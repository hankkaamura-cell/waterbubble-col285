import { fetchMetisLocationBoard, MetisBoard, MetisLocation } from "./metisLocationSharingClient";
import "./metisLocationSharingPanel.css";

function safe(value: string | null | undefined, fallback = "Unknown"): string {
  return value || fallback;
}

function age(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return "unknown age";
  if (minutes < 1) return "just now";
  if (minutes === 1) return "1 minute ago";
  if (minutes < 60) return `${minutes} minutes ago`;
  const hours = Math.floor(minutes / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

function commanderCard(c: MetisLocation): string {
  return `
    <article class="metis-card">
      <div class="metis-card-top">
        <div>
          <div class="metis-name">${safe(c.display_name || c.commander_name)}</div>
          <div class="metis-role">${safe(c.squadron_role, "Squadron Member")}</div>
        </div>
        <div class="metis-status ${c.confidence}">${c.confidence.replace("_", " ")}</div>
      </div>
      <div class="metis-system">${safe(c.system_name)}</div>
      <div class="metis-meta">
        <div>Station: ${safe(c.station_name, "—")}</div>
        <div>Ship: ${safe(c.ship_type, "—")}</div>
        <div>Last seen: ${age(c.age_minutes)}</div>
      </div>
      <div class="metis-source">Source: ${safe(c.source)}${c.source_detail ? " · " + c.source_detail : ""}</div>
    </article>`;
}

function renderBoard(target: HTMLElement, board: MetisBoard): void {
  const counts = board.counts || {};
  target.innerHTML = `
    <section class="metis-panel">
      <header class="metis-header">
        <div>
          <h2>METIS Location Sharing</h2>
          <p>${board.phase}</p>
        </div>
        <span>Generated ${new Date(board.generated_at).toLocaleString()}</span>
      </header>
      <section class="metis-summary">
        ${["total", "live", "recent", "last_known", "unknown"].map(key => `
          <div class="metis-stat"><b>${counts[key] ?? 0}</b><span>${key.replace("_", " ")}</span></div>
        `).join("")}
      </section>
      <section class="metis-grid">
        ${board.commanders.length ? board.commanders.map(commanderCard).join("") : `<div class="metis-error">No commanders have reported into METIS yet.</div>`}
      </section>
    </section>`;
}

export function mountMetisLocationPanel(target: HTMLElement, apiBase = "http://127.0.0.1:8000"): void {
  async function refresh() {
    try {
      const board = await fetchMetisLocationBoard(apiBase);
      renderBoard(target, board);
    } catch (err) {
      target.innerHTML = `<div class="metis-error">Could not reach METIS backend: ${err}</div>`;
    }
  }

  refresh();
  window.setInterval(refresh, 30_000);
}
