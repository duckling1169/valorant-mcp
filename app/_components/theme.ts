import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import type { CSSProperties } from "react";

// Shared visual tokens for the terminal-panel look across the marketing
// page and the operator auth screens. Deliberately NOT "use client" —
// Server Components (app/page.tsx) can't read plain constants exported
// from a "use client" module (Next.js resolves them to undefined), so
// these live in their own plain module that either kind of component can
// import from.

const chakraPetch = Chakra_Petch({ subsets: ["latin"], weight: ["600", "700"] });
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const colors = {
  bg: "#0a0a0c",
  panel: "#101014",
  border: "#26262e",
  inputBorder: "#2c2c34",
  text: "#e8e8ec",
  heading: "#f4f4f6",
  textDim: "#8c8c95",
  textFaint: "#6f6f78",
  red: "#ff4655",
  redLight: "#ff5c5c",
  green: "#5fd97a",
} as const;

export const headFont = chakraPetch.style.fontFamily;
export const monoFont = jetbrainsMono.style.fontFamily;

export const inputStyle: CSSProperties = {
  background: "#17171c",
  border: `1px solid ${colors.inputBorder}`,
  color: colors.text,
  fontFamily: monoFont,
  fontSize: 14,
  padding: "14px 16px",
  outline: "none",
  clipPath: "polygon(0 0,100% 0,100% 100%,10px 100%,0 calc(100% - 10px))",
};

export const primaryButtonStyle: CSSProperties = {
  background: colors.red,
  color: "#0a0a0c",
  border: "none",
  fontFamily: headFont,
  fontWeight: 700,
  fontSize: 15,
  letterSpacing: "0.1em",
  padding: "15px 18px",
  cursor: "pointer",
  clipPath: "polygon(12px 0,100% 0,100% 100%,0 100%,0 12px)",
};

// Extra vertical padding widens the tap target on touch devices without
// changing the visual line height.
export const textLinkStyle: CSSProperties = {
  cursor: "pointer",
  fontFamily: monoFont,
  fontSize: 11,
  color: colors.redLight,
  letterSpacing: "0.06em",
  padding: "6px 0",
  textDecoration: "none",
  display: "inline-block",
};

export const secondaryButtonStyle: CSSProperties = {
  background: "transparent",
  color: colors.red,
  border: `1px solid ${colors.red}`,
  fontFamily: headFont,
  fontWeight: 700,
  fontSize: 13,
  letterSpacing: "0.08em",
  padding: "12px 16px",
  cursor: "pointer",
};
