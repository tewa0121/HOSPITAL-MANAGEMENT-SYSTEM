const esc = (v) => {
  let s = v === null || v === undefined ? '' : String(v);
  // stop spreadsheet formula injection: text that starts like a formula gets a leading '
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

// rows: array of arrays. The BOM makes Excel read Amharic text correctly.
export function downloadCsv(filename, rows) {
  const body = rows.map((r) => r.map(esc).join(',')).join('\r\n');
  const blob = new Blob([`\ufeff${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}