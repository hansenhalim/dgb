import { router } from "expo-router";
import { useCallback, useMemo, useRef } from "react";
import {
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { KeyboardAwareScrollView, KeyboardStickyView } from "react-native-keyboard-controller";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppStatusBar, type AppStatusBarHandle } from "@/components/AppStatusBar";
import { useSession } from "@/config/session";
import { useTheme } from "@/theme/theme";
import { type Colors, fonts, radius } from "@/theme/tokens";

import { useLoginViewModel } from "./useLoginViewModel";

export default function LoginScreen() {
  const vm = useLoginViewModel();
  const { setSession } = useSession();
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const statusBarRef = useRef<AppStatusBarHandle>(null);

  const onSubmit = useCallback(async () => {
    Keyboard.dismiss();
    const session = await vm.submit();
    if (session) {
      setSession(session);
      router.replace("/");
    }
  }, [vm, setSession]);

  const onButtonPress =
    vm.cta.intent === "openReader"
      ? () => {
        Keyboard.dismiss();
        statusBarRef.current?.openReaderSheet();
      }
      : onSubmit;

  return (
    <SafeAreaView style={styles.screen} edges={["top", "left", "right"]}>
      <AppStatusBar ref={statusBarRef} />

      <KeyboardAwareScrollView style={styles.field}>
        <View style={styles.content}>
          <View style={styles.header}>
            <Text style={styles.brandKey}>DIGITAL GUESTBOOK</Text>
            <Text style={styles.title}>Masuk</Text>
            <Text style={styles.subtitle}>
              Masukkan PIN 6 digit lalu scan kartu RFID Anda.
            </Text>
          </View>

          <TextInput
            style={styles.input}
            value={vm.pin}
            onChangeText={vm.setPin}
            keyboardType="number-pad"
            maxLength={6}
            secureTextEntry
            autoFocus
            editable={!vm.busy}
            placeholder="••••••"
            placeholderTextColor={colors.inkDim}
          />

          {vm.error ? <Text style={styles.error}>{vm.error}</Text> : null}
        </View>
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: 16 }}>
        <SafeAreaView style={styles.fabBar} edges={["bottom", "left", "right"]}>
          <Pressable
            style={[styles.cta, !vm.cta.enabled && styles.ctaDisabled]}
            disabled={!vm.cta.enabled}
            onPress={onButtonPress}
          >
            <Text
              style={[styles.ctaText, !vm.cta.enabled && styles.ctaTextDisabled]}
            >
              {vm.cta.label}
              {vm.cta.canCancel ? (
                <>
                  {"  "}
                  <Text style={styles.ctaCancelInline} onPress={vm.cancel}>
                    Batalkan
                  </Text>
                </>
              ) : null}
            </Text>
          </Pressable>
        </SafeAreaView>
      </KeyboardStickyView>
    </SafeAreaView >
  );
}

const makeStyles = (colors: Colors) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 16,
    gap: 28,
    paddingTop: 48,
  },
  header: {
    gap: 8,
  },
  brandKey: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.inkMuted,
    letterSpacing: 1.4,
  },
  title: {
    fontFamily: fonts.sans,
    fontSize: 28,
    fontWeight: "600",
    color: colors.ink,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.inkMuted,
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  input: {
    fontFamily: fonts.mono,
    fontSize: 22,
    letterSpacing: 8,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.ruleStrong,
    borderRadius: radius.base,
    paddingVertical: 16,
    paddingHorizontal: 14,
  },
  error: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.red,
    letterSpacing: 0.4,
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
  ctaCancelInline: {
    color: colors.red,
    textDecorationLine: "underline",
  },
});
