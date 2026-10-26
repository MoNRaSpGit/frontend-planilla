import { useEffect, useState } from "react";
import { getCatalogCached, playerFullName, saveRemembered } from "./catalog";
import { addReservePlayer } from "./rules";
import type { Match, Side } from "./types";

type Props = {
  match: Match;
  side: Side;
  onAdd: (match: Match) => void;
};

// "Llego alguien?" (pedido explicito 26/10/2026): sumar a la planilla un
// jugador que llego tarde, SIEMPRE elegido de la lista de su cuadro (las
// reservas: los del cuadro que no se anotaron). Se usa entre sets
// (LineupScreen) y durante el set, dentro de la ventanita de Cambio.
export function ArrivalForm({ match, side, onAdd }: Props) {
  const info = match.teams[side];
  // La lista sale del cuadro en el servidor (sirve tambien para partidos
  // empezados antes de guardar reservas); sin conexion, las guardadas.
  const [catalogReserves, setCatalogReserves] = useState<{ key: string; name: string }[] | null>(null);
  useEffect(() => {
    if (info.catalogTeamId == null) return;
    let cancelled = false;
    getCatalogCached()
      .then((teams) => {
        const team = teams.find((entry) => entry.id === info.catalogTeamId);
        if (!cancelled && team) setCatalogReserves(team.players.map((player) => ({ key: `c${player.id}`, name: playerFullName(player) })));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [info.catalogTeamId]);
  const onSheet = new Set(info.players.map((player) => player.key ?? player.name));
  const onSheetNames = new Set(info.players.map((player) => player.name));
  const reserves = (catalogReserves ?? info.reserves ?? []).filter((reserve) => !onSheet.has(reserve.key) && !onSheetNames.has(reserve.name));
  const [key, setKey] = useState("");
  const [number, setNumber] = useState("");
  const [libero, setLibero] = useState(false);
  const [error, setError] = useState("");

  if (reserves.length === 0) {
    return <p className="pl-muted">No quedan jugadores de {info.name} para agregar.</p>;
  }

  function handleAdd() {
    if (!key) return setError(`Elegí el jugador de ${info.name} que llegó.`);
    if (number === "") return setError("Poné el número de camiseta.");
    const reserve = reserves.find((candidate) => candidate.key === key);
    if (!reserve) return setError(`Ese jugador no es de ${info.name}.`);
    const result = addReservePlayer(match, side, reserve, Number(number), libero);
    if (typeof result === "string") return setError(result);
    saveRemembered({ [key]: { number: Number(number), libero } });
    setError("");
    setKey("");
    setNumber("");
    setLibero(false);
    onAdd(result);
  }

  return (
    <div className="pl-arrival">
      <p className="pl-label">¿Llegó alguien de {info.name}?</p>
      <div className="pl-arrival-row">
        <select value={key} onChange={(event) => setKey(event.target.value)} aria-label="Jugador que llegó">
          <option value="">Elegir jugador…</option>
          {reserves.map((reserve) => (
            <option key={reserve.key} value={reserve.key}>
              {reserve.name}
            </option>
          ))}
        </select>
        <input
          className="pl-input-number"
          value={number}
          onChange={(event) => setNumber(event.target.value.replace(/\D/g, "").slice(0, 2))}
          inputMode="numeric"
          placeholder="N.º"
          aria-label="Número"
        />
      </div>
      <div className="pl-arrival-row">
        <button type="button" className={`pl-chip ${libero ? "is-on" : ""}`} onClick={() => setLibero((current) => !current)}>
          Líbero
        </button>
        <button type="button" className="pl-button" onClick={handleAdd}>
          Agregar a la planilla
        </button>
      </div>
      {error && <p className="pl-error">{error}</p>}
    </div>
  );
}
