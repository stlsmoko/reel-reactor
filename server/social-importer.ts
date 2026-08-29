import axios from "axios";

export type ExtractedVideo = {
  url: string;
  title: string;
  thumbnail?: string;
  platform: string;
  duration?: number;
};

const COMMON_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BOT_USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";

/**
 * Normalizes input URLs (Google Drive, Dropbox, Imgur, Giphy, etc.) into direct video stream URLs
 */
function normalizeDirectMediaUrl(rawUrl: string): { url: string; platform: string } | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname;

    // 1. Google Drive direct download
    if (host.includes("drive.google.com")) {
      const match = path.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || parsed.searchParams.get("id");
      const fileId = typeof match === "string" ? match : match ? match[1] : null;
      if (fileId) {
        return {
          url: `https://drive.google.com/uc?export=download&id=${fileId}`,
          platform: "Google Drive",
        };
      }
    }

    // 2. Dropbox direct download
    if (host.includes("dropbox.com")) {
      parsed.searchParams.set("dl", "1");
      return {
        url: parsed.toString(),
        platform: "Dropbox",
      };
    }

    // 3. Imgur direct video
    if (host.includes("imgur.com")) {
      const idMatch = path.match(/\/([a-zA-Z0-9]+)(?:\.[a-z0-9]+)?$/);
      if (idMatch && idMatch[1] && !path.includes("gallery")) {
        return {
          url: `https://i.imgur.com/${idMatch[1]}.mp4`,
          platform: "Imgur",
        };
      }
    }

    // 4. Giphy direct MP4
    if (host.includes("giphy.com")) {
      const idMatch = path.match(/gifs\/(?:.*-)?([a-zA-Z0-9]+)$/);
      if (idMatch && idMatch[1]) {
        return {
          url: `https://media.giphy.com/media/${idMatch[1]}/giphy.mp4`,
          platform: "Giphy",
        };
      }
    }

    // 5. Direct video extensions
    if (/\.(mp4|webm|mov|m4v|ogv)(?:\?.*)?$/i.test(path)) {
      return {
        url: rawUrl,
        platform: "Direct Video",
      };
    }
  } catch {
    // Ignore URL parse error
  }
  return null;
}

/**
 * Resolves short links to their canonical destination URL
 */
async function resolveCanonicalUrl(url: string): Promise<string> {
  try {
    const res = await axios.get(url, {
      maxRedirects: 5,
      timeout: 6000,
      headers: { "User-Agent": COMMON_USER_AGENT },
      validateStatus: (status) => status >= 200 && status < 400,
    });
    return res.request?.res?.responseUrl || res.config?.url || url;
  } catch {
    return url;
  }
}

