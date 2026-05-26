import { router } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WarningTriangle } from "@/components/icons";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

import {
  type TransferRequestItem,
  useTransferRequestViewModel,
} from "./useTransferRequestViewModel";

export default function TransferRequestScreen() {
  const vm = useTransferRequestViewModel();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const onReject = (item: TransferRequestItem) => {
    Alert.alert(
      "Tolak permintaan?",
      `Permintaan ${item.amount} kartu dari ${item.fromGate.name} akan dibatalkan. Stok tidak berpindah.`,
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Tolak",
          style: "destructive",
          onPress: () => vm.reject(item.id),
        },
      ],
    );
  };

  const hasItems = vm.items.length > 0;

  return (
    <SafeAreaView
      style={styles.screen}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brandKey}>STOK KARTU</Text>
          <Text style={styles.title}>Permintaan Transfer</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {vm.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.inkMuted} />
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          refreshControl={
            <RefreshControl
              refreshing={vm.refreshing}
              onRefresh={vm.reload}
              tintColor={colors.inkMuted}
            />
          }
        >
          {vm.error ? (
            <Pressable style={styles.banner} onPress={vm.reload}>
              <WarningTriangle size={20} color={colors.red} />
              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle}>GAGAL MEMUAT</Text>
                <Text style={styles.bannerText}>{vm.error}</Text>
                <Text style={styles.bannerHint}>Ketuk untuk coba lagi.</Text>
              </View>
            </Pressable>
          ) : null}

          {vm.respondError ? (
            <View style={styles.banner}>
              <WarningTriangle size={20} color={colors.red} />
              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle}>GAGAL MEMPROSES</Text>
                <Text style={styles.bannerText}>{vm.respondError}</Text>
              </View>
            </View>
          ) : null}

          {vm.items.map((item) => {
            const busy = vm.respondingId !== null;
            const isThisBusy = vm.respondingId === item.id;
            if (item.direction === "incoming") {
              return (
                <View key={item.id} style={styles.requestCard}>
                  <Text style={styles.requestKey}>PERMINTAAN MASUK</Text>
                  <View style={styles.outgoingRow}>
                    <View style={styles.outgoingSide}>
                      <Text style={styles.requestAmount}>{item.amount}</Text>
                      <Text style={styles.requestUnit}>kartu</Text>
                    </View>
                    <Text style={styles.outgoingArrow}>←</Text>
                    <View style={styles.outgoingSideRight}>
                      <Text style={styles.outgoingGate}>
                        {item.fromGate.name}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.actionRow}>
                    <Pressable
                      style={[
                        styles.actionDanger,
                        busy && styles.actionDisabled,
                      ]}
                      disabled={busy}
                      onPress={() => onReject(item)}
                    >
                      <Text style={styles.actionDangerText}>
                        {isThisBusy ? "Memproses…" : "Tolak"}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.actionPrimary,
                        busy && styles.actionDisabled,
                      ]}
                      disabled={busy}
                      onPress={() => vm.confirm(item.id)}
                    >
                      <Text style={styles.actionPrimaryText}>
                        {isThisBusy ? "Memproses…" : "Terima"}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            }
            return (
              <View key={item.id} style={styles.requestCard}>
                <Text style={styles.requestKey}>MENUNGGU KONFIRMASI</Text>
                <View style={styles.outgoingRow}>
                  <View style={styles.outgoingSide}>
                    <Text style={styles.requestAmount}>{item.amount}</Text>
                    <Text style={styles.requestUnit}>kartu</Text>
                  </View>
                  <Text style={styles.outgoingArrow}>→</Text>
                  <View style={styles.outgoingSideRight}>
                    <Text style={styles.outgoingGate}>
                      {item.toGate.name}
                    </Text>
                  </View>
                </View>
                <Text style={styles.guidance}>
                  Untuk membatalkan, minta {item.toGate.name} menolak permintaan.
                </Text>
              </View>
            );
          })}

          {!hasItems && !vm.error ? (
            <View style={styles.emptyBlock}>
              <Text style={styles.emptyKey}>DATA TIDAK DITEMUKAN</Text>
            </View>
          ) : null}
        </ScrollView>
      )}

      {!vm.loading ? (
        <SafeAreaView style={styles.fabBar} edges={["bottom", "left", "right"]}>
          <Pressable
            style={styles.cta}
            onPress={() => router.push("/transfer-request-new")}
          >
            <Text style={styles.ctaText}>Buat Permintaan</Text>
          </Pressable>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}

const makeStyles = (colors: Colors) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 12,
      gap: 12,
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
      color: colors.inkMuted,
      fontFamily: fonts.sans,
      fontSize: 14,
    },
    brandKey: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkMuted,
      letterSpacing: 1.4,
    },
    title: {
      fontFamily: fonts.sans,
      fontSize: 14,
      fontWeight: "500",
      color: colors.ink,
      letterSpacing: -0.1,
    },
    center: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
    },
    content: {
      flex: 1,
    },
    contentInner: {
      padding: 16,
      paddingBottom: 32,
      gap: 12,
    },
    requestCard: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.ruleStrong,
      borderRadius: radius.base,
      padding: 16,
      gap: 8,
    },
    requestKey: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkMuted,
      letterSpacing: 1.2,
    },
    requestAmount: {
      fontFamily: fonts.mono,
      fontSize: 34,
      fontWeight: "500",
      color: colors.ink,
      letterSpacing: -0.6,
      lineHeight: 36,
    },
    requestUnit: {
      fontFamily: fonts.mono,
      fontSize: 13,
      color: colors.inkMuted,
    },
    outgoingRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      marginTop: 2,
    },
    outgoingSide: {
      flex: 1,
      flexDirection: "row",
      alignItems: "baseline",
      gap: 6,
    },
    outgoingSideRight: {
      flex: 1,
      alignItems: "flex-end",
    },
    outgoingArrow: {
      fontFamily: fonts.mono,
      fontSize: 24,
      color: colors.inkDim,
    },
    outgoingGate: {
      fontFamily: fonts.sans,
      fontSize: 18,
      fontWeight: "600",
      color: colors.ink,
      letterSpacing: -0.2,
    },
    guidance: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkMuted,
      letterSpacing: 0.4,
      lineHeight: 16,
      marginTop: 4,
    },
    actionRow: {
      flexDirection: "row",
      gap: 8,
      marginTop: 8,
    },
    actionPrimary: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.accent,
      borderWidth: 1,
      borderColor: colors.accent,
      borderRadius: radius.base,
      paddingVertical: 14,
    },
    actionPrimaryText: {
      color: colors.accentInk,
      fontSize: 15,
      fontWeight: "600",
    },
    actionDanger: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.red,
      borderRadius: radius.base,
      paddingVertical: 14,
    },
    actionDangerText: {
      color: colors.red,
      fontSize: 15,
      fontWeight: "600",
    },
    actionDisabled: {
      opacity: 0.5,
    },
    emptyBlock: {
      alignItems: "center",
      paddingVertical: 28,
    },
    emptyKey: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.inkMuted,
      letterSpacing: 1.2,
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
    bannerHint: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkMuted,
      letterSpacing: 0.4,
      marginTop: 2,
    },
    fabBar: {
      backgroundColor: colors.bg,
      borderTopWidth: 1,
      borderTopColor: colors.rule,
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
    ctaText: {
      color: colors.accentInk,
      fontSize: 16,
      fontWeight: "600",
    },
  });
