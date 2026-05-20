import { CameraView, useCameraPermissions } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

export default function CaptureIdScreen() {
  const { uid, rfidKey } = useLocalSearchParams<{
    uid: string;
    rfidKey: string;
  }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const onShutter = useCallback(async () => {
    if (busy || !cameraReady) return;
    setBusy(true);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.7 });
      if (photo?.uri) {
        router.push({
          pathname: "/guest-form",
          params: { uid, rfidKey, photoUri: photo.uri },
        });
      }
    } finally {
      setBusy(false);
    }
  }, [busy, cameraReady, uid, rfidKey]);

  if (!permission) {
    return <View style={styles.screen} />;
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionScreen} edges={["top", "left", "right", "bottom"]}>
        <View style={styles.permissionBox}>
          <Text style={styles.brandKey}>IZIN KAMERA</Text>
          <Text style={styles.title}>Kamera diperlukan</Text>
          <Text style={styles.subtitle}>
            Izinkan akses kamera untuk foto kartu identitas.
          </Text>
        </View>
        <View style={styles.permissionActions}>
          <Pressable style={styles.cta} onPress={requestPermission}>
            <Text style={styles.ctaText}>Izinkan Kamera</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => router.back()}>
            <Text style={styles.secondaryText}>Batal</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const shutterDisabled = busy || !cameraReady;
  const shutterLabel = busy
    ? "Memproses…"
    : !cameraReady
      ? "Menyiapkan Kamera…"
      : "Ambil Foto";

  return (
    <View style={styles.screen}>
      <SafeAreaView edges={["top", "left", "right"]}>
        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => router.back()} hitSlop={8}>
            <Text style={styles.backText}>Batal</Text>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.brandKeyLight}>KARTU IDENTITAS</Text>
            <Text style={styles.titleLight}>Posisikan KTP/SIM di dalam bingkai</Text>
          </View>
          <View style={styles.backButton} />
        </View>
      </SafeAreaView>

      <View style={styles.cameraWrap}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          pictureSize="640x480"
          onCameraReady={() => setCameraReady(true)}
        />
      </View>

      <SafeAreaView edges={["bottom", "left", "right"]} style={styles.fabBar}>
        <Pressable
          style={[styles.cta, shutterDisabled && styles.ctaDisabled]}
          disabled={shutterDisabled}
          onPress={onShutter}
        >
          <Text style={[styles.ctaText, shutterDisabled && styles.ctaTextDisabled]}>
            {shutterLabel}
          </Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  permissionScreen: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: "space-between",
  },
  permissionBox: {
    padding: 16,
    paddingTop: 48,
    gap: 12,
  },
  permissionActions: {
    padding: 16,
    paddingBottom: 12,
    gap: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  cameraWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  camera: {
    width: "100%",
    aspectRatio: 3 / 4,
    borderRadius: radius.base,
    overflow: "hidden",
    backgroundColor: "#111",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  backButton: {
    minWidth: 52,
  },
  backText: {
    color: "#ffffff",
    fontFamily: fonts.sans,
    fontSize: 14,
  },
  brandKey: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkMuted,
    letterSpacing: 1.4,
  },
  brandKeyLight: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: "#ffffff",
    letterSpacing: 1.4,
    opacity: 0.85,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 22,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.3,
  },
  titleLight: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "500",
    color: "#ffffff",
    letterSpacing: -0.1,
  },
  subtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  fabBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  cta: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.base,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  ctaDisabled: {
    backgroundColor: colors.rule,
    borderColor: colors.ruleStrong,
  },
  ctaText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: "600",
  },
  ctaTextDisabled: {
    color: colors.inkMuted,
  },
  secondary: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  secondaryText: {
    color: colors.inkMuted,
    fontSize: 14,
  },
});
