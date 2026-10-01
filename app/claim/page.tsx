import { getInvite } from "@/lib/connections";
import { getServices } from "@/lib/services";
import { ClaimForm } from "./form";

export const dynamic = "force-dynamic";

export default async function ClaimPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  const invite = code ? await getInvite(getServices().db, code) : null;

  return (
    <main className="page">
      <div className="narrow">
        <nav className="nav" aria-label="Main">
          <a className="wordmark" href="/">
            Valorant<span>/</span>MCP
          </a>
        </nav>
        <section className="panel">
          <h1>Connect your stats</h1>
          {invite && code ? (
            <>
              <p className="lead">
                You&apos;ve been invited to connect{" "}
                <strong style={{ color: "var(--text)" }}>
                  {invite.name}#{invite.tag}
                </strong>{" "}
                to an AI assistant through this server.
              </p>
              <p className="lead">
                If you accept, you get your own connector URL, and people on
                this server can look up your public VALORANT profile and match
                history and compare against you. Nothing is shared until you
                accept, and the server owner can remove you at any time.
              </p>
              <ClaimForm code={code} />
            </>
          ) : (
            <p>
              This invite link is invalid or has already been used. Ask for a
              new one.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
