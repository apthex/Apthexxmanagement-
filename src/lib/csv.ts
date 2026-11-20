export type CsvValue = string | number | null | undefined;

/**
 * Spreadsheet formula injection protection.
 * Text fields beginning with = + - @, tab or CR are prefixed with an
 * apostrophe. Numbers and dates pass through untouched by the caller using
 * CsvValue numeric types; the generic string branch only applies to text.
 */
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replaceAll('"', '""')}"`;
  }
  return safe;
}

export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return String(value);
  }
  return csvText(String(value));
}

export function toCsv(headers: string[], rows: CsvValue[][]): string {
  const lines = [headers.map(csvText).join(","), ...rows.map((row) => row.map(csvCell).join(","))];
  return `${lines.join("\r\n")}\r\n`;
}

export function csvResponse(filename: string, content: string): Response {
  return new Response(content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replaceAll('"', "")}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function safeFilename(prefix: string, date: string): string {
  return `${prefix}-${date.replaceAll(/[^0-9-]/g, "")}.csv`;
}
