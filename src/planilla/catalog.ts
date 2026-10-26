import { API_BASE_URL } from "../shared/api";

// Cuadros y jugadores copiados de juez (backend: GET /planilla/catalog).
export type CatalogSex = "masculino" | "femenino";
export type CatalogDivision = "A" | "B";
export type CatalogPlayer = { id: number; firstName: string; lastName: string };
export type CatalogTeam = { id: number; name: string; division: CatalogDivision; sex: CatalogSex; players: CatalogPlayer[] };

export async function fetchCatalog(): Promise<CatalogTeam[]> {
  const response = await fetch(`${API_BASE_URL}/api/v1/planilla/catalog`, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudieron cargar los cuadros.");
  const data = (await response.json()) as { teams: CatalogTeam[] };
  return data.teams;
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
