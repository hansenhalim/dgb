import {
  Host,
  ModalBottomSheet,
  RNHostView,
  type ModalBottomSheetRef,
} from "@expo/ui/jetpack-compose";
import { fillMaxWidth } from "@expo/ui/jetpack-compose/modifiers";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Gate } from "@/domain/entities";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

export type GateSheetProps = {
  visible: boolean;
  onClose: () => void;
  currentGateId: number | null;
  gates: Gate[] | null;
  selectGate: (gateId: number) => Promise<void>;
};

export function GateSheet({
  visible,
  onClose,
  currentGateId,
  gates,
  selectGate,
}: GateSheetProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sheetRef = useRef<ModalBottomSheetRef>(null);

  const dismiss = useCallback(async () => {
    await sheetRef.current?.hide();
    onClose();
  }, [onClose]);

  const handleSelect = useCallback(
    async (gateId: number) => {
      if (gateId === currentGateId) {
        await dismiss();
        return;
      }
      setBusyId(gateId);
      setError(null);
      try {
        await selectGate(gateId);
        await dismiss();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal mengganti gerbang");
      } finally {
        setBusyId(null);
      }
    },
    [currentGateId, selectGate, dismiss],
  );

  return (
    <Host style={styles.sheetHost}>
      {visible && (
        <ModalBottomSheet
          modifiers={[fillMaxWidth()]}
          ref={sheetRef}
          onDismissRequest={onClose}
          containerColor={colors.bg}
        >
          <RNHostView matchContents>
            <View style={styles.body}>
              <View style={styles.header}>
                <Text style={styles.title}>PILIH GERBANG</Text>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              {gates === null ? (
                <View style={styles.scanRow}>
                  <ActivityIndicator color={colors.inkMuted} />
                  <Text style={styles.scanText}>Memuat gerbang…</Text>
                </View>
              ) : gates.length === 0 ? (
                <Text style={styles.emptyText}>
                  Tidak ada gerbang tersedia.
                </Text>
              ) : (
                gates.map((g) => {
                  const isCurrent = g.id === currentGateId;
                  const disabled = !g.isAvailable || !!busyId;
                  return (
                    <Pressable
                      key={g.id}
                      style={[
                        styles.gate,
                        isCurrent && styles.gateCurrent,
                        disabled && styles.btnDisabled,
                      ]}
                      disabled={disabled}
                      onPress={() => handleSelect(g.id)}
                    >
                      <View style={styles.gateMain}>
                        <Text style={styles.gateName}>{g.name}</Text>
                        <Text style={styles.gateMeta}>
                          {g.isAvailable ? "Tersedia" : "Tidak tersedia"}
                        </Text>
                      </View>
                      {isCurrent ? (
                        <Text style={styles.currentTag}>AKTIF</Text>
                      ) : busyId === g.id ? (
                        <ActivityIndicator color={colors.inkMuted} />
                      ) : null}
                    </Pressable>
                  );
                })
              )}
            </View>
          </RNHostView>
        </ModalBottomSheet>
      )}
    </Host>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  sheetHost: {
    position: "absolute",
    width: "100%",
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
    gap: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: "700",
    color: colors.ink,
    letterSpacing: 1.2,
  },
  error: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
    letterSpacing: 0.4,
  },
  scanRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
  },
  scanText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.inkMuted,
    letterSpacing: 0.6,
  },
  emptyText: {
    fontSize: 13,
    color: colors.inkMuted,
    paddingVertical: 10,
  },
  gate: {
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
  gateCurrent: {
    borderColor: colors.ruleStrong,
  },
  gateMain: {
    flex: 1,
    gap: 2,
  },
  gateName: {
    fontSize: 14,
    color: colors.ink,
    fontWeight: "600",
  },
  gateMeta: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.inkMuted,
    letterSpacing: 0.4,
  },
  currentTag: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkDim,
    letterSpacing: 1,
  },
  btnDisabled: {
    opacity: 0.5,
  },
});
