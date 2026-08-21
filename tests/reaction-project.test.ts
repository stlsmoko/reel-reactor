import { describe, expect, it } from "vitest";

import { clampOverlay, MAX_SOURCE_DURATION_MS, normalizeSharedLink, validateSourceVideo } from "../lib/reaction-project";

describe("source video validation", () => {
  it("requires a local video URI", () => {
    expect(validateSourceVideo({ uri: null })).toBe("Choose a video before opening the studio.");
  });

  it("limits the personal MVP to a practical source duration", () => {
    expect(validateSourceVideo({ uri: "file:///clip.mov", type: "video", duration: MAX_SOURCE_DURATION_MS + 1 })).toContain("under three minutes");
  });

  it("accepts a valid local video", () => {
    expect(validateSourceVideo({ uri: "file:///clip.mov", type: "video", duration: 30_000 })).toBeNull();
  });
});

describe("reaction overlay bounds", () => {
  it("keeps the overlay inside the studio control-safe area", () => {
    expect(clampOverlay({ x: -20, y: 999 }, { width: 390, height: 844 }, 132)).toEqual({ x: 16, y: 572 });
  });
});

describe("shared-link intake", () => {
  it("accepts a copied HTTP URL", () => {
    expect(normalizeSharedLink(" https://www.instagram.com/reel/example ")).toBe("https://www.instagram.com/reel/example");
  });

  it("does not treat non-web content as a shareable social link", () => {
    expect(normalizeSharedLink("reelreactor://shared-link")).toBeNull();
  });
});
