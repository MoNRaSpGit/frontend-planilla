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
  exceptionalSubstitute,
  markCourtChange,
  needsCourtChange,
  SANCTION_LABELS,
  sanction,
  scorePoint,
  sidesSwapped,
  substitute,
  timeout,
  type SanctionLevel
} from "./rules";
import { buildSummary, setDuration } from "./summary";
import type { Match, Side } from "./types";

type Props = {
  match: Match;
  canUndo: boolean;
  onChange: (match: Match) => void;
  onUndo: () => void;
  onNextSet: () => void;
  onNewMatch: () => void;
  // Lleva a la pestaña Tabla (desde el cartel de partido terminado).
  onViewTable?: () => void;
};

type Dialog =
  | { kind: "sub" | "libero"; side: Side }
  | { kind: "log" }
  | { kind: "sanction" }
  | { kind: "new" }
  // Equipos con libero cargado que no lo hicieron entrar, y el tanto que
  // se estaba por anotar (pedido explicito 26/10/2026).
  | { kind: "no_libero"; sides: Side[]; pointFor: Side }
  | null;

// Pantalla del partido (pedido explicito): dividida a la mitad, un equipo
// de cada lado, cada uno con su marcador, su cancha (quien saca) y los
// botones Punto / Cambio / Libero / Tiempo. El planillero solo anota los
// tantos; saque y rotacion los calcula rules.ts.
export function MatchScreen({ match, canUndo, onChange, onUndo, onNextSet, onNewMatch, onViewTable }: Props) {
  const [dialog, setDialog] = useState<Dialog>(null);
  // Sets en los que ya se aviso lo del libero (una sola vez por set).
  const [liberoWarnedSets, setLiberoWarnedSets] = useState<number[]>([]);
  const [shareNote, setShareNote] = useState("");
  const set = currentSet(match);
  if (!set) return null;
  const finished = match.phase === "finished";

  // Resumen en texto: abre "Compartir" del celular (WhatsApp, etc.) o, si
  // no se puede, lo copia.
  async function shareSummary() {
    const text = buildSummary(match);
    try {
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareNote("Resumen copiado");
    } catch {
      setShareNote("No se pudo compartir");
    }
    window.setTimeout(() => setShareNote(""), 2500);
  }

  // Antes del primer tanto del set: si un equipo tiene libero cargado y
  // no lo hizo entrar, se avisa ("a veces me olvido de marcar el libero").
  function handlePoint(side: Side) {
    const currentSetState = currentSet(match)!;
    const isFirstPoint = currentSetState.score.A + currentSetState.score.B === 0;
    if (isFirstPoint && !liberoWarnedSets.includes(currentSetState.number)) {
      const sides = (["A", "B"] as Side[]).filter(
        (entry) => match.teams[entry].liberos.length > 0 && !currentSetState.teams[entry].liberoOn
      );
      if (sides.length > 0) {
        setDialog({ kind: "no_libero", sides, pointFor: side });
        return;
      }
    }
    onChange(scorePoint(match, side));
  }
  const setOver = match.phase === "set_over";
  const swapped = sidesSwapped(match);
  const courtChangeDue = needsCourtChange(match);

  return (
    <main className="pl-match">
      <header className="pl-match-bar">
        <button type="button" className="pl-back-button" onClick={onUndo} disabled={!canUndo} aria-label="Volver un paso atrás" title="Volver un paso atrás">
          <span aria-hidden="true">↶</span>
          <small>Atrás</small>
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
        {(swapped ? (["B", "A"] as Side[]) : (["A", "B"] as Side[])).map((side) => (
          <TeamHalf
            key={side}
            match={match}
            side={side}
            disabled={match.phase !== "playing"}
            onPoint={() => handlePoint(side)}
            onSub={() => setDialog({ kind: "sub", side })}
            onLibero={() => setDialog({ kind: "libero", side })}
            onTimeout={() => onChange(timeout(match, side))}
          />
        ))}
      </div>

      <LastEvents match={match} />

      <div className="pl-match-links">
        <button type="button" className="pl-link" onClick={() => setDialog({ kind: "sanction" })} disabled={match.phase !== "playing"}>
          Sanción
        </button>
        <button type="button" className="pl-link" onClick={() => setDialog({ kind: "new" })}>
          Nuevo partido
        </button>
      </div>

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
              <>
                <button type="button" className="pl-button" onClick={() => void shareSummary()}>
                  {shareNote || "Compartir resumen"}
                </button>
                <button type="button" className="pl-button" onClick={onViewTable}>
                  Ver tabla
                </button>
                <button type="button" className="pl-link" onClick={() => setDialog({ kind: "new" })}>
                  Nuevo partido
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {courtChangeDue && (
        <div className="pl-overlay">
          <div className="pl-modal" role="alertdialog" aria-modal="true">
            <h2>¡Cambio de cancha!</h2>
            <p>Un equipo llegó a 8 en el set decisivo: los equipos cambian de lado. Al aceptar, la pantalla también se da vuelta.</p>
            <div className="pl-modal-actions">
              <button type="button" className="pl-button pl-button--primary" onClick={() => onChange(markCourtChange(match))}>
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {dialog?.kind === "sanction" && (
        <SanctionDialog
          match={match}
          onClose={() => setDialog(null)}
          onConfirm={(side, level, number) => {
            onChange(sanction(match, side, level, number));
            setDialog(null);
          }}
        />
      )}

      {dialog?.kind === "sub" && (
        <SubstitutionDialog
          match={match}
          side={dialog.side}
          onClose={() => setDialog(null)}
          onAddPlayer={onChange}
          onExceptional={(out, entering) => {
            onChange(exceptionalSubstitute(match, dialog.side, out, entering));
            setDialog(null);
          }}
          onConfirm={(out, entering) => {
            onChange(substitute(match, dialog.side, out, entering));
            setDialog(null);
          }}
        />
      )}
      {dialog?.kind === "no_libero" && (
        <div className="pl-overlay">
          <div className="pl-modal" role="alertdialog" aria-modal="true">
            <h2>Falta marcar el líbero</h2>
            <p className="pl-muted">
              {dialog.sides.map((entry) => match.teams[entry].name).join(" y ")} {dialog.sides.length === 1 ? "tiene" : "tienen"} líbero y no
              marcaste por quién entra.
            </p>
            <div className="pl-modal-actions">
              <button type="button" className="pl-button" onClick={() => setDialog({ kind: "libero", side: dialog.sides[0] })}>
                Marcar líbero
              </button>
              <button
                type="button"
                className="pl-button pl-button--primary"
                onClick={() => {
                  setLiberoWarnedSets((current) => [...current, set.number]);
                  setDialog(null);
                  onChange(scorePoint(match, dialog.pointFor));
                }}
              >
                Seguir sin líbero
              </button>
            </div>
          </div>
        </div>
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
      {dialog?.kind === "log" && (
        <LogDialog match={match} onChange={onChange} onClose={() => setDialog(null)} />
      )}
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
  onConfirm,
  onExceptional
}: {
  match: Match;
  side: Side;
  onClose: () => void;
  onAddPlayer: (match: Match) => void;
  onConfirm: (out: number, entering: number) => void;
  onExceptional: (out: number, entering: number) => void;
}) {
  const set = currentSet(match)!;
  const team = set.teams[side];
  const info = match.teams[side];
  const [out, setOut] = useState<number | null>(null);
  // Cambio excepcional (lesion): no cuenta entre los 6 y salta las reglas
  // de titular/suplente.
  const [exceptional, setExceptional] = useState(false);
  const bench = info.players.filter((player) => !team.rotation.includes(player.number) && !info.liberos.includes(player.number));
  const onCourtPlayers = team.rotation.filter((number) => team.liberoOn?.replaced !== number);

  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={(event) => event.stopPropagation()}>
        <h2>
          Cambio {info.name} <small className="pl-muted">({team.subsUsed}/6)</small>
        </h2>
        <label className="pl-check">
          <input
            type="checkbox"
            checked={exceptional}
            onChange={(event) => {
              setExceptional(event.target.checked);
              setOut(null);
            }}
          />
          Cambio excepcional (lesión, no cuenta)
        </label>
        <p className="pl-label">1. Sale</p>
        <div className="pl-choice-grid">
          {onCourtPlayers.map((number) => {
            const check = exceptional ? { ok: true as const } : checkSubstitution(match, side, number, null);
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
                  const check = exceptional ? { ok: true as const } : checkSubstitution(match, side, out, player.number);
                  return (
                    <button
                      key={player.number}
                      type="button"
                      className="pl-choice"
                      disabled={!check.ok}
                      onClick={() => (exceptional ? onExceptional(out, player.number) : onConfirm(out, player.number))}
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
// Planilla completa: todo lo anotado, set por set, lo mas nuevo arriba, con
// la hora de cada set y un cuadro de observaciones / protesta.
function LogDialog({ match, onChange, onClose }: { match: Match; onChange: (match: Match) => void; onClose: () => void }) {
  const sets = [...new Set(match.log.map((entry) => entry.setNumber))].sort((a, b) => b - a);
  const [notes, setNotes] = useState(match.notes ?? "");
  function saveNotes() {
    if ((match.notes ?? "") !== notes) onChange({ ...match, notes });
  }
  function close() {
    saveNotes();
    onClose();
  }
  return (
    <div className="pl-overlay" onClick={close}>
      <div className="pl-modal pl-modal--tall" onClick={(event) => event.stopPropagation()}>
        <h2>Planilla</h2>
        <p className="pl-muted">
          {match.teams.A.name} vs {match.teams.B.name}
        </p>
        <div className="pl-log">
          {sets.map((setNumber) => {
            const setState = match.sets.find((entry) => entry.number === setNumber);
            const duration = setState ? setDuration(setState) : "";
            return (
              <div key={setNumber}>
                <h3>
                  Set {setNumber}
                  {duration && <small className="pl-set-time"> · {duration}</small>}
                </h3>
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
            );
          })}
        </div>
        <label className="pl-field">
          <span className="pl-label">Observaciones / protesta</span>
          <textarea
            className="pl-textarea"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={saveNotes}
            placeholder="Escribí acá lo que haya que dejar asentado."
          />
        </label>
        <div className="pl-modal-actions">
          <button type="button" className="pl-button pl-button--primary" onClick={close}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

// Sancion: elegir equipo, a quien (jugador o equipo/entrenador) y el tipo.
function SanctionDialog({
  match,
  onClose,
  onConfirm
}: {
  match: Match;
  onClose: () => void;
  onConfirm: (side: Side, level: SanctionLevel, number: number | null) => void;
}) {
  const [side, setSide] = useState<Side>("A");
  const [target, setTarget] = useState<number | "team">("team");
  const set = currentSet(match)!;
  const players = set.teams[side].rotation;
  return (
    <div className="pl-overlay" onClick={onClose}>
      <div className="pl-modal" onClick={(event) => event.stopPropagation()}>
        <h2>Sanción</h2>
        <p className="pl-label">1. Equipo</p>
        <div className="pl-segmented">
          {(["A", "B"] as Side[]).map((entry) => (
            <button
              key={entry}
              type="button"
              className={side === entry ? "is-active" : ""}
              onClick={() => {
                setSide(entry);
                setTarget("team");
              }}
            >
              {match.teams[entry].name}
            </button>
          ))}
        </div>
        <p className="pl-label">2. A quién</p>
        <div className="pl-choice-grid">
          <button type="button" className={`pl-choice ${target === "team" ? "is-active" : ""}`} onClick={() => setTarget("team")}>
            Equipo / entrenador
          </button>
          {players.map((number) => (
            <button key={number} type="button" className={`pl-choice ${target === number ? "is-active" : ""}`} onClick={() => setTarget(number)}>
              #{number}
            </button>
          ))}
        </div>
        <p className="pl-label">3. Tipo</p>
        <div className="pl-sanction-list">
          {(Object.keys(SANCTION_LABELS) as SanctionLevel[]).map((level) => (
            <button
              key={level}
              type="button"
              className={level === "penalty" ? "pl-button pl-button--danger" : "pl-button"}
              onClick={() => onConfirm(side, level, target === "team" ? null : target)}
            >
              {SANCTION_LABELS[level]}
            </button>
          ))}
        </div>
        <div className="pl-modal-actions">
          <button type="button" className="pl-button" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
