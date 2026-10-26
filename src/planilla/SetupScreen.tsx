import { useState } from "react";
import type { Match, Player, Side, TeamInfo } from "./types";

type Props = {
  match: Match;
  onContinue: (match: Match) => void;
};

// Pantalla "Datos": equipos, jugadores (numero y nombre opcional), cuales
// son liberos, a cuantos sets y quien saca primero. Se edita un equipo por
// vez (pestanas) para que entre bien en el celular.
export function SetupScreen({ match, onContinue }: Props) {
  const [teams, setTeams] = useState<Record<Side, TeamInfo>>(match.teams);
  const [setsToWin, setSetsToWin] = useState(match.setsToWin);
  const [firstServe, setFirstServe] = useState<Side>(match.firstServeSet1);
  const [editing, setEditing] = useState<Side>("A");
  const [numberInput, setNumberInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const [error, setError] = useState("");

  const team = teams[editing];

  function updateTeam(side: Side, change: Partial<TeamInfo>) {
    setTeams((current) => ({ ...current, [side]: { ...current[side], ...change } }));
  }

  function addPlayer() {
    const number = Number(numberInput);
    if (!numberInput || !Number.isInteger(number) || number < 0 || number > 99) {
      setError("Poné un número de camiseta (0 a 99).");
      return;
    }
    if (team.players.some((player) => player.number === number)) {
      setError(`El #${number} ya está en ${team.name}.`);
      return;
    }
    const players: Player[] = [...team.players, { number, name: nameInput.trim() }].sort((a, b) => a.number - b.number);
    updateTeam(editing, { players });
    setNumberInput("");
    setNameInput("");
    setError("");
  }

  function removePlayer(number: number) {
    updateTeam(editing, {
      players: team.players.filter((player) => player.number !== number),
      liberos: team.liberos.filter((libero) => libero !== number)
    });
  }

  function toggleLibero(number: number) {
    if (team.liberos.includes(number)) {
      updateTeam(editing, { liberos: team.liberos.filter((libero) => libero !== number) });
    } else if (team.liberos.length < 2) {
      updateTeam(editing, { liberos: [...team.liberos, number] });
    } else {
      setError("Máximo 2 líberos por equipo.");
    }
  }

  function handleContinue() {
    for (const side of ["A", "B"] as Side[]) {
      const info = teams[side];
      if (!info.name.trim()) return setError("Poné el nombre de los dos equipos.");
      const regulars = info.players.filter((player) => !info.liberos.includes(player.number));
      if (regulars.length < 6) return setError(`${info.name} necesita al menos 6 jugadores (sin contar líberos).`);
    }
    setError("");
    onContinue({ ...match, teams, setsToWin, firstServeSet1: firstServe, phase: "lineup" });
  }

  return (
    <main className="pl-screen">
      <h1 className="pl-title">Datos del partido</h1>

      <section className="pl-card">
        <div className="pl-team-names">
          {(["A", "B"] as Side[]).map((side) => (
            <label key={side} className={`pl-field pl-field--${side}`}>
              <span>{side === "A" ? "Equipo izquierda" : "Equipo derecha"}</span>
              <input value={teams[side].name} onChange={(event) => updateTeam(side, { name: event.target.value })} />
            </label>
          ))}
        </div>

        <div className="pl-row">
          <span className="pl-label">Partido a</span>
          <div className="pl-segmented">
            <button type="button" className={setsToWin === 3 ? "is-active" : ""} onClick={() => setSetsToWin(3)}>
              5 sets
            </button>
            <button type="button" className={setsToWin === 2 ? "is-active" : ""} onClick={() => setSetsToWin(2)}>
              3 sets
            </button>
          </div>
        </div>

        <div className="pl-row">
          <span className="pl-label">Saca primero</span>
          <div className="pl-segmented">
            {(["A", "B"] as Side[]).map((side) => (
              <button key={side} type="button" className={firstServe === side ? "is-active" : ""} onClick={() => setFirstServe(side)}>
                {teams[side].name || side}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="pl-card">
        <div className="pl-tabs">
          {(["A", "B"] as Side[]).map((side) => (
            <button key={side} type="button" className={`pl-tab pl-tab--${side} ${editing === side ? "is-active" : ""}`} onClick={() => setEditing(side)}>
              {teams[side].name || side} ({teams[side].players.length})
            </button>
          ))}
        </div>

        <form
          className="pl-add-player"
          onSubmit={(event) => {
            event.preventDefault();
            addPlayer();
          }}
        >
          <input
            className="pl-input-number"
            value={numberInput}
            onChange={(event) => setNumberInput(event.target.value.replace(/\D/g, "").slice(0, 2))}
            inputMode="numeric"
            placeholder="N.º"
            aria-label="Número"
          />
          <input value={nameInput} onChange={(event) => setNameInput(event.target.value)} placeholder="Nombre (opcional)" aria-label="Nombre" />
          <button type="submit" className="pl-button pl-button--primary">
            Agregar
          </button>
        </form>

        {team.players.length === 0 ? (
          <p className="pl-muted">Todavía no hay jugadores en {team.name}.</p>
        ) : (
          <ul className="pl-player-list">
            {team.players.map((player) => {
              const isLibero = team.liberos.includes(player.number);
              return (
                <li key={player.number} className={isLibero ? "is-libero" : ""}>
                  <span className="pl-shirt">#{player.number}</span>
                  <span className="pl-player-name">{player.name || "—"}</span>
                  <button type="button" className={`pl-chip ${isLibero ? "is-on" : ""}`} onClick={() => toggleLibero(player.number)}>
                    Líbero
                  </button>
                  <button type="button" className="pl-icon-button" onClick={() => removePlayer(player.number)} aria-label={`Quitar #${player.number}`}>
                    ✕
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {error && <p className="pl-error">{error}</p>}

      <button type="button" className="pl-button pl-button--primary pl-button--block" onClick={handleContinue}>
        Siguiente: formación del set 1
      </button>
    </main>
  );
}
