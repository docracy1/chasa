import { useEffect, useState } from "react";

type RoadmapFeature = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  yesVotes: number;
  noVotes: number;
  myVote: "yes" | "no" | null;
};

async function fetchRoadmap(): Promise<RoadmapFeature[]> {
  const res = await fetch("/api/roadmap", { credentials: "include" });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
  const data = (await res.json()) as { features: RoadmapFeature[] };
  return data.features;
}

async function castVote(id: string, vote: "yes" | "no"): Promise<void> {
  const res = await fetch(`/api/roadmap/${id}/vote`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote }),
  });
  if (!res.ok) throw new Error(`Request failed (${res.status})`);
}

export default function Roadmap() {
  const [features, setFeatures] = useState<RoadmapFeature[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    fetchRoadmap()
      .then(setFeatures)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load the roadmap"));
  }, []);

  async function vote(id: string, choice: "yes" | "no") {
    setPendingId(id);
    try {
      await castVote(id, choice);
      setFeatures((prev) =>
        prev
          ? prev.map((f) => {
              if (f.id !== id) return f;
              const hadYes = f.myVote === "yes";
              const hadNo = f.myVote === "no";
              return {
                ...f,
                myVote: choice,
                yesVotes: f.yesVotes + (choice === "yes" ? 1 : 0) - (hadYes ? 1 : 0),
                noVotes: f.noVotes + (choice === "no" ? 1 : 0) - (hadNo ? 1 : 0),
              };
            })
          : prev
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to vote");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="page-shell" style={{ maxWidth: 720, margin: "0 auto", padding: "40px 20px" }}>
      <h1>Roadmap</h1>
      <p className="page-sub">
        Vote on what we should build next. No account needed — your vote is remembered on this
        device.
      </p>
      {error && <p style={{ color: "var(--danger, #c0392b)" }}>{error}</p>}
      {!features && !error && <p>Loading…</p>}
      {features && features.length === 0 && <p>Nothing on the roadmap yet.</p>}
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
        {features?.map((f) => (
          <li key={f.id} className="dash-card" style={{ padding: 16 }}>
            <h3 style={{ margin: "0 0 4px" }}>{f.title}</h3>
            <p style={{ margin: "0 0 12px", color: "var(--mute, #666)" }}>{f.description}</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                className={f.myVote === "yes" ? "btn-primary" : "btn-secondary"}
                disabled={pendingId === f.id}
                onClick={() => void vote(f.id, "yes")}
              >
                👍 {f.yesVotes}
              </button>
              <button
                type="button"
                className={f.myVote === "no" ? "btn-primary" : "btn-secondary"}
                disabled={pendingId === f.id}
                onClick={() => void vote(f.id, "no")}
              >
                👎 {f.noVotes}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
