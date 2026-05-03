// src/utils/excel.js
import * as XLSX from "xlsx";

/** Read an Excel/CSV file → { fileName, sheetNames, sheets, rowCounts } */
export function readExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const sheets = {};
        wb.SheetNames.forEach((name) => {
          sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: "", raw: false });
        });
        resolve({
          fileName: file.name,
          sheetNames: wb.SheetNames,
          sheets,
          rowCounts: wb.SheetNames.map((n) => sheets[n].length),
        });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error("Read failed"));
    reader.readAsArrayBuffer(file);
  });
}

/** Download a single-sheet workbook from a JSON array. */
export function downloadExcel(data, fileName, sheetName = "Sheet1") {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, fileName);
}

/**
 * Download a multi-sheet workbook.
 * sheets: Array<{ name: string, data: Array<object> }>
 */
export function downloadMultiSheetExcel(sheets, fileName) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, data }) => {
    const ws = XLSX.utils.json_to_sheet(data || []);
    // Excel sheet names are limited to 31 chars and can't contain certain symbols
    const safeName = String(name).replace(/[\\/?*[\]:]/g, "_").slice(0, 31) || "Sheet";
    XLSX.utils.book_append_sheet(wb, ws, safeName);
  });
  XLSX.writeFile(wb, fileName);
}
