import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Wrench } from "lucide-react";
import { Modal } from "./ui/modal";
import { Button } from "./ui/button";
import { campo, etiqueta } from "../lib/ui";
import { mensajeDeError } from "../lib/notify";

// Advertencia al elegir en una ficha un inflable o carrito que ya está asignado ese día, o un
// recurso sin stock suficiente. Muestra dónde está asignado, las otras unidades del mismo tipo
// y permite usar una libre o registrar una unidad nueva (o agregar el stock que falta) ahí mismo.

export interface OcupacionUnidad {
  fichaId: number;
  titulo: string;
  cliente: string;
  fecha: string;
}

export interface OtraUnidad {
  id: number;
  codigo: string;
  estado: "libre" | "ocupada" | "mantenimiento" | "en-esta-ficha";
  ocupacion?: OcupacionUnidad;
}

type PropsUnidad = {
  modo: "unidad";
  tipo: "inflable" | "carrito";
  nombre: string;
  codigo: string;
  ocupaciones: OcupacionUnidad[];
  otras: OtraUnidad[];
  codigoSugerido: string;
  codigosExistentes: string[];
  formatFecha: (iso: string) => string;
  onUsar: (id: number) => void;
  onRegistrar: (codigo: string) => Promise<void>;
  onClose: () => void;
};

type PropsRecurso = {
  modo: "recurso";
  nombre: string;
  disponible: number;
  pedido: number;
  onAgregar: (cantidad: number) => Promise<void>;
  onClose: () => void;
};

