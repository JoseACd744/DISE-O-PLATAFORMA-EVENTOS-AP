import { useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
  Area,
} from "recharts";
import { TrendingUp, Target, DollarSign, Percent, AlertCircle, Calendar, Receipt, CreditCard, Banknote, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { apiRequest } from "../lib/api";
import { useBrand } from "../contexts/BrandContext";

const COLORS = {
  primary: "#1F3C8B",
  secondary: "#EF8022",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  info: "#3B82F6",
  gray: "#6B7280",
};

const tooltipContentStyle = {
  backgroundColor: "#111827",
  border: "1px solid #374151",
  borderRadius: "8px",
};

const tooltipLabelStyle = { color: "#f9fafb", fontWeight: 600 };
const tooltipItemStyle = { color: "#f3f4f6" };

export function ReportsPage() {
  const { brand } = useBrand();
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedFichaHelados, setSelectedFichaHelados] = useState<string | null>(null);
  const [reportFichas, setReportFichas] = useState<any[]>([]);
  const [reportClients, setReportClients] = useState<any[]>([]);
  const [reportFichasDetalle, setReportFichasDetalle] = useState<any[]>([]);

  useEffect(() => {
    const loadReports = async () => {
      if (!brand) return;
      try {
        const [fichas, clients] = await Promise.all([
          apiRequest<any[]>(`/fichas?brand=${brand}`),
          apiRequest<any[]>(`/clients?brand=${brand}`),
        ]);

        const detalles = await Promise.all(
          fichas.map((f) => apiRequest<any>(`/fichas/${f.id}`))
        );

        setReportFichas(fichas);
        setReportClients(clients);
        setReportFichasDetalle(detalles);
      } catch (error) {
        console.error("No se pudo cargar reportes:", error);
      }
    };

    loadReports();
  }, [brand]);

  const monthKey = (value?: string) => {
    if (!value) return "";
    return value.slice(0, 7);
  };

  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    reportFichas.forEach((f) => {
      const key = monthKey(f.fecha);
      if (key) months.add(key);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [reportFichas]);

  useEffect(() => {
    if (!availableMonths.length) return;
    if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
      setSelectedMonth(availableMonths[0]);
    }
  }, [availableMonths, selectedMonth]);

  const financialMonthly = useMemo(() => {
    const ventaTotal = reportFichas.reduce((sum, f) => sum + Number(f.total || 0), 0);
    const saldoPendiente = reportFichas.reduce((sum, f) => sum + Number(f.saldo || 0), 0);
    const ingresoNeto = Math.max(0, ventaTotal - saldoPendiente);
    const fichasPagadas = reportFichas.filter((f) => Number(f.saldo || 0) <= 0).length;
    const fichasPendientes = reportFichas.filter((f) => Number(f.saldo || 0) > 0).length;
    const fichasParciales = reportFichas.filter((f) => Number(f.saldo || 0) > 0 && Number(f.saldo || 0) < Number(f.total || 0)).length;

    return {
      ventaTotal,
      descuentosTotal: 0,
      ingresoNeto,
      saldoPendiente,
      abonosMesActual: ingresoNeto,
      abonosMesAnterior: 0,
      fichasPagadas,
      fichasParciales,
      fichasPendientes,
      totalFichas: reportFichas.length,
    };
  }, [reportFichas]);

  const kpiData = useMemo(() => {
    const objetivo = 10000;
    const ventasActuales = financialMonthly.ventaTotal;
    const nivelAvance = objetivo > 0 ? ventasActuales / objetivo : 0;
    const montoCobrado = financialMonthly.ingresoNeto;
    const montoPorCobrar = financialMonthly.saldoPendiente;
    const indiceCobranza = ventasActuales > 0 ? (montoCobrado / ventasActuales) * 100 : 0;
    const promedioDiario = ventasActuales / Math.max(1, 30);

    return {
      mes: "Mes actual",
      objetivo,
      ventasActuales,
      nivelAvance,
      promedioDiario,
      indiceCobranza,
      montoCobrado,
      montoPorCobrar,
      numDescuentos: 0,
      descuentoAcumulado: 0,
      proporcionDescuentos: 0,
    };
  }, [financialMonthly]);

  const ventasPorDiaSemana = useMemo(() => {
    const dias = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const acc = dias.map((dia) => ({ dia, monto: 0, cantidad: 0 }));
    reportFichas.forEach((f) => {
      const fecha = f.fecha ? new Date(f.fecha) : null;
      if (!fecha || Number.isNaN(fecha.getTime())) return;
      const idx = fecha.getDay();
      acc[idx].monto += Number(f.total || 0);
      acc[idx].cantidad += 1;
    });
    return acc;
  }, [reportFichas]);

  const ventasPorFecha = useMemo(() => {
    const map = new Map<string, { fecha: string; servicios: number; monto: number }>();
    reportFichas.forEach((f) => {
      const rawFecha = typeof f.fecha === "string" ? f.fecha : "";
      if (!rawFecha) return;
      const day = rawFecha.slice(-2);
      const current = map.get(day) || { fecha: day, servicios: 0, monto: 0 };
      current.servicios += 1;
      current.monto += Number(f.total || 0);
      map.set(day, current);
    });
    return Array.from(map.values()).sort((a, b) => a.fecha.localeCompare(b.fecha));
  }, [reportFichas]);

  const distritoTop = useMemo(() => {
    const map = new Map<string, number>();
    reportFichas.forEach((f) => {
      const distrito = f.distrito || "Sin distrito";
      map.set(distrito, (map.get(distrito) || 0) + 1);
    });
    return Array.from(map.entries())
      .map(([distrito, servicios]) => ({ distrito, servicios }))
      .sort((a, b) => b.servicios - a.servicios)
      .slice(0, 10);
  }, [reportFichas]);

  const mediosPago = useMemo(() => {
    const total = financialMonthly.ingresoNeto;
    if (total <= 0) {
      return [
        { medio: "Transferencia", monto: 0, porcentaje: 0 },
        { medio: "Yape", monto: 0, porcentaje: 0 },
        { medio: "Plin", monto: 0, porcentaje: 0 },
        { medio: "Efectivo", monto: 0, porcentaje: 0 },
      ];
    }

    return [
      { medio: "Transferencia", monto: total, porcentaje: 100 },
      { medio: "Yape", monto: 0, porcentaje: 0 },
      { medio: "Plin", monto: 0, porcentaje: 0 },
      { medio: "Efectivo", monto: 0, porcentaje: 0 },
    ];
  }, [financialMonthly]);

  const ingresoVsVentaPorSemana = useMemo(() => {
    const weeks = [1, 2, 3, 4, 5].map((n) => ({ semana: `Sem ${n}`, ventaTotal: 0, ingresoNeto: 0 }));

    reportFichasDetalle.forEach((f) => {
      const fecha = typeof f.fecha === "string" ? new Date(f.fecha) : null;
      if (!fecha || Number.isNaN(fecha.getTime())) return;
      const weekIndex = Math.min(4, Math.max(0, Math.ceil(fecha.getDate() / 7) - 1));
      const abonos = Array.isArray(f.abonos)
        ? f.abonos.reduce((sum: number, a: any) => sum + Number(a.monto || 0), 0)
        : Math.max(0, Number(f.total || 0) - Number(f.saldo || 0));
      weeks[weekIndex].ventaTotal += Number(f.total || 0);
      weeks[weekIndex].ingresoNeto += abonos;
    });

    return weeks.filter((w) => w.ventaTotal > 0 || w.ingresoNeto > 0);
  }, [reportFichasDetalle]);

  const flujoAbonos = useMemo(() => {
    const abonosDia = new Map<string, number>();

    reportFichasDetalle.forEach((f) => {
      if (!Array.isArray(f.abonos)) return;
      f.abonos.forEach((a: any) => {
        const fecha = typeof a.fecha === "string" ? a.fecha.slice(-2) : "";
        if (!fecha) return;
        abonosDia.set(fecha, (abonosDia.get(fecha) || 0) + Number(a.monto || 0));
      });
    });

    const ordered = Array.from(abonosDia.entries())
      .map(([fecha, abonos]) => ({ fecha, abonos }))
      .sort((a, b) => a.fecha.localeCompare(b.fecha));

    let acumulado = 0;
    return ordered.map((item) => {
      acumulado += item.abonos;
      return { ...item, acumulado };
    });
  }, [reportFichasDetalle]);

  const abonosPorMedio = useMemo(() => {
    const byMedio = new Map<string, { medio: string; monto: number; cantidad: number }>();

    reportFichasDetalle.forEach((f) => {
      if (!Array.isArray(f.abonos)) return;
      f.abonos.forEach((a: any) => {
        const medio = (a.medio || "Sin medio") as string;
        const current = byMedio.get(medio) || { medio, monto: 0, cantidad: 0 };
        current.monto += Number(a.monto || 0);
        current.cantidad += 1;
        byMedio.set(medio, current);
      });
    });

    return Array.from(byMedio.values()).sort((a, b) => b.monto - a.monto);
  }, [reportFichasDetalle]);

  const canalesAdquisicion = useMemo(() => {
    const map = new Map<string, number>();
    reportClients.forEach((cliente) => {
      const canal = cliente.canal || cliente.canal_adquisicion || "Sin canal";
      map.set(canal, (map.get(canal) || 0) + 1);
    });
    return Array.from(map.entries()).map(([canal, clientes]) => ({ canal, clientes }));
  }, [reportClients]);

  const ventasPorHora = useMemo(() => {
    const horas = new Map<string, number>();
    reportFichas.forEach((f) => {
      const raw = (f.hora_entrega || "").toString();
      const hora = raw ? `${raw.slice(0, 2)}:00` : "Sin hora";
      horas.set(hora, (horas.get(hora) || 0) + 1);
    });
    return Array.from(horas.entries())
      .map(([hora, servicios]) => ({ hora, servicios }))
      .sort((a, b) => a.hora.localeCompare(b.hora));
  }, [reportFichas]);

  const estadoClientes = useMemo(() => {
    const byEstado = new Map<string, number>();
    reportClients.forEach((c) => {
      const estado = c.estado_cliente || c.estado || "Nuevo";
      byEstado.set(estado, (byEstado.get(estado) || 0) + 1);
    });

    const palette = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];
    return Array.from(byEstado.entries()).map(([estado, cantidad], idx) => ({
      estado,
      cantidad,
      color: palette[idx % palette.length],
    }));
  }, [reportClients]);

  const paquetesPorTipo = useMemo(() => {
    const rows = new Map<string, { paquete: string; corporativo: number; familias: number; instituciones: number; megaeventos: number; organizadores: number }>();

    reportFichasDetalle.forEach((f) => {
      const tipoClienteRaw = (f.tipo_cliente || "familias").toString().toLowerCase();
      const tipoCliente = tipoClienteRaw.includes("corp")
        ? "corporativo"
        : tipoClienteRaw.includes("instit")
        ? "instituciones"
        : tipoClienteRaw.includes("mega")
        ? "megaeventos"
        : tipoClienteRaw.includes("org")
        ? "organizadores"
        : "familias";

      const paquetes = Array.isArray(f.paquetes) ? f.paquetes : [];
      paquetes.forEach((p: any) => {
        const key = (p.paquete_tipo || p.paquete_nombre || "PAQUETE").toString();
        const row = rows.get(key) || {
          paquete: key,
          corporativo: 0,
          familias: 0,
          instituciones: 0,
          megaeventos: 0,
          organizadores: 0,
        };
        row[tipoCliente] += Number(f.total || 0);
        rows.set(key, row);
      });
    });

    return Array.from(rows.values());
  }, [reportFichasDetalle]);

  const heladosReporte = useMemo(() => {
    const unidadesPorTipo: Record<string, { nombre: string; unidades: number }> = {
      BASICO: { nombre: "Paquete Básico", unidades: 100 },
      "100 MINIS": { nombre: "Paquete 100 Minis", unidades: 100 },
      VACILÓN: { nombre: "Paquete Vacilón", unidades: 150 },
      PERSONALIZADO: { nombre: "Paquete Personalizado", unidades: 150 },
    };

    const fichasMes = reportFichasDetalle.filter((f) => monthKey(f.fecha) === selectedMonth);

    const detalle = fichasMes.map((ficha) => {
      const paquetes = Array.isArray(ficha.paquetes) ? ficha.paquetes : [];
      const productosSueltos = Array.isArray(ficha.productosSueltos) ? ficha.productosSueltos : [];

      const paquetesDetalle = paquetes.map((p: any) => {
        const pack = unidadesPorTipo[p.paquete_tipo] || { nombre: p.paquete_nombre || "Paquete", unidades: 0 };
        return {
          nombre: pack.nombre,
          cantidad: Number(p.cantidad || 0),
          unidades: pack.unidades * Number(p.cantidad || 0),
        };
      });

      const unidadesPaquetes = paquetes.reduce((sum: number, p: any) => {
        const pack = unidadesPorTipo[p.paquete_tipo] || { unidades: 0 };
        return sum + (pack.unidades * Number(p.cantidad || 0));
      }, 0);

      const detallePaquetes = paquetes
        .map((p: any) => {
          const pack = unidadesPorTipo[p.paquete_tipo] || { nombre: p.paquete_nombre || "Paquete" };
          return `${pack.nombre} x${Number(p.cantidad || 0)}`;
        })
        .join(", ");

      const unidadesSueltas = productosSueltos.reduce((sum: number, p: any) => sum + Number(p.cantidad || 0), 0);
      const totalUnidades = unidadesPaquetes + unidadesSueltas;

      return {
        ficha: `#${ficha.id}`,
        cliente: ficha.cliente_nombre || "Cliente",
        paquetesDetalle,
        detallePaquetes,
        unidadesPaquetes,
        unidadesSueltas,
        unidades: totalUnidades,
      };
    });

    const totalFichas = detalle.length;
    const totalUnidades = detalle.reduce((sum, f) => sum + f.unidades, 0);
    const totalPaquetes = fichasMes.reduce((sum, f) => {
      const paquetes = Array.isArray(f.paquetes) ? f.paquetes : [];
      return sum + paquetes.reduce((s: number, p: any) => s + Number(p.cantidad || 0), 0);
    }, 0);

    return { detalle, totalFichas, totalUnidades, totalPaquetes };
  }, [reportFichasDetalle, selectedMonth]);

  const fichaDetalleSeleccionada = useMemo(() => {
    if (heladosReporte.detalle.length === 0) return null;
    return heladosReporte.detalle.find((f) => f.ficha === selectedFichaHelados) ?? heladosReporte.detalle[0];
  }, [heladosReporte, selectedFichaHelados]);

  const selectedMonthLabel = useMemo(() => {
    if (!selectedMonth) return "mes actual";
    const [year, month] = selectedMonth.split("-");
    const monthNames = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const monthIndex = Number(month) - 1;
    if (monthIndex < 0 || monthIndex > 11) return selectedMonth;
    return `${monthNames[monthIndex]} ${year}`;
  }, [selectedMonth]);

  const avancePercentage = (kpiData.ventasActuales / kpiData.objetivo) * 100;

  return (
    <div className="p-4 sm:p-6 md:p-8 bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Reportes Mensuales</h1>
          <p className="text-gray-600 dark:text-gray-400">Análisis detallado de ventas y operaciones</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="flex-1 sm:flex-none px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
          >
            {availableMonths.map((month) => (
              <option key={month} value={month}>
                {month}
              </option>
            ))}
          </select>
          <button className="px-4 sm:px-6 py-2 bg-[#EF8022] text-white rounded-lg hover:bg-[#E64441] transition-colors whitespace-nowrap">
            Exportar PDF
          </button>
        </div>
      </div>

      {/* KPI Cards - Section 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Ventas Actuales */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">
              {avancePercentage.toFixed(0)}%
            </span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Ventas Actuales</h3>
          <p className="text-3xl text-gray-900 dark:text-white mb-1">
            S/ {kpiData.ventasActuales.toLocaleString("es-PE")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">Objetivo: S/ {kpiData.objetivo.toLocaleString("es-PE")}</p>
        </div>

        {/* Nivel de Avance */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
              <Target className="w-6 h-6 text-[#1F3C8B] dark:text-blue-400" />
            </div>
            <span className="text-xs text-[#1F3C8B] dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
              {kpiData.nivelAvance}x
            </span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Nivel de Avance</h3>
          <p className="text-3xl text-gray-900 dark:text-white mb-1">{kpiData.nivelAvance}x</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">Meta cumplida</p>
        </div>

        {/* Índice de Cobranza */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-[#EF8022]/10 dark:bg-[#EF8022]/20 p-3 rounded-lg">
              <Percent className="w-6 h-6 text-[#EF8022]" />
            </div>
            <span className="text-xs text-[#EF8022] bg-orange-50 dark:bg-[#EF8022]/10 px-2 py-1 rounded-full">
              {kpiData.indiceCobranza}%
            </span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Índice de Cobranza</h3>
          <p className="text-3xl text-gray-900 dark:text-white mb-1">{kpiData.indiceCobranza}%</p>
          <p className="text-xs text-gray-500 dark:text-gray-500">Por cobrar: S/ {kpiData.montoPorCobrar}</p>
        </div>

        {/* Promedio Diario */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-purple-100 dark:bg-purple-900/30 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded-full">
              Diario
            </span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Promedio Diario</h3>
          <p className="text-3xl text-gray-900 dark:text-white mb-1">
            S/ {kpiData.promedioDiario.toLocaleString("es-PE")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500">Ventas por día</p>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════
          REPORTE FINANCIERO — Venta Total vs Ingreso Neto
         ══════════════════════════════════════════════════════════ */}
      <div className="bg-gradient-to-r from-[#1F3C8B]/5 to-[#EF8022]/5 dark:from-[#1F3C8B]/10 dark:to-[#EF8022]/10 border border-[#1F3C8B]/20 dark:border-[#1F3C8B]/30 rounded-xl p-6 mb-8">
        <h2 className="text-lg text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Banknote className="w-5 h-5 text-[#1F3C8B] dark:text-blue-400" /> Reporte Financiero
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Diferencia entre monto reservado y dinero real cobrado en el mes
        </p>

        {/* KPI cards financieras */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <ArrowUpRight className="w-4 h-4 text-[#1F3C8B] dark:text-blue-400" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Venta Total</span>
            </div>
            <p className="text-2xl text-gray-900 dark:text-white">S/ {financialMonthly.ventaTotal.toLocaleString("es-PE")}</p>
            <p className="text-xs text-gray-400 mt-1">Monto total cotizado/reservado</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4 text-green-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Ingreso Neto</span>
            </div>
            <p className="text-2xl text-green-600 dark:text-green-400">S/ {financialMonthly.ingresoNeto.toLocaleString("es-PE")}</p>
            <p className="text-xs text-gray-400 mt-1">Dinero real cobrado este mes</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2 mb-2">
              <ArrowDownRight className="w-4 h-4 text-red-500" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Saldo Pendiente</span>
            </div>
            <p className="text-2xl text-red-500">S/ {financialMonthly.saldoPendiente.toLocaleString("es-PE")}</p>
            <p className="text-xs text-gray-400 mt-1">Por cobrar de fichas del mes</p>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-[#EF8022]" />
              <span className="text-xs text-gray-500 dark:text-gray-400">Estado Fichas</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <div className="text-center"><p className="text-lg text-green-600 dark:text-green-400">{financialMonthly.fichasPagadas}</p><p className="text-[10px] text-gray-400">Pagadas</p></div>
              <div className="text-center"><p className="text-lg text-[#EF8022]">{financialMonthly.fichasParciales}</p><p className="text-[10px] text-gray-400">Parcial</p></div>
              <div className="text-center"><p className="text-lg text-red-500">{financialMonthly.fichasPendientes}</p><p className="text-[10px] text-gray-400">Pend.</p></div>
            </div>
          </div>
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Venta Total vs Ingreso Neto por Semana */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm text-gray-900 dark:text-white mb-4">Venta Total vs Ingreso Neto</h4>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={ingresoVsVentaPorSemana}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="semana" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  formatter={(value: number) => `S/ ${value.toLocaleString("es-PE")}`}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend />
                <Bar dataKey="ventaTotal" fill={COLORS.primary} name="Venta Total" radius={[8, 8, 0, 0]} />
                <Bar dataKey="ingresoNeto" fill={COLORS.success} name="Ingreso Neto" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Flujo de Abonos Acumulado */}
          <div className="bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
            <h4 className="text-sm text-gray-900 dark:text-white mb-4">Flujo de Abonos Acumulado</h4>
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={flujoAbonos}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="fecha" stroke="#6b7280" />
                <YAxis yAxisId="left" stroke="#6b7280" />
                <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                <Tooltip
                  formatter={(value: number, name: string) => [`S/ ${value.toLocaleString("es-PE")}`, name === "acumulado" ? "Acumulado" : "Abonos"]}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Legend />
                <Bar yAxisId="left" dataKey="abonos" fill={COLORS.secondary} name="Abonos del Día" radius={[6, 6, 0, 0]} />
                <Area yAxisId="right" type="monotone" dataKey="acumulado" fill={COLORS.success} fillOpacity={0.15} stroke={COLORS.success} strokeWidth={2} name="Acumulado" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Abonos por Medio de Pago - compact */}
        <div className="mt-6 bg-white dark:bg-gray-800 p-5 rounded-lg border border-gray-200 dark:border-gray-700">
          <h4 className="text-sm text-gray-900 dark:text-white mb-4">Abonos por Medio de Pago</h4>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {abonosPorMedio.map((item, i) => {
              const colors = [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.gray];
              const totalAbonos = abonosPorMedio.reduce((s, a) => s + a.monto, 0);
              const pct = totalAbonos > 0 ? ((item.monto / totalAbonos) * 100).toFixed(1) : "0";
              return (
                <div key={item.medio} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i] }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.medio}</span>
                    </div>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                  <p className="text-lg text-gray-900 dark:text-white">S/ {item.monto.toLocaleString("es-PE")}</p>
                  <p className="text-xs text-gray-400">{item.cantidad} operaciones</p>
                  <div className="mt-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: colors[i] }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Row 1: Ventas por Día de Semana + Ventas por Hora */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Ventas por Día de Semana */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Ventas por Día de Semana</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={ventasPorDiaSemana}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
              <XAxis dataKey="dia" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke="#6b7280" />
              <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="monto" fill={COLORS.primary} name="Monto (S/)" radius={[8, 8, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cantidad"
                stroke={COLORS.secondary}
                strokeWidth={3}
                name="N° Ventas"
                dot={{ fill: COLORS.secondary, r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Ventas por Hora */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Distribución por Hora de Servicio</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={ventasPorHora}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
              <XAxis dataKey="hora" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Bar dataKey="servicios" fill={COLORS.info} name="Servicios" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 2: Distritos Top + Ventas por Fecha */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Distritos Top */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Distritos con Más Servicios</h3>
          <div className="space-y-3">
            {distritoTop.map((item, index) => (
              <div key={item.distrito} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-[#1F3C8B] to-[#EF8022] text-white text-sm font-semibold"
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-900 dark:text-white">{item.distrito}</span>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{item.servicios}</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-[#1F3C8B] to-[#EF8022] h-2 rounded-full transition-all"
                      style={{ width: `${(item.servicios / distritoTop[0].servicios) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Ventas por Fecha (Diarias) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Ventas Diarias del Mes</h3>
          <ResponsiveContainer width="100%" height={320}>
            <ComposedChart data={ventasPorFecha}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
              <XAxis dataKey="fecha" stroke="#6b7280" />
              <YAxis yAxisId="left" stroke="#6b7280" />
              <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="monto" fill={COLORS.primary} name="Monto (S/)" radius={[8, 8, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="servicios"
                stroke={COLORS.secondary}
                strokeWidth={3}
                name="N° Servicios"
                dot={{ fill: COLORS.secondary, r: 4 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Row 3: Paquetes por Tipo + Medios de Pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Paquetes por Tipo de Cliente */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Ventas por Paquete y Tipo de Cliente</h3>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={paquetesPorTipo} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="paquete" type="category" stroke="#6b7280" width={100} />
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Legend />
              <Bar dataKey="corporativo" stackId="a" fill="#1F3C8B" name="Corporativo" />
              <Bar dataKey="familias" stackId="a" fill="#EF8022" name="Familias" />
              <Bar dataKey="instituciones" stackId="a" fill="#10B981" name="Instituciones" />
              <Bar dataKey="organizadores" stackId="a" fill="#F59E0B" name="Organizadores" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Medios de Pago */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Distribución por Medio de Pago</h3>
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={mediosPago}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ medio, porcentaje }) => `${medio} (${porcentaje}%)`}
                outerRadius={110}
                fill="#8884d8"
                dataKey="monto"
              >
                {mediosPago.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={[COLORS.primary, COLORS.secondary, COLORS.success, COLORS.gray][index]} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => `S/ ${value.toLocaleString("es-PE")}`}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {mediosPago.map((item, index) => (
              <div key={item.medio} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor: [COLORS.primary, COLORS.secondary, COLORS.success, COLORS.gray][index],
                    }}
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">{item.medio}</span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  S/ {item.monto.toLocaleString("es-PE")}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Canales de Adquisición + Estado de Clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Canales de Adquisición (clientes) */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Canales de Adquisición de Clientes</h3>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={canalesAdquisicion} layout="horizontal">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
              <XAxis dataKey="canal" stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip
                formatter={(value: number) => `${value} clientes`}
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
              <Bar dataKey="clientes" fill={COLORS.secondary} name="Clientes" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Estado de Clientes */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Estado de Clientes</h3>
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie
                data={estadoClientes}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ estado, cantidad }) => `${estado}: ${cantidad}`}
                outerRadius={100}
                innerRadius={60}
                fill="#8884d8"
                dataKey="cantidad"
              >
                {estadoClientes.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={tooltipContentStyle}
                labelStyle={tooltipLabelStyle}
                itemStyle={tooltipItemStyle}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 grid grid-cols-3 gap-4">
            {estadoClientes.map((item) => (
              <div key={item.estado} className="text-center">
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{item.cantidad}</div>
                <div className="text-xs text-gray-600 dark:text-gray-400">{item.estado}</div>
                <div className="w-full h-2 rounded-full mt-2" style={{ backgroundColor: item.color }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 5: Cantidad de Helados por Ficha */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <h3 className="text-lg text-gray-900 dark:text-white">Cantidad de Helados por Ficha</h3>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Total: {heladosReporte.totalUnidades} unidades
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-[#EF8022] focus:border-transparent"
            >
              {availableMonths.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="bg-[#1F3C8B]/5 dark:bg-[#1F3C8B]/10 border border-[#1F3C8B]/20 dark:border-[#1F3C8B]/30 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
            En <strong>{selectedMonthLabel}</strong> se generaron <strong>{heladosReporte.totalFichas} fichas</strong>.
            En esas fichas se registraron <strong>{heladosReporte.totalPaquetes} paquetes</strong> y, en total,
            se vendieron <strong>{heladosReporte.totalUnidades} helados</strong>.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={heladosReporte.detalle}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" className="dark:stroke-gray-700" />
                <XAxis dataKey="ficha" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip
                  formatter={(value: number) => `${value} unidades`}
                  contentStyle={tooltipContentStyle}
                  labelStyle={tooltipLabelStyle}
                  itemStyle={tooltipItemStyle}
                />
                <Bar dataKey="unidades" fill={COLORS.success} name="Unidades de helado" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-gray-50 dark:bg-gray-900/40 rounded-lg p-4">
            <h4 className="text-sm text-gray-700 dark:text-gray-300 mb-3">Desglose por ficha</h4>
            <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
              {heladosReporte.detalle.map((item) => (
                <button
                  key={item.ficha}
                  type="button"
                  onClick={() => setSelectedFichaHelados(item.ficha)}
                  className={`w-full text-left rounded-md border px-3 py-2 transition-colors ${fichaDetalleSeleccionada?.ficha === item.ficha ? "border-[#EF8022] bg-[#EF8022]/10 dark:bg-[#EF8022]/20" : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-900 dark:text-white">{item.ficha}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{item.cliente}</p>
                    </div>
                    <p className="text-sm text-green-600 dark:text-green-400">{item.unidades} u.</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {fichaDetalleSeleccionada && (
          <div className="mt-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40 p-4">
            <h4 className="text-sm text-gray-900 dark:text-white mb-3">
              Detalle completo de {fichaDetalleSeleccionada.ficha} - {fichaDetalleSeleccionada.cliente}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
              <div className="rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Unidades por paquetes</p>
                <p className="text-lg text-gray-900 dark:text-white">{fichaDetalleSeleccionada.unidadesPaquetes}</p>
              </div>
              <div className="rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Unidades sueltas</p>
                <p className="text-lg text-gray-900 dark:text-white">{fichaDetalleSeleccionada.unidadesSueltas}</p>
              </div>
              <div className="rounded-md bg-white dark:bg-gray-800 border border-green-200 dark:border-green-700 p-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">Total ficha</p>
                <p className="text-lg text-green-600 dark:text-green-400">{fichaDetalleSeleccionada.unidades}</p>
              </div>
            </div>

            <div className="rounded-md bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Paquetes incluidos</p>
              <div className="space-y-1.5">
                {fichaDetalleSeleccionada.paquetesDetalle.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300">{p.nombre} x{p.cantidad}</span>
                    <span className="text-gray-900 dark:text-white">{p.unidades} u.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Alert de Descuentos */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-400 mb-1">
            Descuentos Brindados
          </h4>
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Se han otorgado <strong>{kpiData.numDescuentos} descuentos</strong> por un total de{" "}
            <strong>S/ {kpiData.descuentoAcumulado.toLocaleString("es-PE")}</strong> (
            {kpiData.proporcionDescuentos}% del total de ventas)
          </p>
        </div>
      </div>
    </div>
  );
}