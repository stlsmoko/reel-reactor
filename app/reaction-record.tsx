import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { clampOverlay, type OverlayPosition } from "@/lib/reaction-project";
import { getCurrentSource, setCurrentReaction } from "@/lib/reaction-session";
import { composeReactionVideo } from "@/lib/video-compositor";

const MIN_OVERLAY_SIZE = 96;
const MAX_OVERLAY_SIZE = 184;

function getTouchDistance(touches: { pageX: number; pageY: number }[]) {
  if (touches.length < 2) return 0;
  const [first, second] = touches;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

export default function ReactionRecordScreen() {
  const source = getCurrentSource();
  const cameraRef = useRef<CameraView>(null);
  const { height, width } = useWindowDimensions();
  const player = useVideoPlayer(source?.uri ?? null, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.audioMixingMode = "auto";
  });
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [microphonePermission, requestMicrophonePermission] = useMicrophonePermissions();
  const [facing, setFacing] = useState<"front" | "back">("front");
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<"permission" | "starting" | "ready" | "error">("permission");
  const [cameraInstanceKey, setCameraInstanceKey] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isCompositing, setIsCompositing] = useState(false);
  const [recordingStatus, setRecordingStatus] = useState("Preparing camera and microphone…");
  const [isCleanScene] = useState(false);
  const [overlaySize, setOverlaySize] = useState(132);
  const [overlayPosition, setOverlayPosition] = useState<OverlayPosition>({ x: width - 154, y: 126 });
  const [overlayGestureStatus, setOverlayGestureStatus] = useState("Drag to move • pinch to resize");
  const dragStart = useRef<OverlayPosition>(overlayPosition);
  const overlayPositionRef = useRef<OverlayPosition>(overlayPosition);
  const overlaySizeRef = useRef(overlaySize);
  const pinchStartSize = useRef(overlaySize);
  const pinchStartDistance = useRef(0);
  const isPinching = useRef(false);

  useEffect(() => {
    if (!source) router.replace("/");
  }, [source]);

  useEffect(() => {
    let isActive = true;

    async function openCameraPreview() {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (isActive) {
          setCameraStatus(permission.granted ? "starting" : "permission");
          setRecordingStatus(permission.granted ? "Opening camera preview…" : "Camera permission is required to record.");
        }
        return;
      }
      setCameraStatus("starting");
      setRecordingStatus("Opening camera preview…");
    }

    openCameraPreview().catch(() => isActive && setCameraStatus("error"));
    return () => { isActive = false; };
  }, [cameraPermission?.granted, requestCameraPermission]);

  useEffect(() => {
    let isActive = true;

    async function prepareMicrophone() {
      if (microphonePermission?.granted) return;
      const permission = await requestMicrophonePermission();
      if (!permission.granted && isActive) {
        setRecordingStatus("Microphone permission is required to record your voice.");
        Alert.alert("Microphone needed", "Allow microphone access now so Start recording can capture your spoken reaction.");
      }
    }

    prepareMicrophone().catch(() => undefined);
    return () => { isActive = false; };
  }, [microphonePermission?.granted, requestMicrophonePermission]);

  useEffect(() => {
    overlayPositionRef.current = overlayPosition;
  }, [overlayPosition]);

  useEffect(() => {
    overlaySizeRef.current = overlaySize;
  }, [overlaySize]);

  // React Native invokes these responder callbacks after a touch event, never during render.
  // eslint-disable-next-line react-hooks/refs
  const overlayResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => !isRecording && !isCompositing,
    onStartShouldSetPanResponderCapture: () => !isRecording && !isCompositing,
    onMoveShouldSetPanResponder: () => !isRecording && !isCompositing,
    onMoveShouldSetPanResponderCapture: () => !isRecording && !isCompositing,
    onPanResponderGrant: (event) => {
      dragStart.current = overlayPositionRef.current;
      pinchStartDistance.current = getTouchDistance(event.nativeEvent.touches);
      pinchStartSize.current = overlaySizeRef.current;
      isPinching.current = pinchStartDistance.current > 0;
      if (pinchStartDistance.current > 0) {
        setOverlayGestureStatus("Resizing camera bubble");
      } else {
        setOverlayGestureStatus("Moving camera bubble");
      }
    },
    onPanResponderMove: (event, gestureState) => {
      const touchDistance = getTouchDistance(event.nativeEvent.touches);

      if (event.nativeEvent.touches.length > 1 && touchDistance > 0) {
        if (!isPinching.current) {
          isPinching.current = true;
          pinchStartDistance.current = touchDistance;
          pinchStartSize.current = overlaySizeRef.current;
          setOverlayGestureStatus("Resizing camera bubble");
          return;
        }
        const baseline = pinchStartDistance.current || touchDistance;
        const nextSize = Math.max(MIN_OVERLAY_SIZE, Math.min(MAX_OVERLAY_SIZE, Math.round(pinchStartSize.current * (touchDistance / baseline))));
        overlaySizeRef.current = nextSize;
        setOverlaySize(nextSize);
        setOverlayPosition((current) => clampOverlay(current, { width, height }, nextSize));
        setOverlayGestureStatus("Resizing camera bubble");
        return;
      }

      if (isPinching.current) return;
      setOverlayPosition(clampOverlay({ x: dragStart.current.x + gestureState.dx, y: dragStart.current.y + gestureState.dy }, { width, height }, overlaySizeRef.current));
      setOverlayGestureStatus("Moving camera bubble");
    },
    onPanResponderRelease: () => {
      isPinching.current = false;
      setOverlayGestureStatus("Camera bubble updated");
    },
    onPanResponderTerminate: () => {
      isPinching.current = false;
      setOverlayGestureStatus("Camera bubble updated");
    },
    onPanResponderTerminationRequest: () => false,
  }), [height, isCompositing, isRecording, width]);

  async function ensurePermissions() {
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const microphone = microphonePermission?.granted ? microphonePermission : await requestMicrophonePermission();
    return camera.granted && microphone.granted;
  }

  async function retryCameraPreview() {
    setIsCameraReady(false);
    setCameraStatus("starting");
    setRecordingStatus("Retrying camera preview…");
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setCameraStatus("permission");
        return;
      }
    }
    setCameraInstanceKey((key) => key + 1);
  }

  async function toggleRecording() {
    if (isRecording) {
      setRecordingStatus("Finishing and saving your reaction…");
      try {
        cameraRef.current?.stopRecording();
      } catch (error) {
        setRecordingStatus(`Could not stop the recording: ${error instanceof Error ? error.message : "unknown camera error"}`);
        setIsRecording(false);
      }
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert("Use a phone for recording", "The studio preview works here, but recording requires the native iPhone or Android build.");
      return;
    }

    setRecordingStatus("Checking camera and microphone permissions…");
    const granted = await ensurePermissions();
    if (!granted) {
      Alert.alert("Camera and microphone needed", "Allow both permissions so Reel Reactor can record your reaction with sound.");
      setRecordingStatus("Camera and microphone permission are required before recording can start.");
      return;
    }
    if (!isCameraReady || !cameraRef.current) {
      setCameraStatus("starting");
      setRecordingStatus("Camera preview is not ready yet. Wait for Ready to react, then try again.");
      Alert.alert("Camera is still opening", "Wait for the top label to say Ready to react, then tap Start recording.");
      return;
    }

    setIsRecording(true);
    setRecordingStatus("Recording reaction now. Tap Stop recording when you are finished.");
    player.replay();
    player.play();
    try {
      const recorded = await cameraRef.current.recordAsync({ maxDuration: 180 });
      if (recorded?.uri) {
        setIsCompositing(true);
        setRecordingStatus("Rendering the merged video: source clip + camera bubble + audio…");
        const compositeUri = await composeReactionVideo({
          sourceUri: source!.uri,
          reactionUri: recorded.uri,
          overlay: { ...overlayPosition, size: overlaySize },
          studioSize: { width, height },
          onProgress: (processedMs) => setRecordingStatus(`Rendering merged video… ${Math.floor(processedMs / 1000)}s processed`),
        });
        setCurrentReaction({ uri: compositeUri, recordedAt: Date.now(), isComposite: true });
        setRecordingStatus("Combined reaction video created. Opening review…");
        router.replace("/review" as never);
      } else {
        setRecordingStatus("The camera stopped without saving a video. Tap Start recording to try again.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown native render error";
      setRecordingStatus(`Merged video failed: ${message}`);
      Alert.alert("Merged video failed", `${message}\n\nNo camera-only file was saved as the final reaction video.`);
    } finally {
      setIsRecording(false);
      setIsCompositing(false);
    }
  }

  if (!source) return null;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} containerClassName="bg-black" safeAreaClassName="bg-black">
      <View style={styles.canvas}>
        <VideoView style={StyleSheet.absoluteFill} player={player} contentFit="contain" nativeControls={false} surfaceType="textureView" />
        <View style={styles.scrim} pointerEvents="none" />

        {!isCleanScene ? <View style={styles.topBar}>
          <Pressable onPress={() => router.back()} disabled={isRecording} hitSlop={12} style={({ pressed }) => [styles.roundControl, (pressed || isRecording) && styles.controlPressed]}>
            <MaterialIcons name="close" size={23} color="#FFFFFF" />
          </Pressable>
          <View style={styles.statusPill}>
            <View style={[styles.statusDot, isRecording && styles.recordingDot]} />
            <Text style={styles.statusLabel}>{isRecording ? "Recording reaction" : cameraStatus === "ready" ? "Ready to react" : "Opening camera"}</Text>
          </View>
          <Pressable onPress={() => {
            setIsCameraReady(false);
            setCameraStatus("starting");
            setCameraInstanceKey((key) => key + 1);
            setFacing((current) => current === "front" ? "back" : "front");
          }} disabled={isRecording} hitSlop={12} style={({ pressed }) => [styles.roundControl, (pressed || isRecording) && styles.controlPressed]}>
            <MaterialIcons name="flip-camera-android" size={22} color="#FFFFFF" />
          </Pressable>
        </View> : null}

        <View collapsable={false} pointerEvents="box-only" {...overlayResponder.panHandlers} style={[styles.reactionOverlay, { borderRadius: overlaySize / 2, height: overlaySize, left: overlayPosition.x, top: overlayPosition.y, width: overlaySize }]}>
            {cameraPermission?.granted ? (
              <>
                <CameraView
                  key={cameraInstanceKey}
                  ref={cameraRef}
                  style={styles.camera}
                  pointerEvents="none"
                  facing={facing}
                  mode="video"
                onCameraReady={() => {
                  setIsCameraReady(true);
                  setCameraStatus("ready");
                  setRecordingStatus("Camera ready. Tap Start recording when you are ready.");
                }}
                onMountError={(error) => {
                  setIsCameraReady(false);
                  setCameraStatus("error");
                  setRecordingStatus(`Camera could not open: ${error.message || "unknown camera error"}`);
                    Alert.alert("Camera could not open", error.message || "Close other apps using the camera, then tap Retry camera.");
                  }}
                />
                <View collapsable={false} pointerEvents="none" style={styles.interactionSurface} />
              </>
            ) : (
              <View style={styles.permissionOverlay}>
                <MaterialIcons name="video-camera-front" size={28} color="#FF8A6B" />
                <Text style={styles.permissionOverlayText}>Allow camera to{`\n`}show your reaction</Text>
                <Pressable onPress={retryCameraPreview} style={({ pressed }) => [styles.cameraRetryButton, pressed && styles.cameraRetryPressed]}>
                  <Text style={styles.cameraRetryLabel}>Allow camera</Text>
                </Pressable>
              </View>
            )}
            {!isCleanScene ? <View pointerEvents="none" style={styles.dragBadge}>
              <MaterialIcons name="open-with" size={13} color="#FFFFFF" />
              <Text style={styles.dragBadgeLabel}>DRAG</Text>
            </View> : null}
        </View>

        {!isCleanScene ? <View style={styles.bottomDock}>
          <Text style={styles.instruction}>{isRecording ? "Your reaction is recording now — tap Stop recording when finished" : overlayGestureStatus}</Text>
          <Pressable disabled={isCompositing} onPress={toggleRecording} style={({ pressed }) => [isRecording ? styles.stopRecordButton : styles.startRecordButton, (pressed || isCompositing) && styles.recordPressed]}>
            <MaterialIcons name={isCompositing ? "hourglass-top" : isRecording ? "stop" : "fiber-manual-record"} size={isRecording ? 25 : 27} color={isRecording ? "#FF5C35" : "#FFFFFF"} />
            <Text style={isRecording ? styles.stopRecordLabel : styles.startRecordLabel}>{isCompositing ? "Creating reaction video…" : isRecording ? "Stop recording" : "Start recording"}</Text>
          </Pressable>
          <View style={[styles.recordingStatusRow, isRecording && styles.recordingStatusActive]}>
            <MaterialIcons name={isRecording ? "fiber-manual-record" : "info-outline"} size={15} color={isRecording ? "#FFB199" : "#C1C9D4"} />
            <Text style={[styles.recordingStatusText, isRecording && styles.recordingStatusTextActive]}>{recordingStatus}</Text>
          </View>
          {cameraStatus === "error" ? <Pressable onPress={retryCameraPreview} style={({ pressed }) => [styles.retryCameraRow, pressed && styles.modePressed]}>
            <MaterialIcons name="refresh" size={16} color="#FFB199" />
            <Text style={styles.retryCameraLabel}>Retry camera</Text>
          </Pressable> : null}
          <Text style={styles.buildLabel}>MERGED VIDEO BUILD · v1.0.4</Text>
        </View> : null}

      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: "#000000", flex: 1 },
  scrim: { ...StyleSheet.absoluteFill, backgroundColor: "rgba(3, 6, 10, 0.13)" },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 5 },
  roundControl: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.72)", borderColor: "rgba(255,255,255,0.18)", borderRadius: 19, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  controlPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  statusPill: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.75)", borderColor: "rgba(255,255,255,0.16)", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 8 },
  statusDot: { backgroundColor: "#36C98A", borderRadius: 4, height: 7, width: 7 },
  recordingDot: { backgroundColor: "#FF5C35" },
  statusLabel: { color: "#F7F8FA", fontSize: 13, fontWeight: "700" },
  reactionOverlay: { borderColor: "#FFFFFF", borderWidth: 3, elevation: 8, overflow: "visible", position: "absolute", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 10 },
  camera: { borderRadius: 999, flex: 1, overflow: "hidden" },
  interactionSurface: { ...StyleSheet.absoluteFill, backgroundColor: "transparent", borderRadius: 999 },
  permissionOverlay: { alignItems: "center", backgroundColor: "#171E2B", borderRadius: 999, flex: 1, justifyContent: "center", overflow: "hidden" },
  permissionOverlayText: { color: "#F7F8FA", fontSize: 10, fontWeight: "700", lineHeight: 14, marginTop: 5, textAlign: "center" },
  cameraRetryButton: { backgroundColor: "#FF5C35", borderRadius: 9, marginTop: 9, paddingHorizontal: 9, paddingVertical: 6 },
  cameraRetryLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  cameraRetryPressed: { opacity: 0.72 },
  dragBadge: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.76)", borderRadius: 10, flexDirection: "row", gap: 3, left: "50%", marginLeft: -30, paddingHorizontal: 7, paddingVertical: 4, position: "absolute", top: -16 },
  dragBadgeLabel: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  bottomDock: { alignItems: "center", bottom: 0, left: 0, paddingBottom: 7, paddingHorizontal: 22, position: "absolute", right: 0 },
  instruction: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", marginBottom: 13, textAlign: "center", textShadowColor: "rgba(0,0,0,0.65)", textShadowRadius: 5 },
  startRecordButton: { alignItems: "center", backgroundColor: "#FF5C35", borderColor: "rgba(255,255,255,0.95)", borderRadius: 18, borderWidth: 2, flexDirection: "row", gap: 10, height: 62, justifyContent: "center", width: "100%" },
  stopRecordButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#FF5C35", borderRadius: 18, borderWidth: 3, flexDirection: "row", gap: 10, height: 62, justifyContent: "center", width: "100%" },
  startRecordLabel: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  stopRecordLabel: { color: "#FF5C35", fontSize: 17, fontWeight: "900" },
  recordingStatusRow: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.82)", borderRadius: 10, flexDirection: "row", gap: 7, marginTop: 9, paddingHorizontal: 10, paddingVertical: 7, width: "100%" },
  recordingStatusActive: { borderColor: "rgba(255,92,53,0.75)", borderWidth: 1 },
  recordingStatusText: { color: "#C1C9D4", flex: 1, fontSize: 11, fontWeight: "600", lineHeight: 15 },
  recordingStatusTextActive: { color: "#FFDFD6" },
  buildLabel: { color: "#FFB199", fontSize: 10, fontWeight: "900", letterSpacing: 0.8, marginTop: 10 },
  retryCameraRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 8, paddingVertical: 3 },
  retryCameraLabel: { color: "#FFB199", fontSize: 12, fontWeight: "800" },
  modePressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  recordPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  doneButton: { backgroundColor: "rgba(12,16,24,0.48)", borderRadius: 10, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, position: "absolute", right: 12 },
  doneLabel: { color: "rgba(247,248,250,0.84)", fontSize: 11, fontWeight: "800" },
});
