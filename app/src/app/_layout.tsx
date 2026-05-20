import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
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
