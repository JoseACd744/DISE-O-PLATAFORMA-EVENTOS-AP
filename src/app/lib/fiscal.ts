import { API_BASE_URL, apiRequest, ApiError } from "./api";
import { getAuthToken } from "./auth";

export type TipoFiscal = "01" | "03";
export interface ReceptorFiscal {
  tipo_documento: string;
  numero_documento: string;
  razon_social: string;
  direccion: string;
  email: string;
}
export interface CuotaFiscal {
  fecha: string;
  monto: number;
}
export interface SolicitudFiscal {
  brand: "donofrio" | "jugueton";
  ficha_id: number;
  emisor_id: string;
  tipo: TipoFiscal;
  receptor: ReceptorFiscal;
  forma_pago: "Contado" | "Credito";
  cuotas: CuotaFiscal[];
  afectacion: "10" | "20" | "30";
  version: string;
}
export interface SnapshotFiscal {
  emisor: {
    id?: string;
    ruc: string;
    razon_social: string;
    direccion?: string;
  };
  receptor: ReceptorFiscal;
  tipo: TipoFiscal;
  fecha_emision: string;
  moneda: string;
  forma_pago: string;
  cuotas: CuotaFiscal[];
  lineas: {
    key?: string;
    descripcion: string;
    cantidad: number;
    total: number;
    base: number;
    igv: number;
  }[];
  base: number;
  igv: number;
  total: number;
  afectacion: string;
}
export interface ComprobanteFiscal {
  id: string;
  tipo: TipoFiscal;
  serie: string;
  numero: number;
  estado: string;
  environment: string;
  created_at: string;
  total: number;
  snapshot?: SnapshotFiscal;
  codigo?: string;
  mensaje?: string;
  archivos?: string[];
}
export interface DatosFiscales {
  config: {
    enabled: boolean;
    environment: string;
    emitter?: { ruc: string; razon_social: string };
    emitters?: {
      id: string;
      ruc: string;
      razon_social: string;
      series: Record<TipoFiscal, string>;
      enabled: boolean;
      reason?: string;
    }[];
    series?: Record<TipoFiscal, string>;
    reason?: string;
  };
  defaults: {
    receptor: ReceptorFiscal;
    lineas: {
      key: string;
      descripcion: string;
      cantidad: number;
      total: number;
    }[];
    total: number;
    abonado: number;
    version: string;
  };
  comprobantes: ComprobanteFiscal[];
}
export interface VistaFiscal {
  snapshot: SnapshotFiscal;
  preview_token: string;
}

export const nombreTipoFiscal = (tipo: string) =>
  tipo === "01" ? "Factura" : "Boleta";
export const dineroFiscal = (monto: unknown) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    Number(monto) || 0,
  );
export const ESTADOS_FISCALES: Record<string, string> = {
  pendiente: "Pendiente de envío",
  enviando: "Enviando",
  enviado: "Pendiente de respuesta",
  aceptado: "Aceptado",
  observado: "Aceptado con observaciones",
  rechazado: "Rechazado",
  desconocido: "Respuesta por confirmar",
  error: "Error de envío",
  anulado: "Anulado",
  queued: "Pendiente de envío",
  sending: "Enviando",
  accepted: "Aceptado",
  observed: "Aceptado con observaciones",
  rejected: "Rechazado",
  unknown: "Respuesta por confirmar",
  retry: "Pendiente de consulta",
  blocked: "Requiere revisión contable",
};
export function estadoFiscal(estado: string) {
  return ESTADOS_FISCALES[estado] || estado;
}

export function obtenerDatosFiscales(brand: string, fichaId: number) {
  return apiRequest<DatosFiscales>(
    `/fiscal?brand=${encodeURIComponent(brand)}&ficha_id=${fichaId}`,
  );
}
export function previsualizarFiscal(body: SolicitudFiscal) {
  return apiRequest<VistaFiscal>("/fiscal/preview", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
export function emitirFiscal(
  body: SolicitudFiscal,
  token: string,
  key: string,
) {
  return apiRequest<ComprobanteFiscal>("/fiscal/emitir", {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ ...body, preview_token: token }),
  });
}
export function consultarFiscal(id: string, brand: string) {
  return apiRequest<ComprobanteFiscal>(
    `/fiscal/${encodeURIComponent(id)}/consultar`,
    { method: "POST", body: JSON.stringify({ brand }) },
  );
}

/** Descarga con la sesión; nunca exponer XML/CDR mediante una URL pública. */
export async function descargarFiscal(
  doc: ComprobanteFiscal,
  tipo: string,
  brand: string,
) {
  const response = await fetch(
    `${API_BASE_URL}/fiscal/${encodeURIComponent(doc.id)}/archivos/${encodeURIComponent(tipo)}?brand=${encodeURIComponent(brand)}`,
    {
      headers: { Authorization: `Bearer ${getAuthToken() || ""}` },
    },
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new ApiError(
      body?.error || "No se pudo descargar el archivo.",
      response.status,
      body,
    );
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  const extension = blob.type.includes("html")
    ? "html"
    : blob.type.includes("zip")
      ? "zip"
      : tipo === "cdr"
        ? "xml"
        : tipo;
  link.download = `${doc.serie}-${doc.numero}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
