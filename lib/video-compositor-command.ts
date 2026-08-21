export type CompositeGeometry = {
  overlay: { x: number; y: number; size: number };
  studioSize: { width: number; height: number };
};

const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1280;

export function getOutputOverlay({ overlay, studioSize }: CompositeGeometry) {
  const scaleX = OUTPUT_WIDTH / studioSize.width;
  const scaleY = OUTPUT_HEIGHT / studioSize.height;
  const sizeScale = Math.min(scaleX, scaleY);

  return {
    x: Math.max(0, Math.round(overlay.x * scaleX)),
    y: Math.max(0, Math.round(overlay.y * scaleY)),
    size: Math.max(80, Math.round(overlay.size * sizeScale)),
  };
}

export function buildCompositeCommand(
  request: CompositeGeometry & { sourcePath: string; reactionPath: string; outputPath: string },
) {
  const overlay = getOutputOverlay(request);
  const filter = [
    `[0:v]scale=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:force_original_aspect_ratio=decrease`,
    `pad=${OUTPUT_WIDTH}:${OUTPUT_HEIGHT}:(ow-iw)/2:(oh-ih)/2:color=black`,
    "setsar=1[background]",
    `[1:v]scale=${overlay.size}:${overlay.size}:force_original_aspect_ratio=increase`,
    `crop=${overlay.size}:${overlay.size},setsar=1[reaction]`,
    `[background][reaction]overlay=${overlay.x}:${overlay.y}:shortest=1[video]`,
    "[0:a][1:a]amix=inputs=2:duration=shortest:dropout_transition=0[audio]",
  ].join(";");

  return {
    filter,
    args: [
      "-y",
      "-i", request.sourcePath,
      "-i", request.reactionPath,
      "-filter_complex", filter,
      "-map", "[video]",
      "-map", "[audio]",
      "-c:v", "mpeg4",
      "-q:v", "4",
      "-pix_fmt", "yuv420p",
      "-c:a", "aac",
      "-shortest",
      request.outputPath,
    ],
  };
}
