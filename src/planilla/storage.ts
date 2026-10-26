import type { Match } from "./types";

// El partido queda guardado en el celular: si se bloquea la pantalla, se
// cierra el navegador o se recarga, sigue donde estaba (con el historial
// para "Deshacer").
const STORAGE_KEY = "planilla-voley";
const MAX_HISTORY = 300;

export type Saved = { match: Match; history: Match[] };

export function loadSaved(): Saved | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

export function save(saved: Saved) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ match: saved.match, history: saved.history.slice(-MAX_HISTORY) }));
  } catch {
    // Sin espacio o sin storage: el partido sigue en memoria igual.
  }
}

export function clearSaved() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nada
  }
}
