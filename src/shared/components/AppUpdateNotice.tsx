import { useEffect, useState } from "react";
import { fetchPublishedFrontendBuildMeta, FRONTEND_BUILD_INFO } from "../build";

const UPDATE_CHECK_INTERVAL_MS = 2 * 60 * 1000;
const APP_CACHE_PREFIX = "planilla-";
// Cuanto tarda la barra en llenarse. La limpieza real (service worker +
// cache) lleva mucho menos; la barra existe para que se VEA que la app se
// esta actualizando y no parezca un parpadeo raro.
const PROGRESS_DURATION_MS = 2200;
const PROGRESS_TICK_MS = 40;

// Misma limpieza que frontend-construccion/gym: desregistra el service
// worker, borra el cache de la app y deja todo listo para que el reload
// traiga la version nueva.
async function clearAppCache() {
  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      const appBasePath = new URL(import.meta.env.BASE_URL, window.location.href).pathname;
      await Promise.all(
        registrations
          .filter((registration) => registration.scope.includes(appBasePath))
          .map((registration) => registration.unregister())
      );
    }

    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.filter((key) => key.startsWith(APP_CACHE_PREFIX)).map((key) => window.caches.delete(key)));
    }
  } catch {
    // Si la limpieza falla, igual se recarga: es lo que trae la version nueva.
  }
}

// Aviso de "hay una nueva actualizacion" (26/10/2026, misma dinamica que
// frontend-distribuidora, pedido explicito):
// un cartel abajo a la izquierda y, al tocar Actualizar, una barra de progreso que toma
// toda la pantalla y recarga la app cuando termina.
//
// Nunca se actualiza sola: siempre decide el planillero cuando (no en
// medio de un tanto). El partido en curso no se pierde al recargar, queda
// guardado en el celular (storage.ts). El logo es provisorio hasta tener
// el definitivo.
export function AppUpdateNotice() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);

  useEffect(() => {
    if (!import.meta.env.PROD) return;

    let mounted = true;

    const checkForUpdates = async () => {
      try {
        const published = await fetchPublishedFrontendBuildMeta();
        if (mounted && published.releaseSha && published.releaseSha !== FRONTEND_BUILD_INFO.releaseSha) {
          setUpdateAvailable(true);
        }
      } catch {
        // Silencioso: se reintenta solo en el proximo chequeo.
      }
    };

    void checkForUpdates();
    const intervalId = window.setInterval(() => void checkForUpdates(), UPDATE_CHECK_INTERVAL_MS);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === "visible") void checkForUpdates();
    };
    window.addEventListener("focus", handleVisibilityOrFocus);
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
    };
  }, []);

  function handleUpdate() {
    if (progress !== null) return;
    setProgress(0);

    const cleanup = clearAppCache();
    const startedAt = Date.now();

    const intervalId = window.setInterval(() => {
      const next = Math.min(100, Math.round(((Date.now() - startedAt) / PROGRESS_DURATION_MS) * 100));
      setProgress(next);

      if (next >= 100) {
        window.clearInterval(intervalId);
        // Se recarga recien con la barra llena Y la limpieza terminada.
        void cleanup.then(() => window.location.reload());
      }
    }, PROGRESS_TICK_MS);
  }

  if (progress !== null) {
    return (
      <div className="update-overlay" role="status" aria-live="polite">
        <div className="update-overlay-card">
          <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" />
          <strong>{progress < 100 ? "Actualizando la aplicación…" : "¡Listo!"}</strong>
          <div
            className="update-progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <div className="update-progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <span>{progress}%</span>
        </div>
      </div>
    );
  }

  if (!updateAvailable) {
    return null;
  }

  return (
    <aside className="update-banner" role="status" aria-live="polite">
      <strong>Hay una nueva actualización</strong>
      <button type="button" className="pl-button pl-button--primary" onClick={handleUpdate}>
        Actualizar
      </button>
    </aside>
  );
}
