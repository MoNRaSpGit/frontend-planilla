import type { LogEntry, LogKind, Match, Rotation, SetState, Side, TeamSetState } from "./types";

// Reglas de voley (FIVB indoor) que la planilla aplica sola. Todas las
// funciones son puras: reciben el partido y devuelven uno nuevo (asi
// "Deshacer" es volver al anterior).

export const POSITION_LABELS = ["I", "II", "III", "IV", "V", "VI"];
// Indices de la zona de atras (I, V, VI): donde puede estar el libero.
export const BACK_ROW = [0, 4, 5];
const FRONT_ROW_ENTRY = 3; // posicion IV: el primer lugar de adelante al rotar.

export function other(side: Side): Side {
  return side === "A" ? "B" : "A";
}

export function currentSet(match: Match): SetState | null {
  return match.sets[match.sets.length - 1] ?? null;
}

export function decidingSetNumber(match: Match) {
  return match.setsToWin * 2 - 1;
}

export function setTarget(match: Match, setNumber: number) {
  return setNumber === decidingSetNumber(match) ? 15 : 25;
}

// Rotacion en el sentido de las agujas del reloj: el de II pasa a I (y
// saca), el de I pasa a VI, VI a V, V a IV, IV a III, III a II.
export function rotate(rotation: Rotation): Rotation {
  return [rotation[1], rotation[2], rotation[3], rotation[4], rotation[5], rotation[0]];
}

// Quien esta realmente en cada posicion (con el libero en lugar del que
// reemplaza).
export function onCourt(team: TeamSetState): number[] {
  return team.rotation.map((number) => (team.liberoOn && team.liberoOn.replaced === number ? team.liberoOn.libero : number));
}

export function serverNumber(set: SetState, side: Side) {
  return onCourt(set.teams[side])[0];
}

function addLog(match: Match, kind: LogKind, side: Side | null, text: string): Match {
  const set = currentSet(match);
  const entry: LogEntry = {
    id: match.nextLogId,
    setNumber: set?.number ?? 0,
    kind,
    side,
    text,
    score: set ? { ...set.score } : { A: 0, B: 0 }
  };
  return { ...match, log: [...match.log, entry], nextLogId: match.nextLogId + 1 };
}

function replaceSet(match: Match, set: SetState): Match {
  return { ...match, sets: [...match.sets.slice(0, -1), set] };
}

function teamName(match: Match, side: Side) {
  return match.teams[side].name;
}

// Primer saque de cada set: el set 1 lo eligen; despues se alterna (saca
// primero el que no saco primero en el set anterior). El set decisivo se
// sortea de nuevo, por eso ahi se pregunta.
export function defaultFirstServe(match: Match, setNumber: number): Side {
  if (setNumber === 1) return match.firstServeSet1;
  const previous = match.sets.find((set) => set.number === setNumber - 1);
  return previous ? other(previous.firstServe) : match.firstServeSet1;
}

export function startSet(match: Match, lineups: Record<Side, Rotation>, firstServe: Side): Match {
  const number = match.sets.length + 1;
  const emptyTeam = (rotation: Rotation): TeamSetState => ({ rotation: [...rotation], liberoOn: null, subs: [], subsUsed: 0, timeoutsUsed: 0 });
  const set: SetState = {
    number,
    score: { A: 0, B: 0 },
    serving: firstServe,
    firstServe,
    startingLineups: { A: [...lineups.A], B: [...lineups.B] },
    teams: { A: emptyTeam(lineups.A), B: emptyTeam(lineups.B) },
    winner: null
  };
  const next: Match = { ...match, sets: [...match.sets, set], phase: "playing" };
  return addLog(next, "set_start", null, `Empieza el set ${number} · saca ${teamName(match, firstServe)} (#${lineups[firstServe][0]})`);
}

// El libero tiene que salir si al rotar le toca pasar adelante (IV).
function liberoMustLeave(team: TeamSetState) {
  if (!team.liberoOn) return false;
  return team.rotation.indexOf(team.liberoOn.replaced) === FRONT_ROW_ENTRY;
}

export function scorePoint(match: Match, side: Side): Match {
  const set = currentSet(match);
  if (!set || match.phase !== "playing") return match;

  const score = { ...set.score, [side]: set.score[side] + 1 };
  let team = set.teams[side];
  let rotated = false;
  let liberoLeft: number | null = null;

  // Si el que gano el tanto estaba recibiendo, recupera el saque y rota.
  if (set.serving !== side) {
    team = { ...team, rotation: rotate(team.rotation) };
    rotated = true;
    if (liberoMustLeave(team)) {
      liberoLeft = team.liberoOn!.libero;
      team = { ...team, liberoOn: null };
    }
  }

  let nextSet: SetState = { ...set, score, serving: side, teams: { ...set.teams, [side]: team } };
  const server = serverNumber(nextSet, side);
  let next = replaceSet(match, nextSet);
  next = addLog(
    next,
    "point",
    side,
    `Tanto ${teamName(match, side)}${rotated ? ` · rota y saca #${server}` : ` · sigue sacando #${server}`}`
  );
  if (liberoLeft !== null) {
    next = addLog(next, "libero_out", side, `Sale el líbero #${liberoLeft} (le tocaba pasar adelante) · vuelve #${team.rotation[FRONT_ROW_ENTRY]}`);
  }

  // Fin de set: llegar a 25 (15 el decisivo) con 2 de diferencia.
  const target = setTarget(match, set.number);
  if (score[side] >= target && score[side] - score[other(side)] >= 2) {
    nextSet = { ...nextSet, winner: side };
    const setsWon = { ...next.setsWon, [side]: next.setsWon[side] + 1 };
    const finished = setsWon[side] >= match.setsToWin;
    next = { ...replaceSet(next, nextSet), setsWon, phase: finished ? "finished" : "set_over" };
    next = addLog(next, "set_end", side, `Set ${set.number} para ${teamName(match, side)} ${score[side]}-${score[other(side)]}`);
  }
  return next;
}

