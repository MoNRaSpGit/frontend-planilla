import type { CatalogSex, CatalogDivision, CatalogTeam } from "../planilla/catalog";
import type { Match } from "../planilla/types";

// Liga simulada (11/11/2026, pedido explicito): cada partido que se termina
// en la planilla se anota solo en la tabla, y para probar el flujo hay
// resultados de EJEMPLO al azar. Todo queda en el celular (localStorage).

export type LeagueSex = CatalogSex;
export type LeagueDivision = CatalogDivision;

export type LeagueResult = {
  id: number;
  sex: LeagueSex;
  division: LeagueDivision;
  homeId: number;
  awayId: number;
  // Tantos de cada set: [local, visitante].
  sets: [number, number][];
  // Fecha en formato AAAA-MM-DD.
  date: string;
  // true = de ejemplo (generado al azar), false = jugado en la planilla.
  demo: boolean;
};

export type LeagueData = {
  results: LeagueResult[];
  nextId: number;
  // Ya se genero el ejemplo una vez (no volver a hacerlo solo).
  seeded?: boolean;
  // Firma del ultimo partido de la planilla ya anotado.
  lastSignature?: string;
};

// Puntos de tabla por partido (a confirmar con el reglamento de la liga):
// ganar 2-0 = 3, ganar 2-1 = 2, perder 1-2 = 1, perder 0-2 = 0.
export const POINTS = { win20: 3, win21: 2, loss12: 1, loss02: 0 };

const STORAGE_KEY = "planilla-liga";

export function loadLeague(): LeagueData | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as LeagueData) : null;
  } catch {
    return null;
  }
}

export function saveLeague(data: LeagueData) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Sin storage: la liga sigue en memoria mientras la app esta abierta.
  }
}

// ---------- tabla ----------

export type Standing = {
  teamId: number;
  name: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  pointsFor: number;
  pointsAgainst: number;
};

// Set average = sets a favor / sets en contra. Point average igual con
// los tantos. Sin nada en contra no se puede dividir: se muestra "∞".
export function average(favor: number, against: number): number {
  if (against === 0) return favor === 0 ? 0 : Infinity;
  return favor / against;
}

export function formatAverage(favor: number, against: number): string {
  if (favor === 0 && against === 0) return "–";
  const value = average(favor, against);
  return value === Infinity ? "∞" : value.toFixed(2);
}

export function setsOf(result: LeagueResult): [number, number] {
  let home = 0;
  let away = 0;
  for (const [h, a] of result.sets) {
    if (h > a) home += 1;
    else away += 1;
  }
  return [home, away];
}

function matchPoints(won: number, lost: number): number {
  if (won > lost) return lost === 0 ? POINTS.win20 : POINTS.win21;
  return won === 0 ? POINTS.loss02 : POINTS.loss12;
}

export function buildStandings(teams: CatalogTeam[], results: LeagueResult[]): Standing[] {
  const table = new Map<number, Standing>();
  for (const team of teams) {
    table.set(team.id, {
      teamId: team.id,
      name: team.name,
      played: 0,
      won: 0,
      lost: 0,
      points: 0,
      setsFor: 0,
      setsAgainst: 0,
      pointsFor: 0,
      pointsAgainst: 0
    });
  }
  for (const result of results) {
    const home = table.get(result.homeId);
    const away = table.get(result.awayId);
    if (!home || !away) continue;
    const [homeSets, awaySets] = setsOf(result);
    const homePoints = result.sets.reduce((total, set) => total + set[0], 0);
    const awayPoints = result.sets.reduce((total, set) => total + set[1], 0);
    for (const [row, mySets, theirSets, myPoints, theirPoints] of [
      [home, homeSets, awaySets, homePoints, awayPoints],
      [away, awaySets, homeSets, awayPoints, homePoints]
    ] as const) {
      row.played += 1;
      if (mySets > theirSets) row.won += 1;
      else row.lost += 1;
      row.points += matchPoints(mySets, theirSets);
      row.setsFor += mySets;
      row.setsAgainst += theirSets;
      row.pointsFor += myPoints;
      row.pointsAgainst += theirPoints;
    }
  }
  // Orden: puntos, despues set average, despues point average, despues nombre.
  return [...table.values()].sort(
    (a, b) =>
      b.points - a.points ||
      average(b.setsFor, b.setsAgainst) - average(a.setsFor, a.setsAgainst) ||
      average(b.pointsFor, b.pointsAgainst) - average(a.pointsFor, a.pointsAgainst) ||
      a.name.localeCompare(b.name)
  );
}

