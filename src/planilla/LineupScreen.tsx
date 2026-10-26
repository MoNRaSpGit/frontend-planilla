import { useState } from "react";
import { saveRemembered } from "./catalog";
import { decidingSetNumber, defaultFirstServe, POSITION_LABELS, startSet } from "./rules";
import type { Match, Rotation, Side } from "./types";

type Props = {
  match: Match;
  onStart: (match: Match) => void;
  onBack: (() => void) | null;
  // Sumar un jugador que llego tarde (siempre de la lista del cuadro).
  onUpdate: (match: Match) => void;
};

// Orden en que se dibuja la cancha (vista del planillero): adelante IV III
// II, atras V VI I -- los indices son los de Rotation (0 = I).
export const COURT_ORDER = [
  [3, 2, 1],
  [4, 5, 0]
];

function emptyLineup(): (number | null)[] {
  return [null, null, null, null, null, null];
}

// Formacion inicial de cada set: que numero va en cada posicion (I a VI)
// y quien saca primero. Arranca con la formacion del set anterior.
export function LineupScreen({ match, onStart, onBack, onUpdate }: Props) {
  const setNumber = match.sets.length + 1;
  const previous = match.sets[match.sets.length - 1];
  const [lineups, setLineups] = useState<Record<Side, (number | null)[]>>({
    A: previous ? [...previous.startingLineups.A] : emptyLineup(),
    B: previous ? [...previous.startingLineups.B] : emptyLineup()
  });
  const [firstServe, setFirstServe] = useState<Side>(defaultFirstServe(match, setNumber));
  const [error, setError] = useState("");
  const [arrival, setArrival] = useState<Record<Side, { key: string; number: string; libero: boolean }>>({
    A: { key: "", number: "", libero: false },
    B: { key: "", number: "", libero: false }
  });
  const isDeciding = setNumber === decidingSetNumber(match);

  function setSlot(side: Side, index: number, value: number | null) {
    setLineups((current) => {
      const next = [...current[side]];
      // Si ese numero ya estaba en otra posicion, se saca de ahi.
      const existing = value === null ? -1 : next.indexOf(value);
      if (existing >= 0) next[existing] = null;
      next[index] = value;
      return { ...current, [side]: next };
    });
  }

  // Jugador que llego tarde (pedido explicito 26/10/2026: "capaz que llega
  // para el segundo set y ahi lo agregas, pero siempre del cuadro").
  function addArrival(side: Side) {
    const info = match.teams[side];
    const entry = arrival[side];
    const reserve = (info.reserves ?? []).find((candidate) => candidate.key === entry.key);
    if (!reserve) return setError(`Elegí el jugador de ${info.name} que llegó.`);
    const number = Number(entry.number);
    if (entry.number === "") return setError(`Poné el número de ${reserve.name}.`);
    if (info.players.some((player) => player.number === number)) return setError(`En ${info.name} ya está el #${number}.`);
    if (entry.libero && info.liberos.length >= 2) return setError(`${info.name} ya tiene 2 líberos.`);
    setError("");
    saveRemembered({ [reserve.key]: { number, libero: entry.libero } });
    onUpdate({
      ...match,
      teams: {
        ...match.teams,
        [side]: {
          ...info,
          players: [...info.players, { number, name: reserve.name, key: reserve.key }].sort((a, b) => a.number - b.number),
          liberos: entry.libero ? [...info.liberos, number] : info.liberos,
          reserves: (info.reserves ?? []).filter((candidate) => candidate.key !== reserve.key)
        }
      }
    });
    setArrival((current) => ({ ...current, [side]: { key: "", number: "", libero: false } }));
  }

  function handleStart() {
    for (const side of ["A", "B"] as Side[]) {
      if (lineups[side].some((value) => value === null)) {
        setError(`Completá las 6 posiciones de ${match.teams[side].name}.`);
        return;
      }
    }
    setError("");
    onStart(startSet(match, { A: lineups.A as Rotation, B: lineups.B as Rotation }, firstServe));
  }

  return (
    <main className="pl-screen">
      <h1 className="pl-title">Formación · set {setNumber}</h1>
      {onBack && (
        <button type="button" className="pl-link" onClick={onBack}>
          ← Volver a los datos
        </button>
      )}

      <section className="pl-card">
        <div className="pl-row">
          <span className="pl-label">Saca primero{isDeciding ? " (set decisivo: sorteo)" : ""}</span>
          <div className="pl-segmented">
            {(["A", "B"] as Side[]).map((side) => (
              <button key={side} type="button" className={firstServe === side ? "is-active" : ""} onClick={() => setFirstServe(side)}>
                {match.teams[side].name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(["A", "B"] as Side[]).map((side) => {
        const info = match.teams[side];
        const regulars = info.players.filter((player) => !info.liberos.includes(player.number));
        return (
          <section key={side} className={`pl-card pl-card--${side}`}>
            <h2 className="pl-subtitle">{info.name}</h2>
            <p className="pl-muted">Arriba la red. La posición I es la que saca.</p>
            <div className="pl-court pl-court--edit">
              <div className="pl-net">RED</div>
              {COURT_ORDER.map((row, rowIndex) => (
                <div key={rowIndex} className="pl-court-row">
                  {row.map((index) => (
                    <label key={index} className="pl-slot">
                      <span className="pl-slot-label">{POSITION_LABELS[index]}</span>
                      <select
                        value={lineups[side][index] ?? ""}
                        onChange={(event) => setSlot(side, index, event.target.value === "" ? null : Number(event.target.value))}
                      >
                        <option value="">—</option>
                        {regulars.map((player) => (
                          <option key={player.number} value={player.number}>
                            #{player.number}
                            {player.name ? ` ${player.name}` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            {(info.reserves ?? []).length > 0 && (
              <div className="pl-arrival">
                <p className="pl-label">¿Llegó alguien de {info.name}?</p>
                <div className="pl-arrival-row">
                  <select
                    value={arrival[side].key}
                    onChange={(event) => setArrival((current) => ({ ...current, [side]: { ...current[side], key: event.target.value } }))}
                  >
                    <option value="">Elegir jugador…</option>
                    {(info.reserves ?? []).map((reserve) => (
                      <option key={reserve.key} value={reserve.key}>
                        {reserve.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="pl-input-number"
                    value={arrival[side].number}
                    onChange={(event) =>
                      setArrival((current) => ({ ...current, [side]: { ...current[side], number: event.target.value.replace(/D/g, "").slice(0, 2) } }))
                    }
                    inputMode="numeric"
                    placeholder="N.º"
                    aria-label="Número"
                  />
                </div>
                <div className="pl-arrival-row">
                  <button
                    type="button"
                    className={`pl-chip ${arrival[side].libero ? "is-on" : ""}`}
                    onClick={() => setArrival((current) => ({ ...current, [side]: { ...current[side], libero: !current[side].libero } }))}
                  >
                    Líbero
                  </button>
                  <button type="button" className="pl-button" onClick={() => addArrival(side)}>
                    Agregar a la planilla
                  </button>
                </div>
              </div>
            )}
          </section>
        );
      })}

      {error && <p className="pl-error">{error}</p>}

      <button type="button" className="pl-button pl-button--primary pl-button--block" onClick={handleStart}>
        Empezar set {setNumber}
      </button>
    </main>
  );
}
