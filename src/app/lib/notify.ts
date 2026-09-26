import { toast } from "sonner";

// Avisos flotantes de la app. Para errores de validación dentro de un formulario abierto se
// prefiere mostrar el mensaje en el propio modal; estos avisos son para éxito y errores generales.

const NOMBRES: Record<string, string> = {
  Ficha: "La ficha", Recurso: "El recurso", Tipo: "El tipo", Reserva: "La reserva", Personal: "La persona",
  Vehiculo: "El vehículo", Product: "El producto", Paquete: "El paquete", Inflable: "El inflable",
  Client: "El cliente", Carrito: "El carrito", Asignacion: "La asignación", Alerta: "La alerta",
  Category: "La categoría", Abono: "El abono", User: "El usuario", Image: "La imagen",
};

const CAMPOS: Record<string, string> = {
  nombre: "nombre", nombre_completo: "nombre completo", dni: "DNI", celular: "celular", licencia: "licencia",
  numero_telefono: "teléfono", fecha_nacimiento: "fecha de nacimiento", fecha_evento: "fecha del evento",
  fecha_reserva: "fecha de venta", cliente_nombre: "cliente", sku: "SKU", producto: "producto", recurso: "recurso",
  modelo: "modelo", codigo: "código", placa: "placa", tipo_id: "tipo", image_url: "imagen", fecha: "fecha",
  monto: "monto", medio: "medio de pago", brand: "marca", email: "correo", password: "contraseña", titulo: "título",
  fecha_reporte: "fecha del reporte", recurso_tipo: "recurso", recurso_id: "recurso", creado_por: "marca",
  zona: "zona", distrito: "distrito", idToken: "sesión de Google", path: "archivo",
};

// Mensajes del backend (en inglés o técnicos) → español para el usuario
const TRADUCCIONES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/Missing or invalid Authorization header|Invalid or expired token|^Unauthorized$/i, "Tu sesión expiró. Vuelve a iniciar sesión."],
  [/Invalid credentials/i, "Correo o contraseña incorrectos."],
  [/Forbidden brand scope/i, "No tienes acceso a los datos de esa marca."],
  [/Admin role required|Only admins can/i, "Solo un administrador puede hacer este cambio."],
  [/^Forbidden$/i, "No tienes permiso para realizar esta acción."],
  [/cliente_id does not exist/i, "El cliente seleccionado ya no existe."],
  [/transporte must be/i, "El tipo de servicio no es válido."],
  [/brand must be|Invalid brand/i, "La marca no es válida."],
  [/mes must have the format/i, "El mes no es válido."],
  [/monto must be a number greater than 0/i, "El monto debe ser mayor a 0."],
  [/Value must be a number between 0 and 100/i, "El valor debe estar entre 0 y 100."],
  [/rol must be chofer or apoyo/i, "El rol debe ser chofer o apoyo."],
  [/estado must be disponible, ocupado or descanso/i, "El estado no es válido."],
  [/licencia is required for chofer/i, "La licencia es obligatoria para un chofer."],
  [/dni must contain exactly 8 digits/i, "El DNI debe tener 8 dígitos."],
  [/dni already exists/i, "Ya existe una persona con ese DNI."],
  [/Email already in use/i, "Ese correo ya está registrado."],
  [/password must have at least 6/i, "La contraseña debe tener al menos 6 caracteres."],
  [/numero_telefono (is required and )?must be a valid phone/i, "El teléfono no es válido."],
  [/nombre_completo (is required and )?must contain at least 3/i, "El nombre completo debe tener al menos 3 caracteres."],
  [/fecha_nacimiento/i, "La fecha de nacimiento no es válida (no puede ser futura)."],
  [/chofer only accepts/i, "Para un chofer solo se guardan nombre, DNI, celular y licencia."],
  [/Not enough stock for salida/i, "No hay stock suficiente para esa salida."],
  [/Stock insuficiente para recurso \d+: disponible (\d+), solicitado (\d+)/i, (m) => `No hay stock suficiente de un recurso: quedan ${m[1]} y se pidieron ${m[2]}.`],
  [/Stock no encontrado para recurso/i, "Un recurso no tiene stock registrado."],
  [/Recurso \d+ not found/i, "Uno de los recursos ya no existe."],
  [/recursoNombre is required/i, "Falta el nombre de un recurso."],
  [/No file provided/i, "No se recibió ningún archivo."],
  [/Invalid (ficha|personal) id/i, "El registro no es válido."],
  [/cannot be empty/i, "Hay un campo obligatorio vacío."],
  [/duplicate key|already exists|unique constraint/i, "Ya existe un registro con esos datos."],
  [/violates foreign key/i, "No se puede completar: hay datos relacionados que lo impiden."],
  [/invalid input syntax/i, "Uno de los datos tiene un formato no válido."],
  [/Google/i, "No se pudo iniciar sesión con Google. Inténtalo de nuevo."],
  [/^(\w+) not found$/i, (m) => `${NOMBRES[m[1]] ?? "El registro"} no existe o fue eliminado.`],
  [/^(.+?) (?:is|are) required/i, (m) => {
    const campos = m[1].split(/,\s*|\s+and\s+|\s+or\s+/).map((c) => CAMPOS[c.trim()] ?? c.trim()).filter(Boolean);
    return campos.length ? `Falta completar: ${campos.join(", ")}.` : "Faltan datos obligatorios.";
  }],
];

// Si el texto ya está en español (el backend tiene varios mensajes así), se muestra tal cual
const PARECE_ESPANOL = /[áéíóúñ¿¡]|\b(ya|no|el|la|los|las|de|para|una?|debe|tienes|puede|requerid[oa]s?)\b/i;

type ErrorConEstado = { status?: number; message?: string; name?: string };

export function mensajeDeError(err: unknown, porDefecto = "Ocurrió un error. Inténtalo de nuevo."): string {
  const e = (err ?? {}) as ErrorConEstado;
  const texto = String(e.message ?? (typeof err === "string" ? err : "")).trim();

  // fetch sin red / servidor caído
  if (e.name === "TypeError" && /fetch|network|load failed/i.test(texto)) {
    return "No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.";
  }
  if (e.status === 413) return "El archivo es demasiado grande (máximo 10 MB).";

  for (const [patron, traduccion] of TRADUCCIONES) {
    const m = texto.match(patron);
    if (m) return typeof traduccion === "string" ? traduccion : traduccion(m);
  }

  if (texto && !/^HTTP \d+$/.test(texto) && PARECE_ESPANOL.test(texto)) return texto;

  if (e.status === 403) return "No tienes permiso para realizar esta acción.";
  if (e.status === 404) return "No se encontró el registro. Puede que se haya eliminado.";
  if (e.status && e.status >= 500) return "Ocurrió un error en el servidor. Inténtalo de nuevo en unos minutos.";
  return porDefecto;
}

export const notify = {
  ok: (mensaje: string) => toast.success(mensaje),
  aviso: (mensaje: string) => toast.warning(mensaje, { duration: 7000 }),
  // `id` evita apilar el mismo aviso varias veces (p. ej. varias peticiones que fallan a la vez)
  error: (err: unknown, porDefecto?: string, opciones: { id?: string } = {}) =>
    toast.error(mensajeDeError(err, porDefecto), { duration: 7000, id: opciones.id }),
};
