import { useEffect, useState } from "react";
import { ChevronDown, Megaphone, X } from "lucide-react";
import { Link } from "react-router";
import { useBrand } from "../contexts/BrandContext";

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
  id: "aviso-ti-2026-11-21-helados-por-dia",
  hasta: "2026-12-06T05:00:00Z",
  titulo: "Helados necesarios por día",
  mensaje:
    "En Reportes puedes consultar el total de helados de una fecha y el detalle por ficha. Abre la consulta y elige el día que necesitas preparar.",
  detalle: [
    "Pulsa «Ver helados por día» para abrir Reportes en la consulta diaria.",
    "Elige la fecha en «Fecha del evento». Verás el total de helados y el desglose por ficha, con paquetes y productos sueltos.",
    "Puedes descargar el detalle con «Exportar helados (Excel)».",
  ],
};

const CLAVE = `avisoCerrado:${AVISO.id}`;
const vence = new Date(AVISO.hasta).getTime();

export function AvisoTI() {
  const { brand } = useBrand();
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

  if (brand !== "donofrio" || !activo || cerrado) return null;

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
            <Link to="/dashboard/reportes?vista=helados#helados-por-ficha" className="font-medium underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-50">Ver helados por día</Link>
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
