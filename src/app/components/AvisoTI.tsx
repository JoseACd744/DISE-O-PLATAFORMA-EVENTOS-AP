import { useEffect, useState } from "react";
import { ChevronDown, Megaphone, X } from "lucide-react";
import { isAuthenticated, isDriverUser } from "../lib/auth";

/**
 * Aviso temporal del área de TI: franja arriba del todo, en todas las páginas.
 * Para publicar otro, cambia `id` (así se vuelve a mostrar a quien cerró el anterior) y `hasta`.
 * Pasada la fecha `hasta` deja de mostrarse solo, sin tener que volver a publicar.
 */
const AVISO = {
  id: "aviso-ti-2026-09-26-stock-recursos",
  hasta: "2026-09-27T02:15:00Z", // 26/09 21:15 (Lima), unas 5 h después de publicarse
  titulo: "Aviso de TI · Stock de recursos por regularizar",
  mensaje:
    "Algunos recursos estaban en 0 unidades y eso impedía guardar fichas. TI les cargó 10 unidades temporales para no frenar el trabajo: revisen el conteo real y corrijan el stock en Productos › Recursos.",
  recursos: [
    "Carrito Modelo Delgado CMD-15, CMD-17 y CMD-18",
    "Carrito Modelo Clásico CMC-04",
    "Carrito cerámica para pintar",
    "Medias D'Onofrio",
    "Lonchera térmica",
    "Torito Pucará rojo, celeste y azul",
  ],
};

const CLAVE = `avisoCerrado:${AVISO.id}`;
const vence = new Date(AVISO.hasta).getTime();

export function AvisoTI() {
  const [cerrado, setCerrado] = useState(() => {
    try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; }
  });
  const [activo, setActivo] = useState(() => Date.now() < vence);
  const [verLista, setVerLista] = useState(false);

  // Si la página queda abierta, el aviso se va solo al vencer
  useEffect(() => {
    if (!activo) return;
    const t = setTimeout(() => setActivo(false), Math.max(0, vence - Date.now()));
    return () => clearTimeout(t);
  }, [activo]);

  if (!activo || cerrado) return null;

  const cerrar = () => {
    setCerrado(true);
    try { localStorage.setItem(CLAVE, "1"); } catch { /* sin almacenamiento: solo se oculta en esta visita */ }
  };
  // El enlace solo sirve a quien ya inició sesión en el panel (no en el login ni en el módulo de choferes)
  const mostrarEnlace = isAuthenticated() && !isDriverUser();

  return (
    <div role="status" className="shrink-0 border-b border-amber-300 bg-amber-100 text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex items-start gap-3 px-4 py-2.5 text-sm">
        <Megaphone className="w-4 h-4 mt-0.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p>
            <span className="font-semibold">{AVISO.titulo}.</span> {AVISO.mensaje}
          </p>
          {verLista && (
            <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
              {AVISO.recursos.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button type="button" onClick={() => setVerLista((v) => !v)} aria-expanded={verLista}
              className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-50">
              {verLista ? "Ocultar recursos" : "Ver recursos ajustados"}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verLista ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
            {mostrarEnlace && (
              <a href="/dashboard/productos?tab=recursos" className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-50">
                Ir a Recursos
              </a>
            )}
          </div>
        </div>
        <button type="button" onClick={cerrar} aria-label="Cerrar aviso" title="Cerrar aviso"
          className="shrink-0 -mr-1 p-1 rounded-md text-amber-800 hover:bg-amber-200 dark:text-amber-300 dark:hover:bg-amber-900">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
