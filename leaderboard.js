"use strict";

const leaderboard = (() => {
  const api = "https://kombucha-leaderboard.djrozzo.workers.dev/api/le-martini";
  const element = (id) => document.getElementById(id);
  const dialog = element("leaderboard-dialog");
  const boardStatus = element("leaderboard-status");
  const entries = element("leaderboard-entries");
  const form = element("score-form");
  const submit = element("submit-score");
  const input = element("nickname");
  const status = element("score-status");
  const nicknameKey = "le-martini-nickname";
  let current;

  try { input.value = localStorage.getItem(nicknameKey) || ""; } catch {}

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

  async function refresh() {
    boardStatus.textContent = "Loading scores…";
    try {
      const data = await request("/scores");
      const rows = data.entries.map(({ name, score }) => {
        const row = document.createElement("li");
        const player = document.createElement("span");
        const tips = document.createElement("strong");
        player.textContent = name;
        tips.textContent = "$" + score;
        row.append(player, tips);
        return row;
      });
      entries.replaceChildren(...rows);
      boardStatus.textContent = rows.length ? "Top 10 by tips" : "No scores yet.";
    } catch {
      entries.replaceChildren();
      boardStatus.textContent = "Leaderboard is unavailable right now.";
    }
  }

  function open() {
    form.hidden = !current?.score;
    submit.disabled = !current?.token || current.posted || current.pending;
    status.textContent = !current?.score ? "" : current.posted ? "Score posted."
      : current.pending ? "Posting score…" : current.token ? "" : "Ranking was unavailable at the start of this shift.";
    dialog.showModal();
    refresh();
  }

  document.querySelectorAll("[data-leaderboard]").forEach((button) => button.addEventListener("click", open));
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const run = current;
    const name = input.value.trim();
    if (!run?.score || !run.token || run.pending || run.posted) return;
    if (!name || /[\p{Cc}\p{Cf}]/u.test(name)) {
      status.textContent = "Enter a nickname of up to 24 characters.";
      return;
    }
    run.pending = true;
    submit.disabled = true;
    status.textContent = "Posting score…";
    try {
      await request("/scores", { name, score: run.score, token: run.token });
      run.posted = true;
      try { localStorage.setItem(nicknameKey, name); } catch {}
      if (current === run) status.textContent = "Score posted.";
      if (dialog.open) refresh();
    } catch {
      if (current === run) status.textContent = "Could not post this score. Try again.";
    } finally {
      run.pending = false;
      if (current === run) submit.disabled = run.posted;
    }
  });

  return {
    begin(ranked = true) {
      if (!ranked) {
        current = null;
        return;
      }
      const run = { token: null, score: 0, posted: false, pending: false };
      current = run;
      request("/run", {}).then(({ token }) => { run.token = token; }).catch(() => {});
    },
    finish(score) {
      if (current) current.score = score;
    },
  };
})();
