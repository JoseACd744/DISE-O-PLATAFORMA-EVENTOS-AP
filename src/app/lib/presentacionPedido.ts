export function nombrePresentacion(value?: string): string {
  return ({ carrito: "Carrito", lonchera: "Lonchera", solo_helados: "Solo helados", tecnopor: "Tecnopor" } as Record<string, string>)[value || "carrito"] || value || "Carrito";
}
