import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { getCurrentSource, setCurrentReaction } from "@/lib/reaction-session";

const OUTPUT_WIDTH = 720;
const OUTPUT_HEIGHT = 1280;
const MIN_OVERLAY_SIZE = 96;
const MAX_OVERLAY_SIZE = 280;

type Overlay = { x: number; y: number; size: number };

function clampOverlay(overlay: Overlay): Overlay {
  const size = Math.max(MIN_OVERLAY_SIZE, Math.min(MAX_OVERLAY_SIZE, overlay.size));
  return {
    size,
    x: Math.max(0, Math.min(OUTPUT_WIDTH - size, overlay.x)),
    y: Math.max(0, Math.min(OUTPUT_HEIGHT - size, overlay.y)),
  };
}

function preferredMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function drawContained(context: CanvasRenderingContext2D, video: HTMLVideoElement) {
  const sourceWidth = video.videoWidth || OUTPUT_WIDTH;
  const sourceHeight = video.videoHeight || OUTPUT_HEIGHT;
  const scale = Math.min(OUTPUT_WIDTH / sourceWidth, OUTPUT_HEIGHT / sourceHeight);
  const width = sourceWidth * scale;
  const height = sourceHeight * scale;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
  context.drawImage(video, (OUTPUT_WIDTH - width) / 2, (OUTPUT_HEIGHT - height) / 2, width, height);
}

