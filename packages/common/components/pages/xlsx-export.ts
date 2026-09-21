import { isFormula, type Workbook } from './sheets';

const HEADER_FILL = '1F3A5F';

/** Build a styled .xlsx from a workbook and trigger a browser download. */
export async function downloadWorkbookAsXlsx(book: Workbook, title: string, fileName: string) {
    // exceljs is large; load it only when someone actually exports.
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Kiln';
    wb.title = title;

    for (const sheet of book.sheets) {
        const ws = wb.addWorksheet(sheet.name, {
            views: sheet.columns.length ? [{ state: 'frozen', ySplit: 1 }] : undefined,
        });

        if (sheet.columns.length) {
            const header = ws.addRow(sheet.columns);
            header.height = 22;
            header.eachCell(cell => {
                cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: `FF${HEADER_FILL}` },
                };
                cell.alignment = { vertical: 'middle' };
            });
        }

        for (const row of sheet.rows) {
            // "=SUM(B2:B5)" becomes a live formula; everything else keeps its type.
            ws.addRow(row.map(v => (isFormula(v) ? { formula: v.slice(1) } : v)));
        }

        const width = Math.max(sheet.columns.length, ...sheet.rows.map(r => r.length), 0);
        for (let c = 1; c <= width; c++) {
            const longest = Math.max(
                String(sheet.columns[c - 1] ?? '').length,
                ...sheet.rows.map(r => String(r[c - 1] ?? '').length)
            );
            ws.getColumn(c).width = Math.min(60, Math.max(10, longest + 2));
            ws.getColumn(c).alignment = { vertical: 'top', wrapText: longest > 60 };
        }

        if (sheet.columns.length && sheet.rows.length) {
            ws.autoFilter = {
                from: { row: 1, column: 1 },
                to: { row: 1, column: sheet.columns.length },
            };
        }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
        new Blob([buffer], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
