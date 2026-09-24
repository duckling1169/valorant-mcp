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

type Status =
  "idle" | "sending" | "code" | "verifying" | "send-error" | "verify-error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  function getNextPath() {
    return new URLSearchParams(window.location.search).get("next") ?? "/";
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");

    const next = getNextPath();
    const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo },
    });
    setStatus(error ? "send-error" : "code");
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("verifying");

    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: token.trim(),
      type: "email",
    });

    if (error) {
      setStatus("verify-error");
      return;
    }

    window.location.href = getNextPath();
  }

  return (
    <OpsPanel
      eyebrow="/login: operator setting up their MCP client"
      badge="OPERATOR SETUP"
    >
      {status === "code" ||
      status === "verifying" ||
      status === "verify-error" ? (
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
              fontSize: "clamp(24px, 3.4vw, 38px)",
              color: colors.heading,
              lineHeight: 1.15,
            }}
          >
            CHECK
            <br />
            YOUR EMAIL
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              color: colors.textDim,
              lineHeight: 1.6,
            }}
          >
            Enter the sign-in code sent to{" "}
            <span style={{ color: colors.text }}>{email}</span>. This browser
            will resume your pending MCP authorization after verification.
          </div>
          <form
            onSubmit={handleVerify}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 12,
              width: "100%",
            }}
          >
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="EMAIL CODE"
              required
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={status === "verifying"}
              style={{
                ...primaryButtonStyle,
                opacity: status === "verifying" ? 0.6 : 1,
              }}
            >
              {status === "verifying" ? "VERIFYING…" : "VERIFY CODE →"}
            </button>
          </form>
          <div
            onClick={() => {
              setToken("");
              setStatus("idle");
            }}
            style={textLinkStyle}
          >
            USE A DIFFERENT EMAIL
          </div>
          {status === "verify-error" && (
            <div
              style={{
                fontFamily: monoFont,
                fontSize: 11,
                color: colors.redLight,
              }}
            >
              That code could not be verified. Request a new code and try again.
            </div>
          )}
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
              fontSize: "clamp(28px, 4vw, 44px)",
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

          <div
            style={{ display: "flex", gap: 6, marginTop: 20, flexWrap: "wrap" }}
          >
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
              {status === "sending" ? "SENDING…" : "SEND SIGN-IN CODE →"}
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
            {status === "send-error" && (
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
