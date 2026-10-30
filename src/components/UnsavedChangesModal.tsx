import React from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onConfirmDiscard: () => void;
  onSaveAndProceed?: () => void;
  onCancel: () => void;
}

export const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  title = 'Niezapisane zmiany w kreatorze trasy',
  description = 'Wprowadzono zmiany w aktualnie edytowanym pakiecie podróży. Czy chcesz zapisać wyprawę przed przejściem dalej?',
  onConfirmDiscard,
  onSaveAndProceed,
  onCancel,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl max-w-md w-full p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-50">
                {title}
              </h3>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {description}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-md transition-colors"
            aria-label="Zamknij"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            className="px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Wróć do edycji
          </button>
          <button
            type="button"
            onClick={onConfirmDiscard}
            className="px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/40 hover:bg-red-100 dark:hover:bg-red-950/60 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Porzuć zmiany
          </button>
          {onSaveAndProceed && (
            <button
              type="button"
              onClick={onSaveAndProceed}
              className="px-4 py-2 text-xs font-medium text-white bg-[#122144] dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Zapisz i kontynuuj
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
