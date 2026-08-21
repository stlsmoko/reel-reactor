import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

import { ScreenContainer } from "@/components/screen-container";
import { clampOverlay, type OverlayPosition } from "@/lib/reaction-project";
import { getCurrentSource, setCurrentReaction } from "@/lib/reaction-session";

const MIN_OVERLAY_SIZE = 96;
const MAX_OVERLAY_SIZE = 184;

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
  const [isCleanScene, setIsCleanScene] = useState(false);
  const [overlaySize, setOverlaySize] = useState(132);
  const [overlayPosition, setOverlayPosition] = useState<OverlayPosition>({ x: width - 154, y: 126 });
  const dragStart = useRef<OverlayPosition>(overlayPosition);
  const overlayPositionRef = useRef<OverlayPosition>(overlayPosition);

  useEffect(() => {
    if (!source) router.replace("/");
  }, [source]);

  useEffect(() => {
    let isActive = true;

    async function openCameraPreview() {
      if (!cameraPermission?.granted) {
        const permission = await requestCameraPermission();
        if (isActive) setCameraStatus(permission.granted ? "starting" : "permission");
        return;
      }
      setCameraStatus("starting");
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
        Alert.alert("Microphone needed", "Allow microphone access now so Start recording can capture your spoken reaction.");
      }
    }

    prepareMicrophone().catch(() => undefined);
    return () => { isActive = false; };
  }, [microphonePermission?.granted, requestMicrophonePermission]);

  useEffect(() => {
    overlayPositionRef.current = overlayPosition;
  }, [overlayPosition]);

  const dragGesture = useMemo(() => Gesture.Pan()
    .runOnJS(true)
    .minDistance(3)
    .onBegin(() => { dragStart.current = overlayPositionRef.current; })
    .onUpdate((event) => {
      setOverlayPosition(clampOverlay({ x: dragStart.current.x + event.translationX, y: dragStart.current.y + event.translationY }, { width, height }, overlaySize));
    }), [height, overlaySize, width]);

  function cycleOverlaySize() {
    const nextSize = overlaySize < 145 ? 168 : overlaySize < 180 ? MAX_OVERLAY_SIZE : MIN_OVERLAY_SIZE;
    setOverlaySize(nextSize);
    setOverlayPosition((current) => clampOverlay(current, { width, height }, nextSize));
  }

  async function ensurePermissions() {
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const microphone = microphonePermission?.granted ? microphonePermission : await requestMicrophonePermission();
    return camera.granted && microphone.granted;
  }

  async function retryCameraPreview() {
    setIsCameraReady(false);
    setCameraStatus("starting");
    if (!cameraPermission?.granted) {
      const permission = await requestCameraPermission();
      if (!permission.granted) {
        setCameraStatus("permission");
        return;
      }
    }
    setCameraInstanceKey((key) => key + 1);
  }

  async function startCleanScene() {
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!camera.granted) {
      Alert.alert("Camera needed", "Allow camera access so your picture-in-picture bubble can appear in the screen recording.");
      return;
    }
    if (!isCameraReady) {
      Alert.alert("Camera is starting", "Please wait a moment and try again.");
      return;
    }
    setIsCleanScene(true);
    player.replay();
    player.play();
  }

  async function toggleRecording() {
    if (isRecording) {
      cameraRef.current?.stopRecording();
      return;
    }

    if (Platform.OS === "web") {
      Alert.alert("Use a phone for recording", "The studio preview works here, but recording requires the native iPhone or Android build.");
      return;
    }

    setCameraStatus("starting");
    const granted = await ensurePermissions();
    if (!granted) {
      Alert.alert("Camera and microphone needed", "Allow both permissions so Reel Reactor can record your reaction with sound.");
      setCameraStatus(cameraPermission?.granted ? "starting" : "permission");
      return;
    }
    if (!isCameraReady || !cameraRef.current) {
      setCameraStatus("starting");
      Alert.alert("Camera is still opening", "Wait for the top label to say Ready to react, then tap Start recording.");
      return;
    }

    setIsRecording(true);
    player.replay();
    player.play();
    try {
      const recorded = await cameraRef.current.recordAsync({ maxDuration: 180 });
      if (recorded?.uri) {
        setCurrentReaction({ uri: recorded.uri, recordedAt: Date.now() });
        router.replace("/review" as never);
      }
    } catch {
      Alert.alert("Recording stopped", "The camera could not finish this take. Please try again.");
    } finally {
      setIsRecording(false);
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
            setFacing((current) => current === "front" ? "back" : "front");
          }} disabled={isRecording} hitSlop={12} style={({ pressed }) => [styles.roundControl, (pressed || isRecording) && styles.controlPressed]}>
            <MaterialIcons name="flip-camera-android" size={22} color="#FFFFFF" />
          </Pressable>
        </View> : null}

        <GestureDetector gesture={dragGesture}>
          <View style={[styles.reactionOverlay, { borderRadius: overlaySize / 2, height: overlaySize, left: overlayPosition.x, top: overlayPosition.y, width: overlaySize }]}>
            {cameraPermission?.granted ? (
              <>
                <CameraView
                  key={cameraInstanceKey}
                  ref={cameraRef}
                  style={styles.camera}
                  facing={facing}
                  mode="video"
                  onCameraReady={() => { setIsCameraReady(true); setCameraStatus("ready"); }}
                  onMountError={(error) => {
                    setIsCameraReady(false);
                    setCameraStatus("error");
                    Alert.alert("Camera could not open", error.message || "Close other apps using the camera, then tap Retry camera.");
                  }}
                />
                <View style={styles.dragSurface} />
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
            {!isCleanScene ? <Pressable onPress={cycleOverlaySize} style={({ pressed }) => [styles.resizeHandle, pressed && styles.resizePressed]}>
              <MaterialIcons name="open-in-full" size={14} color="#FFFFFF" />
            </Pressable> : null}
            {!isCleanScene ? <View pointerEvents="none" style={styles.dragBadge}>
              <MaterialIcons name="open-with" size={13} color="#FFFFFF" />
              <Text style={styles.dragBadgeLabel}>DRAG</Text>
            </View> : null}
          </View>
        </GestureDetector>

        {!isCleanScene ? <View style={styles.bottomDock}>
          <Text style={styles.instruction}>{isRecording ? "Your reaction is recording now — tap Stop recording when finished" : "Drag the camera bubble, then press Start recording"}</Text>
          <Pressable onPress={toggleRecording} style={({ pressed }) => [isRecording ? styles.stopRecordButton : styles.startRecordButton, pressed && styles.recordPressed]}>
            <MaterialIcons name={isRecording ? "stop" : "fiber-manual-record"} size={isRecording ? 25 : 27} color={isRecording ? "#FF5C35" : "#FFFFFF"} />
            <Text style={isRecording ? styles.stopRecordLabel : styles.startRecordLabel}>{isRecording ? "Stop recording" : "Start recording"}</Text>
          </Pressable>
          {cameraStatus === "error" ? <Pressable onPress={retryCameraPreview} style={({ pressed }) => [styles.retryCameraRow, pressed && styles.modePressed]}>
            <MaterialIcons name="refresh" size={16} color="#FFB199" />
            <Text style={styles.retryCameraLabel}>Retry camera</Text>
          </Pressable> : null}
          <Pressable onPress={startCleanScene} disabled={isRecording} style={({ pressed }) => [styles.screenRecordingLink, (pressed || isRecording) && styles.modePressed]}>
            <MaterialIcons name="screen-share" size={18} color="#FFB199" />
            <Text style={styles.screenRecordingLabel}>Use device screen recording for a merged picture-in-picture video</Text>
          </Pressable>
        </View> : null}

        {isCleanScene ? <Pressable onPress={() => setIsCleanScene(false)} style={styles.doneButton}>
          <Text style={styles.doneLabel}>Done</Text>
        </Pressable> : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  canvas: { backgroundColor: "#000000", flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(3, 6, 10, 0.13)" },
  topBar: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 18, paddingTop: 5 },
  roundControl: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.72)", borderColor: "rgba(255,255,255,0.18)", borderRadius: 19, borderWidth: 1, height: 40, justifyContent: "center", width: 40 },
  controlPressed: { opacity: 0.7, transform: [{ scale: 0.96 }] },
  statusPill: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.75)", borderColor: "rgba(255,255,255,0.16)", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 8 },
  statusDot: { backgroundColor: "#36C98A", borderRadius: 4, height: 7, width: 7 },
  recordingDot: { backgroundColor: "#FF5C35" },
  statusLabel: { color: "#F7F8FA", fontSize: 13, fontWeight: "700" },
  reactionOverlay: { borderColor: "#FFFFFF", borderWidth: 3, elevation: 8, overflow: "visible", position: "absolute", shadowColor: "#000000", shadowOpacity: 0.42, shadowRadius: 10 },
  camera: { borderRadius: 999, flex: 1, overflow: "hidden" },
  dragSurface: { ...StyleSheet.absoluteFillObject, backgroundColor: "transparent", borderRadius: 999 },
  permissionOverlay: { alignItems: "center", backgroundColor: "#171E2B", borderRadius: 999, flex: 1, justifyContent: "center", overflow: "hidden" },
  permissionOverlayText: { color: "#F7F8FA", fontSize: 10, fontWeight: "700", lineHeight: 14, marginTop: 5, textAlign: "center" },
  cameraRetryButton: { backgroundColor: "#FF5C35", borderRadius: 9, marginTop: 9, paddingHorizontal: 9, paddingVertical: 6 },
  cameraRetryLabel: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  cameraRetryPressed: { opacity: 0.72 },
  resizeHandle: { alignItems: "center", backgroundColor: "#FF5C35", borderColor: "#FFFFFF", borderRadius: 14, borderWidth: 2, bottom: -5, height: 28, justifyContent: "center", position: "absolute", right: -5, width: 28 },
  resizePressed: { opacity: 0.7, transform: [{ scale: 0.93 }] },
  dragBadge: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.76)", borderRadius: 10, flexDirection: "row", gap: 3, left: "50%", marginLeft: -30, paddingHorizontal: 7, paddingVertical: 4, position: "absolute", top: -16 },
  dragBadgeLabel: { color: "#FFFFFF", fontSize: 8, fontWeight: "900", letterSpacing: 0.6 },
  bottomDock: { alignItems: "center", bottom: 0, left: 0, paddingBottom: 7, paddingHorizontal: 22, position: "absolute", right: 0 },
  instruction: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", marginBottom: 13, textAlign: "center", textShadowColor: "rgba(0,0,0,0.65)", textShadowRadius: 5 },
  startRecordButton: { alignItems: "center", backgroundColor: "#FF5C35", borderColor: "rgba(255,255,255,0.95)", borderRadius: 18, borderWidth: 2, flexDirection: "row", gap: 10, height: 62, justifyContent: "center", width: "100%" },
  stopRecordButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#FF5C35", borderRadius: 18, borderWidth: 3, flexDirection: "row", gap: 10, height: 62, justifyContent: "center", width: "100%" },
  startRecordLabel: { color: "#FFFFFF", fontSize: 17, fontWeight: "900" },
  stopRecordLabel: { color: "#FF5C35", fontSize: 17, fontWeight: "900" },
  screenRecordingLink: { alignItems: "center", flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 10, paddingVertical: 6 },
  screenRecordingLabel: { color: "#FFB199", fontSize: 12, fontWeight: "700" },
  retryCameraRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 8, paddingVertical: 3 },
  retryCameraLabel: { color: "#FFB199", fontSize: 12, fontWeight: "800" },
  modePressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  recordPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  doneButton: { backgroundColor: "rgba(12,16,24,0.48)", borderRadius: 10, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, position: "absolute", right: 12 },
  doneLabel: { color: "rgba(247,248,250,0.84)", fontSize: 11, fontWeight: "800" },
});
