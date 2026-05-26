import * as Updates from "expo-updates";
import { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/theme/theme";
import { type Colors, fonts } from "@/theme/tokens";

import { Sparkle } from "./icons";

export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [reloading, setReloading] = useState(false);

  const onReload = useCallback(async () => {
    setReloading(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setReloading(false);
    }
  }, []);

  if (!isUpdatePending) return null;

  return (
    <View style={styles.banner}>
      <View style={styles.left}>
        <Sparkle size={12} color={colors.accentInk} />
        <Text style={styles.text}>UPDATE AVAILABLE</Text>
      </View>
      <Pressable
        style={styles.button}
        onPress={onReload}
        disabled={reloading}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Reload to apply update"
      >
        {reloading ? (
          <ActivityIndicator size="small" color={colors.bg} />
        ) : (
          <Text style={styles.buttonText}>RELOAD</Text>
        )}
      </Pressable>
    </View>
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  banner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingLeft: 16,
    paddingRight: 8,
    paddingVertical: 6,
    backgroundColor: colors.accent,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.accentInk,
    letterSpacing: 0.8,
  },
  button: {
    backgroundColor: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.bg,
    letterSpacing: 0.8,
  },
});
