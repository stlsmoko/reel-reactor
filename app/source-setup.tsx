import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useVideoPlayer, VideoView } from "expo-video";
import { router } from "expo-router";
import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { getCurrentSharedLink, getCurrentSource } from "@/lib/reaction-session";

export default function SourceSetupScreen() {
  const source = getCurrentSource();
  const sharedLink = getCurrentSharedLink();
  const player = useVideoPlayer(source?.uri ?? null, (videoPlayer) => {
    videoPlayer.loop = true;
  });

  useEffect(() => {
    if (!source) router.replace("/");
    return () => player.pause();
  }, [player, source]);

  if (!source) return null;

  const durationSeconds = source.durationMs ? Math.round(source.durationMs / 1_000) : null;

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-[#0C1018]">
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.iconButton}>
          <MaterialIcons name="arrow-back-ios-new" size={20} color="#F7F8FA" />
        </Pressable>
        <Text style={styles.title}>Set up your reaction</Text>
        <View style={styles.iconSpacer} />
      </View>

      <View style={styles.previewCard}>
        <VideoView style={styles.preview} player={player} contentFit="contain" nativeControls />
      </View>

      <View style={styles.sourceSummary}>
        <View style={styles.sourceIcon}>
          <MaterialIcons name="movie" size={20} color="#FF8A6B" />
        </View>
        <View style={styles.sourceCopy}>
          <Text style={styles.sourceName} numberOfLines={1}>{source.name}</Text>
          <Text style={styles.sourceMeta}>{durationSeconds ? `${durationSeconds}s local video` : "Local video"}</Text>
        </View>
        <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.changeButton, pressed && styles.pressed]}>
          <Text style={styles.changeButtonLabel}>Change</Text>
        </Pressable>
      </View>

      <View style={styles.tipCard}>
        <MaterialIcons name="tips-and-updates" size={21} color="#AAB3C2" />
        <Text style={styles.tipCopy}>
          In the studio, your video plays full screen while your front-camera reaction sits on top. Move the reaction bubble to a clear spot before recording.
        </Text>
      </View>
      {sharedLink ? <Text style={styles.linkNotice}>Source link attached to this session: {sharedLink.url}</Text> : null}

      <View style={styles.spacer} />
      <Pressable onPress={() => router.push("/reaction-studio" as never)} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
        <MaterialIcons name="video-camera-front" size={22} color="#FFFFFF" />
        <Text style={styles.primaryButtonLabel}>Open reaction studio</Text>
      </Pressable>
      <Text style={styles.footer}>Your source stays on this device. Only use clips you have permission to reuse.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", height: 58, justifyContent: "space-between" },
  iconButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  iconSpacer: { width: 40 },
  title: { color: "#F7F8FA", fontSize: 17, fontWeight: "700", letterSpacing: -0.2 },
  previewCard: { aspectRatio: 9 / 14, backgroundColor: "#000000", borderColor: "#283244", borderRadius: 28, borderWidth: 1, overflow: "hidden", width: "100%" },
  preview: { flex: 1 },
  sourceSummary: { alignItems: "center", backgroundColor: "#171E2B", borderColor: "#283244", borderRadius: 18, borderWidth: 1, flexDirection: "row", marginTop: 18, padding: 14 },
  sourceIcon: { alignItems: "center", backgroundColor: "#32241F", borderRadius: 12, height: 42, justifyContent: "center", width: 42 },
  sourceCopy: { flex: 1, marginLeft: 11 },
  sourceName: { color: "#F7F8FA", fontSize: 14, fontWeight: "700" },
  sourceMeta: { color: "#AAB3C2", fontSize: 12, marginTop: 3 },
  changeButton: { paddingHorizontal: 4, paddingVertical: 8 },
  changeButtonLabel: { color: "#FF8A6B", fontSize: 13, fontWeight: "700" },
  tipCard: { alignItems: "flex-start", backgroundColor: "#121823", borderRadius: 16, flexDirection: "row", gap: 10, marginTop: 14, padding: 14 },
  tipCopy: { color: "#AAB3C2", flex: 1, fontSize: 13, lineHeight: 19 },
  linkNotice: { color: "#8792A3", fontSize: 11, lineHeight: 16, marginTop: 10 },
  spacer: { flex: 1 },
  primaryButton: { alignItems: "center", backgroundColor: "#FF5C35", borderRadius: 18, flexDirection: "row", gap: 9, height: 58, justifyContent: "center", marginTop: 20 },
  primaryPressed: { opacity: 0.88, transform: [{ scale: 0.98 }] },
  primaryButtonLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  footer: { color: "#7E899A", fontSize: 12, lineHeight: 17, marginBottom: 7, marginTop: 14, textAlign: "center" },
  pressed: { opacity: 0.65 },
});
