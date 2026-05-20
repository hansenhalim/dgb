export const lightColors = {
  bg: "#fafaf7",
  surface: "#ffffff",
  rule: "#e2e2db",
  ruleStrong: "#c9c9c0",
  ink: "#0b0b0c",
  ink2: "#2a2a2d",
  inkMuted: "#6a6a66",
  inkDim: "#9a9a94",
  accent: "#22c55e",
  accentInk: "#ffffff",
  red: "#b91c1c",
  green: "#15803d",
};

export const darkColors: typeof lightColors = {
  bg: "#0b0b0c",
  surface: "#18181b",
  rule: "#2a2a2d",
  ruleStrong: "#3f3f46",
  ink: "#fafaf7",
  ink2: "#e4e4e0",
  inkMuted: "#9a9a94",
  inkDim: "#6a6a66",
  accent: "#22c55e",
  accentInk: "#ffffff",
  red: "#f87171",
  green: "#4ade80",
};

export type Colors = typeof lightColors;

export const radius = {
  base: 6,
  sm: 4,
};

export const fonts = {
  sans: "System",
  mono: "monospace",
};
