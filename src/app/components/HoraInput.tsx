import { useEffect, useState } from "react";

interface HoraInputProps {
  name: string;
  value: string;
  onChange: (event: { target: { name: string; value: string } }) => void;
  required?: boolean;
  className?: string;
}

function desglosarHora(value: string) {
  if (!value) return { hora: "", minuto: "00", periodo: "AM" };
  const [hora, minuto] = value.split(":");
  const numero = Number(hora);
  return {
    hora: String(numero % 12 || 12),
    minuto,
    periodo: numero >= 12 ? "PM" : "AM",
  };
}

export function HoraInput({ name, value, onChange, required, className }: HoraInputProps) {
  const [partes, setPartes] = useState(() => desglosarHora(value));
  useEffect(() => setPartes(desglosarHora(value)), [value]);

  function actualizar(campo: keyof typeof partes, valor: string) {
    const siguiente = { ...partes, [campo]: valor };
    setPartes(siguiente);
    const hora24 = Number(siguiente.hora) % 12 + (siguiente.periodo === "PM" ? 12 : 0);
    const hora = siguiente.hora
      ? String(hora24).padStart(2, "0") + ":" + siguiente.minuto
      : "";
    onChange({ target: { name, value: hora } });
  }

  return (
    <div className="flex min-w-0 items-center gap-0.5" role="group" aria-label={name.replaceAll("_", " ")}>
      <select aria-label="Hora" name={name + "_hora"} value={partes.hora} required={required}
        onChange={event => actualizar("hora", event.target.value)} className={className} style={{ minWidth: 0, paddingLeft: 4, paddingRight: 4, fontSize: 14 }}>
        <option value="">Hora</option>
        {Array.from({ length: 12 }, (_, index) => index + 1).map(hora => (
          <option key={hora} value={hora}>{hora}</option>
        ))}
      </select>
      <span aria-hidden="true">:</span>
      <select aria-label="Minutos" value={partes.minuto}
        onChange={event => actualizar("minuto", event.target.value)} className={className} style={{ minWidth: 0, paddingLeft: 4, paddingRight: 4, fontSize: 14 }}>
        {Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0")).map(minuto => (
          <option key={minuto} value={minuto}>{minuto}</option>
        ))}
      </select>
      <select aria-label="AM o PM" value={partes.periodo}
        onChange={event => actualizar("periodo", event.target.value)} className={className} style={{ minWidth: 50, width: 50, flexShrink: 0, paddingLeft: 4, paddingRight: 4, fontSize: 14 }}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  );
}
