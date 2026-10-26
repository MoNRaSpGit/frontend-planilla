import { useEffect, useMemo, useState } from "react";
import {
  fetchCatalog,
  loadRemembered,
  playerFullName,
  saveRemembered,
  type CatalogDivision,
  type CatalogSex,
  type CatalogTeam,
  type RememberedPlayer
} from "./catalog";
import type { Match, Side, TeamInfo } from "./types";

type Props = {
  match: Match;
  onContinue: (match: Match) => void;
};

// Un jugador en la lista de un cuadro: los del catalogo traen key "c<id>"
// (asi se recuerda su numero), los agregados a mano "m<n>".
type RosterPlayer = { key: string; name: string; numberInput: string; libero: boolean };
type Roster = { catalogTeamId: number | null; name: string; players: RosterPlayer[] };

const SIDE_LABELS: Record<Side, string> = { A: "Local", B: "Visitante" };

function rosterFromCatalog(team: CatalogTeam, remembered: Record<string, RememberedPlayer>): Roster {
  return {
    catalogTeamId: team.id,
    name: team.name,
    players: team.players.map((player) => {
      const key = `c${player.id}`;
      const memory = remembered[key];
      return { key, name: playerFullName(player), numberInput: memory?.number != null ? String(memory.number) : "", libero: memory?.libero ?? false };
    })
  };
}

function rosterFromMatch(team: TeamInfo): Roster {
  return {
    catalogTeamId: team.catalogTeamId ?? null,
    name: team.name,
    players: team.players.map((player, index) => ({
      key: `m${index}-${player.number}`,
      name: player.name,
      numberInput: String(player.number),
      libero: team.liberos.includes(player.number)
    }))
  };
}

