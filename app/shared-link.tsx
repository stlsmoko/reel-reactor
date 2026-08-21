import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { normalizeSharedLink } from "@/lib/reaction-project";
import { getCurrentSharedLink, setCurrentSharedLink } from "@/lib/reaction-session";

export default function SharedLinkScreen() {
  const params = useLocalSearchParams<{ url?: string | string[] }>();
  const incomingUrl = Array.isArray(params.url) ? params.url[0] : params.url;
  const existingLink = getCurrentSharedLink();
  const normalizedIncoming = incomingUrl ? normalizeSharedLink(incomingUrl) : null;
  const sharedUrl = normalizedIncoming ?? existingLink?.url ?? null;

  useEffect(() => {
    if (normalizedIncoming) setCurrentSharedLink({ url: normalizedIncoming, capturedAt: Date.now() });
  }, [normalizedIncoming]);

  const sourceName = useMemo(() => {
    if (!sharedUrl) return "Shared link";
    try { return new URL(sharedUrl).hostname.replace(/^www\./, ""); } catch { return "Shared link"; }
  }, [sharedUrl]);

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-[#0C1018]">
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/")} hitSlop={12} style={styles.iconButton}>
          <MaterialIcons name="close" size={22} color="#F7F8FA" />
        </Pressable>
        <Text style={styles.headerTitle}>Shared post</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.linkBadge}><MaterialIcons name="link" size={27} color="#FF8A6B" /></View>
      <Text style={styles.heading}>{sharedUrl ? "Link captured" : "No link found"}</Text>
      <Text style={styles.subtitle}>{sharedUrl ? `Reel Reactor saved a link from ${sourceName}.` : "Copy a post link in the social app, then return here and choose Paste copied link."}</Text>

      {sharedUrl ? (
        <View style={styles.urlCard}>
          <Text style={styles.urlLabel}>SOURCE LINK</Text>
          <Text style={styles.urlValue} numberOfLines={3}>{sharedUrl}</Text>
        </View>
      ) : null}

      <View style={styles.explanationCard}>
        <MaterialIcons name="info-outline" size={21} color="#AAB3C2" />
        <Text style={styles.explanationText}>A copied post link identifies what you want to react to, but it does not include the platform’s video file. Choose a saved, rights-cleared copy of the clip to use it in the reaction studio.</Text>
      </View>

      <View style={styles.spacer} />
      <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.primaryButton, pressed && styles.primaryPressed]}>
        <MaterialIcons name="video-library" size={22} color="#FFFFFF" />
        <Text style={styles.primaryLabel}>Choose saved video</Text>
      </Pressable>
      <Text style={styles.footer}>Direct “Share to Reel Reactor” import requires separate native share-extension work and depends on the source app’s sharing rules.</Text>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", flexDirection: "row", height: 58, justifyContent: "space-between" },
  iconButton: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  headerTitle: { color: "#F7F8FA", fontSize: 17, fontWeight: "700" },
  linkBadge: { alignItems: "center", backgroundColor: "#32241F", borderRadius: 24, height: 48, justifyContent: "center", marginTop: 35, width: 48 },
  heading: { color: "#F7F8FA", fontSize: 31, fontWeight: "800", letterSpacing: -0.8, marginTop: 19 },
  subtitle: { color: "#AAB3C2", fontSize: 15, lineHeight: 22, marginTop: 10 },
  urlCard: { backgroundColor: "#171E2B", borderColor: "#283244", borderRadius: 18, borderWidth: 1, marginTop: 25, padding: 16 },
  urlLabel: { color: "#8792A3", fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  urlValue: { color: "#F7F8FA", fontSize: 13, lineHeight: 20, marginTop: 8 },
  explanationCard: { alignItems: "flex-start", backgroundColor: "#121823", borderRadius: 17, flexDirection: "row", gap: 10, marginTop: 15, padding: 15 },
  explanationText: { color: "#AAB3C2", flex: 1, fontSize: 13, lineHeight: 19 },
  spacer: { flex: 1 },
  primaryButton: { alignItems: "center", backgroundColor: "#FF5C35", borderRadius: 18, flexDirection: "row", gap: 9, height: 58, justifyContent: "center" },
  primaryPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  primaryLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  footer: { color: "#7E899A", fontSize: 12, lineHeight: 17, marginBottom: 8, marginTop: 14, textAlign: "center" },
});
