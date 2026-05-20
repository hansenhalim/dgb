import { router } from "expo-router";
import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { WarningTriangle } from "@/components/icons";
import type { VisitHistoryEntry } from "@/domain/entities";
import { POSITION_LABEL } from "@/domain/visitCard";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

import { formatRelativeID } from "./relativeTime";
import { useVisitHistoryViewModel } from "./useVisitHistoryViewModel";

export default function VisitHistoryScreen() {
  const vm = useVisitHistoryViewModel();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right", "bottom"]}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Text style={styles.backText}>Kembali</Text>
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.brandKey}>KUNJUNGAN</Text>
          <Text style={styles.title}>Riwayat</Text>
        </View>
        <View style={styles.backButton} />
      </View>

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

      {vm.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.inkMuted} />
        </View>
      ) : (
        <FlatList
          data={vm.entries}
          keyExtractor={(item, index) => `${item.id}-${index}`}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={vm.refreshing}
              onRefresh={vm.reload}
              tintColor={colors.inkMuted}
            />
          }
          ListEmptyComponent={
            vm.error ? null : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>DATA TIDAK DITEMUKAN</Text>
              </View>
            )
          }
          renderItem={({ item }) => <Row entry={item} styles={styles} />}
        />
      )}
    </SafeAreaView>
  );
}

function Row({
  entry,
  styles,
}: {
  entry: VisitHistoryEntry;
  styles: ReturnType<typeof makeStyles>;
}) {
  // Visitor is outside the perimeter (post-checkout OUT or in-transit TRNST):
  // dim the row so guards focus on visitors currently inside.
  const isOutside =
    entry.currentPosition === "OUT" || entry.currentPosition === "TRNST";
  return (
    <View style={[styles.row, isOutside && styles.rowOutside]}>
      <Text style={[styles.plate, isOutside && styles.plateOutside]}>
        {entry.vehiclePlateNumber}
      </Text>
      <Text style={styles.meta} numberOfLines={1}>
        <Text style={[styles.position, isOutside && styles.positionOutside]}>
          {POSITION_LABEL[entry.currentPosition]}
        </Text>
        {"  →  "}
        <Text style={styles.destination}>{entry.destinationName}</Text>
      </Text>
      <Text style={styles.time}>{formatRelativeID(entry.createdAt)}</Text>
    </View>
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
    listContent: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 32,
    },
    separator: {
      height: 8,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.base,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 12,
    },
    rowOutside: {
      opacity: 0.6,
    },
    plate: {
      fontFamily: fonts.mono,
      fontSize: 18,
      fontWeight: "600",
      color: colors.ink,
      letterSpacing: 0.4,
    },
    plateOutside: {
      color: colors.ink2,
    },
    meta: {
      flex: 1,
      textAlign: "center",
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.inkMuted,
      letterSpacing: 0.4,
    },
    time: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkMuted,
      letterSpacing: 0.4,
    },
    position: {
      color: colors.ink2,
    },
    positionOutside: {
      color: colors.inkMuted,
    },
    destination: {
      color: colors.ink2,
    },
    empty: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingTop: 80,
    },
    emptyText: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.inkMuted,
      letterSpacing: 1.2,
    },
    banner: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      margin: 16,
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
  });
