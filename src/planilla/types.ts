// Planilla de voley (26/10/2026): el planillero solo anota de quien es
// cada tanto; saque, rotacion, cambios, libero y sets salen de las reglas
// (ver rules.ts).

export type Side = "A" | "B";

// key = jugador del catalogo ("c<id>"): sirve para recordar su numero.
export type Player = { number: number; name: string; key?: string };

export type TeamInfo = {
  name: string;
  // Cuadro elegido del catalogo (copiado de juez); null = cargado a mano.
  catalogTeamId: number | null;
  players: Player[];
  // Numeros de los liberos (hasta 2), tambien estan en players.
  liberos: number[];
  // Jugadores del cuadro que no se anotaron (sin numero): si llegan tarde
  // se suman entre sets eligiendolos de aca (pedido explicito 26/10/2026:
  // "siempre del cuadro, nunca uno inventado").
  reserves?: { key: string; name: string }[];
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
  // Hora de inicio y de fin del set (la planilla oficial las pide).
  startedAt?: string;
  endedAt?: string;
  // Set decisivo: ya se hizo el cambio de cancha al llegar a 8.
  courtChanged?: boolean;
};

export type LogKind = "point" | "sub" | "libero_in" | "libero_out" | "timeout" | "set_start" | "set_end" | "sanction" | "court_change";

export type LogEntry = {
  id: number;
  setNumber: number;
  kind: LogKind;
  side: Side | null;
  text: string;
  score: Record<Side, number>;
};

export type Phase = "setup" | "lineup" | "playing" | "set_over" | "finished";

// Datos de la cabecera de la planilla (todos opcionales).
export type MatchInfo = {
  date: string;
  time: string;
  place: string;
  referee1: string;
  referee2: string;
  captainA: string;
  captainB: string;
  coachA: string;
  coachB: string;
};

export type Match = {
  info?: MatchInfo;
  // Observaciones / protesta, texto libre.
  notes?: string;
  teams: Record<Side, TeamInfo>;
  // Sets para ganar. Desde 26/10/2026 siempre 2 (partido a 3 sets: 25,
  // 25 y el tercero a 15); el tipo admite 3 por partidos guardados antes.
  setsToWin: 2 | 3;
  category: { sex: "masculino" | "femenino"; division: "A" | "B" } | null;
  firstServeSet1: Side;
  sets: SetState[];
  setsWon: Record<Side, number>;
  phase: Phase;
  log: LogEntry[];
  nextLogId: number;
};
