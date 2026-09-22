// Cálculo de las líneas de una cotización (precio, descuento por ítem, inflables incluidos
// en paquetes). Es la única fórmula de precios de la app: la usan el formulario de fichas,
// las proformas, el contrato y los informes, para que siempre den el mismo resultado.

import type { Carrito, FlatProduct, Inflable, Paquete, Recurso } from "../contexts/ProductsContext";

export const IGV_RATE = 0.18;

export type DescuentoTipo = "porcentaje" | "monto";

export interface LineaDescuento {
  descuentoTipo: DescuentoTipo;
  descuentoValor: number;
}

export const SIN_DESCUENTO: LineaDescuento = { descuentoTipo: "porcentaje", descuentoValor: 0 };

export type GrupoLinea = "Paquete" | "Producto" | "Carrito" | "Inflable" | "Recurso" | "Movilidad";

export interface LineaCotizacion extends LineaDescuento {
  key: string;
  grupo: GrupoLinea;
  descripcion: string;
  detalle?: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
  descuentoMonto: number;
  total: number;
  editable: boolean;
  incluidoEnPaquete?: boolean;
  ref: { tipo: "paquete" | "producto" | "carrito" | "inflable" | "recurso" | "movilidad"; index?: number; id?: number };
}

export interface OrigenPaquete extends LineaDescuento {
  paqueteId: number;
  paqueteNombre: string;
  cantidad: number;
}

export interface OrigenProducto extends LineaDescuento {
  productoNombre: string;
  cantidad: number;
}

export interface OrigenLineas {
  brand: "donofrio" | "jugueton";
  paquetes: OrigenPaquete[];
  productosSueltos: OrigenProducto[];
  carritoIds: number[];
  carritosDescuentos: Record<number, LineaDescuento>;
  inflableIds: number[];
  inflablesDescuentos: Record<number, LineaDescuento>;
  recursos: Array<{ recursoId: number; cantidad: number; nombre?: string; precio?: number } & LineaDescuento>;
  costoEnvio: number;
  descuentoMovilidad: number;
  distrito: string;
}

export interface CatalogosCotizacion {
  paquetes: Paquete[];
  productos: FlatProduct[];
  carritos: Carrito[];
  inflables: Inflable[];
  recursos: Recurso[];
}

export function toMoneyNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const normalized = value.replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

// Descuento de una línea: 'porcentaje' se aplica sobre el subtotal, 'monto' es soles directos.
export function getDescuentoLinea(subtotal: number, { descuentoTipo, descuentoValor }: LineaDescuento): number {
  const valor = toMoneyNumber(descuentoValor);
  if (valor <= 0 || subtotal <= 0) return 0;
  const monto = descuentoTipo === "monto" ? valor : subtotal * (valor / 100);
  return Math.min(subtotal, Math.max(0, monto));
}

export function formatearContenidoPaquete(contenido: { productoNombre: string; cantidad: number }[]) {
  if (contenido.length === 0) return "";
  const parts = contenido.map((item) => `${item.cantidad} ${item.productoNombre}`);
  if (parts.length === 1) return parts[0];
  const last = parts.pop()!;
  return `${parts.join(", ")} y ${last}`;
}

export function mapDescuentoApi(row: any): LineaDescuento {
  return {
    descuentoTipo: row?.descuento_tipo === "monto" ? "monto" : "porcentaje",
    descuentoValor: toMoneyNumber(row?.descuento_valor),
  };
}

export function mapDescuentosPorId(rows: any[] | undefined, idKey: string): Record<number, LineaDescuento> {
  const map: Record<number, LineaDescuento> = {};
  (rows ?? []).forEach((row) => {
    const id = Number(row?.[idKey]);
    if (Number.isFinite(id)) map[id] = mapDescuentoApi(row);
  });
  return map;
}

