import { useState } from "react";
import { DayPicker, DateRange } from "react-day-picker";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Calendar, X } from "lucide-react";
import "react-day-picker/dist/style.css";

interface DateRangePickerProps {
  selectedRange: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  onClear: () => void;
}

export function DateRangePicker({ selectedRange, onRangeChange, onClear }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDateRange = () => {
    if (!selectedRange?.from && !selectedRange?.to) {
      return "Seleccionar rango de fechas";
    }
    
    if (selectedRange?.from && selectedRange?.to) {
      return `${format(selectedRange.from, "dd MMM yyyy", { locale: es })} - ${format(selectedRange.to, "dd MMM yyyy", { locale: es })}`;
    }
    
    if (selectedRange?.from) {
      return `Desde ${format(selectedRange.from, "dd MMM yyyy", { locale: es })}`;
    }
    
    return "Seleccionar rango de fechas";
  };

  return (
    <div className="relative">
      <label className="block text-sm text-gray-600 dark:text-gray-300 mb-2 flex items-center gap-2">
        <Calendar className="w-4 h-4" />
        Rango de Fechas
      </label>
      
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#EF8022] focus:border-transparent text-left bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
        >
          <span className={selectedRange?.from || selectedRange?.to ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-300"}>
            {formatDateRange()}
          </span>
        </button>
        
        {(selectedRange?.from || selectedRange?.to) && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setIsOpen(false);
            }}
            className="px-3 py-2.5 text-sm text-gray-600 dark:text-gray-300 hover:text-[#E64441] dark:hover:text-[#ff7b79] hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg transition-colors flex items-center gap-2 border border-gray-300 dark:border-gray-600"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute top-full left-0 mt-2 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl z-50 p-4 max-w-[calc(100vw-2rem)] overflow-auto">
            <style>{`
              .rdp {
                --rdp-accent-color: #1F3C8B;
                --rdp-background-color: #EFF6FF;
                color: #111827;
              }
              .dark .rdp {
                --rdp-accent-color: #EF8022;
                --rdp-background-color: rgba(239, 128, 34, 0.2);
                color: #f3f4f6;
              }
              .rdp-caption_label,
              .rdp-head_cell,
              .rdp-day {
                color: inherit;
              }
              .rdp-day_selected {
                background-color: #1F3C8B !important;
                color: white !important;
              }
              .dark .rdp-day_selected {
                background-color: #EF8022 !important;
                color: #111827 !important;
              }
              .rdp-day_selected:hover {
                background-color: #EF8022 !important;
              }
              .rdp-day_range_middle {
                background-color: #F0F9FF !important;
                color: #1F3C8B !important;
              }
              .dark .rdp-day_range_middle {
                background-color: rgba(31, 60, 139, 0.35) !important;
                color: #f9fafb !important;
              }
              .rdp-day_range_start,
              .rdp-day_range_end {
                background-color: #1F3C8B !important;
                color: white !important;
              }
              .dark .rdp-day_range_start,
              .dark .rdp-day_range_end {
                background-color: #EF8022 !important;
                color: #111827 !important;
              }
              .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: #EFF6FF !important;
                color: #1F3C8B !important;
              }
              .dark .rdp-button:hover:not([disabled]):not(.rdp-day_selected) {
                background-color: rgba(31, 60, 139, 0.35) !important;
                color: #f9fafb !important;
              }
              .dark .rdp-day_outside {
                color: #9ca3af !important;
              }
            `}</style>
            <DayPicker
              mode="range"
              selected={selectedRange}
              onSelect={onRangeChange}
              locale={es}
              numberOfMonths={2}
              showOutsideDays
            />
            <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="flex-1 bg-[#EF8022] text-white dark:text-gray-900 py-2 rounded-lg hover:bg-[#1F3C8B] dark:hover:bg-[#f09b54] transition-colors font-semibold text-sm"
              >
                Aplicar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}