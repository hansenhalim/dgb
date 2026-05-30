import { useFocusEffect } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo } from "react";
import {
  BackHandler,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppStatusBar } from "@/components/AppStatusBar";
import { WarningTriangle } from "@/components/icons";
import { useActiveGate } from "@/config/activeGate";
import { useDestinations } from "@/config/destinations";
import {
  gateAllowsArea,
  gateAreaResult,
  gateSupportedDirections,
} from "@/domain/gateAreaMap";
import { POSITION_LABEL, type CardArea } from "@/domain/visitCard";
import { useTheme } from "@/theme/theme";
import { fonts, radius, type Colors } from "@/theme/tokens";

import { useVisitPreviewViewModel } from "./useVisitPreviewViewModel";

type Tone = "warn" | "alert";

const WARN_COLOR = "#CA8A04";

function uidToDecimal(uid: string): string {
  if (!uid) return "—";
  try {
    const bytes = uid.match(/.{2}/g) ?? [];
    const reversed = bytes.reverse().join("");
    return BigInt("0x" + reversed).toString(10);
  } catch {
    return uid;
  }
}

function formatPlate(raw: string): string {
  if (raw.length === 0) return "—";
  return raw
    .replace(/([A-Z])(\d)/g, "$1 $2")
    .replace(/(\d)([A-Z])/g, "$1 $2");
}

function formatDurationSince(updatedAtMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - updatedAtMs);
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "kurang dari 1 menit lalu";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) return `${hours} jam lalu`;
  return `${hours} jam ${remMinutes} menit lalu`;
}

function inTransitDurationTone(updatedAtMs: number, nowMs: number): Tone | null {
  const diffMin = Math.max(0, nowMs - updatedAtMs) / 60000;
  if (diffMin > 24 * 60) return "alert";
  if (diffMin > 5) return "warn";
  return null;
}

