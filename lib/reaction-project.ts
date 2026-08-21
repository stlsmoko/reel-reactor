export type OverlayPosition = {
  x: number;
  y: number;
};

export const MAX_SOURCE_DURATION_MS = 180_000;

export function validateSourceVideo(input: {
  uri?: string | null;
  type?: string | null;
  duration?: number | null;
}): string | null {
  if (!input.uri) return "Choose a video before opening the studio.";
  if (input.type && input.type !== "video") return "Choose a video file rather than an image.";
  if (input.duration && input.duration > MAX_SOURCE_DURATION_MS) {
    return "For the first version, choose a clip under three minutes.";
  }
  return null;
}

export function normalizeSharedLink(value: string): string | null {
  const candidate = value.trim();
  try {
    const parsed = new URL(candidate);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export function clampOverlay(
  position: OverlayPosition,
  bounds: { width: number; height: number },
  overlaySize: number,
): OverlayPosition {
  const horizontalInset = 16;
  const topInset = 96;
  const bottomInset = 140;
  return {
    x: Math.max(horizontalInset, Math.min(position.x, Math.max(horizontalInset, bounds.width - overlaySize - horizontalInset))),
    y: Math.max(topInset, Math.min(position.y, Math.max(topInset, bounds.height - overlaySize - bottomInset))),
  };
}