export type SubCheck = { ok: true } | { ok: false; reason: string };

// Validacion de un cambio comun (no cuenta el libero): maximo 6 por set;
// el titular sale una sola vez y vuelve solo por el que lo reemplazo, en
// su mismo lugar; el que entro solo puede salir por ese titular.
export function checkSubstitution(match: Match, side: Side, outNumber: number, inNumber: number | null): SubCheck {
  const set = currentSet(match);
  if (!set) return { ok: false, reason: "No hay set en juego." };
  const team = set.teams[side];
  const info = match.teams[side];

  if (team.liberoOn && team.liberoOn.replaced === outNumber) return { ok: false, reason: "Está afuera por el líbero." };
  if (!team.rotation.includes(outNumber)) return { ok: false, reason: "No está en cancha." };
  const pair = team.subs.find((entry) => entry.starter === outNumber || entry.sub === outNumber);
  if (pair && pair.closed) return { ok: false, reason: "Ya salió y volvió en este set." };
  if (team.subsUsed >= 6) return { ok: false, reason: "Ya se hicieron los 6 cambios del set." };
  if (inNumber === null) return { ok: true };

  if (info.liberos.includes(inNumber)) return { ok: false, reason: "El líbero entra con el botón Líbero." };
  if (team.rotation.includes(inNumber)) return { ok: false, reason: "Ya está en cancha." };
  if (pair && pair.sub === outNumber) {
    return inNumber === pair.starter ? { ok: true } : { ok: false, reason: `Solo puede volver el #${pair.starter}.` };
  }
  const inPair = team.subs.find((entry) => entry.starter === inNumber || entry.sub === inNumber);
  if (inPair) {
    return { ok: false, reason: inPair.closed ? "Ya entró y salió en este set." : `Solo puede entrar por el #${inPair.sub}.` };
  }
  return { ok: true };
}

export function substitute(match: Match, side: Side, outNumber: number, inNumber: number): Match {
  const check = checkSubstitution(match, side, outNumber, inNumber);
  const set = currentSet(match);
  if (!check.ok || !set) return match;
  const team = set.teams[side];
  const pair = team.subs.find((entry) => entry.sub === outNumber && !entry.closed);
  const subs = pair
    ? team.subs.map((entry) => (entry === pair ? { ...entry, closed: true } : entry))
    : [...team.subs, { starter: outNumber, sub: inNumber, closed: false }];
  const rotation = team.rotation.map((number) => (number === outNumber ? inNumber : number));
  const nextTeam: TeamSetState = { ...team, rotation, subs, subsUsed: team.subsUsed + 1 };
  const next = replaceSet(match, { ...set, teams: { ...set.teams, [side]: nextTeam } });
  return addLog(next, "sub", side, `Cambio ${teamName(match, side)}: sale #${outNumber}, entra #${inNumber} (${nextTeam.subsUsed}/6)`);
}

// Donde puede entrar el libero: un jugador de atras (I, V, VI). En I no
// si su equipo esta sacando (el libero no saca).
export function liberoTargets(match: Match, side: Side): number[] {
  const set = currentSet(match);
  if (!set) return [];
  const team = set.teams[side];
  return BACK_ROW.filter((index) => !(index === 0 && set.serving === side)).map((index) => team.rotation[index]);
}

export function liberoIn(match: Match, side: Side, libero: number, replaced: number): Match {
  const set = currentSet(match);
  if (!set || !liberoTargets(match, side).includes(replaced)) return match;
  const team = set.teams[side];
  const previous = team.liberoOn;
  const nextTeam: TeamSetState = { ...team, liberoOn: { libero, replaced } };
  const next = replaceSet(match, { ...set, teams: { ...set.teams, [side]: nextTeam } });
  const text = previous
    ? `Líbero ${teamName(match, side)}: sale #${previous.libero} (vuelve #${previous.replaced}), entra #${libero} por #${replaced}`
    : `Líbero ${teamName(match, side)}: entra #${libero} por #${replaced}`;
  return addLog(next, "libero_in", side, text);
}

export function liberoOut(match: Match, side: Side): Match {
  const set = currentSet(match);
  if (!set || !set.teams[side].liberoOn) return match;
  const team = set.teams[side];
  const { libero, replaced } = team.liberoOn!;
  const next = replaceSet(match, { ...set, teams: { ...set.teams, [side]: { ...team, liberoOn: null } } });
  return addLog(next, "libero_out", side, `Líbero ${teamName(match, side)}: sale #${libero}, vuelve #${replaced}`);
}

export function timeout(match: Match, side: Side): Match {
  const set = currentSet(match);
  if (!set || set.teams[side].timeoutsUsed >= 2) return match;
  const team = set.teams[side];
  const nextTeam = { ...team, timeoutsUsed: team.timeoutsUsed + 1 };
  const next = replaceSet(match, { ...set, teams: { ...set.teams, [side]: nextTeam } });
  return addLog(next, "timeout", side, `Tiempo ${teamName(match, side)} (${nextTeam.timeoutsUsed}/2)`);
}

export function newMatch(): Match {
  return {
    teams: {
      A: { name: "Local", players: [], liberos: [] },
      B: { name: "Visitante", players: [], liberos: [] }
    },
    setsToWin: 3,
    firstServeSet1: "A",
    sets: [],
    setsWon: { A: 0, B: 0 },
    phase: "setup",
    log: [],
    nextLogId: 1
  };
}
