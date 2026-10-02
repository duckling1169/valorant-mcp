import { Readout } from "./_components/Readout";

const REPO = "https://github.com/duckling1169/valorant-mcp";
const DEPLOY =
  "https://vercel.com/new/clone?repository-url=" +
  encodeURIComponent(REPO) +
  "&env=HENRIKDEV_API_KEY,OWNER_PASSWORD&envDescription=" +
  encodeURIComponent(
    "A HenrikDev API key, and any long password to unlock /setup.",
  );

export default function Home() {
  return (
    <main className="page">
      <div className="wrap">
        <nav className="nav" aria-label="Main">
          <span className="wordmark">
            Valorant<span>/</span>MCP
          </span>
          <span className="nav-links">
            <a href={REPO}>GitHub</a>
            <a className="button" href="/setup">
              Set up
            </a>
          </span>
        </nav>

        <section className="hero">
          <h1>Ask your AI about your last match</h1>
          <p className="lede">
            Your VALORANT ranks, matches and round-by-round stats, available to
            Claude, ChatGPT and any MCP client. Self-hosted, read-only, and only
            for players who opt in.
          </p>
          <div className="actions">
            <a className="button" href="#setup">
              Set it up
            </a>
            <a className="button ghost" href={REPO}>
              View source
            </a>
          </div>
        </section>

        <section className="section tight" aria-labelledby="tools">
          <h2 id="tools">What it can answer</h2>
          <p className="sub">
            Eight tools covering your profile, match history, per-match
            breakdowns, trends and head-to-heads with friends.
          </p>
          <Readout />
        </section>

        <section className="section" id="setup" aria-labelledby="setup-title">
          <h2 id="setup-title">Set it up</h2>
          <p className="sub">
            About five minutes. You need a Vercel account and a free HenrikDev
            API key.
          </p>
          <ol className="steps">
            <li>
              <div>
                <h3>Get a HenrikDev API key</h3>
                <p>HenrikDev serves the match data. Keys are free.</p>
              </div>
              <a className="button ghost" href="https://docs.henrikdev.xyz">
                HenrikDev docs
              </a>
            </li>
            <li>
              <div>
                <h3>Deploy your own copy</h3>
                <p>
                  Set <code>HENRIKDEV_API_KEY</code> and an{" "}
                  <code>OWNER_PASSWORD</code>, and add a Neon Postgres database
                  from the Vercel Marketplace. Tables are created on first use.
                </p>
              </div>
              <a className="button" href={DEPLOY}>
                Deploy to Vercel
              </a>
            </li>
            <li>
              <div>
                <h3>Add your Riot ID on your setup page</h3>
                <p>
                  Unlock <code>/setup</code> with your password and enter your
                  Riot ID. You get a connector URL, shown once.
                </p>
              </div>
            </li>
            <li>
              <div>
                <h3>Add it to your assistant</h3>
                <p>
                  Paste the URL as a custom connector in Claude, ChatGPT or
                  Cursor. Invite friends from <code>/setup</code> to compare
                  against them.
                </p>
              </div>
            </li>
          </ol>
        </section>

        <footer className="footer">
          <span>
            Data from HenrikDev. Not affiliated with or endorsed by Riot Games.
          </span>
          <a href={REPO}>MIT licensed on GitHub</a>
        </footer>
      </div>
    </main>
  );
}