export async function extractSocialVideo(rawUrl: string): Promise<ExtractedVideo> {
  const inputUrl = rawUrl.trim();
  if (!inputUrl) {
    throw new Error("Please provide a valid video link.");
  }

  // Check smart normalized direct links first (Google Drive, Dropbox, Imgur, Giphy, .mp4, .webm)
  const normalized = normalizeDirectMediaUrl(inputUrl);
  if (normalized) {
    return {
      url: normalized.url,
      title: "Direct Video Clip",
      platform: normalized.platform,
    };
  }

  // Resolve short links (vm.tiktok.com, t.co, bit.ly, youtu.be, fb.watch)
  const url = await resolveCanonicalUrl(inputUrl);
  const hostname = new URL(url).hostname.toLowerCase();

  // 1. X / Twitter (x.com / twitter.com)
  if (hostname.includes("twitter.com") || hostname.includes("x.com") || hostname.includes("t.co")) {
    const match = url.match(/(?:status|statuses)\/(\d+)/i);
    if (match && match[1]) {
      const tweetId = match[1];
      // Try FxTwitter API
      try {
        const resp = await axios.get(`https://api.fxtwitter.com/status/${tweetId}`, {
          timeout: 8000,
          headers: { "User-Agent": BOT_USER_AGENT },
        });
        const tweet = resp.data?.tweet;
        if (tweet?.media?.videos && tweet.media.videos.length > 0) {
          const video = tweet.media.videos[0];
          return {
            url: video.url,
            title: tweet.text ? tweet.text.slice(0, 80) : "X / Twitter Post",
            thumbnail: video.thumbnail_url || tweet.media.photos?.[0]?.url,
            platform: "X / Twitter",
            duration: video.duration,
          };
        }
      } catch (err) {
        console.warn("[SocialExtractor] fxtwitter error:", err);
      }

      // Try VxTwitter API
      try {
        const resp = await axios.get(`https://api.vxtwitter.com/Twitter/status/${tweetId}`, {
          timeout: 8000,
          headers: { "User-Agent": BOT_USER_AGENT },
        });
        const tweet = resp.data;
        if (tweet?.media_extended && tweet.media_extended.length > 0) {
          const video = tweet.media_extended.find((m: { type: string; url: string }) => m.type === "video");
          if (video && video.url) {
            return {
              url: video.url,
              title: tweet.text ? tweet.text.slice(0, 80) : "X / Twitter Post",
              thumbnail: video.thumbnail_url,
              platform: "X / Twitter",
              duration: video.duration_millis ? Math.round(video.duration_millis / 1000) : undefined,
            };
          }
        }
      } catch (err) {
        console.warn("[SocialExtractor] vxtwitter error:", err);
      }
    }
  }

  // 2. TikTok (tiktok.com / vm.tiktok.com)
  if (hostname.includes("tiktok.com")) {
    // Try TikWM API
    try {
      const resp = await axios.post(
        "https://www.tikwm.com/api/",
        new URLSearchParams({ url, hd: "1" }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": COMMON_USER_AGENT,
          },
          timeout: 10000,
        }
      );
      if (resp.data && resp.data.data && (resp.data.data.play || resp.data.data.wmplay)) {
        const data = resp.data.data;
        const playUrl = data.play || data.wmplay;
        const videoUrl = playUrl.startsWith("http") ? playUrl : `https://www.tikwm.com${playUrl}`;
        return {
          url: videoUrl,
          title: data.title || "TikTok Video",
          thumbnail: data.cover,
          platform: "TikTok",
          duration: data.duration,
        };
      }
    } catch (err) {
      console.warn("[SocialExtractor] TikWM error:", err);
    }

    // Try Lovetik API
    try {
      const resp = await axios.post(
        "https://lovetik.com/api/ajax/search",
        new URLSearchParams({ query: url }).toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": COMMON_USER_AGENT,
          },
          timeout: 8000,
        }
      );
      if (resp.data && resp.data.links && resp.data.links.length > 0) {
        const linkObj = resp.data.links.find((l: { a: string }) => l.a) || resp.data.links[0];
        const vUrl = linkObj?.a;
        if (vUrl) {
          return {
            url: vUrl,
            title: resp.data.desc || "TikTok Video",
            thumbnail: resp.data.cover,
            platform: "TikTok",
          };
        }
      }
    } catch (err) {
      console.warn("[SocialExtractor] Lovetik error:", err);
    }

    // Try btch-downloader ttdl
    try {
      const btch = await import("btch-downloader");
      const ttdl = btch.ttdl || btch.default?.ttdl;
      if (typeof ttdl === "function") {
        const ttData = await ttdl(url);
        const vUrl =
          (Array.isArray(ttData?.video) && ttData.video[0]) ||
          ttData?.video ||
          ttData?.url ||
          ttData?.result;
        if (vUrl && typeof vUrl === "string") {
          return {
            url: vUrl,
            title: ttData.title || "TikTok Video",
            thumbnail: ttData.thumbnail,
            platform: "TikTok",
          };
        }
      }
    } catch (err) {
      console.warn("[SocialExtractor] btch ttdl error:", err);
    }
  }

  // 3. Instagram (instagram.com / instagr.am)
  if (hostname.includes("instagram.com") || hostname.includes("instagr.am")) {
    // Try btch-downloader igdl
    try {
      const btch = await import("btch-downloader");
      const igdl = btch.igdl || btch.default?.igdl;
      if (typeof igdl === "function") {
        const igData = await igdl(url);
        if (Array.isArray(igData) && igData.length > 0) {
          const item = igData[0];
          const mediaUrl = item.url || item.video || item.link;
          if (mediaUrl) {
            return {
              url: mediaUrl,
              title: "Instagram Reel",
              thumbnail: item.thumbnail,
              platform: "Instagram",
            };
          }
        } else if (igData && (igData.url || igData.result)) {
          const mediaUrl = igData.url || (Array.isArray(igData.result) ? igData.result[0]?.url : igData.result);
          if (mediaUrl) {
            return {
              url: mediaUrl,
              title: "Instagram Reel",
              platform: "Instagram",
            };
          }
        }
      }
    } catch (err) {
      console.warn("[SocialExtractor] Instagram btch error:", err);
    }

    // Try ddinstagram metadata parser
    try {
      const ddUrl = url.replace("instagram.com", "ddinstagram.com");
      const ddRes = await axios.get(ddUrl, {
        headers: { "User-Agent": BOT_USER_AGENT },
        timeout: 8000,
      });
      const html = typeof ddRes.data === "string" ? ddRes.data : "";
      const ogVideo = html.match(/<meta\s+property=["']og:video(?::secure_url)?["']\s+content=["']([^"']+)["']/i);
      if (ogVideo && ogVideo[1]) {
        return {
          url: ogVideo[1].replace(/&amp;/g, "&"),
          title: "Instagram Reel",
          platform: "Instagram",
        };
      }
    } catch (err) {
      console.warn("[SocialExtractor] ddinstagram error:", err);
    }
  }

  // 4. YouTube (youtube.com / youtu.be / youtube.com/shorts)
  if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
    try {
      const btch = await import("btch-downloader");
      const youtube = btch.youtube || btch.default?.youtube;
      if (typeof youtube === "function") {
        const ytData = await youtube(url);
        const vUrl = ytData?.mp4 || ytData?.url || ytData?.video || ytData?.result;
        if (vUrl) {
          return {
            url: vUrl,
            title: ytData.title || "YouTube Video",
            thumbnail: ytData.thumbnail,
            platform: "YouTube",
          };
        }
      }
    } catch (err) {
      console.warn("[SocialExtractor] YouTube btch error:", err);
    }
  }

  // 5. Facebook (facebook.com / fb.watch)
  if (hostname.includes("facebook.com") || hostname.includes("fb.watch")) {
    try {
      const btch = await import("btch-downloader");
      const fbdown = btch.fbdown || btch.default?.fbdown;
      if (typeof fbdown === "function") {
        const fbData = await fbdown(url);
        const fbUrl = fbData?.hd || fbData?.sd || fbData?.url || (Array.isArray(fbData) ? fbData[0]?.url : null);
        if (fbUrl) {
          return {
            url: fbUrl,
            title: fbData?.title || "Facebook Video",
            platform: "Facebook",
          };
        }
      }
    } catch (err) {
      console.warn("[SocialExtractor] Facebook btch error:", err);
    }
  }

  // 6. Generic btch-downloader aio fallback
  try {
    const btch = await import("btch-downloader");
    const aio = btch.aio || btch.default?.aio;
    if (typeof aio === "function") {
      const generic = await aio(url);
      if (generic && (generic.url || generic.video || generic.link || generic.medias?.[0]?.url)) {
        return {
          url: generic.url || generic.video || generic.link || generic.medias[0].url,
          title: generic.title || "Shared Video",
          platform: "Social Media",
        };
      }
    }
  } catch {
    // Ignore generic error
  }

  // 7. Universal HTML5 & OpenGraph video scraper (works for blogs, news sites, direct media pages, video CDN sites)
  try {
    const res = await axios.get(url, {
      headers: {
        "User-Agent": COMMON_USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,video/*;q=0.8,*/*;q=0.7",
      },
      timeout: 10000,
      maxRedirects: 5,
    });

    const contentType = res.headers["content-type"] || "";
    if (contentType.includes("video/")) {
      return {
        url,
        title: "Direct Video",
        platform: "Direct Video",
      };
    }

    const html = typeof res.data === "string" ? res.data : "";
    const ogVideoMatch =
      html.match(/<meta\s+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+(?:property|name)=["'](?:og:video|og:video:url|og:video:secure_url|twitter:player:stream)["']/i);
    const ogTitleMatch =
      html.match(/<meta\s+(?:property|name)=["'](?:og:title|twitter:title)["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<title>([^<]+)<\/title>/i);

    if (ogVideoMatch && ogVideoMatch[1]) {
      const decodedUrl = ogVideoMatch[1].replace(/&amp;/g, "&");
      const absUrl = decodedUrl.startsWith("http") ? decodedUrl : new URL(decodedUrl, url).toString();
      return {
        url: absUrl,
        title: ogTitleMatch ? ogTitleMatch[1].replace(/&amp;/g, "&").trim() : "Online Video",
        platform: hostname || "Web Video",
      };
    }

    // Check for raw HTML5 video / source tags in the page
    const videoTagMatch = html.match(/<video[^>]*\ssrc=["']([^"']+)["']/i) || html.match(/<source[^>]*\ssrc=["']([^"']+\.(?:mp4|webm|mov|m4v))["']/i);
    if (videoTagMatch && videoTagMatch[1]) {
      const rawSrc = videoTagMatch[1].replace(/&amp;/g, "&");
      const absUrl = rawSrc.startsWith("http") ? rawSrc : new URL(rawSrc, url).toString();
      return {
        url: absUrl,
        title: ogTitleMatch ? ogTitleMatch[1].replace(/&amp;/g, "&").trim() : "Web Video",
        platform: hostname || "Web Video",
      };
    }
  } catch (err) {
    console.warn("[SocialExtractor] Direct/OG scraper error:", err);
  }

  // Descriptive error message to guide the user
  throw new Error(
    `Could not extract video from this link (${hostname || "url"}). Social networks often require authentication or restrict server-side scraping. You can paste any direct video URL (e.g. MP4, Google Drive, Dropbox, Imgur) or upload the video file directly from your device.`
  );
}
