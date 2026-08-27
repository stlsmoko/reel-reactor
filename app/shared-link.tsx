import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import ReelImporter from "reel-importer";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { normalizeSharedLink } from "@/lib/reaction-project";
import { getCurrentSharedLink, setCurrentSharedLink, setCurrentSource } from "@/lib/reaction-session";

export default function SharedLinkScreen() {
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
    if (!sharedUrl) return "Shared link";
    try { return new URL(sharedUrl).hostname.replace(/^www\./, ""); } catch { return "Shared link"; }
  }, [sharedUrl]);

  async function importPublicVideo() {
    if (!sharedUrl || isImporting) return;
    setImportError(null);
    setIsImporting(true);
    try {
      const imported = await ReelImporter.downloadPublicVideo(sharedUrl);
      setCurrentSource({ uri: imported.uri, name: imported.fileName, durationMs: undefined, width: undefined, height: undefined });
      router.replace("/source-setup" as never);
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "This link could not be downloaded on this phone. Choose a saved clip instead.");
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
        <Text style={styles.headerTitle}>Shared post</Text>
        <View style={styles.iconButton} />
      </View>

      <View style={styles.linkBadge}><MaterialIcons name="link" size={27} color="#FF8A6B" /></View>
      <Text style={styles.heading}>{sharedUrl ? "Link captured" : "No link found"}</Text>
      <Text style={styles.subtitle}>{sharedUrl ? `Reel Reactor received a public link from ${sourceName}.` : "Share a public post link to Reel Reactor from another Android app."}</Text>

      {sharedUrl ? (
        <View style={styles.urlCard}>
          <Text style={styles.urlLabel}>SOURCE LINK</Text>
          <Text style={styles.urlValue} numberOfLines={3}>{sharedUrl}</Text>
        </View>
      ) : null}

      <View style={styles.explanationCard}>
        <MaterialIcons name="info-outline" size={21} color="#AAB3C2" />
        <Text style={styles.explanationText}>Reel Reactor will try to download a public playable video directly onto this phone. Private, login-only, or blocked links can fail; you can always choose a saved clip instead.</Text>
      </View>

      <View style={styles.spacer} />
      {sharedUrl ? <Pressable disabled={isImporting} onPress={importPublicVideo} style={({ pressed }) => [styles.primaryButton, (pressed || isImporting) && styles.primaryPressed]}>
        <MaterialIcons name={isImporting ? "downloading" : "download"} size={22} color="#FFFFFF" />
        <Text style={styles.primaryLabel}>{isImporting ? "Downloading public video…" : "Download & react"}</Text>
      </Pressable> : null}
      {importError ? <Text style={styles.importError}>{importError}</Text> : null}
      <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.secondaryButton, pressed && styles.primaryPressed]}>
        <MaterialIcons name="video-library" size={20} color="#FFB199" />
        <Text style={styles.secondaryLabel}>Choose saved video instead</Text>
      </Pressable>
      <Text style={styles.footer}>Public-link downloading runs locally on this Android phone. It cannot bypass a platform’s private or protected access controls.</Text>
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
  secondaryButton: { alignItems: "center", borderColor: "#465267", borderRadius: 18, borderWidth: 1, flexDirection: "row", gap: 8, height: 52, justifyContent: "center", marginTop: 11 },
  secondaryLabel: { color: "#FFB199", fontSize: 14, fontWeight: "800" },
  importError: { color: "#FFB4A3", fontSize: 12, lineHeight: 18, marginTop: 12, textAlign: "center" },
  footer: { color: "#7E899A", fontSize: 12, lineHeight: 17, marginBottom: 8, marginTop: 14, textAlign: "center" },
});
