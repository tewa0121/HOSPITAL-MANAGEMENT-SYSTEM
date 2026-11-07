export default function Select({ label, error, required, options = [], placeholder, className = '', ...props }) {
  return (
    <div className={className}>
      {label && (
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      <select
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 ${
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
            : 'border-slate-300 focus:border-teal-500 focus:ring-teal-500/20'
        }`}
        {...props}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}