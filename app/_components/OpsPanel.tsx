"use client";

import type { ReactNode } from "react";
import { colors, headFont, monoFont } from "@/app/_components/theme";

// Shared visual chrome for the operator-facing auth screens (/login,
// /claim). Mirrors the "Valorant Forward UI" design project's terminal-panel
// look: clipped corners, scanline overlay, Chakra Petch / JetBrains Mono.
//
// Color/font tokens live in ./theme.ts (a plain, non-"use client" module)
// and are re-exported here so existing imports keep working — a Server
// Component importing plain constants directly from a "use client" module
// gets `undefined` back, since only component exports cross that boundary.
export {
  colors,
  headFont,
  monoFont,
  inputStyle,
  primaryButtonStyle,
  textLinkStyle,
  secondaryButtonStyle,
} from "@/app/_components/theme";

export function OpsPanel({
  eyebrow,
  badge,
  children,
}: {
  eyebrow: string;
  badge: string;
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
        @keyframes vmcp-spin { to { transform: rotate(360deg); } }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 900,
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
          width: "100%",
          maxWidth: 900,
          minHeight: 640,
          background: colors.panel,
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
          clipPath: "polygon(0 0,100% 0,100% 100%,24px 100%,0 calc(100% - 24px))",
          boxSizing: "border-box",
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
            position: "relative",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            minHeight: 640,
            padding: "clamp(28px, 7vw, 64px) clamp(20px, 6vw, 60px)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
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
                fontFamily: monoFont,
                fontSize: 10,
                color: "#6b6b74",
                letterSpacing: "0.1em",
                border: "1px solid #2c2c34",
                padding: "5px 10px",
                whiteSpace: "nowrap",
              }}
            >
              {badge}
            </div>
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
