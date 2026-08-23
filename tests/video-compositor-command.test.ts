import { describe, expect, it } from "vitest";

import { buildCompositeCommand, getOutputOverlay } from "../lib/video-compositor-command";

describe("composite command geometry", () => {
  it("maps the portrait studio bubble to the 720 by 1280 export canvas", () => {
    expect(getOutputOverlay({
      overlay: { x: 236, y: 126, size: 132 },
      studioSize: { width: 390, height: 844 },
    })).toEqual({ x: 436, y: 191, size: 200 });
  });
});

describe("composite command", () => {
  it("contains both inputs, a positioned picture-in-picture overlay, and mixed source plus microphone audio", () => {
    const command = buildCompositeCommand({
      sourcePath: "file:///cache/source.mp4",
      reactionPath: "file:///cache/reaction.mp4",
      outputPath: "file:///cache/output.mp4",
      overlay: { x: 20, y: 80, size: 132 },
      studioSize: { width: 390, height: 844 },
    });

    expect(command.args).toEqual(expect.arrayContaining([
      "-i", "file:///cache/source.mp4",
      "-i", "file:///cache/reaction.mp4",
      "-map", "[video]",
      "-map", "[audio]",
      "file:///cache/output.mp4",
    ]));
    expect(command.filter).toContain("[background][reaction]overlay=");
    expect(command.filter).toContain("[0:a][1:a]amix=inputs=2:duration=shortest");
    expect(command.filter).toContain("pad=720:1280");
    expect(command.filter).toContain("[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[background]");
    expect(command.filter).toContain("[1:v]scale=200:200:force_original_aspect_ratio=increase,crop=200:200,setsar=1[reaction]");
    expect(command.filter).not.toContain(";setsar=1");
  });
});
