"use client";

import { Chakra_Petch, JetBrains_Mono } from "next/font/google";
import type { CSSProperties, ReactNode } from "react";

// Shared visual chrome for the operator-facing auth screens (/login,
// /claim). Mirrors the "Valorant Forward UI" design project's terminal-panel
// look: clipped corners, scanline overlay, Chakra Petch / JetBrains Mono.

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

export function OpsPanel({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: colors.bg,
        gap: 14,
        padding: "40px 20px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes vmcp-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
        @keyframes vmcp-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          width: 420,
          maxWidth: "100%",
          fontFamily: monoFont,
          fontSize: 10,
          color: colors.textFaint,
          letterSpacing: "0.1em",
        }}
      >
        {eyebrow}
      </div>

      <div
        style={{
          width: 420,
          maxWidth: "100%",
          minHeight: 560,
          background: colors.panel,
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          clipPath: "polygon(0 0,100% 0,100% 100%,24px 100%,0 calc(100% - 24px))",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "repeating-linear-gradient(0deg,rgba(255,255,255,0.02) 0px,rgba(255,255,255,0.02) 1px,transparent 1px,transparent 3px)",
            pointerEvents: "none",
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 80,
            background: "linear-gradient(180deg,rgba(255,70,85,0.08),transparent)",
            animation: "vmcp-scan 6s linear infinite",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            padding: "36px clamp(20px, 8vw, 34px)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontFamily: headFont,
              fontWeight: 700,
              fontSize: 15,
              letterSpacing: "0.16em",
              color: colors.text,
            }}
          >
            VALORANT<span style={{ color: colors.red }}>·MCP</span>
          </div>
          <div
            style={{
              height: 1,
              background: `linear-gradient(90deg,${colors.red},transparent)`,
              margin: "22px 0 26px",
            }}
          />

          <div
            style={{
              position: "relative",
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CheckBadge({ tone = colors.green }: { tone?: string }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        border: `2px solid ${tone}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: tone,
        fontSize: 22,
        fontFamily: monoFont,
        clipPath: "polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)",
      }}
    >
      ✓
    </div>
  );
}

export function AlertBadge() {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        border: `2px solid ${colors.red}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: colors.red,
        fontSize: 22,
        fontFamily: monoFont,
        clipPath: "polygon(8px 0,100% 0,100% 100%,0 100%,0 8px)",
      }}
    >
      !
    </div>
  );
}

export function Spinner() {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        border: `2px solid ${colors.inputBorder}`,
        borderTopColor: colors.red,
        borderRadius: "50%",
        animation: "vmcp-spin 0.8s linear infinite",
      }}
    />
  );
}
