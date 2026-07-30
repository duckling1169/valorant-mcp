"use client";

import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/src/supabase-browser";
import { requireSession } from "@/src/require-session";
import {
  OpsPanel,
  CheckBadge,
  AlertBadge,
  Spinner,
  colors,
  headFont,
  monoFont,
  textLinkStyle,
} from "@/app/_components/OpsPanel";

type Status = "working" | "done" | "notfound" | "error";

export default function ClaimPage() {
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState("");
  const [handle, setHandle] = useState<string | null>(null);

  useEffect(() => {
    async function run() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (!code) {
        setStatus("notfound");
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const session = await requireSession(
        supabase,
        `/claim?code=${encodeURIComponent(code)}`,
      );
      if (!session) return;

      const res = await fetch("/api/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body: { error?: string; name?: string; tag?: string } =
        await res.json();
      if (!res.ok) {
        setStatus("error");
        setMessage(body.error ?? "Something went wrong.");
        return;
      }
      if (body.name && body.tag) setHandle(`${body.name}#${body.tag}`);
      setStatus("done");
    }
    void run();
  }, []);

  return (
    <OpsPanel
      eyebrow="/claim?code=...: operator setting up their MCP client"
      badge="OPERATOR SETUP"
    >
      {status === "working" && (
        <div
          style={{
            margin: "auto 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 18,
          }}
        >
          <Spinner />
          <div
            style={{
              fontFamily: headFont,
              fontWeight: 700,
              fontSize: "clamp(20px, 3vw, 32px)",
              color: colors.heading,
            }}
          >
            VERIFYING INVITE
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              color: colors.textDim,
              letterSpacing: "0.02em",
            }}
          >
            {"// resolving code against roster"}
          </div>
        </div>
      )}

      {status === "done" && (
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
            ROSTER
            <br />
            CONFIRMED
          </div>
          {handle && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: monoFont,
                fontSize: 12,
                color: "#c4c4ca",
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  background: colors.green,
                  borderRadius: "50%",
                }}
              />
              <span>
                invite matched <span style={{ color: colors.text }}>{handle}</span>
              </span>
            </div>
          )}
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              color: colors.textDim,
              lineHeight: 1.6,
            }}
          >
            You&apos;re cleared. Point your MCP client at the server with the
            same credentials, no further setup.
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
              gap: 1,
              background: colors.border,
              border: `1px solid ${colors.border}`,
              width: "100%",
            }}
          >
            {[
              {
                label: "PROFILE + RANK",
                body: "current rank, accuracy, agent pool",
              },
              {
                label: "MATCH HISTORY",
                body: "recent games, per-match detail",
              },
              {
                label: "COMPARE",
                body: "head-to-head against a teammate",
              },
            ].map((tile) => (
              <div key={tile.label} style={{ background: "#17171c", padding: "12px 14px" }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 10,
                    color: colors.red,
                    letterSpacing: "0.06em",
                  }}
                >
                  {tile.label}
                </div>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 10.5,
                    color: colors.textDim,
                    marginTop: 4,
                  }}
                >
                  {tile.body}
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 10,
              color: "#4d4d55",
              letterSpacing: "0.06em",
            }}
          >
            8 TOOLS TOTAL, ARMED AND READY
          </div>
        </div>
      )}

      {status === "notfound" && (
        <div
          style={{
            margin: "auto 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 10,
          }}
        >
          <div
            style={{
              fontFamily: headFont,
              fontWeight: 700,
              fontSize: "clamp(56px, 8vw, 96px)",
              color: "#26262e",
              lineHeight: 1,
            }}
          >
            404
          </div>
          <div style={{ fontFamily: monoFont, fontSize: 12, color: colors.textDim }}>
            Missing invite code.
          </div>
          <a href="/login" style={{ ...textLinkStyle, marginTop: 6 }}>
            BACK TO LOGIN
          </a>
        </div>
      )}

      {status === "error" && (
        <div
          style={{
            margin: "auto 0",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 14,
          }}
        >
          <AlertBadge />
          <div
            style={{
              fontFamily: headFont,
              fontWeight: 700,
              fontSize: "clamp(24px, 3.4vw, 38px)",
              color: colors.heading,
              lineHeight: 1.15,
            }}
          >
            CLAIM
            <br />
            FAILED
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 12,
              color: colors.textDim,
              lineHeight: 1.6,
            }}
          >
            {message}
          </div>
          <a href="/login" style={{ ...textLinkStyle, marginTop: 6 }}>
            BACK TO LOGIN
          </a>
        </div>
      )}
    </OpsPanel>
  );
}
