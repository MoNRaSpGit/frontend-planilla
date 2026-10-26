import { useEffect, useState } from "react";
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
    />
  );
}
