import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import path from "path";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Social media and direct video extraction endpoint
  app.post("/api/import-media", async (req, res) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      res.status(400).json({ error: "Please provide a valid video link." });
      return;
    }
    try {
      const { extractSocialVideo } = await import("../social-importer");
      const result = await extractSocialVideo(url);
      const streamUrl = `/api/proxy-media?url=${encodeURIComponent(result.url)}`;
      res.json({
        success: true,
        streamUrl,
        directUrl: result.url,
        title: result.title,
        platform: result.platform,
        thumbnail: result.thumbnail,
        duration: result.duration,
      });
    } catch (err: unknown) {
      console.error("[import-media error]", err);
      const message = err instanceof Error ? err.message : "Could not import video from this link.";
      res.status(422).json({ error: message });
    }
  });

  // High-performance streaming proxy for social video streams with Range request and CORS support
  app.get("/api/proxy-media", async (req, res) => {
    const rawTarget = req.query.url;
    if (!rawTarget || typeof rawTarget !== "string") {
      res.status(400).send("Missing target URL");
      return;
    }
    try {
      const targetUrl = decodeURIComponent(rawTarget);
      const axios = (await import("axios")).default;
      let origin = "";
      try {
        origin = new URL(targetUrl).origin;
      } catch {}

      const headers: Record<string, string> = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "*/*",
      };
      if (origin) {
        headers["Referer"] = origin;
      }
      if (req.headers.range) {
        headers["Range"] = req.headers.range;
      }

      const response = await axios({
        method: "GET",
        url: targetUrl,
        responseType: "stream",
        headers,
        timeout: 25000,
        maxRedirects: 5,
        validateStatus: (status) => status < 400,
      });

      res.status(response.status);
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Cross-Origin-Resource-Policy", "cross-origin");
      
      const copyHeaders = [
        "content-type",
        "content-length",
        "content-range",
        "accept-ranges",
        "last-modified",
        "etag",
      ];
      for (const h of copyHeaders) {
        if (response.headers[h]) {
          res.header(h, response.headers[h]);
        }
      }
      if (!response.headers["content-type"]) {
        res.header("Content-Type", "video/mp4");
      }
      if (!response.headers["accept-ranges"]) {
        res.header("Accept-Ranges", "bytes");
      }

      req.on("close", () => {
        if (response.data && typeof response.data.destroy === "function") {
          response.data.destroy();
        }
      });

      response.data.pipe(res);
    } catch (err: unknown) {
      console.error("[proxy-media error]", err);
      if (!res.headersSent) {
        res.status(502).send("Could not stream remote media");
      }
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  // Serve static files and frontend entry point
  const rootDir = process.cwd();
  app.use(express.static(rootDir));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(rootDir, "index.html"));
  });

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, "0.0.0.0", () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);