export default function VisitPreviewScreen() {
  const { uid, rfidKey, secret } = useLocalSearchParams<{
    uid: string;
    rfidKey: string;
    secret: string;
  }>();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { destinations, fetch: fetchDestinations } = useDestinations();
  const { activeGate } = useActiveGate();

  useEffect(() => {
    if (!destinations) fetchDestinations();
  }, [destinations, fetchDestinations]);

  const vm = useVisitPreviewViewModel({
    uid: uid ?? "",
    rfidKey: rfidKey ?? "",
    secretHex: secret ?? "",
  });

  const goHome = useCallback(() => {
    router.dismissAll();
  }, []);

  useEffect(() => {
    if (!vm.success) return;
    router.dismissAll();
    router.push({
      pathname: "/visit-success",
      params: {
        visitId: vm.success.visitId,
        rfidKey: "",
        cardWritten: "1",
        cardPayloadHex: "",
        direction: vm.success.flavor === "transitEnter" ? "in" : "out",
        flavor: vm.success.flavor,
      },
    });
  }, [vm.success]);

  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goHome();
        return true;
      });
      return () => sub.remove();
    }, [goHome]),
  );

  // Gate on `decoded` alone: a successful legacy retry sets `decoded` while
  // `decodeError` (the v1 failure) stays set, so the two now diverge.
  if (!vm.decoded) {
    const legacyFailed = vm.legacyAttempted;
    return (
      <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
        <AppStatusBar />
        <View style={styles.errorBody}>
          <Text style={styles.brandKey}>FORMAT KARTU</Text>
          <Text style={styles.title}>Kartu tidak dikenali</Text>

          <View style={styles.errorBanner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.errorBannerBody}>
              <Text style={styles.errorBannerTitle}>
                FORMAT KARTU TIDAK DIKENAL
              </Text>
              <Text style={styles.errorBannerText}>
                {legacyFailed
                  ? "Format lama juga tidak terbaca. Kartu ini tidak dapat digunakan."
                  : (vm.decodeError ?? "Format kartu tidak didukung.")}
              </Text>
              {!legacyFailed ? (
                <Pressable style={styles.retryBtn} onPress={vm.tryLegacy}>
                  <Text style={styles.retryBtnText}>Coba Format Lama</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>
        <SafeAreaView style={styles.fabBar} edges={["bottom", "left", "right"]}>
          <Pressable style={styles.cta} onPress={goHome}>
            <Text style={styles.ctaText}>Kembali</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    );
  }

  const decoded = vm.decoded;
  const inTransit = decoded.currentArea === "TRNST";
  const lockedAction =
    vm.phase === "checkingOut" ||
      vm.failure?.kind === "checkoutApi" ||
      vm.failure?.kind === "checkoutCard"
      ? "checkout"
      : vm.phase === "transiting" ||
        vm.failure?.kind === "transitApi" ||
        vm.failure?.kind === "transitCard"
        ? "transit"
        : vm.phase === "transitEntering" ||
          vm.failure?.kind === "transitEnterApi" ||
          vm.failure?.kind === "transitEnterCard"
          ? "transitEnter"
          : null;

  const checkoutDisabled =
    vm.phase !== "idle" || (lockedAction !== null && lockedAction !== "checkout");
  const transitDisabled =
    vm.phase !== "idle" || (lockedAction !== null && lockedAction !== "transit");
  const transitEnterDisabled =
    vm.phase !== "idle" ||
    (lockedAction !== null && lockedAction !== "transitEnter");

  const checkoutLabel =
    vm.phase === "checkingOut"
      ? "Memproses…"
      : vm.failure?.kind === "checkoutCard"
        ? "Tulis Ulang Kartu"
        : vm.failure?.kind === "checkoutApi"
          ? "Coba Lagi Checkout"
          : "Checkout";

  const transitLabel =
    vm.phase === "transiting"
      ? "Memproses…"
      : vm.failure?.kind === "transitCard"
        ? "Tulis Ulang Transit"
        : vm.failure?.kind === "transitApi"
          ? "Coba Lagi Transit"
          : "Transit";

  // Gate 4 "out" goes to villa2 (area change) — same /transit endpoint, but
  // labeled "Keluar" rather than "Checkout" since it doesn't end the visit.
  const exitLabel =
    vm.phase === "transiting"
      ? "Memproses…"
      : vm.failure?.kind === "transitCard"
        ? "Tulis Ulang"
        : vm.failure?.kind === "transitApi"
          ? "Coba Lagi"
          : "Keluar";

  const transitEnterLabel =
    vm.phase === "transitEntering"
      ? "Memproses…"
      : vm.failure?.kind === "transitEnterCard"
        ? "Tulis Ulang Kartu"
        : vm.failure?.kind === "transitEnterApi"
          ? "Coba Lagi Masuk"
          : "Masuk";

  const failureBannerTitle = vm.failure?.kind.startsWith("checkout")
    ? "GAGAL CHECKOUT"
    : vm.failure?.kind.startsWith("transitEnter")
      ? "GAGAL MASUK"
      : "GAGAL TRANSIT";

  const purposeText =
    decoded.purposeEnum === 3 ? decoded.purposeCustom : decoded.purposeLabel;

  const destinationPosition =
    (destinations?.find((d) => d.name === decoded.destination)?.position ?? null) as
    | CardArea
    | null;
  const tujuanTone: Tone | null =
    activeGate && destinationPosition &&
      !gateAllowsArea(activeGate.id, destinationPosition)
      ? "warn"
      : null;
  const inTransitTimeTone = inTransit
    ? inTransitDurationTone(decoded.updatedAt, Date.now())
    : null;

  // Gate 4 is an internal boundary: the visitor must be in villa2 to enter exclusive,
  // or in exclusive to leave back to villa2. Any other state at gate 4 means the card
  // didn't pass through gate 4 cleanly on the way in — show a wrong-side note.
  const supportedDirections = activeGate
    ? gateSupportedDirections(activeGate.id)
    : [];
  const outResult = activeGate
    ? gateAreaResult(activeGate.id, "out")
    : undefined;
  const isInternalGate = activeGate?.id === 4;
  const wrongSide =
    isInternalGate &&
    decoded.currentArea !== "VIL_2" &&
    decoded.currentArea !== "VIL_E";
  const showMasuk =
    !wrongSide &&
    supportedDirections.includes("in") &&
    (isInternalGate ? decoded.currentArea === "VIL_2" : inTransit);
  const showCheckout = !wrongSide && !inTransit && outResult === "wipe";
  const showExit =
    !wrongSide &&
    outResult !== undefined &&
    outResult !== "wipe" &&
    decoded.currentArea === "VIL_E";
  const showTransit =
    !wrongSide && !inTransit && supportedDirections.includes("transit");

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <AppStatusBar />

      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.brandKey}>KUNJUNGAN AKTIF</Text>

        <View style={styles.fieldList}>
          <Field
            label="Nomor Kartu"
            value={uidToDecimal(uid ?? "")}
            colors={colors}
          />
          <Field label="NIK" value={decoded.identityMask} colors={colors} />
          <Field label="Nama" value={decoded.fullname} colors={colors} />
          <Field
            label="No. Plat"
            value={formatPlate(decoded.plate)}
            colors={colors}
          />
          <Field
            label="Tujuan"
            value={decoded.destination}
            colors={colors}
            badge={destinationPosition ? POSITION_LABEL[destinationPosition] : undefined}
            tone={tujuanTone ?? undefined}
          />
          <Field
            label="Keperluan"
            value={purposeText}
            colors={colors}
            isLast={!inTransit}
          />
          {inTransit ? (
            <Field
              label="Waktu di Luar"
              value={formatDurationSince(decoded.updatedAt, Date.now())}
              colors={colors}
              tone={inTransitTimeTone ?? undefined}
              isLast
            />
          ) : null}
        </View>
      </ScrollView>

      <SafeAreaView style={styles.fabBar} edges={["bottom", "left", "right"]}>
        {vm.failure ? (
          <View style={styles.errorBanner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.errorBannerBody}>
              <Text style={styles.errorBannerTitle}>{failureBannerTitle}</Text>
              <Text style={styles.errorBannerText}>{vm.failure.message}</Text>
              {vm.apiCommitted ? (
                <Text style={styles.errorBannerHint}>
                  Server sudah tercatat. Tinggal menulis ulang kartu.
                </Text>
              ) : null}
            </View>
          </View>
        ) : null}

        {wrongSide ? (
          <View style={styles.errorBanner}>
            <WarningTriangle size={20} color={WARN_COLOR} />
            <View style={styles.errorBannerBody}>
              <Text
                style={[styles.errorBannerTitle, { color: WARN_COLOR }]}
              >
                KARTU TIDAK VALID DI GATE INI
              </Text>
              <Text style={styles.errorBannerText}>
                Tamu harus melewati gate perimeter dahulu sebelum menggunakan gate 4.
              </Text>
            </View>
          </View>
        ) : null}

        {showMasuk ? (
          <Pressable
            style={[styles.cta, transitEnterDisabled && styles.ctaDisabled]}
            disabled={transitEnterDisabled}
            onPress={vm.transitEnter}
          >
            <Text
              style={[
                styles.ctaText,
                transitEnterDisabled && styles.ctaTextDisabled,
              ]}
            >
              {transitEnterLabel}
            </Text>
          </Pressable>
        ) : null}
        {showCheckout ? (
          <Pressable
            style={[styles.cta, checkoutDisabled && styles.ctaDisabled]}
            disabled={checkoutDisabled}
            onPress={vm.checkout}
          >
            <Text
              style={[
                styles.ctaText,
                checkoutDisabled && styles.ctaTextDisabled,
              ]}
            >
              {checkoutLabel}
            </Text>
          </Pressable>
        ) : null}
        {showExit ? (
          <Pressable
            style={[styles.cta, transitDisabled && styles.ctaDisabled]}
            disabled={transitDisabled}
            onPress={vm.transit}
          >
            <Text
              style={[
                styles.ctaText,
                transitDisabled && styles.ctaTextDisabled,
              ]}
            >
              {exitLabel}
            </Text>
          </Pressable>
        ) : null}
        {showTransit ? (
          <Pressable
            style={[
              styles.secondaryCta,
              transitDisabled && styles.secondaryCtaDisabled,
            ]}
            disabled={transitDisabled}
            onPress={vm.transit}
          >
            <Text
              style={[
                styles.secondaryCtaText,
                transitDisabled && styles.secondaryCtaTextDisabled,
              ]}
            >
              {transitLabel}
            </Text>
          </Pressable>
        ) : null}
      </SafeAreaView>
    </SafeAreaView>
  );
}

