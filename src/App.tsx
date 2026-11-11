import { useCallback, useEffect, useState } from "react";
import { loadLeague, matchSignature, resultFromMatch, saveLeague, type LeagueData } from "./liga/league";
import { TablaScreen } from "./liga/TablaScreen";
import { LineupScreen } from "./planilla/LineupScreen";
import { MatchScreen } from "./planilla/MatchScreen";
import { newMatch } from "./planilla/rules";
import { SetupScreen } from "./planilla/SetupScreen";
import { clearSaved, loadSaved, save } from "./planilla/storage";
import type { Match } from "./planilla/types";

// Planilla de voley (26/10/2026, pedido explicito). Tres pantallas segun la
// fase: Datos -> Formacion de cada set -> Partido. Cada anotacion guarda
// el estado anterior para "Deshacer", y todo queda en el celular.
export function App() {
  const [state, setState] = useState(() => loadSaved() ?? { match: newMatch(), history: [] as Match[] });
  const { match, history } = state;
  const [view, setView] = useState<"planilla" | "tabla">("planilla");
  const [league, setLeagueState] = useState<LeagueData>(() => loadLeague() ?? { results: [], nextId: 1 });

  const setLeague = useCallback((next: LeagueData) => {
    setLeagueState(next);
    saveLeague(next);
  }, []);

  // Partido terminado en la planilla (con cuadros del catalogo): se anota
  // solo en la tabla, una vez.
  useEffect(() => {
    const signature = matchSignature(match);
    if (!signature || league.lastSignature === signature) return;
    const result = resultFromMatch(match, league.nextId, signature);
    if (!result) return;
    setLeague({ ...league, results: [...league.results, result], nextId: league.nextId + 1, lastSignature: signature });
  }, [match, league, setLeague]);

  useEffect(() => {
    save(state);
  }, [state]);

  function change(next: Match) {
    if (next === match) return;
    setState((current) => ({ match: next, history: [...current.history, current.match] }));
  }

  function undo() {
    setState((current) => {
      const previous = current.history[current.history.length - 1];
      return previous ? { match: previous, history: current.history.slice(0, -1) } : current;
    });
  }

  function resetMatch() {
    clearSaved();
    // Todo de cero (pedido explicito 26/10/2026): categoria, cuadros,
    // jugadores y saque se eligen de nuevo. Los numeros de camiseta que el
    // celular recuerda por jugador (catalog.ts) se mantienen.
    setState({ match: newMatch(), history: [] });
  }

  function renderPlanilla() {
  if (match.phase === "setup") {
    return <SetupScreen match={match} onContinue={change} />;
  }

  if (match.phase === "lineup") {
    return (
      <LineupScreen
        match={match}
        onStart={change}
        onUpdate={change}
        onBack={match.sets.length === 0 ? () => change({ ...match, phase: "setup" }) : null}
      />
    );
  }

  return (
    <MatchScreen
      match={match}
      canUndo={history.length > 0}
      onChange={change}
      onUndo={undo}
      onNextSet={() => change({ ...match, phase: "lineup" })}
      onNewMatch={resetMatch}
      onViewTable={() => setView("tabla")}
    />
  );
  }

  // La barra de abajo se esconde mientras se juega (la cancha ocupa todo);
  // al terminar el partido se llega a la tabla desde el cartel final.
  const inMatch = match.phase === "playing" || match.phase === "set_over" || match.phase === "finished";
  const showTabBar = view === "tabla" || !inMatch;

  return (
    <>
      <div hidden={view !== "planilla"}>{renderPlanilla()}</div>
      {view === "tabla" && <TablaScreen league={league} onChange={setLeague} />}
      {showTabBar && (
        <nav className="lg-tabbar" aria-label="Secciones">
          <button type="button" className={view === "planilla" ? "is-active" : ""} onClick={() => setView("planilla")}>
            Planilla
          </button>
          <button type="button" className={view === "tabla" ? "is-active" : ""} onClick={() => setView("tabla")}>
            Tabla
          </button>
        </nav>
      )}
    </>
  );
}
