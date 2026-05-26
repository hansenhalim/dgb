import LogRocket from "@logrocket/react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ActiveGateProvider } from "@/config/activeGate";
import { ServicesProvider, useServices } from "@/config/container";
import { DestinationsProvider } from "@/config/destinations";
import { SessionProvider, useSession } from "@/config/session";
import { ThemeProvider, useTheme } from "@/theme/theme";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useSession();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const onLogin = segments[0] === "login";
    if (!session && !onLogin) {
      router.replace("/login");
    } else if (session && onLogin) {
      router.replace("/");
    }
  }, [loading, session, segments, router]);

  if (loading) return null;
  return <>{children}</>;
}

function ReaderBootstrap() {
  const { rfid } = useServices();
  useEffect(() => {
    if (rfid.getPairedPeripheralId() && rfid.getStatus().state !== "connected") {
      rfid.connect().catch(() => { });
    }
  }, [rfid]);
  return null;
}

const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;

function UpdatesBootstrap() {
  const lastCheckedAt = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled) return;

    async function check() {
      const now = Date.now();
      if (now - lastCheckedAt.current < UPDATE_CHECK_INTERVAL_MS) return;
      lastCheckedAt.current = now;
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        lastCheckedAt.current = 0;
      }
    }

    check();
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
  }, []);

  return null;
}

function LogRocketIdentify() {
  const { session } = useSession();
  useEffect(() => {
    if (!session) return;
    LogRocket.identify(session.guardName, {
      name: session.guardName,
      validUntil: session.validUntil.toISOString(),
    });
  }, [session]);
  return null;
}

function ThemedShell({ children }: { children: React.ReactNode }) {
  const { scheme } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    LogRocket.init("wtmg9v/dgb-ih2xo");
  }, []);

  return (
    <KeyboardProvider>
      <ThemeProvider>
        <ServicesProvider>
          <SessionProvider>
            <ActiveGateProvider>
              <DestinationsProvider>
                <SafeAreaProvider>
                  <ThemedShell>
                    <ReaderBootstrap />
                    <UpdatesBootstrap />
                    <LogRocketIdentify />
                    <AuthGate>
                      <Stack screenOptions={{ headerShown: false }} />
                    </AuthGate>
                  </ThemedShell>
                </SafeAreaProvider>
              </DestinationsProvider>
            </ActiveGateProvider>
          </SessionProvider>
        </ServicesProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}