export function AvisoDisponibilidad(props: PropsUnidad | PropsRecurso) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState("");
  const faltan = props.modo === "recurso" ? Math.max(1, props.pedido - props.disponible) : 0;
  const [codigo, setCodigo] = useState(props.modo === "unidad" ? props.codigoSugerido : "");
  const [cantidad, setCantidad] = useState(String(faltan));

  // Si cambia la unidad consultada, se reinician los campos
  const clave = props.modo === "unidad" ? `${props.tipo}-${props.codigo}` : `recurso-${props.nombre}`;
  useEffect(() => {
    setError("");
    if (props.modo === "unidad") setCodigo(props.codigoSugerido);
    else setCantidad(String(faltan));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clave]);

  const ejecutar = async (accion: () => Promise<void>) => {
    setOcupado(true);
    setError("");
    try {
      await accion();
    } catch (err) {
      setError(mensajeDeError(err, "No se pudo completar la acción."));
    } finally {
      setOcupado(false);
    }
  };

  if (props.modo === "recurso") {
    const confirmar = () => {
      const n = Math.floor(Number(cantidad));
      if (!Number.isFinite(n) || n < faltan) {
        setError(`Agrega al menos ${faltan} ${faltan === 1 ? "unidad" : "unidades"} para cubrir lo que pides.`);
        return;
      }
      void ejecutar(() => props.onAgregar(n));
    };
    return (
      <Modal
        open
        elevated
        onClose={props.onClose}
        busy={ocupado}
        error={error || undefined}
        title={<span className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />Stock insuficiente</span>}
        description={`«${props.nombre}»`}
        footer={<>
          <Button type="button" variant="subtle" onClick={props.onClose} disabled={ocupado}>Cancelar</Button>
          <Button type="button" variant="brand" onClick={confirmar} loading={ocupado}>Agregar al stock</Button>
        </>}
      >
        <p className="text-sm text-gray-700 dark:text-gray-300">
          No hay stock suficiente de <span className="font-medium">«{props.nombre}»</span>:{" "}
          {props.disponible === 1 ? "queda 1" : `quedan ${props.disponible}`} y pides {props.pedido}.
        </p>
        <p className="mt-2 text-sm text-gray-700 dark:text-gray-300">
          ¿Deseas agregar {faltan === 1 ? "la unidad que falta" : `las ${faltan} unidades que faltan`} al stock?
          Quedará registrado en el historial del recurso como entrada.
        </p>
        <div className="mt-4 max-w-40">
          <label htmlFor="aviso-cantidad" className={etiqueta}>Unidades a agregar</label>
          <input id="aviso-cantidad" type="number" min={faltan} step={1} value={cantidad}
            onChange={(e) => setCantidad(e.target.value)} className={campo} />
        </div>
      </Modal>
    );
  }

  const esInflable = props.tipo === "inflable";
  const articulo = esInflable ? "El inflable" : "El carrito";
  const libres = props.otras.filter((o) => o.estado === "libre");
  const codigoLimpio = codigo.trim();
  const codigoRepetido = props.codigosExistentes.some((c) => c.trim().toUpperCase() === codigoLimpio.toUpperCase());

  const registrar = () => {
    if (!codigoLimpio) { setError("Escribe el código de la unidad nueva."); return; }
    if (codigoRepetido) { setError(`Ya existe una unidad con el código «${codigoLimpio}». Usa otro.`); return; }
    void ejecutar(() => props.onRegistrar(codigoLimpio));
  };

  return (
    <Modal
      open
      elevated
      size="lg"
      onClose={props.onClose}
      busy={ocupado}
      error={error || undefined}
      title={<span className="flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />{esInflable ? "Inflable" : "Carrito"} ocupado ese día</span>}
      description={`${props.nombre} · ${props.codigo}`}
      footer={<>
        <Button type="button" variant="subtle" onClick={props.onClose} disabled={ocupado}>Cancelar</Button>
        <Button type="button" variant="brand" onClick={registrar} loading={ocupado}>Registrar unidad y asignarla</Button>
      </>}
    >
      <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
        {props.ocupaciones.length > 0 ? (
          props.ocupaciones.map((o) => (
            <p key={o.fichaId} className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
              {articulo} <span className="font-medium">{props.nombre} ({props.codigo})</span> está asignado a la ficha{" "}
              <span className="font-medium">#{o.fichaId} «{o.titulo}»</span>{o.cliente ? ` (${o.cliente})` : ""} para el evento del{" "}
              <span className="font-medium">{props.formatFecha(o.fecha)}</span>.
            </p>
          ))
        ) : (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
            {articulo} <span className="font-medium">{props.nombre} ({props.codigo})</span> ya está asignado a otra ficha para ese día.
          </p>
        )}

        <div>
          <p className="font-medium text-gray-900 dark:text-white mb-2">
            {props.otras.length ? `Otras unidades de ${props.nombre}` : `No hay otras unidades de ${props.nombre}.`}
          </p>
          {props.otras.length > 0 && (
            <ul className="space-y-1.5">
              {props.otras.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2">
                  <span className="min-w-0">
                    <span className="font-medium text-gray-900 dark:text-white">{o.codigo}</span>{" "}
                    {o.estado === "libre" && <span className="text-green-700 dark:text-green-400">· Disponible ese día</span>}
                    {o.estado === "en-esta-ficha" && <span className="text-gray-500 dark:text-gray-400">· Ya está en esta ficha</span>}
                    {o.estado === "mantenimiento" && <span className="inline-flex items-center gap-1 text-gray-500 dark:text-gray-400">· <Wrench className="w-3.5 h-3.5" /> En mantenimiento</span>}
                    {o.estado === "ocupada" && o.ocupacion && (
                      <span className="text-gray-500 dark:text-gray-400">· Asignada a la ficha #{o.ocupacion.fichaId} «{o.ocupacion.titulo}»</span>
                    )}
                  </span>
                  {o.estado === "libre" && (
                    <Button type="button" size="sm" variant="navy" onClick={() => props.onUsar(o.id)} disabled={ocupado}>
                      <CheckCircle2 /> Usar esta
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
          <p className="text-gray-900 dark:text-white">
            {libres.length ? "¿O prefieres registrar otra unidad?" : "¿Deseas registrar otra unidad y asignarla a esta ficha?"}
          </p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Se agrega a {esInflable ? "Inflables" : "Productos › Carritos"} como una unidad nueva de {props.nombre}, disponible desde ya.
          </p>
          <div className="mt-3 max-w-56">
            <label htmlFor="aviso-codigo" className={etiqueta}>Código de la unidad nueva</label>
            <input id="aviso-codigo" type="text" value={codigo} onChange={(e) => setCodigo(e.target.value)} className={campo} />
            {codigoLimpio && codigoRepetido && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">Ese código ya existe.</p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// Propone el siguiente código siguiendo el formato del que está ocupado:
// "004ILO" → siguiente número libre con el mismo sufijo; "CLASICO-21" → "CLASICO-22".
export function sugerirCodigo(base: string, existentes: string[]): string {
  const usados = new Set(existentes.map((c) => c.trim().toUpperCase()));
  const m = base.trim().match(/^(.*?)(\d+)(\D*)$/);
  if (!m) {
    let n = 2;
    while (usados.has(`${base}-${n}`.toUpperCase())) n++;
    return `${base}-${n}`;
  }
  const [, prefijo, numero, sufijo] = m;
  // Con el mismo prefijo, la numeración es compartida (en inflables el número es correlativo entre tipos)
  const max = existentes.reduce((acc, c) => {
    const x = c.trim().match(/^(.*?)(\d+)(\D*)$/);
    return x && x[1].toUpperCase() === prefijo.toUpperCase() ? Math.max(acc, Number(x[2])) : acc;
  }, Number(numero));
  let n = max + 1;
  const armar = (v: number) => `${prefijo}${String(v).padStart(numero.length, "0")}${sufijo}`;
  while (usados.has(armar(n).toUpperCase())) n++;
  return armar(n);
}
