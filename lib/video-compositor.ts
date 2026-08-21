import * as FileSystem from "expo-file-system/legacy";
import { execute, FFmpegError } from "ffmpeg-expo";

export type CompositeRequest = {
  sourceUri: string;
  reactionUri: string;
  overlay: { x: number; y: number; size: number };
  studioSize: { width: number; height: number };
  onProgress?: (processedMs: number) => void;
};

const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1280;

function getOutputOverlay(request: CompositeRequest) {
  const scaleX = OUTPUT_WIDTH / request.studioSize.width;
  const scaleY = OUTPUT_HEIGHT / request.studioSize.height;
  const scale = Math.min(scaleX, scaleY);
  return {
    x: Math.max(0, Math.round(request.overlay.x * scaleX)),
    y: Math.max(0, Math.round(request.overlay.y * scaleY)),
    size: Math.max(80, Math.round(request.overlay.size * scale)),
  };
}

export async function composeReactionVideo(request: CompositeRequest) {
  const overlay = getOutputOverlay(request);
  const outputUri = `${FileSystem.cacheDirectory}reel-reactor-${Date.now()}.mp4`;
  const filter = [
    `[0:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1[background]",
    `[1:v]scale=${overlay.size}:${overlay.size}:force_original_aspect_ratio=increase`,
    `crop=${overlay.size}:${overlay.size},setsar=1[reaction]`,
    `[background][reaction]overlay=${overlay.x}:${overlay.y}:shortest=1[video]`,
    "[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=0[audio]",
  ].join(";");

  try {
    await execute([
      "-y",
      "-i", request.sourceUri,
      "-i", request.reactionUri,
      "-filter_complex", filter,
      "-map", "[video]",
      "-map", "[audio]",
      "-c:v", "mpeg4",
      "-q:v", "4",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-shortest",
      outputUri,
    ], {
      onProgress: (progress) => request.onProgress?.(progress.time),
      logLevel: "warning",
    });
  } catch (error) {
    if (error instanceof FFmpegError) {
      throw new Error(error.output.trim().slice(-700) || "The device could not render the merged reaction video.");
    }
    throw error;
  }

  const outputInfo = await FileSystem.getInfoAsync(outputUri);
  if (!outputInfo.exists || !outputInfo.size) {
    throw new Error("The merged reaction video was not created on the device.");
  }
  return outputUri;
}
