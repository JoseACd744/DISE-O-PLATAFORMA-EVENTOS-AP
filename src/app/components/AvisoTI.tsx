import { useEffect, useState } from "react";
import { ChevronDown, Megaphone, X } from "lucide-react";
import { isAuthenticated, isDriverUser } from "../lib/auth";

/**
 * Aviso temporal del área de TI: franja arriba del todo, en todas las páginas.
 * Para publicar otro, cambia `id` (así se vuelve a mostrar a quien cerró el anterior) y `hasta`.
 * Pasada la fecha `hasta` deja de mostrarse solo, sin tener que volver a publicar.
 */
const AVISO: {
  id: string;
  hasta: string;
  titulo: string;
  mensaje: string;
  /** Lista opcional que se despliega con "Ver detalle" */
  detalle?: string[];
  /** Enlace opcional (solo se muestra a quien ya inició sesión en el panel) */
  enlace?: { href: string; texto: string };
} = {
  id: "aviso-ti-2026-09-29-inflables-y-unidades",
  hasta: "2026-09-29T22:57:00Z", // 29/09 17:57 (Lima), unas 5 h después de publicarse
  titulo: "Aviso de TI · Novedades en Fichas",
  mensaje:
    "Los inflables incluidos en los paquetes ya se marcan sin costo, y si un inflable, carrito o recurso no está disponible ese día, la ficha te avisa dónde está asignado y te deja usar otra unidad o registrar una nueva.",
  detalle: [
    "COMBOS: al elegir el paquete, sus inflables se marcan solos con «Incluido en … · S/ 0». Puedes cambiarlos por otra unidad; si quitas el paquete, se desmarcan.",
    "INFANTIL 1, 2 y 3 («INFLABLE MEDIANO / GRANDE»): puedes elegir cualquier inflable sin costo; todos aparecen como «Incluido» hasta que elijas uno. Cualquier inflable adicional se cobra aparte.",
    "Inflables y carritos ocupados ese día: al elegirlos se muestra a qué ficha están asignados y para qué fecha, las otras unidades del mismo tipo (con «Usar esta» si hay una libre) y la opción de registrar una unidad nueva con un código sugerido.",
    "Recursos sin stock suficiente: se avisa cuántos quedan y puedes agregar al stock las unidades que faltan; queda en el historial del recurso.",
    "Productos › Personal: el calendario ahora muestra a las personas asignadas cada día (apoyo en fichas y choferes en rutas), no los nombres de las fichas.",
  ],
  enlace: { href: "/dashboard/fichas", texto: "Ir a Fichas" },
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
          {verLista && AVISO.detalle && (
            <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
              {AVISO.detalle.map((r) => <li key={r}>{r}</li>)}
            </ul>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {AVISO.detalle?.length ? (
              <button type="button" onClick={() => setVerLista((v) => !v)} aria-expanded={verLista}
                className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-50">
                {verLista ? "Ocultar detalle" : "Ver detalle"}
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${verLista ? "rotate-180" : ""}`} aria-hidden="true" />
              </button>
            ) : null}
            {mostrarEnlace && AVISO.enlace && (
              <a href={AVISO.enlace.href} className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-50">
                {AVISO.enlace.texto}
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