function Field({
  label,
  value,
  colors,
  mono,
  isLast,
  badge,
  tone,
}: {
  label: string;
  value: string;
  colors: Colors;
  mono?: boolean;
  isLast?: boolean;
  badge?: string;
  tone?: Tone;
}) {
  const styles = useMemo(() => makeFieldStyles(colors), [colors]);
  const toneColor =
    tone === "alert" ? colors.red : tone === "warn" ? WARN_COLOR : null;
  return (
    <View style={[styles.row, isLast && styles.rowLast]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.valueRow}>
        <Text
          style={[
            styles.value,
            mono && styles.valueMono,
            toneColor ? { color: toneColor } : null,
          ]}
        >
          {value || "—"}
        </Text>
        {badge ? (
          <Text
            style={[
              styles.badge,
              toneColor
                ? { color: toneColor, borderColor: toneColor }
                : null,
            ]}
          >
            {badge}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const makeFieldStyles = (colors: Colors) =>
  StyleSheet.create({
    row: {
      gap: 4,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.rule,
    },
    rowLast: {
      borderBottomWidth: 0,
    },
    label: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkMuted,
      letterSpacing: 1.2,
    },
    value: {
      fontSize: 16,
      color: colors.ink,
    },
    valueMono: {
      fontFamily: fonts.mono,
      fontSize: 14,
    },
    valueRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      flexWrap: "wrap",
    },
    badge: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkMuted,
      letterSpacing: 0.6,
      borderWidth: 1,
      borderColor: colors.ruleStrong,
      borderRadius: radius.sm,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
  });

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    flex: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingTop: 24,
      paddingBottom: 24,
      gap: 12,
    },
    brandKey: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkMuted,
      letterSpacing: 1.4,
    },
    errorBody: {
      flex: 1,
      padding: 16,
      paddingTop: 32,
      gap: 12,
    },
    title: {
      fontFamily: fonts.sans,
      fontSize: 22,
      fontWeight: "600",
      color: colors.ink,
      letterSpacing: -0.3,
    },
    fieldList: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.base,
      paddingHorizontal: 14,
      marginTop: 4,
    },
    fabBar: {
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.rule,
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 8,
    },
    errorBanner: {
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
    },
    errorBannerBody: {
      flex: 1,
      gap: 4,
    },
    errorBannerTitle: {
      fontFamily: fonts.mono,
      fontSize: 12,
      fontWeight: "700",
      color: colors.red,
      letterSpacing: 1.2,
    },
    errorBannerText: {
      fontSize: 13,
      color: colors.ink,
      lineHeight: 18,
    },
    errorBannerHint: {
      fontSize: 12,
      color: colors.inkMuted,
      fontStyle: "italic",
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
    retryBtnText: {
      color: colors.red,
      fontSize: 13,
      fontWeight: "600",
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
    secondaryCta: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.ruleStrong,
      borderRadius: radius.base,
      paddingVertical: 16,
      paddingHorizontal: 20,
    },
    secondaryCtaDisabled: {
      opacity: 0.5,
    },
    secondaryCtaText: {
      color: colors.ink,
      fontSize: 15,
      fontWeight: "600",
    },
    secondaryCtaTextDisabled: {
      color: colors.inkMuted,
    },
  });
