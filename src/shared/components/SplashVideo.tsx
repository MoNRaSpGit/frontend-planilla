import { useEffect, useRef, useState } from "react";

// Pantalla de inicio con el video de Logic Lab (26/10/2026, pedido
// explicito): cada vez que se abre la app se ve el video COMPLETO, y
// mientras tanto la app se carga atras ("lo camuflamos con esto").
//
// Sonido: primero intenta CON sonido. Los navegadores solo lo permiten si
// la app esta instalada (celular o PC) o si el usuario ya toco la pagina;
// si no lo dejan, se reproduce mudo (es la unica forma de que arranque
// solo).
//
// Nunca se queda trabado: si el video falla, no arranca en unos segundos
// (internet lento) o tarda demasiado, se pasa a la app igual.
const SPLASH_SRC = `${import.meta.env.BASE_URL}logiclab_splash_liviano.mp4`;
const START_TIMEOUT_MS = 4000;
const MAX_DURATION_MS = 15000;

export function SplashVideo() {
  const [visible, setVisible] = useState(true);
  const [fading, setFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  function finish() {
    setFading(true);
    window.setTimeout(() => setVisible(false), 350);
  }

  useEffect(() => {
    const video = videoRef.current;
    let started = false;
    const markStarted = () => {
      started = true;
    };
    video?.addEventListener("playing", markStarted);
    if (video) {
      video.muted = false;
      video.play().catch(() => {
        video.muted = true;
        video.play().catch(() => finish());
      });
    }

    const startTimer = window.setTimeout(() => {
      if (!started) finish();
    }, START_TIMEOUT_MS);
    const maxTimer = window.setTimeout(finish, MAX_DURATION_MS);
    return () => {
      video?.removeEventListener("playing", markStarted);
      window.clearTimeout(startTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div className={`splash ${fading ? "is-fading" : ""}`} aria-hidden="true">
      <video ref={videoRef} src={SPLASH_SRC} playsInline preload="auto" onEnded={finish} onError={finish} />
    </div>
  );
}