// Dado los paquetes y los inflables asignados a una ficha, calcula qué inflables ya
// vienen cubiertos (S/0) por el "cupo" de inflables incluidos de esos paquetes.
export function getInflablesGratisIds(
  paquetesFicha: { paqueteId: number; cantidad: number }[],
  inflableIdsFicha: number[],
  catalogoPaquetes: Paquete[],
  catalogoInflables: Inflable[]
): Set<number> {
  const cupos = paquetesFicha.flatMap((p) => {
    const catalogo = catalogoPaquetes.find((item) => item.id === p.paqueteId);
    const cantidadPaquete = Math.max(0, toMoneyNumber(p.cantidad));
    return (catalogo?.inflablesIncluidos ?? [])
      .map((slot) => ({ tipoIds: slot.tipoIds, restante: slot.cantidad * cantidadPaquete }))
      .filter((cupo) => cupo.restante > 0);
  });

  const gratis = new Set<number>();
  inflableIdsFicha.forEach((inflableId) => {
    const inflable = catalogoInflables.find((item) => item.id === inflableId);
    if (!inflable) return;
    const cupo = cupos.find((c) => c.restante > 0 && c.tipoIds.includes(inflable.tipoId));
    if (cupo) {
      cupo.restante -= 1;
      gratis.add(inflableId);
    }
  });
  return gratis;
}

export function construirLineasCotizacion(origen: OrigenLineas, catalogos: CatalogosCotizacion): LineaCotizacion[] {
  const lineas: LineaCotizacion[] = [];

  const push = (base: Omit<LineaCotizacion, "subtotal" | "descuentoMonto" | "total">) => {
    const subtotal = base.precioUnitario * base.cantidad;
    const descuentoMonto = base.editable ? getDescuentoLinea(subtotal, base) : 0;
    lineas.push({ ...base, subtotal, descuentoMonto, total: Math.max(0, subtotal - descuentoMonto) });
  };

  origen.paquetes.forEach((paquete, index) => {
    if (!paquete.paqueteId) return;
    const catalogo = catalogos.paquetes.find((item) => item.id === paquete.paqueteId);
    push({
      key: `paquete-${index}`,
      grupo: "Paquete",
      descripcion: paquete.paqueteNombre || catalogo?.nombre || "Paquete",
      detalle: formatearContenidoPaquete(catalogo?.contenido ?? []),
      cantidad: Math.max(0, toMoneyNumber(paquete.cantidad)),
      precioUnitario: toMoneyNumber(catalogo?.precioUnitario),
      descuentoTipo: paquete.descuentoTipo,
      descuentoValor: paquete.descuentoValor,
      editable: true,
      ref: { tipo: "paquete", index },
    });
  });

  origen.productosSueltos.forEach((producto, index) => {
    if (!producto.productoNombre) return;
    const catalogo = catalogos.productos.find(
      (item) => item.producto === producto.productoNombre && item.brand === origen.brand
    );
    push({
      key: `producto-${index}`,
      grupo: "Producto",
      descripcion: producto.productoNombre,
      cantidad: Math.max(0, toMoneyNumber(producto.cantidad)),
      precioUnitario: toMoneyNumber(catalogo?.precio),
      descuentoTipo: producto.descuentoTipo,
      descuentoValor: producto.descuentoValor,
      editable: true,
      ref: { tipo: "producto", index },
    });
  });

  origen.carritoIds.forEach((carritoId) => {
    if (!carritoId) return;
    const carrito = catalogos.carritos.find((item) => item.id === carritoId);
    if (!carrito) return;
    const desc = origen.carritosDescuentos[carritoId] ?? SIN_DESCUENTO;
    push({
      key: `carrito-${carritoId}`,
      grupo: "Carrito",
      descripcion: `${carrito.codigo} — ${carrito.modelo}`,
      cantidad: 1,
      precioUnitario: toMoneyNumber(carrito.precioAlquiler),
      descuentoTipo: desc.descuentoTipo,
      descuentoValor: desc.descuentoValor,
      editable: true,
      ref: { tipo: "carrito", id: carritoId },
    });
  });

  if (origen.brand === "jugueton") {
    const gratisIds = getInflablesGratisIds(origen.paquetes, origen.inflableIds, catalogos.paquetes, catalogos.inflables);
    origen.inflableIds.forEach((inflableId) => {
      const inflable = catalogos.inflables.find((item) => item.id === inflableId);
      if (!inflable) return;
      const incluido = gratisIds.has(inflableId);
      const desc = origen.inflablesDescuentos[inflableId] ?? SIN_DESCUENTO;
      push({
        key: `inflable-${inflableId}`,
        grupo: "Inflable",
        descripcion: `${inflable.tipoNombre}${inflable.codigo ? ` (${inflable.codigo})` : ""}`,
        detalle: incluido ? "Incluido en el paquete" : undefined,
        cantidad: 1,
        precioUnitario: incluido ? 0 : toMoneyNumber(inflable.precioAlquiler),
        descuentoTipo: desc.descuentoTipo,
        descuentoValor: desc.descuentoValor,
        editable: !incluido,
        incluidoEnPaquete: incluido,
        ref: { tipo: "inflable", id: inflableId },
      });
    });
  }

  origen.recursos.forEach((recurso, index) => {
    if (!recurso.recursoId) return;
    const catalogo = catalogos.recursos.find((item) => item.id === recurso.recursoId);
    push({
      key: `recurso-${index}`,
      grupo: "Recurso",
      descripcion: recurso.nombre || catalogo?.recurso || "Recurso",
      cantidad: Math.max(0, toMoneyNumber(recurso.cantidad)),
      precioUnitario: recurso.precio !== undefined ? toMoneyNumber(recurso.precio) : toMoneyNumber(catalogo?.precio),
      descuentoTipo: recurso.descuentoTipo,
      descuentoValor: recurso.descuentoValor,
      editable: true,
      ref: { tipo: "recurso", index },
    });
  });

  const costoEnvio = toMoneyNumber(origen.costoEnvio);
  if (costoEnvio > 0) {
    push({
      key: "movilidad",
      grupo: "Movilidad",
      descripcion: `Movilidad a ${origen.distrito || "destino"}`,
      cantidad: 1,
      precioUnitario: costoEnvio,
      descuentoTipo: "porcentaje",
      descuentoValor: toMoneyNumber(origen.descuentoMovilidad),
      editable: true,
      ref: { tipo: "movilidad" },
    });
  }

  return lineas;
}

