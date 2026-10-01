import type { CSSProperties } from "react";
import { colors, headFont, textLinkStyle } from "@/app/_components/theme";
import { listConnections, listInvites } from "@/lib/connections";
import { isOwner } from "@/lib/owner";
import { getServices } from "@/lib/services";
import {
  cancelInviteAction,
  connectAction,
  inviteAction,
  revokeAction,
  signInAction,
} from "./actions";
import { PasswordForm, RiotIdForm } from "./forms";

export const dynamic = "force-dynamic";

const page: CSSProperties = {
  minHeight: "100vh",
  background: colors.bg,
  color: colors.text,
  padding: "40px 16px",
};
const column: CSSProperties = {
  maxWidth: 640,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 32,
};
const h1: CSSProperties = { fontFamily: headFont, fontSize: 32, margin: 0 };
const h2: CSSProperties = {
  fontFamily: headFont,
  fontSize: 20,
  margin: "0 0 8px",
};
const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "8px 0",
  borderBottom: `1px solid ${colors.border}`,
};
const date = (iso: string | null) => (iso ? iso.slice(0, 10) : "never");

export default async function SetupPage() {
  if (!(await isOwner())) {
    return (
      <main style={page}>
        <div style={column}>
          <h1 style={h1}>Owner setup</h1>
          <p style={{ color: colors.textDim }}>
            Enter the OWNER_PASSWORD set on this deployment.
          </p>
          <PasswordForm action={signInAction} />
        </div>
      </main>
    );
  }

  const { db } = getServices();
  const [connections, invites] = await Promise.all([
    listConnections(db),
    listInvites(db),
  ]);

  return (
    <main style={page}>
      <div style={column}>
        <h1 style={h1}>Owner setup</h1>

        <section>
          <h2 style={h2}>Connect your account</h2>
          <p style={{ color: colors.textDim }}>
            Enter your Riot ID to get a connector URL for Claude, ChatGPT or any
            MCP client.
          </p>
          <RiotIdForm
            action={connectAction}
            button="Create connector URL"
            resultLabel="Add this as a custom connector. It is shown once and works like a password."
          />
        </section>

        <section>
          <h2 style={h2}>Invite a friend</h2>
          <p style={{ color: colors.textDim }}>
            Friends who accept can use their own connector URL, and become
            available to compare against.
          </p>
          <RiotIdForm
            action={inviteAction}
            button="Create invite link"
            resultLabel="Send this single-use link to your friend."
          />
        </section>

        <section>
          <h2 style={h2}>Connector URLs</h2>
          {connections.length === 0 && (
            <p style={{ color: colors.textDim }}>None yet.</p>
          )}
          {connections.map((c) => (
            <form key={c.keyHash} action={revokeAction} style={row}>
              <span>
                {c.name}#{c.tag}
                <span style={{ color: colors.textDim }}>
                  {" "}
                  created {date(c.createdAt)}, last used {date(c.lastUsedAt)}
                </span>
              </span>
              <input type="hidden" name="keyHash" value={c.keyHash} />
              <button
                style={{ ...textLinkStyle, background: "none", border: 0 }}
              >
                Revoke
              </button>
            </form>
          ))}
        </section>

        {invites.length > 0 && (
          <section>
            <h2 style={h2}>Pending invites</h2>
            {invites.map((i) => (
              <form key={i.code} action={cancelInviteAction} style={row}>
                <span>
                  {i.name}#{i.tag}
                  <span style={{ color: colors.textDim }}>
                    {" "}
                    sent {date(i.created_at)}
                  </span>
                </span>
                <input type="hidden" name="code" value={i.code} />
                <button
                  style={{ ...textLinkStyle, background: "none", border: 0 }}
                >
                  Cancel
                </button>
              </form>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
