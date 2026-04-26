import { Package, TrendingUp, Clock, MapPin } from "lucide-react";

export function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Vista general de las métricas de entrega</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg">
              <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-full">+12%</span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Entregas Totales</h3>
          <p className="text-3xl text-gray-900 dark:text-white">1,845</p>
          <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">Este mes</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-[#1F3C8B] dark:text-blue-400" />
            </div>
            <span className="text-xs text-[#1F3C8B] dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">+8%</span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Tasa de Éxito</h3>
          <p className="text-3xl text-gray-900 dark:text-white">94.2%</p>
          <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">Última semana</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-amber-100 dark:bg-amber-900/30 p-3 rounded-lg">
              <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
            </div>
            <span className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">-5%</span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Tiempo Promedio</h3>
          <p className="text-3xl text-gray-900 dark:text-white">32 min</p>
          <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">Por entrega</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-4">
            <div className="bg-[#EF8022]/10 dark:bg-[#EF8022]/20 p-3 rounded-lg">
              <MapPin className="w-6 h-6 text-[#EF8022] dark:text-[#EF8022]" />
            </div>
            <span className="text-xs text-[#EF8022] dark:text-[#EF8022] bg-orange-50 dark:bg-[#EF8022]/10 px-2 py-1 rounded-full">+15%</span>
          </div>
          <h3 className="text-gray-600 dark:text-gray-400 text-sm mb-1">Rutas Activas</h3>
          <p className="text-3xl text-gray-900 dark:text-white">23</p>
          <p className="text-xs text-gray-500 dark:text-gray-300 mt-2">Hoy</p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Monthly Deliveries */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Entregas Mensuales</h3>
          <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
            <p>Datos en desarrollo</p>
          </div>
        </div>

        {/* Status Distribution */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg text-gray-900 dark:text-white mb-6">Estado de Pedidos</h3>
          <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
            <p>Datos en desarrollo</p>
          </div>
        </div>
      </div>

      {/* Weekly Performance */}
      <div className="bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg text-gray-900 dark:text-white mb-6">Rendimiento Semanal</h3>
        <div className="h-[300px] flex items-center justify-center text-gray-400 dark:text-gray-500">
          <p>Datos en desarrollo</p>
        </div>
      </div>
    </div>
  );
}