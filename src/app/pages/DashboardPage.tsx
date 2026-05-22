import { useState, useEffect } from "react";
import { Package, Users, Truck, UserCheck, Loader2 } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { apiRequest } from "../lib/api";
import { useBrand } from "../contexts/BrandContext";

interface Stats {
  fichasTotal: number;
  clientesTotal: number;
  vehiculosEnRuta: number;
  personalDisponible: number;
}

interface VehicleChartEntry { name: string; value: number; color: string }
interface PersonalChartEntry { name: string; value: number }

const PERSONAL_COLORS = ["#1F3C8B", "#EF8022"];

export function DashboardPage() {
  const { brand } = useBrand();
  const [stats, setStats] = useState<Stats | null>(null);
  const [vehiculosChart, setVehiculosChart] = useState<VehicleChartEntry[]>([]);
  const [personalChart, setPersonalChart] = useState<PersonalChartEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!brand) return;
    setLoading(true);
    (async () => {
      try {
        const [fichas, clientes, vehiculos, personal] = await Promise.all([
          apiRequest<any[]>(`/fichas?brand=${brand}`).catch(() => []),
          apiRequest<any[]>(`/clients?brand=${brand}`).catch(() => []),
          apiRequest<any[]>(`/logistics/vehiculos?brand=${brand}`).catch(() => []),
          apiRequest<any[]>("/personal").catch(() => []),
        ]);

        const enRuta = vehiculos.filter((v: any) => v.estado === "en-ruta").length;
        const disponiblesV = vehiculos.filter((v: any) => v.estado === "disponible").length;
        const mantenimiento = vehiculos.filter((v: any) => v.estado === "mantenimiento").length;
        const personalDisp = personal.filter((p: any) => p.estado === "disponible").length;
        const choferes = personal.filter((p: any) => p.rol === "chofer").length;
        const apoyo = personal.filter((p: any) => p.rol === "apoyo").length;

        setStats({
          fichasTotal: fichas.length,
          clientesTotal: clientes.length,
          vehiculosEnRuta: enRuta,
          personalDisponible: personalDisp,
        });

        setVehiculosChart([
          { name: "En Ruta", value: enRuta, color: "#3b82f6" },
          { name: "Disponible", value: disponiblesV, color: "#22c55e" },
          { name: "Mantenimiento", value: mantenimiento, color: "#f59e0b" },
        ].filter(d => d.value > 0));

        setPersonalChart([
          { name: "Choferes", value: choferes },
          { name: "Apoyo", value: apoyo },
        ].filter(d => d.value > 0));
      } catch { /* fail silently */ }
      finally { setLoading(false); }
    })();
  }, [brand]);

  const kpis = [
    {
      icon: Package,
      iconBg: "bg-[#1F3C8B]/10 dark:bg-[#1F3C8B]/20",
      iconColor: "text-[#1F3C8B] dark:text-blue-400",
      label: "Total Fichas",
      value: stats?.fichasTotal ?? 0,
      sub: "registradas",
    },
    {
      icon: Users,
      iconBg: "bg-green-100 dark:bg-green-900/30",
      iconColor: "text-green-600 dark:text-green-400",
      label: "Clientes",
      value: stats?.clientesTotal ?? 0,
      sub: "activos",
    },
    {
      icon: Truck,
      iconBg: "bg-blue-100 dark:bg-blue-900/30",
      iconColor: "text-blue-600 dark:text-blue-400",
      label: "Vehículos en Ruta",
      value: stats?.vehiculosEnRuta ?? 0,
      sub: "en este momento",
    },
    {
      icon: UserCheck,
      iconBg: "bg-[#EF8022]/10 dark:bg-[#EF8022]/20",
      iconColor: "text-[#EF8022]",
      label: "Personal Disponible",
      value: stats?.personalDisponible ?? 0,
      sub: "listos para asignar",
    },
  ];

  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Vista general del estado operacional</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {kpis.map(({ icon: Icon, iconBg, iconColor, label, value, sub }) => (
          <div key={label} className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between mb-4">
              <div className={`${iconBg} p-3 rounded-lg`}>
                <Icon className={`w-6 h-6 ${iconColor}`} />
              </div>
              {loading && <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />}
            </div>
            <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">{label}</h3>
            <p className="text-3xl text-gray-900 dark:text-white">
              {loading ? <span className="text-gray-300 dark:text-gray-600">—</span> : value}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Vehículos por estado */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Vehículos por Estado</h3>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : vehiculosChart.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              Sin vehículos registrados
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={vehiculosChart} barSize={48}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(0,0,0,0.04)" }}
                  formatter={(val: number) => [val, "Vehículos"]}
                />
                <Bar dataKey="value" name="Vehículos" radius={[6, 6, 0, 0]}>
                  {vehiculosChart.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Personal por rol */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Personal por Rol</h3>
          {loading ? (
            <div className="h-[300px] flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-gray-300 animate-spin" />
            </div>
          ) : personalChart.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
              Sin personal registrado
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={personalChart}
                  cx="50%"
                  cy="50%"
                  innerRadius={64}
                  outerRadius={104}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {personalChart.map((_, idx) => (
                    <Cell key={idx} fill={PERSONAL_COLORS[idx % PERSONAL_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(val: number) => [val, "personas"]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
