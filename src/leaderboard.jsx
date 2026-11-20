import { useEffect, useRef, useState } from "react";
import { formatShiftTime } from "./data.js";

const api = "https://kombucha-leaderboard.djrozzo.workers.dev/api/le-martini-endless";
const nicknameKey = "le-martini-nickname";

export function readStorage(key, fallback = "") {
  try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; }
}
export function writeStorage(key, value) {
  try { localStorage.setItem(key, value); } catch {}
}

async function request(path, body) {
  const options = { signal: AbortSignal.timeout(8000) };
  if (body !== undefined) {
    options.method = "POST";
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(body);
  }
  const response = await fetch(api + path, options);
  if (!response.ok) throw new Error("Leaderboard response " + response.status);
  return response.json();
}

export function useRanking() {
  const [run, setRun] = useState(null);
  const active = useRef(null);

  function publish(current) {
    if (active.current === current) setRun({ ...current });
  }

  function begin() {
    const current = { token: null, score: 0, pending: false, posted: false, loading: true, error: "" };
    active.current = current;
    publish(current);
    request("/run", {}).then(({ token }) => { current.token = token; }).catch(() => {}).finally(() => {
      current.loading = false;
      publish(current);
    });
  }

  function finish(score) {
    if (!active.current) return;
    active.current.score = score;
    publish(active.current);
  }

  async function submit(name) {
    const current = active.current;
    if (!current?.score || !current.token || current.pending || current.posted) return false;
    if (!name || name.length > 24 || /[\p{Cc}\p{Cf}]/u.test(name)) {
      current.error = "Enter a nickname of up to 24 characters.";
      publish(current);
      return false;
    }
    current.pending = true;
    current.error = "";
    publish(current);
    try {
      await request("/scores", { name, score: current.score, token: current.token });
      current.posted = true;
      writeStorage(nicknameKey, name);
      return true;
    } catch {
      current.error = "Could not post this time. Try again.";
      return false;
    } finally {
      current.pending = false;
      publish(current);
    }
  }

  return { run, begin, finish, submit };
}

export function Leaderboard({ open, onClose, run, submit }) {
  const dialog = useRef(null);
  const [board, setBoard] = useState({ entries: [], status: "Loading times…" });
  const [nickname, setNickname] = useState(() => readStorage(nicknameKey));
  const posted = run?.posted ?? false;

  useEffect(() => {
    const element = dialog.current;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    setBoard({ entries: [], status: "Loading times…" });
    request("/scores").then(({ entries }) => {
      if (current) setBoard({ entries, status: entries.length ? "Top 10 longest shifts" : "No times yet." });
    }).catch(() => {
      if (current) setBoard({ entries: [], status: "Leaderboard is unavailable right now." });
    });
    return () => { current = false; };
  }, [open, posted]);

  const status = run?.error || (posted ? "Time posted."
    : run?.pending ? "Posting time…" : run?.token ? ""
      : run?.loading ? "Connecting to the leaderboard…" : "Ranking was unavailable at the start of this shift.");

  return <dialog ref={dialog} id="leaderboard-dialog" aria-labelledby="leaderboard-title" onClose={onClose}>
    <div className="dialog-heading">
      <h2 id="leaderboard-title">Leaderboard</h2>
      <form method="dialog"><button className="quiet" autoFocus>Close</button></form>
    </div>
    <p id="leaderboard-status" role="status">{board.status}</p>
    <ol id="leaderboard-entries">{board.entries.map(({ name, score }, index) =>
      <li key={name + ":" + index}><span>{name}</span><strong>{formatShiftTime(score)}</strong></li>)}</ol>
    {run?.score > 0 && <form id="score-form" onSubmit={event => { event.preventDefault(); submit(nickname.trim()); }}>
      <label htmlFor="nickname">Nickname</label>
      <div className="score-controls">
        <input id="nickname" name="nickname" maxLength={24} autoComplete="nickname" required
          value={nickname} onChange={event => setNickname(event.target.value)} />
        <button className="primary" id="submit-score" disabled={!run.token || run.posted || run.pending}>Post time</button>
      </div>
      <p id="score-status" role="status">{status}</p>
    </form>}
  </dialog>;
}
