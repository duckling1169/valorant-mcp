import type { CSSProperties } from "react";
import { colors, headFont } from "@/app/_components/theme";
import { getInvite } from "@/lib/connections";
import { getServices } from "@/lib/services";
import { ClaimForm } from "./form";

export const dynamic = "force-dynamic";

const page: CSSProperties = {
  minHeight: "100vh",
  background: colors.bg,
  color: colors.text,
  padding: "40px 16px",
};
const column: CSSProperties = {
  maxWidth: 560,
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const invite = code ? await getInvite(getServices().db, code) : null;

  return (
    <main style={page}>
      <div style={column}>
        <h1 style={{ fontFamily: headFont, fontSize: 32, margin: 0 }}>
          Connect your VALORANT stats
        </h1>
        {invite && code ? (
          <>
            <p>
              You&apos;ve been invited to connect{" "}
              <strong>
                {invite.name}#{invite.tag}
              </strong>{" "}
              to an AI assistant through this server.
            </p>
            <p style={{ color: colors.textDim }}>
              If you accept, you get your own connector URL, and other people on
              this server can look up your public VALORANT profile and match
              history and compare against you. Nothing is shared until you
              accept. The server owner can remove you at any time.
            </p>
            <ClaimForm code={code} />
          </>
        ) : (
          <p style={{ color: colors.textDim }}>
            This invite link is invalid or has already been used. Ask for a new
            one.
          </p>
        )}
      </div>
    </main>
  );
}
