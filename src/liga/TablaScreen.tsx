import { useEffect, useMemo, useState } from "react";
import { getCatalogCached, type CatalogTeam } from "../planilla/catalog";
import {
  POINTS,
  buildStandings,
  formatAverage,
  generateDemoResults,
  setsOf,
  type LeagueData,
  type LeagueDivision,
  type LeagueResult,
  type LeagueSex
} from "./league";

type Props = {
  league: LeagueData;
  onChange: (next: LeagueData) => void;
};

function formatDate(key: string) {
  const [year, month, day] = key.split("-");
  return `${day}/${month}/${year}`;
}

function setScores(result: LeagueResult, mine: "home" | "away") {
  return result.sets
    .map(([home, away]) => (mine === "home" ? `${home}-${away}` : `${away}-${home}`))
    .join(" · ");
}

// Pestaña "Tabla" (11/11/2026): posiciones por categoria (masculino /
// femenino, A / B) con partidos, puntos y set average; al tocar un cuadro
// se ven sus numeros y partidos.
export function TablaScreen({ league, onChange }: Props) {
  const [teams, setTeams] = useState<CatalogTeam[] | null>(null);
  const [error, setError] = useState("");
  const [sex, setSex] = useState<LeagueSex>("masculino");
  const [division, setDivision] = useState<LeagueDivision>("A");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    getCatalogCached()
      .then((list) => alive && setTeams(list))
      .catch((err: unknown) => alive && setError(err instanceof Error ? err.message : "No se pudieron cargar los cuadros."));
    return () => {
      alive = false;
    };
  }, []);

  // Primera vez: arranca con partidos de ejemplo para ver la tabla andando.
  useEffect(() => {
    if (!teams || league.seeded) return;
    const demo = generateDemoResults(teams, league.nextId);
    onChange({ ...league, results: [...league.results, ...demo], nextId: league.nextId + demo.length, seeded: true });
  }, [teams, league, onChange]);

  const categoryTeams = useMemo(
    () => (teams ?? []).filter((team) => team.sex === sex && team.division === division),
    [teams, sex, division]
  );
  const categoryResults = useMemo(
    () => league.results.filter((result) => result.sex === sex && result.division === division),
    [league.results, sex, division]
  );
  const standings = useMemo(() => buildStandings(categoryTeams, categoryResults), [categoryTeams, categoryResults]);

  function regenerateDemo() {
    if (!teams) return;
    const real = league.results.filter((result) => !result.demo);
    const startId = league.nextId;
    const demo = generateDemoResults(teams, startId);
    onChange({ ...league, results: [...real, ...demo], nextId: startId + demo.length, seeded: true });
  }

  function clearDemo() {
    onChange({ ...league, results: league.results.filter((result) => !result.demo) });
  }

  function removeResult(id: number) {
    onChange({ ...league, results: league.results.filter((result) => result.id !== id) });
  }

  const hasDemo = league.results.some((result) => result.demo);
  const selectedIndex = standings.findIndex((row) => row.teamId === selectedId);
  const selected = selectedIndex >= 0 ? standings[selectedIndex] : null;

  if (selected) {
    const teamResults = categoryResults
      .filter((result) => result.homeId === selected.teamId || result.awayId === selected.teamId)
      .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const nameOf = (id: number) => categoryTeams.find((team) => team.id === id)?.name ?? "Cuadro";
    return (
      <div className="pl-screen">
        <button type="button" className="pl-link pl-back" onClick={() => setSelectedId(null)}>
          ← Volver a la tabla
        </button>
        <h1 className="pl-title">{selected.name}</h1>
        <p className="pl-subtitle">
          {selectedIndex + 1}.º en {sex === "masculino" ? "Masculino" : "Femenino"} {division}
        </p>

        <div className="lg-stats">
          <div className="lg-stat lg-stat--main">
            <span>Puntos</span>
            <strong>{selected.points}</strong>
          </div>
          <div className="lg-stat">
            <span>Jugó</span>
            <strong>{selected.played}</strong>
          </div>
          <div className="lg-stat">
            <span>Ganó</span>
            <strong>{selected.won}</strong>
          </div>
          <div className="lg-stat">
            <span>Perdió</span>
            <strong>{selected.lost}</strong>
          </div>
          <div className="lg-stat">
            <span>Sets (F-C)</span>
            <strong>
              {selected.setsFor}-{selected.setsAgainst}
            </strong>
          </div>
          <div className="lg-stat lg-stat--main">
            <span>Set average</span>
            <strong>{formatAverage(selected.setsFor, selected.setsAgainst)}</strong>
          </div>
          <div className="lg-stat">
            <span>Tantos (F-C)</span>
            <strong>
              {selected.pointsFor}-{selected.pointsAgainst}
            </strong>
          </div>
          <div className="lg-stat">
            <span>Point average</span>
            <strong>{formatAverage(selected.pointsFor, selected.pointsAgainst)}</strong>
          </div>
        </div>

        <h2 className="lg-heading">Partidos</h2>
        {teamResults.length === 0 && <p className="pl-muted">Todavía no jugó ningún partido.</p>}
        <ul className="lg-matches">
          {teamResults.map((result) => {
            const isHome = result.homeId === selected.teamId;
            const [homeSets, awaySets] = setsOf(result);
            const mySets = isHome ? homeSets : awaySets;
            const theirSets = isHome ? awaySets : homeSets;
            const won = mySets > theirSets;
            return (
              <li key={result.id} className={`lg-match ${won ? "is-won" : "is-lost"}`}>
                <div className="lg-match-top">
                  <strong>
                    {won ? "Ganó" : "Perdió"} {mySets}-{theirSets}
                  </strong>
                  <span className={result.demo ? "lg-tag" : "lg-tag lg-tag--real"}>{result.demo ? "Ejemplo" : "Jugado"}</span>
                </div>
                <div>vs {nameOf(isHome ? result.awayId : result.homeId)}</div>
                <div className="pl-muted">
                  {setScores(result, isHome ? "home" : "away")} · {formatDate(result.date)}
                </div>
                <button type="button" className="pl-link lg-remove" onClick={() => removeResult(result.id)}>
                  Quitar este partido
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="pl-screen">
      <h1 className="pl-title">Tabla</h1>
      <div className="pl-row">
        <div className="pl-segmented">
          <button type="button" className={sex === "masculino" ? "is-active" : ""} onClick={() => setSex("masculino")}>
            Masculino
          </button>
          <button type="button" className={sex === "femenino" ? "is-active" : ""} onClick={() => setSex("femenino")}>
            Femenino
          </button>
        </div>
        <div className="pl-segmented">
          <button type="button" className={division === "A" ? "is-active" : ""} onClick={() => setDivision("A")}>
            A
          </button>
          <button type="button" className={division === "B" ? "is-active" : ""} onClick={() => setDivision("B")}>
            B
          </button>
        </div>
      </div>

      {error && <p className="pl-muted">{error}</p>}
      {!teams && !error && <p className="pl-muted">Cargando cuadros…</p>}
      {teams && standings.length === 0 && <p className="pl-muted">No hay cuadros en esta categoría.</p>}

      {standings.length > 0 && (
        <div className="lg-table-wrap">
          <table className="lg-table">
            <thead>
              <tr>
                <th>#</th>
                <th className="lg-left">Cuadro</th>
                <th>PJ</th>
                <th>PG</th>
                <th>PP</th>
                <th>Pts</th>
                <th>Set avg</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((row, index) => (
                <tr key={row.teamId} onClick={() => setSelectedId(row.teamId)}>
                  <td>{index + 1}</td>
                  <td className="lg-left lg-team">{row.name}</td>
                  <td>{row.played}</td>
                  <td>{row.won}</td>
                  <td>{row.lost}</td>
                  <td className="lg-pts">{row.points}</td>
                  <td>{formatAverage(row.setsFor, row.setsAgainst)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="pl-muted lg-note">
        Tocá un cuadro para ver sus partidos. PJ jugados, PG ganados, PP perdidos. Set average = sets ganados ÷ sets perdidos.
        Puntos: ganar 2-0 = {POINTS.win20}, ganar 2-1 = {POINTS.win21}, perder 1-2 = {POINTS.loss12}, perder 0-2 = {POINTS.loss02}.
        Desempata el set average y después el de tantos.
      </p>

      <div className="lg-demo">
        <strong>Datos de ejemplo</strong>
        <p className="pl-muted">
          Los partidos marcados “Ejemplo” son inventados al azar. Los que terminás en la planilla se anotan solos como “Jugado”.
        </p>
        <div className="pl-row">
          <button type="button" className="pl-button" onClick={regenerateDemo} disabled={!teams}>
            {hasDemo ? "Volver a generar" : "Generar ejemplo"}
          </button>
          {hasDemo && (
            <button type="button" className="pl-button" onClick={clearDemo}>
              Borrar ejemplo
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
