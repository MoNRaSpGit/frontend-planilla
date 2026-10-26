// Planilla de voley (26/10/2026): el planillero solo anota de quien es
// cada tanto; saque, rotacion, cambios, libero y sets salen de las reglas
// (ver rules.ts).

export type Side = "A" | "B";

export type Player = { number: number; name: string };

export type TeamInfo = {
  name: string;
  players: Player[];
  // Numeros de los liberos (hasta 2), tambien estan en players.
  liberos: number[];
};

// Los 6 de la formacion OFICIAL en cancha: indice 0 = posicion I (el que
// saca), 1 = II, 2 = III, 3 = IV, 4 = V, 5 = VI. El libero no va aca: se
// superpone al jugador que reemplaza (ver liberoOn).
export type Rotation = number[];

// Cambio de jugador dentro de un set: el titular sale una vez y solo puede
// volver por el mismo que lo reemplazo (y ahi la pareja queda cerrada).
export type SubPair = { starter: number; sub: number; closed: boolean };

export type TeamSetState = {
  rotation: Rotation;
  liberoOn: { libero: number; replaced: number } | null;
  subs: SubPair[];
  subsUsed: number;
  timeoutsUsed: number;
};

export type SetState = {
  number: number;
  score: Record<Side, number>;
  serving: Side;
  firstServe: Side;
  startingLineups: Record<Side, Rotation>;
  teams: Record<Side, TeamSetState>;
  winner: Side | null;
};

export type LogKind = "point" | "sub" | "libero_in" | "libero_out" | "timeout" | "set_start" | "set_end";

export type LogEntry = {
  id: number;
  setNumber: number;
  kind: LogKind;
  side: Side | null;
  text: string;
  score: Record<Side, number>;
};

export type Phase = "setup" | "lineup" | "playing" | "set_over" | "finished";

export type Match = {
  teams: Record<Side, TeamInfo>;
  // Sets para ganar: 3 (a 5 sets) o 2 (a 3 sets).
  setsToWin: 2 | 3;
  firstServeSet1: Side;
  sets: SetState[];
  setsWon: Record<Side, number>;
  phase: Phase;
  log: LogEntry[];
  nextLogId: number;
};
