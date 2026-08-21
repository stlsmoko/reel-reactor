import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, PanResponder, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";

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
  const [isRecording, setIsRecording] = useState(false);
  const [isCleanScene, setIsCleanScene] = useState(false);
  const [overlaySize, setOverlaySize] = useState(132);
  const [overlayPosition, setOverlayPosition] = useState<OverlayPosition>({ x: width - 154, y: 126 });
  const dragStart = useRef<OverlayPosition>(overlayPosition);
  const sizeStart = useRef(overlaySize);

  useEffect(() => {
    if (!source) router.replace("/");
    return () => player.pause();
  }, [player, source]);

  const dragResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3 || Math.abs(gesture.dy) > 3,
    onPanResponderGrant: () => { dragStart.current = overlayPosition; },
    onPanResponderMove: (_, gesture) => {
      setOverlayPosition(clampOverlay({ x: dragStart.current.x + gesture.dx, y: dragStart.current.y + gesture.dy }, { width, height }, overlaySize));
    },
  }), [height, overlayPosition, overlaySize, width]);

  const resizeResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { sizeStart.current = overlaySize; },
    onPanResponderMove: (_, gesture) => {
      const nextSize = Math.max(MIN_OVERLAY_SIZE, Math.min(MAX_OVERLAY_SIZE, sizeStart.current + Math.max(gesture.dx, gesture.dy)));
      setOverlaySize(nextSize);
      setOverlayPosition((current) => clampOverlay(current, { width, height }, nextSize));
    },
  }), [height, overlaySize, width]);

  async function ensurePermissions() {
    const camera = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    const microphone = microphonePermission?.granted ? microphonePermission : await requestMicrophonePermission();
    return camera.granted && microphone.granted;
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

    const granted = await ensurePermissions();
    if (!granted) {
      Alert.alert("Camera and microphone needed", "Allow both permissions so Reel Reactor can record your reaction with sound.");
      return;
    }
    if (!isCameraReady || !cameraRef.current) {
      Alert.alert("Camera is starting", "Please wait a moment and try again.");
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
      player.pause();
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
            <Text style={styles.statusLabel}>{isRecording ? "Recording reaction" : "Ready to react"}</Text>
          </View>
          <Pressable onPress={() => setFacing((current) => current === "front" ? "back" : "front")} disabled={isRecording} hitSlop={12} style={({ pressed }) => [styles.roundControl, (pressed || isRecording) && styles.controlPressed]}>
            <MaterialIcons name="flip-camera-android" size={22} color="#FFFFFF" />
          </Pressable>
        </View> : null}

        <View {...dragResponder.panHandlers} style={[styles.reactionOverlay, { borderRadius: overlaySize / 2, height: overlaySize, left: overlayPosition.x, top: overlayPosition.y, width: overlaySize }]}>
          {cameraPermission?.granted ? (
            <CameraView ref={cameraRef} style={styles.camera} facing={facing} mode="video" onCameraReady={() => setIsCameraReady(true)} />
          ) : (
            <View style={styles.permissionOverlay}>
              <MaterialIcons name="video-camera-front" size={28} color="#FF8A6B" />
              <Text style={styles.permissionOverlayText}>Tap a mode{`\n`}to enable camera</Text>
            </View>
          )}
          {!isCleanScene ? <View {...resizeResponder.panHandlers} style={styles.resizeHandle}>
            <MaterialIcons name="open-in-full" size={14} color="#FFFFFF" />
          </View> : null}
        </View>

        {!isCleanScene ? <View style={styles.bottomDock}>
          <Text style={styles.instruction}>{isRecording ? "Your source clip is playing while your camera take records" : "Drag the bubble; use the corner handle to resize"}</Text>
          <View style={styles.modeRow}>
            <Pressable onPress={toggleRecording} style={({ pressed }) => [styles.modeButton, pressed && styles.modePressed]}>
              <MaterialIcons name={isRecording ? "stop" : "videocam"} size={19} color="#FFFFFF" />
              <Text style={styles.modeLabel}>{isRecording ? "Stop take" : "Camera take"}</Text>
            </Pressable>
            <Pressable onPress={startCleanScene} disabled={isRecording} style={({ pressed }) => [styles.modeButton, styles.screenModeButton, (pressed || isRecording) && styles.modePressed]}>
              <MaterialIcons name="screen-share" size={19} color="#FF8A6B" />
              <Text style={styles.screenModeLabel}>Screen recording</Text>
            </Pressable>
          </View>
          <Text style={styles.recordCaption}>Screen recording creates the merged picture-in-picture capture</Text>
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
  permissionOverlay: { alignItems: "center", backgroundColor: "#171E2B", borderRadius: 999, flex: 1, justifyContent: "center", overflow: "hidden" },
  permissionOverlayText: { color: "#F7F8FA", fontSize: 10, fontWeight: "700", lineHeight: 14, marginTop: 5, textAlign: "center" },
  resizeHandle: { alignItems: "center", backgroundColor: "#FF5C35", borderColor: "#FFFFFF", borderRadius: 14, borderWidth: 2, bottom: -5, height: 28, justifyContent: "center", position: "absolute", right: -5, width: 28 },
  bottomDock: { alignItems: "center", bottom: 0, left: 0, paddingBottom: 7, paddingHorizontal: 22, position: "absolute", right: 0 },
  instruction: { color: "#FFFFFF", fontSize: 13, fontWeight: "600", marginBottom: 13, textAlign: "center", textShadowColor: "rgba(0,0,0,0.65)", textShadowRadius: 5 },
  modeRow: { flexDirection: "row", gap: 10, justifyContent: "center", width: "100%" },
  modeButton: { alignItems: "center", backgroundColor: "rgba(12,16,24,0.88)", borderColor: "rgba(255,255,255,0.25)", borderRadius: 16, borderWidth: 1, flex: 1, flexDirection: "row", gap: 8, height: 54, justifyContent: "center" },
  screenModeButton: { borderColor: "#FF8A6B" },
  modeLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  screenModeLabel: { color: "#FF8A6B", fontSize: 13, fontWeight: "800" },
  modePressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  recordCaption: { color: "#E8EDF5", fontSize: 12, fontWeight: "600", marginTop: 9, textAlign: "center" },
  doneButton: { backgroundColor: "rgba(12,16,24,0.48)", borderRadius: 10, bottom: 12, paddingHorizontal: 10, paddingVertical: 6, position: "absolute", right: 12 },
  doneLabel: { color: "rgba(247,248,250,0.84)", fontSize: 11, fontWeight: "800" },
});
