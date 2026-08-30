import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";

export default function SharedLinkWebScreen() {
  return (
    <ScreenContainer edges={["top", "bottom", "left", "right"]} className="px-5" containerClassName="bg-[#0C1018]">
      <View style={styles.page}>
        <Text style={styles.heading}>Open this on Android</Text>
        <Text style={styles.copy}>Sharing a public link into Reel Reactor is available in the Android build. In the browser, choose a video saved on this device instead.</Text>
        <Pressable onPress={() => router.replace("/")} style={styles.button}>
          <Text style={styles.buttonLabel}>Choose a video</Text>
        </Pressable>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center" },
  heading: { color: "#F7F8FA", fontSize: 28, fontWeight: "800" },
  copy: { color: "#AAB3C2", fontSize: 16, lineHeight: 23, marginTop: 12 },
  button: { alignItems: "center", backgroundColor: "#FF5C35", borderRadius: 18, marginTop: 26, paddingVertical: 17 },
  buttonLabel: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
});
