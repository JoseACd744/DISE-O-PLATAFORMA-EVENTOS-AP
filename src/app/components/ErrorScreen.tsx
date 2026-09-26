import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { AlertTriangle, RotateCcw } from "lucide-react";

// Pantalla que reemplaza al mensaje en inglés de React Router cuando una página falla al mostrarse
export function ErrorScreen() {
  const error = useRouteError();
  const navigate = useNavigate();
  const noExiste = isRouteErrorResponse(error) && error.status === 404;
  console.error("Error de pantalla:", error);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-8">
        <div className="mx-auto mb-4 w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-xl text-gray-900 dark:text-white mb-2">{noExiste ? "Esta página no existe" : "Algo salió mal"}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          {noExiste
            ? "Revisa la dirección o vuelve al inicio."
            : "Ocurrió un error inesperado al mostrar esta pantalla. Tus datos guardados no se perdieron."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-brand-orange text-white hover:bg-brand-orange-hover"
          >
            <RotateCcw className="w-4 h-4" /> Recargar la página
          </button>
          <button
            onClick={() => navigate("/dashboard/reportes")}
            className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Ir a Reportes
          </button>
        </div>
      </div>
    </div>
  );
}
