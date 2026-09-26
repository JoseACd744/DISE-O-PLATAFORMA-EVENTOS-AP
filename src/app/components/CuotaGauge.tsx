// Velocímetro semicircular de avance de cuota (0 % a la izquierda, 100 % a la derecha).
// Por encima del 100 % la aguja se queda al tope; el porcentaje real se muestra en el texto.

const CX = 100;
const CY = 100;
const R = 80;

// Zonas del dial, como en un tacómetro: lejos, cerca, cumplida
const ZONAS = [
  { desde: 0, hasta: 50, color: "#EF4444" },
  { desde: 50, hasta: 80, color: "#F59E0B" },
  { desde: 80, hasta: 100, color: "#10B981" },
];

function punto(pct: number, radio: number) {
  const angulo = Math.PI * (1 - pct / 100);
  return { x: CX + radio * Math.cos(angulo), y: CY - radio * Math.sin(angulo) };
}

function arco(desde: number, hasta: number) {
  const a = punto(desde, R);
  const b = punto(hasta, R);
  return `M ${a.x} ${a.y} A ${R} ${R} 0 0 1 ${b.x} ${b.y}`;
}

export function colorDeAvance(pct: number) {
  return (ZONAS.find((z) => pct < z.hasta) ?? ZONAS[ZONAS.length - 1]).color;
}

export function CuotaGauge({ porcentaje }: { porcentaje: number }) {
  const pct = Math.max(0, Math.min(100, porcentaje));
  const aguja = punto(pct, R - 14);

  return (
    <svg viewBox="-16 -2 232 122" className="w-full max-w-[280px]" role="img" aria-label={`Avance de cuota: ${porcentaje.toFixed(0)}%`}>
      {ZONAS.map((z) => (
        <path key={z.desde} d={arco(z.desde, z.hasta)} fill="none" stroke={z.color} strokeOpacity={0.25} strokeWidth={14} />
      ))}
      {pct > 0 && (
        <path d={arco(0, pct)} fill="none" stroke={colorDeAvance(porcentaje)} strokeWidth={14} strokeLinecap="butt" />
      )}
      {[0, 25, 50, 75, 100].map((t) => {
        const exterior = punto(t, R + 9);
        const interior = punto(t, R + 3);
        const etiqueta = punto(t, R + 18);
        return (
          <g key={t} className="text-gray-400 dark:text-gray-500">
            <line x1={interior.x} y1={interior.y} x2={exterior.x} y2={exterior.y} stroke="currentColor" strokeWidth={1.5} />
            <text x={etiqueta.x} y={etiqueta.y + 3} textAnchor="middle" fontSize={8} fill="currentColor">{t}%</text>
          </g>
        );
      })}
      <g className="text-gray-800 dark:text-gray-100">
        <line x1={CX} y1={CY} x2={aguja.x} y2={aguja.y} stroke="currentColor" strokeWidth={3} strokeLinecap="round" style={{ transition: "all 0.6s ease-out" }} />
        <circle cx={CX} cy={CY} r={6} fill="currentColor" />
      </g>
    </svg>
  );
}
