/**
 * Accent color presets. Values are "R G B" strings matching the CSS custom
 * property format in styles.css; ThemeApplier writes them onto :root so
 * every `cortex-accent` / user-bubble utility follows the chosen accent.
 * Each preset carries dark- and light-theme variants (Tailwind 400/600 +
 * 950/800 shades on dark, 500/600 + 50/500 on light — same recipe as the
 * original indigo).
 */

export type AccentId = "indigo" | "violet" | "blue" | "teal" | "emerald" | "rose";

interface AccentVariant {
  accent: string;
  accentDim: string;
  userBg: string;
  userBorder: string;
}

export interface AccentPreset {
  id: AccentId;
  label: string;
  dark: AccentVariant;
  light: AccentVariant;
}

export const DEFAULT_ACCENT: AccentId = "indigo";

export const ACCENT_PRESETS: AccentPreset[] = [
  {
    id: "indigo",
    label: "Indigo",
    dark: { accent: "129 140 248", accentDim: "79 70 229", userBg: "30 27 75", userBorder: "55 48 163" },
    light: { accent: "99 102 241", accentDim: "79 70 229", userBg: "238 242 255", userBorder: "99 102 241" },
  },
  {
    id: "violet",
    label: "Violet",
    dark: { accent: "167 139 250", accentDim: "124 58 237", userBg: "46 16 101", userBorder: "91 33 182" },
    light: { accent: "139 92 246", accentDim: "124 58 237", userBg: "245 243 255", userBorder: "139 92 246" },
  },
  {
    id: "blue",
    label: "Blue",
    dark: { accent: "96 165 250", accentDim: "37 99 235", userBg: "23 37 84", userBorder: "30 64 175" },
    light: { accent: "59 130 246", accentDim: "37 99 235", userBg: "239 246 255", userBorder: "59 130 246" },
  },
  {
    id: "teal",
    label: "Teal",
    dark: { accent: "45 212 191", accentDim: "13 148 136", userBg: "4 47 46", userBorder: "17 94 89" },
    light: { accent: "20 184 166", accentDim: "13 148 136", userBg: "240 253 250", userBorder: "20 184 166" },
  },
  {
    id: "emerald",
    label: "Emerald",
    dark: { accent: "52 211 153", accentDim: "5 150 105", userBg: "2 44 34", userBorder: "6 95 70" },
    light: { accent: "16 185 129", accentDim: "5 150 105", userBg: "236 253 245", userBorder: "16 185 129" },
  },
  {
    id: "rose",
    label: "Rose",
    dark: { accent: "251 113 133", accentDim: "225 29 72", userBg: "76 5 25", userBorder: "159 18 57" },
    light: { accent: "244 63 94", accentDim: "225 29 72", userBg: "255 241 242", userBorder: "244 63 94" },
  },
];

export function findAccent(id: string | undefined): AccentPreset {
  return ACCENT_PRESETS.find((p) => p.id === id) ?? ACCENT_PRESETS[0];
}
