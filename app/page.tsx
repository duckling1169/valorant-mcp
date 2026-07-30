import { colors, headFont, monoFont } from "@/app/_components/theme";
import { InviteCodeForm } from "@/app/_components/InviteCodeForm";

const GITHUB_URL = "https://github.com/duckling1169/valorant-mcp";

const features = [
  {
    label: "WHAT",
    title: "8 tools over MCP",
    body: "Profile, match history, per-match detail, rank, and head-to-head compare, wired straight into your assistant's tool list.",
  },
  {
    label: "HOW",
    title: "Consent-gated lookups",
    body: "Every Riot ID is verified and allowlisted before data ever gets served. No open lookup, no scraping strangers' stats.",
  },
  {
    label: "WHY",
    title: "A build worth studying",
    body: "Built solo end-to-end: auth, invite flow, third-party API integration, and a protocol server, shipped and running live.",
  },
];

export default function Home() {
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
        padding: "clamp(24px, 6vw, 40px) 16px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @keyframes vmcp-landing-scan { 0% { transform: translateY(-100%); } 100% { transform: translateY(100%); } }
      `}</style>

      <div
        style={{
          width: "100%",
          maxWidth: 900,
          background: colors.panel,
          position: "relative",
          overflow: "hidden",
          border: `1px solid ${colors.border}`,
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
            padding:
              "clamp(28px, 7vw, 64px) clamp(20px, 6vw, 60px) clamp(28px, 6vw, 56px)",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 90,
              overflow: "hidden",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 90,
                background: "linear-gradient(180deg,rgba(255,70,85,0.1),transparent)",
                animation: "vmcp-landing-scan 6s linear infinite",
              }}
            />
          </div>

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
              OPEN SOURCE · SOLO BUILD
            </div>
          </div>

          <div
            style={{
              height: 1,
              background: `linear-gradient(90deg,${colors.red},transparent)`,
              margin: "32px 0 40px",
            }}
          />

          <div
            style={{
              fontFamily: headFont,
              fontWeight: 700,
              fontSize: "clamp(30px, 6vw, 52px)",
              color: colors.heading,
              lineHeight: 1.08,
              letterSpacing: "0.01em",
              maxWidth: 640,
            }}
          >
            GIVE YOUR AI ASSISTANT
            <br />A <span style={{ color: colors.red }}>RIOT ID.</span>
          </div>
          <div
            style={{
              fontFamily: monoFont,
              fontSize: 14,
              color: colors.textDim,
              marginTop: 18,
              maxWidth: 560,
              lineHeight: 1.6,
            }}
          >
            An MCP server that lets Claude and other assistants pull live
            Valorant match history, ranks, and stats. Ask about a game in
            plain English instead of tabbing to a tracker site.
          </div>

          <div style={{ marginTop: 32 }}>
            <InviteCodeForm />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 1,
              background: colors.border,
              marginTop: 56,
              border: `1px solid ${colors.border}`,
            }}
          >
            {features.map((feature) => (
              <div key={feature.label} style={{ background: colors.panel, padding: "26px 24px" }}>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 11,
                    color: colors.red,
                    letterSpacing: "0.1em",
                  }}
                >
                  {feature.label}
                </div>
                <div
                  style={{
                    fontFamily: headFont,
                    fontWeight: 600,
                    fontSize: 17,
                    color: colors.text,
                    marginTop: 10,
                  }}
                >
                  {feature.title}
                </div>
                <div
                  style={{
                    fontFamily: monoFont,
                    fontSize: 12,
                    color: colors.textDim,
                    marginTop: 8,
                    lineHeight: 1.55,
                  }}
                >
                  {feature.body}
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              marginTop: 48,
              fontFamily: monoFont,
              fontSize: 11,
              color: "#4d4d55",
              letterSpacing: "0.06em",
            }}
          >
            <a href={GITHUB_URL} style={{ color: "#4d4d55", textDecoration: "none" }}>
              SOURCE ON GITHUB
            </a>
            <span>POWERED BY HENRIKDEV</span>
          </div>
        </div>
      </div>
    </div>
  );
}