// ---------- partido real de la planilla ----------

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

// Firma del partido terminado: evita anotarlo dos veces si la pantalla
// se vuelve a abrir. null = no se puede anotar (cuadros cargados a mano,
// sin categoria o sin terminar).
export function matchSignature(match: Match): string | null {
  const a = match.teams.A.catalogTeamId;
  const b = match.teams.B.catalogTeamId;
  if (match.phase !== "finished" || a == null || b == null || !match.category) return null;
  return `${a}-${b}-${match.nextLogId}-${match.sets.map((set) => `${set.score.A}:${set.score.B}`).join(",")}`;
}

export function resultFromMatch(match: Match, id: number): LeagueResult | null {
  const a = match.teams.A.catalogTeamId;
  const b = match.teams.B.catalogTeamId;
  if (a == null || b == null || !match.category) return null;
  return {
    id,
    sex: match.category.sex,
    division: match.category.division,
    homeId: a,
    awayId: b,
    sets: match.sets.map((set) => [set.score.A, set.score.B] as [number, number]),
    date: todayKey(),
    demo: false
  };
}

// ---------- ejemplo al azar ----------

// Generador con semilla: el ejemplo de cada categoria sale igual cada vez
// que se regenera (mientras no cambien los cuadros).
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function randomSet(random: () => number, winnerIsHome: boolean, target: number): [number, number] {
  const loser = Math.floor(random() * (target - 8)) + 6; // 6 .. target-3
  const close = random() < 0.25;
  const loserPoints = close ? target - 1 : loser;
  const winnerPoints = close ? target + 1 : target;
  return winnerIsHome ? [winnerPoints, loserPoints] : [loserPoints, winnerPoints];
}

export function generateDemoResults(teams: CatalogTeam[], startId: number): LeagueResult[] {
  const results: LeagueResult[] = [];
  let id = startId;
  const groups = new Map<string, CatalogTeam[]>();
  for (const team of teams) {
    const key = `${team.sex}-${team.division}`;
    groups.set(key, [...(groups.get(key) ?? []), team]);
  }
  for (const [key, group] of groups) {
    const random = seeded([...key].reduce((total, char) => total * 31 + char.charCodeAt(0), 7));
    const strength = new Map(group.map((team) => [team.id, random()]));
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        if (random() > 0.6) continue; // no todos se enfrentaron todavia
        const homeFirst = random() < 0.5;
        const home = homeFirst ? group[i] : group[j];
        const away = homeFirst ? group[j] : group[i];
        const chanceHome = 0.5 + ((strength.get(home.id) ?? 0.5) - (strength.get(away.id) ?? 0.5)) * 0.8;
        const homeWins = random() < chanceHome;
        const threeSets = random() < 0.4;
        const sets: [number, number][] = [];
        if (threeSets) {
          // El ganador pierde un set (el primero o el segundo) y gana el tercero a 15.
          const loseAt = random() < 0.5 ? 0 : 1;
          for (let s = 0; s < 2; s += 1) sets.push(randomSet(random, s === loseAt ? !homeWins : homeWins, 25));
          sets.push(randomSet(random, homeWins, 15));
        } else {
          sets.push(randomSet(random, homeWins, 25), randomSet(random, homeWins, 25));
        }
        results.push({
          id,
          sex: home.sex,
          division: home.division,
          homeId: home.id,
          awayId: away.id,
          sets,
          date: dateDaysAgo(Math.floor(random() * 50) + 1),
          demo: true
        });
        id += 1;
      }
    }
  }
  return results;
}
