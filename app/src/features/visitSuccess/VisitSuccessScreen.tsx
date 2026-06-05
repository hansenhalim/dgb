import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useMemo } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppStatusBar } from "@/components/AppStatusBar";
import { WarningTriangle } from "@/components/icons";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

import { useVisitSuccessViewModel } from "./useVisitSuccessViewModel";

type Flavor = "entry" | "checkout" | "transit" | "transitEnter";

const FLAVOR_COPY: Record<
  Flavor,
  { brand: string; title: string }
> = {
  entry: {
    brand: "KUNJUNGAN TERSIMPAN",
    title: "Kunjungan berhasil disimpan",
  },
  checkout: {
    brand: "VISITOR CHECKOUT",
    title: "Kunjungan diakhiri",
  },
  transit: {
    brand: "TRANSIT TERCATAT",
    title: "Transit berhasil dicatat",
  },
  transitEnter: {
    brand: "MASUK TERCATAT",
    title: "Masuk Berhasil",
  },
};

function parseFlavor(raw: string | undefined): Flavor {
  if (raw === "checkout" || raw === "transit" || raw === "transitEnter") {
    return raw;
  }
  return "entry";
}

export default function VisitSuccessScreen() {
  const {
    visitId,
    rfidKey,
    cardWritten,
    cardPayloadHex,
    direction,
    flavor: flavorRaw,
  } = useLocalSearchParams<{
    visitId: string;
    rfidKey: string;
    cardWritten: string;
    cardPayloadHex: string;
    direction?: string;
    flavor?: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const flavor = parseFlavor(flavorRaw);
  const copy = FLAVOR_COPY[flavor];
  const pulseDirection = direction === "out" ? "out" : "in";

  const vm = useVisitSuccessViewModel({
    visitId: visitId ?? "",
    rfidKey: rfidKey ?? "",
    initialCardWritten: cardWritten === "1",
    cardPayloadHex: cardPayloadHex ?? "",
    direction: pulseDirection,
  });

  const goHome = useCallback(() => {
    router.dismissAll();
  }, []);

  const onPulse = useCallback(() => {
    vm.pulseGate();
    goHome();
  }, [vm, goHome]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome]),
  );

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <AppStatusBar />

      <View style={styles.body}>
        <Text style={styles.brandKey}>{copy.brand}</Text>
        <Text style={styles.title}>{copy.title}</Text>
        <Text style={styles.subtitle}>ID: {vm.visitId}</Text>

        {!vm.cardWritten ? (
          <View style={styles.banner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>KARTU BELUM TERTULIS</Text>
              <Text style={styles.bannerText}>
                {vm.cardRetryError ??
                  "Kartu RFID belum terisi visit. Pastikan kartu menempel di reader, lalu coba tulis ulang."}
              </Text>
              <Pressable
                style={[
                  styles.retryBtn,
                  !vm.canRetryCard && styles.retryBtnDisabled,
                ]}
                disabled={!vm.canRetryCard}
                onPress={vm.retryCardWrite}
              >
                <Text style={styles.retryBtnText}>
                  {vm.cardRetrying ? "Menulis ulang…" : "Tulis Ulang"}
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      <SafeAreaView style={styles.fabBar} edges={["bottom", "left", "right"]}>
        <View style={styles.ctaRow}>
          <Pressable style={[styles.secondary, styles.flexBtn]} onPress={goHome}>
            <Text style={styles.secondaryText}>Lewati ke Beranda</Text>
          </Pressable>
          <Pressable style={[styles.cta, styles.flexBtn]} onPress={onPulse}>
            <Text style={styles.ctaText}>Buka Boom Gate</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    body: {
      flex: 1,
      padding: 16,
      paddingTop: 32,
      gap: 12,
    },
    brandKey: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkMuted,
      letterSpacing: 1.4,
    },
    title: {
      fontFamily: fonts.sans,
      fontSize: 22,
      fontWeight: "600",
      color: colors.ink,
      letterSpacing: -0.3,
    },
    subtitle: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.inkMuted,
      letterSpacing: 0.6,
    },
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 14,
      paddingHorizontal: 14,
      backgroundColor: "rgba(185,28,28,0.08)",
      borderWidth: 1,
      borderColor: "rgba(185,28,28,0.30)",
      borderLeftWidth: 4,
      borderLeftColor: colors.red,
      borderRadius: radius.base,
      marginTop: 12,
    },
    bannerBody: {
      flex: 1,
      gap: 8,
    },
    bannerTitle: {
      fontFamily: fonts.mono,
      fontSize: 12,
      fontWeight: "700",
      color: colors.red,
      letterSpacing: 1.2,
    },
    bannerText: {
      fontSize: 13,
      color: colors.ink,
      lineHeight: 18,
    },
    retryBtn: {
      alignSelf: "flex-start",
      borderWidth: 1,
      borderColor: colors.red,
      borderRadius: radius.sm,
      paddingHorizontal: 14,
      paddingVertical: 8,
      marginTop: 4,
    },
    retryBtnDisabled: {
      opacity: 0.6,
    },
    retryBtnText: {
      color: colors.red,
      fontSize: 13,
      fontWeight: "600",
    },
    fabBar: {
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.rule,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 4,
    },
    ctaRow: {
      flexDirection: "row",
      gap: 8,
    },
    flexBtn: {
      flex: 1,
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
    ctaText: {
      color: colors.accentInk,
      fontSize: 16,
      fontWeight: "600",
    },
    secondary: {
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: colors.ruleStrong,
      borderRadius: radius.base,
      paddingVertical: 18,
      paddingHorizontal: 20,
    },
    secondaryText: {
      color: colors.inkMuted,
      fontSize: 14,
    },
  });
