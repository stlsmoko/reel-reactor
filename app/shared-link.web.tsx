import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { normalizeSharedLink } from "@/lib/reaction-project";
import { getCurrentSharedLink, setCurrentSharedLink, setCurrentSource } from "@/lib/reaction-session";

export default function SharedLinkWebScreen() {
  const params = useLocalSearchParams<{ url?: string | string[] }>();
  const incomingUrl = Array.isArray(params.url) ? params.url[0] : params.url;
  const existingLink = getCurrentSharedLink();
  const normalizedIncoming = incomingUrl ? normalizeSharedLink(incomingUrl) : null;
  const sharedUrl = normalizedIncoming ?? existingLink?.url ?? null;
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (normalizedIncoming) setCurrentSharedLink({ url: normalizedIncoming, capturedAt: Date.now() });
  }, [normalizedIncoming]);

  const sourceName = useMemo(() => {
    if (!sharedUrl) return "Social link";
    try { return new URL(sharedUrl).hostname.replace(/^www\./, ""); } catch { return "Social link"; }
  }, [sharedUrl]);

  async function importVideoWeb() {
    if (!sharedUrl || isImporting) return;
    setImportError(null);
    setIsImporting(true);
    try {
      const resp = await fetch("/api/import-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sharedUrl }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Could not extract video from this link.");
      }

      setCurrentSource({
        uri: data.streamUrl || data.directUrl,
        name: data.title || `${data.platform || "Social"} Video`,
        durationMs: data.duration ? data.duration * 1000 : undefined,
      });

      router.replace("/source-setup" as never);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "This link could not be downloaded. Please verify the post is public, or choose a saved video.");
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-[#0C1018]">
      <View style={styles.header}>
        <Pressable onPress={() => router.replace("/")} hitSlop={12} style={styles.iconButton}>
          <MaterialIcons name="close" size={22} color="#F7F8FA" />
        </Pressable>
        <Text style={styles.headerTitle}>Import Social Reel</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.linkBadge}><MaterialIcons name="link" size={27} color="#FF8A6B" /></View>
      <Text style={styles.heading}>{sharedUrl ? "Link ready" : "No link found"}</Text>
      <Text style={styles.subtitle}>{sharedUrl ? `Ready to import video from ${sourceName}. Supports Instagram, TikTok, YouTube Shorts, X, Facebook, and more.` : "Paste a public post link from Instagram, TikTok, YouTube, X, or Facebook."}</Text>

      {sharedUrl ? (
        <View style={styles.urlCard}>
          <Text style={styles.urlLabel}>SOURCE LINK</Text>
          <Text style={styles.urlValue} numberOfLines={3}>{sharedUrl}</Text>
        </View>
      ) : null}

      <View style={styles.platformsRow}>
        <Text style={styles.platformsTitle}>Supported Platforms:</Text>
        <Text style={styles.platformsList}>Instagram Reels • TikTok • YouTube Shorts & Videos • X / Twitter • Facebook Reels • Reddit</Text>
      </View>

      <View style={styles.spacer} />
      {sharedUrl ? (
        <Pressable disabled={isImporting} onPress={importVideoWeb} style={({ pressed }) => [styles.primaryButton, (pressed || isImporting) && styles.primaryPressed]}>
          <MaterialIcons name={isImporting ? "downloading" : "download"} size={22} color="#FFFFFF" />
          <Text style={styles.primaryLabel}>{isImporting ? "Extracting & preparing video…" : "Import & React"}</Text>
        </Pressable>
      ) : null}
      {importError ? <Text style={styles.importError}>{importError}</Text> : null}
      <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.primaryPressed]}>
        <MaterialIcons name="video-library" size={20} color="#FFB199" />
        <Text style={styles.secondaryLabel}>Choose a saved video instead</Text>
      </Pressable>
      <Text style={styles.footer}>Reel Reactor processes public video clips directly for your reaction studio.</Text>
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
  platformsRow: { backgroundColor: "#121823", borderRadius: 16, marginTop: 16, padding: 14 },
  platformsTitle: { color: "#FF8A6B", fontSize: 11, fontWeight: "800", letterSpacing: 0.5, marginBottom: 4 },
  platformsList: { color: "#C7CFDC", fontSize: 12, lineHeight: 18 },
  spacer: { flex: 1 },
  primaryButton: { alignItems: "center", backgroundColor: "#FF5C35", borderRadius: 18, flexDirection: "row", gap: 9, height: 58, justifyContent: "center" },
  primaryPressed: { opacity: 0.86, transform: [{ scale: 0.98 }] },
  primaryLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  secondaryButton: { alignItems: "center", borderColor: "#465267", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 8, height: 52, justifyContent: "center", marginTop: 11 },
  secondaryLabel: { color: "#FFB199", fontSize: 14, fontWeight: "800" },
  importError: { color: "#FFB4A3", fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" },
  footer: { color: "#7E899A", fontSize: 12, lineHeight: 17, marginBottom: 8, marginTop: 14, textAlign: "center" },
});
