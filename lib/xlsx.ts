import ExcelJS from "exceljs";

export interface SheetInfo {
  name: string;
  rowCount: number;
}

export interface ParsedSheet {
  headers: string[];
  rows: string[][];
  sheets: SheetInfo[];
  sheetUsed: string;
}

/**
 * Excel stores a time-only cell as a fraction of 1899-12-30, and a date cell as
 * a real date. exceljs hands both back as UTC Date objects, so read them with
 * UTC getters — using local getters would shift every value by the server's
 * offset and silently move records across midnight.
 */
function dateToString(d: Date): string {
  const y = d.getUTCFullYear();
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${y}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const time = `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;

  // 1899-12-30 (and the 1900 leap-year artifact) means "time only".
  if (y <= 1900) return time;
  return `${date}T${time}`;
}

/** exceljs cell values come in several shapes; flatten them all to text. */
function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return dateToString(value);
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);

  const v = value as any;
  if (v.error) return "";
  if (typeof v.text === "string") return v.text.trim();          // hyperlink
  if (Array.isArray(v.richText)) {
    return v.richText.map((r: any) => r.text).join("").trim();    // styled text
  }
  if ("result" in v) {
    // Formula cell — take the computed result, recursing for date results.
    return v.result === null || v.result === undefined ? "" : cellToString(v.result);
  }
  if (v instanceof Object && "toISOString" in v) return dateToString(v as Date);
  return String(v).trim();
}

/**
 * Reads an .xlsx/.xlsm buffer into the same { headers, rows } shape the CSV
 * parser returns, so both formats share one import pipeline downstream.
 *
 * Header detection scans the first few rows rather than assuming row 1, because
 * exported sheets often carry a title or a blank line above the real header.
 */
export async function parseWorkbook(buffer: Buffer, sheetName?: string): Promise<ParsedSheet> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);

  const sheets: SheetInfo[] = [];
  wb.eachSheet((ws) => sheets.push({ name: ws.name, rowCount: ws.actualRowCount ?? ws.rowCount }));
  if (!sheets.length) throw new Error("That workbook has no sheets");

  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  if (!ws) throw new Error(`No sheet named "${sheetName}" in that workbook`);

  // Pull every row out as text first.
  const grid: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    // row.values is 1-based with a leading hole, so walk by column count.
    for (let c = 1; c <= (ws.actualColumnCount || row.cellCount); c++) {
      cells.push(cellToString(row.getCell(c).value));
    }
    if (cells.some((v) => v !== "")) grid.push(cells);
  });

  if (!grid.length) return { headers: [], rows: [], sheets, sheetUsed: ws.name };

  // The header is the first row within the top 10 that has at least two
  // non-empty cells — a stray title line usually has only one.
  let headerIdx = 0;
  for (let i = 0; i < Math.min(grid.length, 10); i++) {
    if (grid[i].filter((v) => v !== "").length >= 2) { headerIdx = i; break; }
  }

  const headers = grid[headerIdx].map((h) => h.trim());
  const rows = grid.slice(headerIdx + 1);
  return { headers, rows, sheets, sheetUsed: ws.name };
}

export function isExcelFile(name: string, type: string) {
  return /\.xlsx?$|\.xlsm$/i.test(name) ||
    type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    type === "application/vnd.ms-excel.sheet.macroEnabled.12";
}
