import { router } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  AppStatusBar,
  useReaderStatus,
  type AppStatusBarHandle,
} from "@/components/AppStatusBar";
import {
  CaretDown,
  ChevronRight,
  LogOut,
  WarningTriangle,
} from "@/components/icons";
import { useSession } from "@/config/session";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

import { GateSheet } from "./GateSheet";
import { useHomeViewModel } from "./useHomeViewModel";
import { useScanViewModel } from "./useScanViewModel";

const LOW_BATTERY_THRESHOLD = 20;

export default function HomeScreen() {
  const vm = useHomeViewModel();
  const scan = useScanViewModel();
  const { session, logout } = useSession();
  const readerStatus = useReaderStatus();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusBarRef = useRef<AppStatusBarHandle>(null);
  const [gateSheetOpen, setGateSheetOpen] = useState(false);
  const [scanBlockError, setScanBlockError] = useState<string | null>(null);

  const lowBattery =
    readerStatus.state === "connected" &&
    readerStatus.batteryPercent !== null &&
    readerStatus.batteryPercent < LOW_BATTERY_THRESHOLD;

  const onLogout = useCallback(async () => {
    await logout();
    router.replace("/login");
  }, [logout]);

  const onScan = useCallback(async () => {
    setScanBlockError(null);
    const result = await scan.submit();
    if (!result) return;
    if (result.isEmpty) {
      if (vm.gate?.id === 4) {
        setScanBlockError(
          "Kunjungan baru tidak dapat didaftarkan di gate 4. Gunakan gate perimeter.",
        );
        return;
      }
      router.push({
        pathname: "/capture-id",
        params: { uid: result.uid, rfidKey: result.rfidKey },
      });
      return;
    }
    router.push({
      pathname: "/visit-preview",
      params: {
        uid: result.uid,
        rfidKey: result.rfidKey,
        secret: result.secret,
      },
    });
  }, [scan, vm.gate]);

  const onScanButtonPress =
    scan.cta.intent === "openReader"
      ? () => statusBarRef.current?.openReaderSheet()
      : onScan;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <AppStatusBar ref={statusBarRef} />

      <View style={styles.phead}>
        <View style={styles.guardGroup}>
          <Text style={styles.guardName}>{session?.guardName ?? "—"}</Text>
          <Pressable
            style={styles.logoutButton}
            hitSlop={8}
            onPress={onLogout}
          >
            <LogOut size={16} color={colors.inkMuted} />
          </Pressable>
        </View>

        <Pressable
          style={styles.gatePill}
          onPress={() => setGateSheetOpen(true)}
          hitSlop={8}
        >
          <Text style={styles.gateKey}>POS</Text>
          <Text style={styles.gateValue}>{vm.gate?.name ?? "—"}</Text>
          <CaretDown size={10} color={colors.inkMuted} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentInner}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={vm.refreshing}
            onRefresh={vm.reload}
            tintColor={colors.inkMuted}
          />
        }
      >
        <View style={styles.statRow}>
          <Pressable
            style={[styles.stat, vm.lowStock && styles.statAlert]}
            onPress={() => router.push("/transfer-request")}
          >
            <View style={styles.statChev}>
              <ChevronRight size={12} color={colors.inkDim} />
            </View>
            <View style={styles.statKeyRow}>
              {vm.hasIncomingTransferRequest ? <View style={styles.dot} /> : null}
              <Text style={styles.statKey}>KARTU RFID</Text>
            </View>
            <View style={styles.statBigRow}>
              <Text
                style={[styles.statBig, vm.lowStock && styles.statBigAlert]}
              >
                {vm.cardStock?.available ?? "—"}
              </Text>
              <Text style={styles.statBigOf}>/{vm.cardStock?.total ?? "—"}</Text>
            </View>
          </Pressable>

          <Pressable
            style={[styles.stat, !vm.gate && styles.statDisabled]}
            disabled={!vm.gate}
            onPress={() => router.push("/visit-history")}
          >
            <View style={styles.statChev}>
              <ChevronRight size={12} color={colors.inkDim} />
            </View>
            <Text style={styles.statKey}>JUMLAH KUNJUNGAN</Text>
            <View style={styles.statBigRow}>
              <Text style={styles.statBig}>{vm.visits?.total ?? "—"}</Text>
              <Text style={styles.statBigOf}>
                ·{vm.visits?.active ?? 0} aktif
              </Text>
            </View>
          </Pressable>
        </View>

        {lowBattery ? (
          <View style={styles.banner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>BATERAI READER MENIPIS</Text>
              <Text style={styles.bannerText}>
                Siapkan baterai cadangan. Matikan reader untuk mengganti baterai.
              </Text>
            </View>
          </View>
        ) : null}

        {vm.lowStock ? (
          <View style={styles.banner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>STOK KARTU RFID MENIPIS</Text>
              <Text style={styles.bannerText}>
                Minta transfer dari pos gerbang terdekat.
              </Text>
            </View>
          </View>
        ) : null}

        {vm.error ? (
          <View style={styles.banner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>GAGAL MEMUAT</Text>
              <Text style={styles.bannerText}>{vm.error}</Text>
            </View>
          </View>
        ) : null}

        {scan.error ? (
          <View style={styles.banner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>GAGAL SCAN</Text>
              <Text style={styles.bannerText}>{scan.error}</Text>
            </View>
          </View>
        ) : null}

        {scanBlockError ? (
          <View style={styles.banner}>
            <WarningTriangle size={20} color={colors.red} />
            <View style={styles.bannerBody}>
              <Text style={styles.bannerTitle}>SCAN DITOLAK</Text>
              <Text style={styles.bannerText}>{scanBlockError}</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <SafeAreaView style={styles.fabBar} edges={["bottom", "left", "right"]}>
        <Pressable
          style={[styles.scanButton, !scan.cta.enabled && styles.scanButtonDisabled]}
          disabled={!scan.cta.enabled}
          onPress={onScanButtonPress}
        >
          <Text
            style={[styles.scanText, !scan.cta.enabled && styles.scanTextDisabled]}
          >
            {scan.cta.label}
            {scan.cta.canCancel ? (
              <>
                {"  "}
                <Text
                  style={styles.scanCancelInline}
                  onPress={scan.cancel}
                >
                  Batalkan
                </Text>
              </>
            ) : null}
          </Text>
        </Pressable>
      </SafeAreaView>

      <GateSheet
        visible={gateSheetOpen}
        onClose={() => setGateSheetOpen(false)}
        currentGateId={vm.gate?.id ?? null}
        gates={vm.gates}
        selectGate={vm.selectGate}
      />
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // page header
  phead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.rule,
    gap: 12,
  },
  guardGroup: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  guardName: {
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.07,
  },
  logoutButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
  },
  gatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius.sm,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 8,
  },
  gateKey: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.inkDim,
    letterSpacing: 1,
  },
  gateValue: {
    fontSize: 12,
    color: colors.ink2,
  },
  // content
  content: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },

  // stat row
  statRow: {
    flexDirection: "row",
    gap: 8,
  },
  stat: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.rule,
    borderRadius: radius.base,
    padding: 14,
  },
  statKey: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkMuted,
    letterSpacing: 1,
  },
  statKeyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent,
  },
  statBigRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 6,
    marginTop: 4,
  },
  statBig: {
    fontFamily: fonts.mono,
    fontSize: 34,
    fontWeight: "500",
    color: colors.ink,
    letterSpacing: -0.6,
    lineHeight: 36,
  },
  statBigAlert: {
    color: colors.red,
  },
  statAlert: {
    borderColor: "rgba(185,28,28,0.40)",
  },
  statDisabled: {
    opacity: 0.5,
  },
  statBigOf: {
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.inkMuted,
  },
  statChev: {
    position: "absolute",
    top: 10,
    right: 10,
  },

  // banner
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
  },
  bannerBody: {
    flex: 1,
    gap: 3,
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

  // fab
  fabBar: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  scanButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.accent,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: radius.base,
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  scanButtonDisabled: {
    backgroundColor: colors.rule,
    borderColor: colors.ruleStrong,
  },
  scanText: {
    color: colors.accentInk,
    fontSize: 16,
    fontWeight: "600",
  },
  scanTextDisabled: {
    color: colors.inkMuted,
  },
  scanCancelInline: {
    color: colors.red,
    textDecorationLine: "underline",
  },
});