// Construye el origen de las líneas a partir del detalle crudo de `GET /fichas/:id`.
export function origenDesdeDetalleApi(f: any): OrigenLineas {
  return {
    brand: f?.brand === "jugueton" ? "jugueton" : "donofrio",
    paquetes: (f?.paquetes ?? []).map((p: any) => ({
      paqueteId: Number(p.paquete_id) || 0,
      paqueteNombre: p.paquete_nombre || "",
      cantidad: toMoneyNumber(p.cantidad) || 1,
      ...mapDescuentoApi(p),
    })),
    productosSueltos: (f?.productosSueltos ?? []).map((p: any) => ({
      productoNombre: p.producto_nombre || "",
      cantidad: toMoneyNumber(p.cantidad) || 1,
      ...mapDescuentoApi(p),
    })),
    carritoIds: f?.carritoIds ?? [],
    carritosDescuentos: mapDescuentosPorId(f?.carritos, "id"),
    inflableIds: f?.inflableIds ?? [],
    inflablesDescuentos: mapDescuentosPorId(f?.inflables, "id"),
    recursos: (f?.recursos ?? []).map((r: any) => ({
      recursoId: Number(r.recurso_id) || 0,
      cantidad: toMoneyNumber(r.cantidad) || 1,
      nombre: r.recurso_nombre || "",
      precio: toMoneyNumber(r.precio),
      ...mapDescuentoApi(r),
    })),
    costoEnvio: toMoneyNumber(f?.costo_envio),
    descuentoMovilidad: toMoneyNumber(f?.descuento_movilidad),
    distrito: f?.distrito || "",
  };
}
