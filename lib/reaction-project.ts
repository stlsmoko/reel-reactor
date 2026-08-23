export type OverlayPosition = {
  x: number;
  y: number;
};

export function validateSourceVideo(input: {
  uri?: string | null;
  type?: string | null;
  duration?: number | null;
}): string | null {
  if (!input.uri) return "Choose a video before opening the studio.";
  if (input.type && input.type !== "video") return "Choose a video file rather than an image.";
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

export function getRecordingStartBlocker(input: {
  platform: string;
  cameraReady: boolean;
  hasCameraRef: boolean;
}): string | null {
  if (input.platform === "web") {
    return "Browser preview cannot record a reaction. Open Reel Reactor in the Android or iPhone build to record with camera and microphone.";
  }
  if (!input.cameraReady || !input.hasCameraRef) {
    return "Camera preview is not ready yet. Wait for Ready to react, then tap Start recording.";
  }
  return null;
}

export function beginReactionCameraRecording<T>(input: {
  startCameraRecording: () => Promise<T>;
  startSourcePlayback: () => void | Promise<void>;
  onSourcePlaybackIssue: () => void;
}): Promise<T> {
  const recordingPromise = input.startCameraRecording();
  try {
    Promise.resolve(input.startSourcePlayback()).catch(input.onSourcePlaybackIssue);
  } catch {
    input.onSourcePlaybackIssue();
  }
  return recordingPromise;
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
