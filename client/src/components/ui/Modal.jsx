import { X } from 'lucide-react';

const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl' };

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className={`relative max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white shadow-xl ${widths[size]}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-slate-100 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}