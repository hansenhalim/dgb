import { router } from "expo-router";
import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
} from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { WarningTriangle } from "@/components/icons";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

import { useNewTransferRequestViewModel } from "./useNewTransferRequestViewModel";

export default function NewTransferRequestScreen() {
  const vm = useNewTransferRequestViewModel();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const onSubmit = useCallback(async () => {
    Keyboard.dismiss();
    const ok = await vm.submit();
    if (ok) router.back();
  }, [vm]);

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
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
          <Text style={styles.title}>Permintaan Baru</Text>
        </View>
        <View style={styles.backButton} />
      </View>

      {vm.loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.inkMuted} />
        </View>
      ) : (
        <KeyboardAwareScrollView
          style={styles.content}
          contentContainerStyle={styles.contentInner}
          keyboardShouldPersistTaps="handled"
        >
          {vm.loadError ? (
            <Pressable style={styles.banner} onPress={vm.reload}>
              <WarningTriangle size={20} color={colors.red} />
              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle}>GAGAL MEMUAT</Text>
                <Text style={styles.bannerText}>{vm.loadError}</Text>
                <Text style={styles.bannerHint}>Ketuk untuk coba lagi.</Text>
              </View>
            </Pressable>
          ) : null}

          {!vm.cardStock && !vm.loadError ? (
            <Pressable style={styles.banner} onPress={vm.reload}>
              <WarningTriangle size={20} color={colors.red} />
              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle}>STOK TIDAK TERSEDIA</Text>
                <Text style={styles.bannerText}>
                  Coba muat ulang untuk melanjutkan.
                </Text>
              </View>
            </Pressable>
          ) : null}

          {vm.submitError ? (
            <View style={styles.banner}>
              <WarningTriangle size={20} color={colors.red} />
              <View style={styles.bannerBody}>
                <Text style={styles.bannerTitle}>GAGAL MENGIRIM</Text>
                <Text style={styles.bannerText}>{vm.submitError}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldKey}>SUMBER</Text>
            <View style={styles.sourceRow}>
              <Text style={styles.sourceName}>{vm.sourceGate?.name ?? "—"}</Text>
              <Text style={styles.sourceMeta}>
                {vm.cardStock?.available ?? "—"}/{vm.cardStock?.total ?? "—"}{" "}
                kartu
              </Text>
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldKey}>TUJUAN</Text>
            <View style={styles.receiverList}>
              {vm.receivers.map((g) => {
                const selected = vm.selectedReceiverId === g.id;
                return (
                  <Pressable
                    key={g.id}
                    style={[
                      styles.receiverRow,
                      selected && styles.receiverRowSelected,
                    ]}
                    onPress={() => vm.setReceiver(g.id)}
                  >
                    <View style={styles.receiverMain}>
                      <Text style={styles.receiverName}>{g.name}</Text>
                      <Text style={styles.receiverMeta}>
                        {g.isAvailable ? "Tersedia" : "Tidak tersedia"}
                      </Text>
                    </View>
                    {selected ? (
                      <Text style={styles.receiverPickedTag}>DIPILIH</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldKey}>JUMLAH KARTU</Text>
            <TextInput
              style={styles.amountInput}
              value={vm.amountText}
              onChangeText={vm.setAmount}
              keyboardType="number-pad"
              returnKeyType="done"
              placeholder="0"
              placeholderTextColor={colors.inkDim}
              maxLength={5}
            />
            {vm.exceedsMax ? (
              <Text style={styles.hintAlert}>Maks {vm.maxAmount}</Text>
            ) : (
              <Text style={styles.hint}>Maks {vm.maxAmount} kartu</Text>
            )}
          </View>

          {vm.impact ? (
            <View style={styles.impactBlock}>
              <Text style={styles.fieldKey}>ESTIMASI SISA</Text>
              <View style={styles.impactRow}>
                <Text style={styles.impactLabel}>
                  {vm.sourceGate?.name ?? "Sumber"}
                </Text>
                <Text
                  style={[
                    styles.impactValues,
                    vm.impact.sourceLow && styles.impactValuesAlert,
                  ]}
                >
                  {vm.impact.sourceBefore} → {vm.impact.sourceAfter}
                </Text>
              </View>
            </View>
          ) : null}
        </KeyboardAwareScrollView>
      )}

      <KeyboardStickyView offset={{ closed: 0, opened: 0 }}>
        <SafeAreaView style={styles.fabBar} edges={["bottom", "left", "right"]}>
          <Pressable
            style={[
              styles.cta,
              (!vm.valid || vm.submitting) && styles.ctaDisabled,
            ]}
            disabled={!vm.valid || vm.submitting}
            onPress={onSubmit}
          >
            <Text
              style={[
                styles.ctaText,
                (!vm.valid || vm.submitting) && styles.ctaTextDisabled,
              ]}
            >
              {vm.submitting ? "Mengirim…" : "Kirim Permintaan"}
            </Text>
          </Pressable>
        </SafeAreaView>
      </KeyboardStickyView>
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
      gap: 16,
    },
    fieldBlock: {
      gap: 8,
    },
    fieldKey: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.inkMuted,
      letterSpacing: 1.2,
    },
    sourceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.base,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    sourceName: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.ink,
    },
    sourceMeta: {
      fontFamily: fonts.mono,
      fontSize: 12,
      color: colors.inkMuted,
    },
    receiverList: {
      gap: 6,
    },
    receiverRow: {
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
    receiverRowSelected: {
      borderColor: colors.accent,
      borderWidth: 2,
      paddingVertical: 11,
      paddingHorizontal: 13,
    },
    receiverMain: {
      flex: 1,
      gap: 2,
    },
    receiverName: {
      fontSize: 14,
      color: colors.ink,
      fontWeight: "600",
    },
    receiverMeta: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkMuted,
      letterSpacing: 0.4,
    },
    receiverPickedTag: {
      fontFamily: fonts.mono,
      fontSize: 10,
      color: colors.accent,
      letterSpacing: 1,
    },
    amountInput: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.ruleStrong,
      borderRadius: radius.base,
      paddingVertical: 14,
      paddingHorizontal: 14,
      fontFamily: fonts.mono,
      fontSize: 24,
      color: colors.ink,
      letterSpacing: -0.4,
    },
    hint: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.inkMuted,
      letterSpacing: 0.4,
    },
    hintAlert: {
      fontFamily: fonts.mono,
      fontSize: 11,
      color: colors.red,
      letterSpacing: 0.4,
    },
    impactBlock: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.rule,
      borderRadius: radius.base,
      paddingVertical: 12,
      paddingHorizontal: 14,
      gap: 8,
    },
    impactRow: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
    },
    impactLabel: {
      fontSize: 13,
      color: colors.ink2,
    },
    impactValues: {
      fontFamily: fonts.mono,
      fontSize: 14,
      color: colors.ink,
      letterSpacing: 0.4,
    },
    impactValuesAlert: {
      color: colors.red,
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
  });
