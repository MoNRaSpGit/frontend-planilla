import { API_BASE_URL } from "../shared/api";

// Cuadros y jugadores copiados de juez (backend: GET /planilla/catalog).
export type CatalogSex = "masculino" | "femenino";
export type CatalogDivision = "A" | "B";
export type CatalogPlayer = { id: number; firstName: string; lastName: string; expiryDate?: string | null };
export type CatalogTeam = { id: number; name: string; division: CatalogDivision; sex: CatalogSex; players: CatalogPlayer[] };

export async function fetchCatalog(): Promise<CatalogTeam[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/planilla/catalog`, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron cargar los cuadros.");
  const data = (await response.json()) as { teams: CatalogTeam[] };
  return data.teams;
}

// Una sola descarga por sesion (la usan Datos y "Llego alguien?").
let catalogPromise: Promise<CatalogTeam[]> | null = null;
export function getCatalogCached(): Promise<CatalogTeam[]> {
  if (!catalogPromise) {
    catalogPromise = fetchCatalog().catch((error) => {
      catalogPromise = null;
      throw error;
    });
  }
  return catalogPromise;
}

// Aviso del carne del deportista (13/11/2026): rojo = vencido, amarillo =
// vence en 30 dias o menos. Es solo una alerta: nunca bloquea nada.
export type CarnetStatus = "expired" | "soon" | "ok";
export type CarnetInfo = { status: CarnetStatus; label: string };

export function carnetInfo(expiryDate: string | null | undefined): CarnetInfo | null {
  if (!expiryDate) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const [year, month, day] = expiryDate.split("-").map(Number);
  const expiry = new Date(year, month - 1, day).getTime();
  const shown = String(day).padStart(2, "0") + "/" + String(month).padStart(2, "0") + "/" + year;
  const days = Math.round((expiry - today) / 86400000);
  if (days < 0) return { status: "expired", label: "Carné vencido el " + shown };
  if (days <= 30) return { status: "soon", label: days === 0 ? "Carné vence hoy" : "Carné vence el " + shown };
  return { status: "ok", label: "" };
}

export function playerFullName(player: CatalogPlayer) {
  return `${player.firstName} ${player.lastName}`.trim();
}

// Numero de camiseta y libero de cada jugador del catalogo: juez no los
// tiene, se ponen en la planilla y el celular los recuerda para la
// proxima vez que juegue ese cuadro.
const NUMBERS_KEY = "planilla-numeros";
export type RememberedPlayer = { number: number | null; libero: boolean };

export function loadRemembered(): Record<string, RememberedPlayer> {
  try {
    return JSON.parse(window.localStorage.getItem(NUMBERS_KEY) || "{}") as Record<string, RememberedPlayer>;
  } catch {
    return {};
  }
}

export function saveRemembered(entries: Record<string, RememberedPlayer>) {
  try {
    window.localStorage.setItem(NUMBERS_KEY, JSON.stringify({ ...loadRemembered(), ...entries }));
  } catch {
    // Sin storage: la proxima vez hay que volver a poner los numeros.
  }
}
