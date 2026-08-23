import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { normalizeSharedLink, validateSourceVideo } from "@/lib/reaction-project";
import { setCurrentSharedLink, setCurrentSource } from "@/lib/reaction-session";

/**
 * Home Screen - NativeWind Example
 *
 * This template uses NativeWind (Tailwind CSS for React Native).
 * You can use familiar Tailwind classes directly in className props.
 *
 * Key patterns:
 * - Use `className` instead of `style` for most styling
 * - Theme colors: use tokens directly (bg-background, text-foreground, bg-primary, etc.); no dark: prefix needed
 * - Responsive: standard Tailwind breakpoints work on web
 * - Custom colors defined in tailwind.config.js
 */
export default function HomeScreen() {
  const [isChoosing, setIsChoosing] = useState(false);

  async function chooseVideo() {
    if (isChoosing) return;
    setIsChoosing(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["videos"],
        allowsMultipleSelection: false,
        videoMaxDuration: 180,
        quality: 1,
        preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;

      const asset = result.assets[0];
      const message = validateSourceVideo(asset);
      if (message) {
        Alert.alert("Choose another clip", message);
        return;
      }

      if (Platform.OS === "web") {
        setCurrentSource({
          uri: asset.uri,
          name: asset.fileName ?? "Selected video",
          durationMs: asset.duration,
          width: asset.width,
          height: asset.height,
        });
        router.push("/source-setup" as never);
        return;
      }

      if (!FileSystem.cacheDirectory) {
        Alert.alert("Video storage unavailable", "Reel Reactor could not prepare this clip on your phone. Close the app, reopen it, and try again.");
        return;
      }

      const extension = asset.fileName?.match(/\.[a-z0-9]{2,5}$/i)?.[0] ?? ".mp4";
      const localUri = `${FileSystem.cacheDirectory}reel-reactor-source-${Date.now()}${extension}`;
      try {
        await FileSystem.copyAsync({ from: asset.uri, to: localUri });
        const localInfo = await FileSystem.getInfoAsync(localUri);
        if (!localInfo.exists || !localInfo.size) {
          throw new Error("The selected clip was empty after copying.");
        }
      } catch {
        Alert.alert("Could not prepare that video", "Reel Reactor needs a local copy of the selected clip before it can mix your reaction. Try selecting the clip again.");
        return;
      }

      setCurrentSource({
        uri: localUri,
        name: asset.fileName ?? "Selected video",
        durationMs: asset.duration,
        width: asset.width,
        height: asset.height,
      });
      router.push("/source-setup" as never);
    } catch {
      Alert.alert("Could not open your videos", "Please try selecting a video again.");
    } finally {
      setIsChoosing(false);
    }
  }

  async function pasteSharedLink() {
    try {
      const copiedText = await Clipboard.getStringAsync();
      const url = normalizeSharedLink(copiedText);
      if (!url) {
        Alert.alert("No post link found", "Copy a full https:// link from the post’s Share menu, then return and try again.");
        return;
      }
      setCurrentSharedLink({ url, capturedAt: Date.now() });
      router.push("/shared-link" as never);
    } catch {
      Alert.alert("Could not read the clipboard", "Try copying the post link again, then return to Reel Reactor.");
    }
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-[#0C1018]">
      <View style={styles.page}>
        <View>
          <View style={styles.brandRow}>
            <View style={styles.logoMark}><MaterialIcons name="bolt" size={22} color="#FFFFFF" /></View>
            <Text style={styles.brandName}>Reel Reactor</Text>
          </View>
          <Text style={styles.heading}>React while the{`\n`}video rolls.</Text>
          <Text style={styles.subheading}>Choose a clip, position your camera, then record your honest reaction in one focused studio.</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.fakeVideoFrame}>
            <View style={styles.fakeCaption} />
            <View style={styles.fakeCaptionShort} />
            <View style={styles.fakeOverlay}>
              <MaterialIcons name="face" size={34} color="#FF8A6B" />
            </View>
            <View style={styles.fakeRecord}><MaterialIcons name="fiber-manual-record" size={30} color="#FFFFFF" /></View>
          </View>
          <View style={styles.heroCardBottom}>
            <Text style={styles.heroCardTitle}>Picture-in-picture reactions</Text>
            <Text style={styles.heroCardCopy}>Your source clip stays as the stage. Your camera is the conversation.</Text>
          </View>
        </View>

        <View style={styles.spacer} />
        <Pressable onPress={chooseVideo} disabled={isChoosing} style={({ pressed }) => [styles.primaryButton, (pressed || isChoosing) && styles.primaryPressed]}>
          <MaterialIcons name="video-library" size={22} color="#FFFFFF" />
          <Text style={styles.primaryLabel}>{isChoosing ? "Opening videos…" : "Choose a video"}</Text>
        </Pressable>
        <Pressable onPress={pasteSharedLink} style={({ pressed }) => [styles.linkButton, pressed && styles.linkPressed]}>
          <MaterialIcons name="content-paste-go" size={20} color="#FF8A6B" />
          <Text style={styles.linkButtonLabel}>Paste copied post link</Text>
        </Pressable>
        <View style={styles.infoRow}>
          <MaterialIcons name="lock-outline" size={15} color="#8792A3" />
          <Text style={styles.infoText}>Personal-use MVP · Videos stay on your device</Text>
        </View>
        <View style={styles.notice}>
          <MaterialIcons name="info-outline" size={18} color="#AAB3C2" />
          <Text style={styles.noticeText}>Start with a saved clip. Direct importing from a social-app share is the next step and depends on what that app makes available.</Text>
        </View>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingBottom: 8, paddingTop: 11 },
  brandRow: { alignItems: "center", flexDirection: "row", gap: 9 },
  logoMark: { alignItems: "center", backgroundColor: "#FF5C35", borderRadius: 11, height: 37, justifyContent: "center", width: 37 },
  brandName: { color: "#F7F8FA", fontSize: 16, fontWeight: "800", letterSpacing: -0.2 },
  heading: { color: "#F7F8FA", fontSize: 38, fontWeight: "800", letterSpacing: -1.3, lineHeight: 42, marginTop: 34 },
  subheading: { color: "#AAB3C2", fontSize: 16, lineHeight: 23, marginTop: 14, maxWidth: 330 },
  heroCard: { backgroundColor: "#171E2B", borderColor: "#283244", borderRadius: 25, borderWidth: 1, marginTop: 26, overflow: "hidden" },
  fakeVideoFrame: { backgroundColor: "#29344A", height: 192, overflow: "hidden", position: "relative" },
  fakeCaption: { backgroundColor: "rgba(247,248,250,0.68)", borderRadius: 4, height: 9, left: 18, position: "absolute", top: 27, width: 126 },
  fakeCaptionShort: { backgroundColor: "rgba(247,248,250,0.38)", borderRadius: 4, height: 8, left: 18, position: "absolute", top: 42, width: 77 },
  fakeOverlay: { alignItems: "center", backgroundColor: "#202B3C", borderColor: "#FFFFFF", borderRadius: 46, borderWidth: 3, height: 92, justifyContent: "center", position: "absolute", right: 20, top: 22, width: 92 },
  fakeRecord: { alignItems: "center", backgroundColor: "#FF5C35", borderColor: "rgba(255,255,255,0.88)", borderRadius: 25, borderWidth: 3, bottom: 17, height: 50, justifyContent: "center", left: "50%", marginLeft: -25, position: "absolute", width: 50 },
  heroCardBottom: { padding: 18 },
  heroCardTitle: { color: "#F7F8FA", fontSize: 17, fontWeight: "800" },
  heroCardCopy: { color: "#AAB3C2", fontSize: 13, lineHeight: 19, marginTop: 5 },
  spacer: { flex: 1 },
  primaryButton: { alignItems: "center", backgroundColor: "#FF5C35", borderRadius: 18, flexDirection: "row", gap: 10, height: 58, justifyContent: "center" },
  primaryPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  primaryLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  infoRow: { alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 13 },
  infoText: { color: "#8792A3", fontSize: 12 },
  notice: { alignItems: "flex-start", backgroundColor: "#121823", borderRadius: 14, flexDirection: "row", gap: 9, marginTop: 14, padding: 12 },
  noticeText: { color: "#AAB3C2", flex: 1, fontSize: 12, lineHeight: 17 },
  linkButton: { alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 9, paddingVertical: 10 },
  linkButtonLabel: { color: "#FF8A6B", fontSize: 14, fontWeight: "800" },
  linkPressed: { opacity: 0.65 },
});