// Pantalla "Datos" (26/10/2026, pedido explicito): se elige la categoria
// (masculino/femenino, A/B) y despues Local y Visitante de los cuadros
// copiados de juez. A cada jugador se le pone el numero de camiseta (juez
// no lo tiene) y si es libero; los que quedan sin numero no juegan. El
// partido es siempre a 3 sets (25, 25 y el tercero a 15).
export function SetupScreen({ match, onContinue }: Props) {
  const [catalog, setCatalog] = useState<CatalogTeam[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [sex, setSex] = useState<CatalogSex>(match.category?.sex ?? "masculino");
  const [division, setDivision] = useState<CatalogDivision>(match.category?.division ?? "A");
  const [rosters, setRosters] = useState<Record<Side, Roster | null>>({
    A: match.teams.A.name ? rosterFromMatch(match.teams.A) : null,
    B: match.teams.B.name ? rosterFromMatch(match.teams.B) : null
  });
  const [firstServe, setFirstServe] = useState<Side>(match.firstServeSet1);
  const [editing, setEditing] = useState<Side>("A");
  const [extraNumber, setExtraNumber] = useState("");
  const [extraName, setExtraName] = useState("");
  const [error, setError] = useState("");

  function loadCatalog() {
    setLoadError("");
    fetchCatalog()
      .then(setCatalog)
      .catch((err) => setLoadError(err instanceof Error ? err.message : "No se pudieron cargar los cuadros."));
  }

  useEffect(() => {
    loadCatalog();
  }, []);

  const teamsInCategory = useMemo(
    () => (catalog ?? []).filter((team) => team.sex === sex && team.division === division),
    [catalog, sex, division]
  );

  function changeCategory(nextSex: CatalogSex, nextDivision: CatalogDivision) {
    setSex(nextSex);
    setDivision(nextDivision);
    // Otra categoria = otros cuadros: se vacia la eleccion.
    setRosters({ A: null, B: null });
  }

  function pickTeam(side: Side, teamId: string) {
    const team = teamsInCategory.find((entry) => String(entry.id) === teamId);
    setRosters((current) => ({ ...current, [side]: team ? rosterFromCatalog(team, loadRemembered()) : null }));
    setEditing(side);
    setError("");
  }

  function updatePlayer(side: Side, key: string, change: Partial<RosterPlayer>) {
    setRosters((current) => {
      const roster = current[side];
      if (!roster) return current;
      return { ...current, [side]: { ...roster, players: roster.players.map((player) => (player.key === key ? { ...player, ...change } : player)) } };
    });
  }

  function addExtraPlayer() {
    const roster = rosters[editing];
    if (!roster) return;
    if (!extraNumber) {
      setError("Poné el número del jugador que agregás.");
      return;
    }
    const player: RosterPlayer = { key: `m${Date.now()}`, name: extraName.trim() || "Jugador", numberInput: extraNumber, libero: false };
    setRosters((current) => ({ ...current, [editing]: { ...roster, players: [...roster.players, player] } }));
    setExtraNumber("");
    setExtraName("");
    setError("");
  }

  function buildTeam(side: Side): TeamInfo | string {
    const roster = rosters[side];
    if (!roster) return `Elegí el cuadro ${SIDE_LABELS[side]}.`;
    const playing = roster.players.filter((player) => player.numberInput !== "");
    const numbers = playing.map((player) => Number(player.numberInput));
    const repeated = numbers.find((number, index) => numbers.indexOf(number) !== index);
    if (repeated !== undefined) return `En ${roster.name} el #${repeated} está repetido.`;
    const liberos = playing.filter((player) => player.libero).map((player) => Number(player.numberInput));
    if (liberos.length > 2) return `${roster.name} tiene más de 2 líberos.`;
    if (playing.length - liberos.length < 6) return `${roster.name} necesita al menos 6 jugadores con número (sin contar líberos).`;
    return {
      name: roster.name,
      catalogTeamId: roster.catalogTeamId,
      players: playing.map((player) => ({ number: Number(player.numberInput), name: player.name })).sort((a, b) => a.number - b.number),
      liberos
    };
  }

  function handleContinue() {
    if (rosters.A && rosters.B && rosters.A.catalogTeamId !== null && rosters.A.catalogTeamId === rosters.B.catalogTeamId) {
      setError("Local y Visitante no pueden ser el mismo cuadro.");
      return;
    }
    const teamA = buildTeam("A");
    if (typeof teamA === "string") return setError(teamA);
    const teamB = buildTeam("B");
    if (typeof teamB === "string") return setError(teamB);

    // Se recuerdan numero y libero de los jugadores del catalogo.
    const memory: Record<string, RememberedPlayer> = {};
    for (const side of ["A", "B"] as Side[]) {
      for (const player of rosters[side]!.players) {
        if (player.key.startsWith("c")) {
          memory[player.key] = { number: player.numberInput === "" ? null : Number(player.numberInput), libero: player.libero };
        }
      }
    }
    saveRemembered(memory);
    setError("");
    onContinue({ ...match, teams: { A: teamA, B: teamB }, setsToWin: 2, category: { sex, division }, firstServeSet1: firstServe, phase: "lineup" });
  }

  const roster = rosters[editing];

  return (
    <main className="pl-screen">
      <h1 className="pl-title">Datos del partido</h1>

      <section className="pl-card">
        <div className="pl-row">
          <span className="pl-label">Categoría</span>
          <div className="pl-segmented">
            <button type="button" className={sex === "masculino" ? "is-active" : ""} onClick={() => changeCategory("masculino", division)}>
              Masculino
            </button>
            <button type="button" className={sex === "femenino" ? "is-active" : ""} onClick={() => changeCategory("femenino", division)}>
              Femenino
            </button>
          </div>
        </div>
        <div className="pl-row">
          <span className="pl-label">División</span>
          <div className="pl-segmented">
            {(["A", "B"] as CatalogDivision[]).map((value) => (
              <button key={value} type="button" className={division === value ? "is-active" : ""} onClick={() => changeCategory(sex, value)}>
                {value}
              </button>
            ))}
          </div>
        </div>

        {loadError ? (
          <div className="pl-row">
            <p className="pl-error">{loadError}</p>
            <button type="button" className="pl-button" onClick={loadCatalog}>
              Reintentar
            </button>
          </div>
        ) : catalog === null ? (
          <p className="pl-muted">Cargando cuadros…</p>
        ) : (
          <div className="pl-team-names">
            {(["A", "B"] as Side[]).map((side) => (
              <label key={side} className={`pl-field pl-field--${side}`}>
                <span>{SIDE_LABELS[side]}</span>
                <select value={rosters[side]?.catalogTeamId ?? ""} onChange={(event) => pickTeam(side, event.target.value)}>
                  <option value="">Elegir cuadro…</option>
                  {teamsInCategory.map((team) => (
                    <option key={team.id} value={team.id} disabled={rosters[side === "A" ? "B" : "A"]?.catalogTeamId === team.id}>
                      {team.name}
                      {team.players.length === 0 ? " (sin jugadores)" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        <p className="pl-muted">Partido a 3 sets: 25, 25 y el tercero a 15 (si van 1 a 1).</p>

        <div className="pl-row">
          <span className="pl-label">Saca primero</span>
          <div className="pl-segmented">
            {(["A", "B"] as Side[]).map((side) => (
              <button key={side} type="button" className={firstServe === side ? "is-active" : ""} onClick={() => setFirstServe(side)}>
                {rosters[side]?.name || SIDE_LABELS[side]}
              </button>
            ))}
          </div>
        </div>
      </section>

      {(rosters.A || rosters.B) && (
        <section className="pl-card">
          <div className="pl-tabs">
            {(["A", "B"] as Side[]).map((side) => (
              <button
                key={side}
                type="button"
                className={`pl-tab pl-tab--${side} ${editing === side ? "is-active" : ""}`}
                onClick={() => setEditing(side)}
                disabled={!rosters[side]}
              >
                {rosters[side]?.name || SIDE_LABELS[side]}
              </button>
            ))}
          </div>

          {roster ? (
            <>
              {roster.players.length === 0 ? (
                // Cuadros cargados sin jugadores (ej. Sarandi Mayores / Sub 20,
                // 26/10/2026): todavia no estan en juez. Para este partido se
                // agregan a mano abajo.
                <p className="pl-warning">
                  Faltan ingresar los jugadores de {roster.name}: todavía no están cargados. Para este partido agregalos abajo con número y nombre.
                </p>
              ) : (
                <p className="pl-muted">Poné el número de camiseta de los que juegan. Sin número = no juega.</p>
              )}
              <ul className="pl-player-list">
                {roster.players.map((player) => (
                  <li key={player.key} className={`${player.libero ? "is-libero" : ""} ${player.numberInput === "" ? "is-out" : ""}`}>
                    <input
                      className="pl-input-number"
                      value={player.numberInput}
                      onChange={(event) => updatePlayer(editing, player.key, { numberInput: event.target.value.replace(/\D/g, "").slice(0, 2) })}
                      inputMode="numeric"
                      placeholder="N.º"
                      aria-label={`Número de ${player.name}`}
                    />
                    <span className="pl-player-name">{player.name}</span>
                    <button
                      type="button"
                      className={`pl-chip ${player.libero ? "is-on" : ""}`}
                      onClick={() => updatePlayer(editing, player.key, { libero: !player.libero })}
                    >
                      Líbero
                    </button>
                  </li>
                ))}
              </ul>

              <form
                className="pl-add-player"
                onSubmit={(event) => {
                  event.preventDefault();
                  addExtraPlayer();
                }}
              >
                <input
                  className="pl-input-number"
                  value={extraNumber}
                  onChange={(event) => setExtraNumber(event.target.value.replace(/\D/g, "").slice(0, 2))}
                  inputMode="numeric"
                  placeholder="N.º"
                  aria-label="Número"
                />
                <input value={extraName} onChange={(event) => setExtraName(event.target.value)} placeholder="Otro jugador (nombre)" aria-label="Nombre" />
                <button type="submit" className="pl-button">
                  Agregar
                </button>
              </form>
            </>
          ) : (
            <p className="pl-muted">Elegí el cuadro {SIDE_LABELS[editing]} arriba.</p>
          )}
        </section>
      )}

      {error && <p className="pl-error">{error}</p>}

      <button type="button" className="pl-button pl-button--primary pl-button--block" onClick={handleContinue}>
        Siguiente: formación del set 1
      </button>
    </main>
  );
}