export default function DesktopReactionRecordScreen() {
  const source = getCurrentSource();
  const sourceVideoRef = useRef<HTMLVideoElement>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const sourceAudioRef = useRef<MediaElementAudioSourceNode | null>(null);
  const microphoneAudioRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const sourceGainRef = useRef<GainNode | null>(null);
  const micGainRef = useRef<GainNode | null>(null);
  const frameRef = useRef<number | null>(null);
  const drawSceneRef = useRef<() => void>(() => undefined);
  const chunksRef = useRef<Blob[]>([]);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  const [cameraReady, setCameraReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [status, setStatus] = useState("Choose Enable webcam to prepare your desktop reaction studio.");
  const [overlay, setOverlay] = useState<Overlay>({ x: 486, y: 120, size: 180 });
  const [isSourcePaused, setIsSourcePaused] = useState(false);
  const [bgVolume, setBgVolume] = useState(0.25);
  const [micVolume, setMicVolume] = useState(1.4);

  useEffect(() => {
    if (!source) router.replace("/");
  }, [source]);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioContextRef.current?.close().catch(() => undefined);
    };
  }, []);

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    const sourceVideo = sourceVideoRef.current;
    const cameraVideo = cameraVideoRef.current;
    if (!canvas || !sourceVideo) return;

    const context = canvas.getContext("2d");
    if (!context) return;
    drawContained(context, sourceVideo);

    if (cameraVideo?.readyState && cameraVideo.videoWidth) {
      context.save();
      context.beginPath();
      context.arc(overlay.x + overlay.size / 2, overlay.y + overlay.size / 2, overlay.size / 2, 0, Math.PI * 2);
      context.clip();
      context.translate(overlay.x + overlay.size, overlay.y);
      context.scale(-1, 1);
      context.drawImage(cameraVideo, 0, 0, overlay.size, overlay.size);
      context.restore();
      context.lineWidth = 8;
      context.strokeStyle = "#FFFFFF";
      context.beginPath();
      context.arc(overlay.x + overlay.size / 2, overlay.y + overlay.size / 2, overlay.size / 2 - 4, 0, Math.PI * 2);
      context.stroke();
    }

    frameRef.current = requestAnimationFrame(() => drawSceneRef.current());
  }, [overlay]);

  useEffect(() => {
    drawSceneRef.current = drawScene;
  }, [drawScene]);

  useEffect(() => {
    if (sourceVideoRef.current?.readyState) drawScene();
  }, [drawScene]);

  async function enableCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("This browser cannot access a webcam. Use a current desktop Chrome, Edge, or Firefox browser.");
      return;
    }
    setPreparing(true);
    setStatus("Requesting webcam and microphone access…");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = stream;
      if (cameraVideoRef.current) {
        cameraVideoRef.current.srcObject = stream;
        await cameraVideoRef.current.play();
      }
      setCameraReady(true);
      setStatus("Webcam and microphone are ready. Drag the bubble, scroll over it to resize, then Start recording.");
      drawScene();
    } catch (error) {
      setStatus(`Webcam or microphone access failed: ${error instanceof Error ? error.message : "unknown browser error"}`);
    } finally {
      setPreparing(false);
    }
  }

  async function ensureAudioGraph() {
    const sourceVideo = sourceVideoRef.current;
    const cameraStream = cameraStreamRef.current;
    if (!sourceVideo || !cameraStream) throw new Error("The source video or webcam is not ready.");

    const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const AudioContextClass = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) throw new Error("This browser cannot mix source and microphone audio.");
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    const destination = audioDestinationRef.current ?? context.createMediaStreamDestination();
    audioDestinationRef.current = destination;

    const compressor = context.createDynamicsCompressor();
    compressor.threshold.setValueAtTime(-12, context.currentTime);
    compressor.ratio.setValueAtTime(3.5, context.currentTime);
    compressor.connect(destination);

    if (!sourceGainRef.current) {
      const sGain = context.createGain();
      sGain.gain.value = bgVolume;
      sourceGainRef.current = sGain;
      sGain.connect(compressor);
      sGain.connect(context.destination);
    } else {
      sourceGainRef.current.gain.value = bgVolume;
    }

    if (!micGainRef.current) {
      const hp = context.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.setValueAtTime(80, context.currentTime);

      const mGain = context.createGain();
      mGain.gain.value = micVolume;
      micGainRef.current = mGain;

      hp.connect(mGain);
      mGain.connect(compressor);

      const micSource = context.createMediaStreamSource(cameraStream);
      microphoneAudioRef.current = micSource;
      micSource.connect(hp);
    } else {
      micGainRef.current.gain.value = micVolume;
    }

    if (!sourceAudioRef.current) {
      sourceAudioRef.current = context.createMediaElementSource(sourceVideo);
      sourceAudioRef.current.connect(sourceGainRef.current);
    }
    if (context.state === "suspended") await context.resume();
    return destination;
  }

  function handleBgVolumeChange(val: number) {
    setBgVolume(val);
    if (sourceGainRef.current && audioContextRef.current) {
      sourceGainRef.current.gain.setValueAtTime(val, audioContextRef.current.currentTime);
    }
  }

  function handleMicVolumeChange(val: number) {
    setMicVolume(val);
    if (micGainRef.current && audioContextRef.current) {
      micGainRef.current.gain.setValueAtTime(val, audioContextRef.current.currentTime);
    }
  }

  async function startRecording() {
    const sourceVideo = sourceVideoRef.current;
    const canvas = canvasRef.current;
    if (!cameraReady || !cameraStreamRef.current || !sourceVideo || !canvas) {
      setStatus("Enable webcam first, then wait for the source video preview to load.");
      return;
    }
    if (typeof MediaRecorder === "undefined" || !canvas.captureStream) {
      setStatus("This browser does not support desktop video export. Use current Chrome or Edge.");
      return;
    }

    setPreparing(true);
    setStatus("Preparing clean combined desktop recording…");
    try {
      const destination = await ensureAudioGraph();
      sourceVideo.currentTime = 0;
      await sourceVideo.play();
      if (frameRef.current === null) drawScene();

      const visualStream = canvas.captureStream(30);
      const stream = new MediaStream([
        ...visualStream.getVideoTracks(),
        ...destination.stream.getAudioTracks(),
      ]);
      const mimeType = preferredMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 }) : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => setStatus("Desktop recording failed in the browser. No camera-only output was created.");
      recorder.onstop = () => {
        if (frameRef.current !== null) {
          cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
        sourceVideo.pause();
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
        if (blob.size < 1_024) {
          setStatus("Desktop recording stopped without enough video data. Try again after the source preview starts.");
          setRecording(false);
          return;
        }
        const outputUri = URL.createObjectURL(blob);
        setCurrentReaction({ uri: outputUri, recordedAt: Date.now(), isComposite: true });
        setRecording(false);
        setStatus("Combined desktop reaction created. Opening review…");
        router.replace("/review" as never);
      };
      setIsSourcePaused(false);
      recorder.start(1_000);
      setRecording(true);
      setStatus("Recording the source video, webcam bubble, and mixed audio. You can pause the background clip anytime to speak.");
    } catch (error) {
      setStatus(`Could not start combined desktop recording: ${error instanceof Error ? error.message : "unknown browser error"}`);
    } finally {
      setPreparing(false);
    }
  }

  function toggleSourcePause() {
    const sourceVideo = sourceVideoRef.current;
    if (!recording || !sourceVideo) return;
    if (isSourcePaused) {
      sourceVideo.play().then(() => {
        setIsSourcePaused(false);
        setStatus("Background clip resumed while reaction recording continues.");
      }).catch((e) => {
        setStatus(`Could not resume clip: ${e instanceof Error ? e.message : "error"}`);
      });
    } else {
      sourceVideo.pause();
      setIsSourcePaused(true);
      setStatus("Background clip paused. Your webcam and microphone are still recording so you can talk over this moment.");
    }
  }

  function stopRecording() {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") return;
    setIsSourcePaused(false);
    setStatus("Finalizing your combined reaction video…");
    mediaRecorderRef.current.stop();
  }

  function moveBubble(event: React.PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId) || !stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    const next = clampOverlay({
      ...overlay,
      x: ((event.clientX - bounds.left) / bounds.width) * OUTPUT_WIDTH - dragOffsetRef.current.x,
      y: ((event.clientY - bounds.top) / bounds.height) * OUTPUT_HEIGHT - dragOffsetRef.current.y,
    });
    setOverlay(next);
  }

  function startMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!stageRef.current) return;
    const bounds = stageRef.current.getBoundingClientRect();
    dragOffsetRef.current = {
      x: ((event.clientX - bounds.left) / bounds.width) * OUTPUT_WIDTH - overlay.x,
      y: ((event.clientY - bounds.top) / bounds.height) * OUTPUT_HEIGHT - overlay.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function resizeBubble(event: React.WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    setOverlay((current) => clampOverlay({ ...current, size: current.size - event.deltaY * 0.45 }));
  }

  if (!source) return null;

  return (
    <main style={styles.page}>
      <section style={styles.content}>
        <header style={styles.header}>
          <div>
            <div style={styles.eyebrow}>DESKTOP REACTION STUDIO</div>
            <h1 style={styles.title}>React while the video rolls.</h1>
            <p style={styles.subtitle}>Your exported file contains the source clip, webcam bubble, source audio, and microphone audio.</p>
          </div>
          <button type="button" onClick={() => router.replace("/")} style={styles.backButton}>Change video</button>
        </header>

        <div style={styles.studioGrid}>
          <div>
            <div ref={stageRef} style={styles.stage}>
              <video ref={sourceVideoRef} src={source.uri} onCanPlay={drawScene} playsInline style={styles.sourcePreview} />
              <div
                style={{
                  ...styles.cameraBubble,
                  left: `${(overlay.x / OUTPUT_WIDTH) * 100}%`,
                  top: `${(overlay.y / OUTPUT_HEIGHT) * 100}%`,
                  width: `${(overlay.size / OUTPUT_WIDTH) * 100}%`,
                  height: `${(overlay.size / OUTPUT_HEIGHT) * 100}%`,
                }}
                onPointerDown={startMove}
                onPointerMove={moveBubble}
                onPointerUp={(event) => event.currentTarget.releasePointerCapture(event.pointerId)}
                onWheel={resizeBubble}
              >
                <video ref={cameraVideoRef} muted playsInline style={{ ...styles.cameraPreview, display: cameraReady ? "block" : "none" }} />
                {!cameraReady ? <span style={styles.cameraPlaceholder}>Enable webcam</span> : null}
              </div>
              <span style={styles.dragHint}>Drag to move · scroll to resize</span>
            </div>
            <canvas ref={canvasRef} width={OUTPUT_WIDTH} height={OUTPUT_HEIGHT} style={styles.hiddenCanvas} />
          </div>

          <aside style={styles.controls}>
            <div style={styles.sourceCard}>
              <span style={styles.sourceLabel}>SOURCE VIDEO</span>
              <strong style={styles.sourceName}>{source.name}</strong>
              <span style={styles.sourceNote}>Local file · never uploaded</span>
            </div>

            <div style={styles.volumeCard}>
              <span style={styles.sourceLabel}>AUDIO MIXER</span>
              <div style={styles.volumeRow}>
                <div style={styles.volumeHeaderRow}>
                  <label htmlFor="web-bg-volume" style={styles.volumeLabelText}>Background Reel Volume</label>
                  <span style={styles.volumeValText}>{Math.round(bgVolume * 100)}%</span>
                </div>
                <input
                  id="web-bg-volume"
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={bgVolume}
                  onChange={(e) => handleBgVolumeChange(parseFloat(e.target.value))}
                  style={styles.slider}
                />
              </div>

              <div style={styles.volumeRow}>
                <div style={styles.volumeHeaderRow}>
                  <label htmlFor="web-mic-volume" style={styles.volumeLabelText}>Reaction Mic Volume</label>
                  <span style={styles.volumeValText}>{Math.round((micVolume / 1.4) * 100)}%</span>
                </div>
                <input
                  id="web-mic-volume"
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.05"
                  value={micVolume}
                  onChange={(e) => handleMicVolumeChange(parseFloat(e.target.value))}
                  style={styles.slider}
                />
              </div>
              <span style={styles.volumeHint}>Adjust the audio levels to keep your reaction voice clear over the background clip.</span>
            </div>

            <button type="button" disabled={cameraReady || preparing || recording} onClick={enableCamera} style={{ ...styles.secondaryButton, ...(cameraReady || preparing || recording ? styles.disabledButton : {}) }}>
              {cameraReady ? "Webcam ready" : preparing ? "Preparing webcam…" : "Enable webcam + microphone"}
            </button>

            {recording ? (
              <button type="button" onClick={toggleSourcePause} style={styles.pauseButton}>
                {isSourcePaused ? "▶️ Resume background reel" : "⏸️ Pause background reel (Keep talking)"}
              </button>
            ) : null}

            <button type="button" disabled={!cameraReady || preparing} onClick={recording ? stopRecording : startRecording} style={{ ...styles.primaryButton, ...(!cameraReady || preparing ? styles.disabledButton : {}), ...(recording ? styles.stopButton : {}) }}>
              {recording ? "⏹️ Finish & Get Combined Video" : "Start recording"}
            </button>
            <div style={styles.statusCard}>
              <span style={styles.statusDot} />
              <span>{status}</span>
            </div>
            <p style={styles.browserNote}>Desktop export uses your browser’s recorder. Chrome and Edge export a downloadable WebM file; the phone build continues to export MP4.</p>
          </aside>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { minHeight: "100vh", background: "#0C1018", color: "#F7F8FA", fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif" },
  content: { width: "min(1220px, calc(100% - 48px))", margin: "0 auto", padding: "42px 0 58px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 28, marginBottom: 30 },
  eyebrow: { color: "#FF8A6B", fontSize: 11, fontWeight: 800, letterSpacing: "0.12em", marginBottom: 10 },
  title: { fontSize: "clamp(32px, 4vw, 52px)", margin: 0, letterSpacing: "-0.05em", lineHeight: 1 },
  subtitle: { maxWidth: 620, color: "#AAB3C2", fontSize: 16, lineHeight: 1.5, margin: "14px 0 0" },
  backButton: { background: "transparent", border: "1px solid #465267", borderRadius: 12, color: "#F7F8FA", cursor: "pointer", fontWeight: 700, padding: "12px 15px" },
  studioGrid: { display: "grid", gridTemplateColumns: "minmax(330px, 650px) minmax(280px, 1fr)", alignItems: "start", gap: 28 },
  stage: { position: "relative", overflow: "hidden", width: "100%", aspectRatio: "9 / 16", maxHeight: "calc(100vh - 210px)", background: "#000", borderRadius: 24, border: "1px solid #283244", boxShadow: "0 30px 80px rgba(0,0,0,0.35)" },
  sourcePreview: { width: "100%", height: "100%", objectFit: "contain", background: "#000" },
  cameraBubble: { position: "absolute", display: "grid", placeItems: "center", overflow: "hidden", borderRadius: "50%", border: "4px solid #FFFFFF", background: "#171E2B", cursor: "grab", touchAction: "none", boxShadow: "0 12px 34px rgba(0,0,0,0.5)" },
  cameraPreview: { width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)", pointerEvents: "none" },
  cameraPlaceholder: { color: "#FFB199", fontWeight: 800, fontSize: 12, textAlign: "center", padding: 10 },
  dragHint: { position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 16, borderRadius: 999, background: "rgba(12,16,24,0.76)", color: "#FFFFFF", fontSize: 12, fontWeight: 700, padding: "8px 12px", pointerEvents: "none" },
  hiddenCanvas: { display: "none" },
  controls: { display: "grid", gap: 12, position: "sticky", top: 28 },
  sourceCard: { display: "grid", gap: 6, padding: 18, background: "#171E2B", border: "1px solid #283244", borderRadius: 18 },
  sourceLabel: { color: "#8792A3", fontSize: 11, fontWeight: 800, letterSpacing: "0.1em" },
  sourceName: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 15 },
  sourceNote: { color: "#AAB3C2", fontSize: 12 },
  volumeCard: { display: "grid", gap: 12, padding: 18, background: "#171E2B", border: "1px solid #283244", borderRadius: 18 },
  volumeRow: { display: "grid", gap: 6 },
  volumeHeaderRow: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  volumeLabelText: { fontSize: 13, fontWeight: 700, color: "#E1E7F0" },
  volumeValText: { fontSize: 13, fontWeight: 800, color: "#FF8A6B" },
  slider: { width: "100%", accentColor: "#FF5C35", cursor: "pointer", height: 6 },
  volumeHint: { color: "#8792A3", fontSize: 11, lineHeight: 1.4 },
  primaryButton: { width: "100%", border: 0, borderRadius: 16, background: "#FF5C35", color: "#FFFFFF", cursor: "pointer", fontSize: 16, fontWeight: 900, padding: "17px 18px" },
  pauseButton: { width: "100%", border: "1px solid #FF8A6B", borderRadius: 16, background: "#2A1813", color: "#FFB199", cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "15px 18px" },
  secondaryButton: { width: "100%", border: "1px solid #465267", borderRadius: 16, background: "#171E2B", color: "#F7F8FA", cursor: "pointer", fontSize: 15, fontWeight: 800, padding: "16px 18px" },
  stopButton: { background: "#FFFFFF", color: "#D84325" },
  disabledButton: { cursor: "not-allowed", opacity: 0.46 },
  statusCard: { display: "flex", gap: 10, alignItems: "flex-start", padding: 14, borderRadius: 14, background: "#121823", color: "#C1C9D4", fontSize: 13, lineHeight: 1.45 },
  statusDot: { flex: "0 0 auto", width: 8, height: 8, borderRadius: "50%", background: "#36C98A", marginTop: 5 },
  browserNote: { color: "#8792A3", fontSize: 12, lineHeight: 1.55, margin: "2px 2px 0" },
};
