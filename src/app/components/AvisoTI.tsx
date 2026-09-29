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
  id: "aviso-ti-2026-09-29-novedades-inflables-incluidos",
  hasta: "2026-09-29T22:30:00Z", // 29/09 17:30 (Lima), unas 5 h después de publicarse
  titulo: "Aviso de TI · Novedades",
  mensaje:
    "En la ficha, al elegir un paquete que incluye inflables, ahora se marcan los inflables incluidos sin costo. También: dirección y ciudad del cliente opcionales, \"Link de Pago\" en el abono inicial y la fecha de contacto antes que la del evento.",
  detalle: [
    "Fichas (Juguetón): si el paquete incluye inflables (por ejemplo un COMBO), aparece un aviso con cuántos incluye y esos inflables se muestran primero con «Incluido en … · S/ 0». Al marcarlos, el resumen los cobra en S/ 0; cualquier inflable adicional se cobra aparte.",
    "Clientes: puedes crear o editar un cliente solo con su nombre y teléfono (también en \"+ Nuevo cliente\" dentro de una ficha). Al editar, si dejas la dirección o la ciudad vacías, se borran.",
    "Fichas: al registrar el abono inicial ya aparece el medio de pago \"Link de Pago\".",
    "Fichas: primero va la fecha de contacto del cliente y luego la fecha del evento (en el formulario, los filtros y el detalle). Si la fecha del evento es anterior a la de contacto, se muestra un aviso para revisarla.",
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
