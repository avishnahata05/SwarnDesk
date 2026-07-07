export function exportToCsv(filename: string, data: Record<string, unknown>[]): boolean {
  if (!data || data.length === 0) return false;
  const headers = Object.keys(data[0]);
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s}"` : s;
  };
  const rows = [headers.join(","), ...data.map(r => headers.map(h => escape(r[h])).join(","))];
  const blob = new Blob(["﻿" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 200);
  return true;
}
