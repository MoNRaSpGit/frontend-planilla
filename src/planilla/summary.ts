import type { Match, SetState } from "./types";

function hhmm(iso: string | undefined) {
  if (!iso) return "";
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

// Hora de inicio y fin del set con su duracion (la planilla oficial las pide).
export function setDuration(set: SetState): string {
  if (!set.startedAt || !set.endedAt) return "";
  const minutes = Math.max(1, Math.round((new Date(set.endedAt).getTime() - new Date(set.startedAt).getTime()) / 60000));
  return `${hhmm(set.startedAt)}–${hhmm(set.endedAt)} (${minutes} min)`;
}

function formatDate(key: string) {
  const [year, month, day] = key.split("-");
  return year && month && day ? `${day}/${month}/${year}` : key;
}

// Resumen en texto para mandar por WhatsApp (o copiar) al terminar.
export function buildSummary(match: Match): string {
  const { A, B } = match.teams;
  const lines: string[] = [];
  const category = match.category ? ` · ${match.category.sex === "masculino" ? "Masculino" : "Femenino"} ${match.category.division}` : "";
  lines.push(`🏐 ${A.name} ${match.setsWon.A} - ${match.setsWon.B} ${B.name}${category}`);
  const info = match.info;
  if (info) {
    const when = [info.date ? formatDate(info.date) : "", info.time].filter(Boolean).join(" ");
    if (when || info.place) lines.push([when, info.place].filter(Boolean).join(" · "));
    const referees = [info.referee1, info.referee2].filter(Boolean).join(" y ");
    if (referees) lines.push(`Árbitros: ${referees}`);
    if (info.captainA || info.captainB) lines.push(`Capitanes: ${A.name} ${info.captainA || "-"} · ${B.name} ${info.captainB || "-"}`);
    if (info.coachA || info.coachB) lines.push(`Entrenadores: ${A.name} ${info.coachA || "-"} · ${B.name} ${info.coachB || "-"}`);
  }
  lines.push("");
  for (const set of match.sets) {
    const duration = setDuration(set);
    lines.push(`Set ${set.number}: ${set.score.A} - ${set.score.B}${duration ? `  ${duration}` : ""}`);
  }
  const sanctions = match.log.filter((entry) => entry.kind === "sanction");
  if (sanctions.length > 0) {
    lines.push("", "Sanciones:");
    for (const entry of sanctions) lines.push(`• Set ${entry.setNumber} (${entry.score.A}-${entry.score.B}): ${entry.text}`);
  }
  if (match.notes && match.notes.trim()) lines.push("", `Observaciones: ${match.notes.trim()}`);
  return lines.join("\n");
}
