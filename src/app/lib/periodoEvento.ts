export function diasEvento(inicio: string, fin?: string | null): number {
  const a = Date.parse(inicio?.slice(0,10) + 'T00:00:00Z');
  const b = Date.parse((fin || inicio)?.slice(0,10) + 'T00:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) && b >= a ? Math.round((b-a)/86400000)+1 : 1;
}
export function periodosSolapan(inicio: string, fin: string | undefined | null, otroInicio: string, otroFin?: string | null): boolean {
  const a=inicio?.slice(0,10), b=(fin||inicio)?.slice(0,10), c=otroInicio?.slice(0,10), d=(otroFin||otroInicio)?.slice(0,10);
  return Boolean(a && b && c && d && a<=d && c<=b);
}
export function diasDelPeriodo(inicio: string, fin?: string | null): string[] {
  const fecha = new Date(inicio?.slice(0,10)+'T00:00:00Z'); if (Number.isNaN(fecha.getTime())) return [];
  return Array.from({length:diasEvento(inicio,fin)},(_,i)=>new Date(fecha.getTime()+i*86400000).toISOString().slice(0,10));
}
