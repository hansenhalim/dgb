import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Appearance } from "react-native";

import { type Colors, darkColors, lightColors } from "./tokens";

type Scheme = "light" | "dark";

const STORAGE_KEY = "theme.scheme";

type ThemeContextValue = {
  scheme: Scheme;
  colors: Colors;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function initialScheme(): Scheme {
  return Appearance.getColorScheme() === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [scheme, setScheme] = useState<Scheme>(initialScheme);

  useEffect(() => {
    let cancelled = false;
    SecureStore.getItemAsync(STORAGE_KEY)
      .then((saved) => {
        if (cancelled) return;
        if (saved === "light" || saved === "dark") setScheme(saved);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(() => {
    setScheme((prev) => {
      const next: Scheme = prev === "dark" ? "light" : "dark";
      SecureStore.setItemAsync(STORAGE_KEY, next).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      scheme,
      colors: scheme === "dark" ? darkColors : lightColors,
      toggle,
    }),
    [scheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
