import { Loader2 } from 'lucide-react';

const variants = {
  primary: 'bg-teal-600 text-white hover:bg-teal-700 focus-visible:ring-teal-500',
  secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-500',
  ghost: 'text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400',
};

export default function Button({ variant = 'primary', loading = false, className = '', children, disabled, ...props }) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60
        ${variants[variant]} ${className}`}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}