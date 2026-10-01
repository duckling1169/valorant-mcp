"use client";

import { useState, type ReactNode } from "react";

// Example question and an illustrative answer per tool. Numbers are made up.
type Example = {
  tab: string;
  tools: string;
  question: string;
  answer: ReactNode;
};

const Stats = ({ items }: { items: [string, string][] }) => (
  <div className="stats">
    {items.map(([value, label]) => (
      <div className="stat" key={label}>
        <b>{value}</b>
        <span>{label}</span>
      </div>
    ))}
  </div>
);

const EXAMPLES: Example[] = [
  {
    tab: "Profile",
    tools: "get_profile",
    question: "What's my rank right now?",
    answer: (
      <Stats
        items={[
          ["D2 · 47", "Rank · RR"],
          ["Asc 1", "Peak rank"],
          ["212", "Account level"],
          ["NA", "Region"],
        ]}
      />
    ),
  },
  {
    tab: "Matches",
    tools: "get_recent_matches",
    question: "How did my last five games go?",
    answer: (
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th>Map</th>
              <th>Agent</th>
              <th>K / D / A</th>
              <th>Score</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["Ascent", "Jett", "24 / 15 / 4", "13–9", true],
              ["Lotus", "Jett", "17 / 18 / 6", "10–13", false],
              ["Sunset", "Raze", "21 / 14 / 8", "13–7", true],
              ["Bind", "Jett", "12 / 16 / 3", "8–13", false],
              ["Haven", "Neon", "26 / 19 / 5", "14–12", true],
            ].map(([map, agent, kda, score, won]) => (
              <tr key={String(map)}>
                <td>{map}</td>
                <td>{agent}</td>
                <td>{kda}</td>
                <td className={won ? "win" : "loss"}>{score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
  {
    tab: "Match detail",
    tools: "get_match_detail",
    question: "Break down my last Ascent game.",
    answer: (
      <Stats
        items={[
          ["268", "ACS"],
          ["78%", "KAST"],
          ["164", "ADR"],
          ["4", "First bloods"],
          ["1 / 2", "Clutches won"],
          ["Top 2", "In the lobby"],
        ]}
      />
    ),
  },
  {
    tab: "Stats",
    tools: "get_player_stats · search_match_history",
    question: "What's my headshot rate over my last 20 games?",
    answer: (
      <Stats
        items={[
          ["24%", "Headshot rate"],
          ["231", "Median ACS"],
          ["1.12", "K / D"],
          ["Jett · 9", "Most played"],
        ]}
      />
    ),
  },
  {
    tab: "Rank history",
    tools: "get_rank_history",
    question: "How much RR did I gain this week?",
    answer: (
      <Stats
        items={[
          ["+62", "RR this week"],
          ["9", "Games"],
          ["6 – 3", "Wins – losses"],
          ["+21", "Biggest gain"],
        ]}
      />
    ),
  },
  {
    tab: "Compare",
    tools: "compare_match · compare_rank",
    question: "Did I outplay their Sova last game?",
    answer: (
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th></th>
              <th>You</th>
              <th>Their Sova</th>
            </tr>
          </thead>
          <tbody>
            {[
              ["ACS", "268", "214"],
              ["K / D / A", "24 / 15 / 4", "18 / 19 / 9"],
              ["Headshot rate", "27%", "19%"],
              ["Rank", "Diamond 2", "Diamond 1"],
            ].map(([label, you, them]) => (
              <tr key={label}>
                <td>{label}</td>
                <td>{you}</td>
                <td>{them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    ),
  },
];

export function Readout() {
  const [index, setIndex] = useState(0);
  const example = EXAMPLES[index];
  if (!example) return null;

  return (
    <div className="readout">
      <div className="readout-tabs" role="tablist" aria-label="Tools">
        {EXAMPLES.map((e, i) => (
          <button
            key={e.tab}
            type="button"
            role="tab"
            className="readout-tab"
            aria-selected={i === index}
            onClick={() => setIndex(i)}
          >
            {e.tab}
            <small>{e.tools}</small>
          </button>
        ))}
      </div>
      <div className="readout-body" role="tabpanel" aria-label={example.tab}>
        <p className="readout-q">{example.question}</p>
        {example.answer}
        <p className="readout-note">
          Example answer. Your assistant gets real numbers from your matches.
        </p>
      </div>
    </div>
  );
}
