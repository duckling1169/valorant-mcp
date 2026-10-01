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
import { ConnectForm, InviteForm, PasswordForm } from "./forms";

export const dynamic = "force-dynamic";

const day = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "never";

function Nav() {
  return (
    <nav className="nav" aria-label="Main">
      <a className="wordmark" href="/">
        Valorant<span>/</span>MCP
      </a>
    </nav>
  );
}

export default async function SetupPage() {
  if (!(await isOwner())) {
    return (
      <main className="page">
        <div className="narrow">
          <Nav />
          <section className="panel">
            <h1>Owner setup</h1>
            <p>
              Enter the <code>OWNER_PASSWORD</code> you set on this deployment.
            </p>
            <PasswordForm action={signInAction} />
          </section>
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
    <main className="page">
      <div className="narrow">
        <Nav />

        <section className="panel">
          <h1>Connect a player</h1>
          <p>
            Enter your Riot ID, or a friend&apos;s if they&apos;ve agreed. Their
            profile becomes available to this server&apos;s tools.
          </p>
          <ConnectForm action={connectAction} />
        </section>

        <section className="panel">
          <h2>Invite a friend</h2>
          <p>
            They see what they&apos;re agreeing to, accept, and get their own
            connector URL.
          </p>
          <InviteForm action={inviteAction} />
        </section>

        <section className="panel" aria-labelledby="connections">
          <h2 id="connections">Connector URLs</h2>
          {connections.length === 0 ? (
            <p>None yet.</p>
          ) : (
            <ul className="list">
              {connections.map((c) => (
                <li key={c.keyHash}>
                  <span>
                    {c.name}#{c.tag}
                    <small>
                      Created {day(c.createdAt)}, last used {day(c.lastUsedAt)}
                    </small>
                  </span>
                  <form action={revokeAction}>
                    <input type="hidden" name="keyHash" value={c.keyHash} />
                    <button className="link-button">Revoke</button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>

        {invites.length > 0 && (
          <section className="panel" aria-labelledby="invites">
            <h2 id="invites">Pending invites</h2>
            <ul className="list">
              {invites.map((i) => (
                <li key={i.code}>
                  <span>
                    {i.name}#{i.tag}
                    <small>Sent {day(i.created_at)}</small>
                  </span>
                  <form action={cancelInviteAction}>
                    <input type="hidden" name="code" value={i.code} />
                    <button className="link-button">Cancel</button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </main>
  );
}
