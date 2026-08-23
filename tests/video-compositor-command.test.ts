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
  it("contains both inputs, a positioned circular picture-in-picture overlay, and normalized source plus microphone audio", () => {
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
    expect(command.filter).toContain("[reaction_rgba][reaction_alpha]alphamerge[reaction]");
    expect(command.filter).toContain("amix=inputs=2:duration=longest:dropout_transition=0:normalize=1[audio]");
    expect(command.filter).toContain("pad=720:1280");
    expect(command.filter).toContain("[0:v]scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1[background]");
    expect(command.filter).toContain("[1:v]scale=200:200:force_original_aspect_ratio=increase,crop=200:200,setsar=1,format=rgba[reaction_rgba]");
    expect(command.filter).not.toContain(";setsar=1");
  });

  it("can render a square or a green-screen keyed reaction layer without the circular alpha mask", () => {
    const baseRequest = {
      sourcePath: "file:///cache/source.mp4",
      reactionPath: "file:///cache/reaction.mp4",
      outputPath: "file:///cache/output.mp4",
      overlay: { x: 20, y: 80, size: 132 },
      studioSize: { width: 390, height: 844 },
    };

    expect(buildCompositeCommand({ ...baseRequest, overlayStyle: "square" }).filter).toContain("setsar=1[reaction]");
    expect(buildCompositeCommand({ ...baseRequest, overlayStyle: "green-screen" }).filter).toContain("chromakey=0x00FF00:0.18:0.08[reaction]");
  });

  it("freezes the background and inserts silent source audio when the creator pauses the reel to talk", () => {
    const command = buildCompositeCommand({
      sourcePath: "file:///cache/source.mp4",
      reactionPath: "file:///cache/reaction.mp4",
      outputPath: "file:///cache/output.mp4",
      overlay: { x: 20, y: 80, size: 132 },
      studioSize: { width: 390, height: 844 },
      sourcePauses: [{ sourceTimeSec: 4.25, durationSec: 3.5 }],
    });

    expect(command.filter).toContain("trim=start=0:end=4.25");
    expect(command.filter).toContain("tpad=stop_mode=clone:stop_duration=3.5");
    expect(command.filter).toContain("anullsrc=channel_layout=stereo:sample_rate=48000,atrim=duration=3.5");
    expect(command.filter).toContain("concat=n=2:v=1:a=0[background]");
    expect(command.filter).toContain("concat=n=3:v=0:a=1[source_audio]");
  });
});
