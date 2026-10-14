import { useEffect, useState } from "react";
import { ChevronDown, Megaphone, X } from "lucide-react";

/**
 * Aviso temporal del área de TI: franja dentro del panel, después de iniciar sesión.
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
} = {
  id: "aviso-ti-2026-10-01-movilidad-y-personal",
  hasta: "2026-10-02T02:20:00Z", // 01/10 21:20 (Lima), aproximadamente 5 h de publicación
  titulo: "Aviso de TI · Mejoras en cotizaciones y fichas",
  mensaje:
    "Ya puedes cotizar la movilidad por varios días y agregar personal de reparto con precio editable. También tienes filtros de crédito y fechas, y horarios exactos o por rango para D’Onofrio.",
  detalle: [
    "Movilidad por días: ingresa el precio por día y la cantidad de días. Por ejemplo, 4 días × S/ 80 = S/ 320. Se refleja en el total y en la proforma.",
    "Al editar una ficha, se conserva el precio de movilidad guardado y el total se ajusta cuando cambias el costo, los días o el descuento de movilidad.",
    "Productos › Personal: puedes crear y reutilizar tipos de personal con el nombre que necesites. El nombre del tipo y el precio del servicio se editan por separado.",
    "Al asignar personal a una ficha, su tarifa se suma una vez a la cotización y aparece en la proforma. El precio queda guardado para conservar las cotizaciones anteriores.",
    "Fichas: filtra por crédito completado, pendiente o parcial, y combina ese filtro con los rangos de fecha de contacto y fecha del evento.",
    "D’Onofrio: elige hora exacta o rango de hora por separado para entrega y recojo. Al cambiar de rango a hora exacta, la hora final anterior se elimina.",
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
