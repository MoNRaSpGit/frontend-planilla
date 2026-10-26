import { useState } from "react";
import { ArrivalForm } from "./ArrivalForm";
import { COURT_ORDER } from "./LineupScreen";
import {
  checkSubstitution,
  currentSet,
  liberoIn,
  liberoOut,
  liberoTargets,
  onCourt,
  POSITION_LABELS,
  scorePoint,
  substitute,
  timeout
} from "./rules";
import type { Match, Side } from "./types";

type Props = {
  match: Match;
  canUndo: boolean;
  onChange: (match: Match) => void;
  onUndo: () => void;
  onNextSet: () => void;
  onNewMatch: () => void;
};

type Dialog = { kind: "sub" | "libero"; side: Side } | { kind: "log" } | { kind: "new" } | null;

// Pantalla del partido (pedido explicito): dividida a la mitad, un equipo
// de cada lado, cada uno con su marcador, su cancha (quien saca) y los
// botones Punto / Cambio / Libero / Tiempo. El planillero solo anota los
// tantos; saque y rotacion los calcula rules.ts.
export function MatchScreen({ match, canUndo, onChange, onUndo, onNextSet, onNewMatch }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  const set = currentSet(match);
  if (!set) return null;
  const finished = match.phase === "finished";
  const setOver = match.phase === "set_over";

  return (
    <main className="pl-match">
      <header className="pl-match-bar">
        <button type="button" className="pl-bar-button" onClick={onUndo} disabled={!canUndo}>
          ↶ Deshacer
        </button>
        <div className="pl-match-sets">
          <strong>Set {set.number}</strong>
          <span>
            Sets {match.setsWon.A} - {match.setsWon.B}
          </span>
        </div>
        <button type="button" className="pl-bar-button" onClick={() => setDialog({ kind: "log" })}>
          Planilla
        </button>
      </header>

      <div className="pl-halves">
        {(["A", "B"] as Side[]).map((side) => (
          <TeamHalf
            key={side}
            match={match}
            side={side}
            disabled={match.phase !== "playing"}
            onPoint={() => onChange(scorePoint(match, side))}
            onSub={() => setDialog({ kind: "sub", side })}
            onLibero={() => setDialog({ kind: "libero", side })}
            onTimeout={() => onChange(timeout(match, side))}
          />
        ))}
      </div>

      <LastEvents match={match} />

      <button type="button" className="pl-link pl-new-match" onClick={() => setDialog({ kind: "new" })}>
        Nuevo partido
      </button>

      {(setOver || finished) && (
        <div className="pl-overlay">
          <div className="pl-modal">
            <h2>{finished ? `¡Ganó ${match.teams[set.winner!].name}!` : `Set ${set.number} para ${match.teams[set.winner!].name}`}</h2>
            <p className="pl-big-score">
              {match.teams.A.name} {set.score.A} - {set.score.B} {match.teams.B.name}
            </p>
            <ul className="pl-set-results">
              {match.sets.map((entry) => (
                <li key={entry.number}>
                  Set {entry.number}: {entry.score.A} - {entry.score.B}
                </li>
              ))}
            </ul>
            <p className="pl-muted">
              Sets: {match.teams.A.name} {match.setsWon.A} - {match.setsWon.B} {match.teams.B.name}
            </p>
            <div className="pl-modal-actions">
              <button type="button" className="pl-button" onClick={onUndo}>
                Deshacer último tanto
              </button>
              {finished ? (
                <button type="button" className="pl-button pl-button--primary" onClick={() => setDialog({ kind: "log" })}>
                  Ver planilla
                </button>
              ) : (
                <button type="button" className="pl-button pl-button--primary" onClick={onNextSet}>
                  Formación del set {set.number + 1}
                </button>
              )}
            </div>
            {finished && (
              <button type="button" className="pl-link" onClick={() => setDialog({ kind: "new" })}>
                Nuevo partido
              </button>
            )}
          </div>
        </div>
      )}

      {dialog?.kind === "sub" && (
        <SubstitutionDialog
          match={match}
          side={dialog.side}
          onClose={() => setDialog(null)}
          onAddPlayer={onChange}
          onConfirm={(out, entering) => {
            onChange(substitute(match, dialog.side, out, entering));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "libero" && (
        <LiberoDialog
          match={match}
          side={dialog.side}
          onClose={() => setDialog(null)}
          onChange={(next) => {
            onChange(next);
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "log" && <LogDialog match={match} onClose={() => setDialog(null)} />}
      {dialog?.kind === "new" && (
        <div className="pl-overlay">
          <div className="pl-modal">
            <h2>¿Empezar un partido nuevo?</h2>
            <p className="pl-muted">Se borra este partido y su planilla.</p>
            <div className="pl-modal-actions">
              <button type="button" className="pl-button" onClick={() => setDialog(null)}>
                Cancelar
              </button>
              <button type="button" className="pl-button pl-button--danger" onClick={onNewMatch}>
                Sí, nuevo partido
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function TeamHalf({
  match,
  side,
  disabled,
  onPoint,
  onSub,
  onLibero,
  onTimeout
}: {
  match: Match;
  side: Side;
  disabled: boolean;
  onPoint: () => void;
  onSub: () => void;
  onLibero: () => void;
  onTimeout: () => void;
}) {
  const set = currentSet(match)!;
  const team = set.teams[side];
  const info = match.teams[side];
  const court = onCourt(team);
  const serving = set.serving === side;

  return (
    <section className={`pl-half pl-half--${side} ${serving ? "is-serving" : ""}`}>
      <h2 className="pl-half-name">{info.name}</h2>
      <div className="pl-half-score">{set.score[side]}</div>
      <p className="pl-half-serve">{serving ? `🏐 Saca #${court[0]}` : "Recibe"}</p>

      <div className="pl-court">
        <div className="pl-net">RED</div>
        {COURT_ORDER.map((row, rowIndex) => (
          <div key={rowIndex} className="pl-court-row">
            {row.map((index) => {
              const number = court[index];
              const isLibero = team.liberoOn?.libero === number;
              const isServer = index === 0 && serving;
              return (
                <div key={index} className={`pl-spot ${isLibero ? "is-libero" : ""} ${isServer ? "is-server" : ""}`}>
                  <span className="pl-spot-pos">{POSITION_LABELS[index]}</span>
                  <strong>{number}</strong>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <button type="button" className="pl-point-button" onClick={onPoint} disabled={disabled}>
        PUNTO
      </button>
      <div className="pl-half-actions">
        <button type="button" onClick={onSub} disabled={disabled}>
          Cambio <small>{team.subsUsed}/6</small>
        </button>
        <button type="button" onClick={onLibero} disabled={disabled || info.liberos.length === 0}>
          Líbero{team.liberoOn ? <small> #{team.liberoOn.libero}</small> : null}
        </button>
        <button type="button" onClick={onTimeout} disabled={disabled || team.timeoutsUsed >= 2}>
          Tiempo <small>{team.timeoutsUsed}/2</small>
        </button>
      </div>
    </section>
  );
}

// Los ultimos 3 movimientos, para confirmar de un vistazo lo que se anoto.
function LastEvents({ match }: { match: Match }) {
  const last = match.log.slice(-3).reverse();
  return (
    <ul className="pl-last-events">
      {last.map((entry) => (
        <li key={entry.id} className={entry.side ? `is-${entry.side}` : ""}>
          <span className="pl-event-score">
            {entry.score.A}-{entry.score.B}
          </span>{" "}
          {entry.text}
        </li>
      ))}
    </ul>
  );
}

function SubstitutionDialog({
  match,
  side,
  onClose,
  onAddPlayer,
  onConfirm
}: {
  match: Match;
  side: Side;
  onClose: () => void;
  onAddPlayer: (match: Match) => void;
  onConfirm: (out: number, entering: number) => void;
}) {
  const set = currentSet(match)!;
  const team = set.teams[side];
  const info = match.teams[side];
  const [out, setOut] = useState<number | null>(null);
  const bench = info.players.filter((player) => !team.rotation.includes(player.number) && !info.liberos.includes(player.number));
  const onCourtPlayers = team.rotation.filter((number) => team.liberoOn?.replaced !== number);

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={(event) => event.stopPropagation()}>
        <h2>
          Cambio {info.name} <small className="pl-muted">({team.subsUsed}/6)</small>
        </h2>
        <p className="pl-label">1. Sale</p>
        <div className="pl-choice-grid">
          {onCourtPlayers.map((number) => {
            const check = checkSubstitution(match, side, number, null);
            return (
              <button
                key={number}
                type="button"
                className={`pl-choice ${out === number ? "is-active" : ""}`}
                disabled={!check.ok}
                title={check.ok ? undefined : check.reason}
                onClick={() => setOut(number)}
              >
                #{number}
                {!check.ok && <small>{check.reason}</small>}
              </button>
            );
          })}
        </div>
        {out !== null && (
          <>
            <p className="pl-label">2. Entra</p>
            {bench.length === 0 ? (
              <p className="pl-muted">No hay suplentes cargados.</p>
            ) : (
              <div className="pl-choice-grid">
                {bench.map((player) => {
                  const check = checkSubstitution(match, side, out, player.number);
                  return (
                    <button
                      key={player.number}
                      type="button"
                      className="pl-choice"
                      disabled={!check.ok}
                      onClick={() => onConfirm(out, player.number)}
                    >
                      #{player.number}
                      {player.name ? <small>{player.name}</small> : null}
                      {!check.ok && <small>{check.reason}</small>}
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
        {(info.catalogTeamId != null || (info.reserves ?? []).length > 0) && <ArrivalForm match={match} side={side} onAdd={onAddPlayer} />}
        <div className="pl-modal-actions">
          <button type="button" className="pl-button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

function LiberoDialog({ match, side, onClose, onChange }: { match: Match; side: Side; onClose: () => void; onChange: (match: Match) => void }) {
  const set = currentSet(match)!;
  const team = set.teams[side];
  const info = match.teams[side];
  const [libero, setLibero] = useState<number>(team.liberoOn?.libero ?? info.liberos[0]);
  const targets = liberoTargets(match, side).filter((number) => number !== team.liberoOn?.replaced);

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={(event) => event.stopPropagation()}>
        <h2>Líbero {info.name}</h2>
        {team.liberoOn && (
          <button type="button" className="pl-button pl-button--block" onClick={() => onChange(liberoOut(match, side))}>
            Sale #{team.liberoOn.libero} · vuelve #{team.liberoOn.replaced}
          </button>
        )}
        {info.liberos.length > 1 && (
          <>
            <p className="pl-label">Líbero</p>
            <div className="pl-choice-grid">
              {info.liberos.map((number) => (
                <button key={number} type="button" className={`pl-choice ${libero === number ? "is-active" : ""}`} onClick={() => setLibero(number)}>
                  #{number}
                </button>
              ))}
            </div>
          </>
        )}
        <p className="pl-label">{team.liberoOn ? "O cambiar de lugar: entra" : "Entra"} #{libero} por (zagueros)</p>
        <div className="pl-choice-grid">
          {targets.map((number) => (
            <button key={number} type="button" className="pl-choice" onClick={() => onChange(liberoIn(match, side, libero, number))}>
              #{number}
              <small>pos. {POSITION_LABELS[team.rotation.indexOf(number)]}</small>
            </button>
          ))}
        </div>
        {set.serving === side && <p className="pl-muted">En la posición I no: está por sacar y el líbero no saca.</p>}
        <div className="pl-modal-actions">
          <button type="button" className="pl-button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

// Planilla completa: todo lo anotado, set por set, lo mas nuevo arriba.
function LogDialog({ match, onClose }: { match: Match; onClose: () => void }) {
  const sets = [...new Set(match.log.map((entry) => entry.setNumber))].sort((a, b) => b - a);
  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal pl-modal--tall" onClick={(event) => event.stopPropagation()}>
        <h2>Planilla</h2>
        <p className="pl-muted">
          {match.teams.A.name} vs {match.teams.B.name}
        </p>
        <div className="pl-log">
          {sets.map((setNumber) => (
            <div key={setNumber}>
              <h3>Set {setNumber}</h3>
              <ul>
                {match.log
                  .filter((entry) => entry.setNumber === setNumber)
                  .reverse()
                  .map((entry) => (
                    <li key={entry.id} className={`is-${entry.kind} ${entry.side ? `is-${entry.side}` : ""}`}>
                      <span className="pl-event-score">
                        {entry.score.A}-{entry.score.B}
                      </span>
                      {entry.text}
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="pl-modal-actions">
          <button type="button" className="pl-button pl-button--primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
