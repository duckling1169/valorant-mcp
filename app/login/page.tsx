"use client";

import { useState, type FormEvent } from "react";
import { createBrowserSupabaseClient } from "@/src/supabase-browser";
import {
  OpsPanel,
  CheckBadge,
  colors,
  headFont,
  monoFont,
  inputStyle,
  primaryButtonStyle,
  textLinkStyle,
} from "@/app/_components/OpsPanel";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const next = new URLSearchParams(window.location.search).get("next") ?? "/";
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    setStatus(error ? "error" : "sent");
  }

  return (
    <OpsPanel eyebrow="/login: operator setting up their MCP client">
      {status === "sent" ? (
        <div
          style={{
            margin: "auto 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <CheckBadge />
          <div
            style={{
              fontFamily: headFont,
              fontWeight: 700,
              fontSize: "clamp(22px, 7vw, 26px)",
              color: colors.heading,
              lineHeight: 1.15,
            }}
          >
            LINK
            <br />
            DEPLOYED
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              color: colors.textDim,
              lineHeight: 1.6,
            }}
          >
            Check <span style={{ color: colors.text }}>{email}</span> for
            your access link. Expires in 15 minutes; your MCP client stays
            benched until you confirm.
          </div>
          <div onClick={() => setStatus("idle")} style={textLinkStyle}>
            USE A DIFFERENT EMAIL
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", height: "100%" }}
        >
          <div
            style={{
              fontFamily: headFont,
              fontWeight: 700,
              fontSize: "clamp(24px, 8vw, 30px)",
              color: colors.heading,
              lineHeight: 1.1,
              letterSpacing: "0.02em",
            }}
          >
            AGENT
            <br />
            VERIFICATION
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              color: colors.textDim,
              marginTop: 10,
              letterSpacing: "0.02em",
            }}
          >
            {
              "// authorize your callsign. this MCP channel arms 8 tools once you're in"
            }
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 20, flexWrap: "wrap" }}>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                color: colors.red,
                letterSpacing: "0.1em",
                border: "1px solid rgba(255,70,85,0.4)",
                padding: "4px 8px",
              }}
            >
              MCP
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                color: "#6b6b74",
                letterSpacing: "0.1em",
                border: "1px solid #2c2c34",
                padding: "4px 8px",
              }}
            >
              STREAMABLE HTTP
            </span>
            <span
              style={{
                fontFamily: monoFont,
                fontSize: 10,
                color: "#6b6b74",
                letterSpacing: "0.1em",
                border: "1px solid #2c2c34",
                padding: "4px 8px",
              }}
            >
              OAUTH 2.1
            </span>
          </div>

          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="operator@domain.com"
              required
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={status === "sending"}
              style={{
                ...primaryButtonStyle,
                opacity: status === "sending" ? 0.6 : 1,
                cursor: status === "sending" ? "default" : "pointer",
              }}
            >
              {status === "sending" ? "DEPLOYING…" : "DEPLOY ACCESS LINK →"}
            </button>
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 11.5,
                color: colors.textDim,
                letterSpacing: "0.06em",
                textAlign: "center",
              }}
            >
              INVITE-ONLY · NO LOOKUP WITHOUT CONSENT
            </div>
            {status === "error" && (
              <div
                style={{
                  fontFamily: monoFont,
                  fontSize: 11,
                  color: colors.redLight,
                  letterSpacing: "0.02em",
                }}
              >
                Something went wrong. Try again.
              </div>
            )}
          </div>
        </form>
      )}
    </OpsPanel>
  );
}
