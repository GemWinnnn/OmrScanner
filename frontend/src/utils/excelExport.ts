/**
 * Excel export utility using SheetJS (xlsx).
 * Exports student grades for a class to an .xlsx file.
 */

import * as XLSX from 'xlsx'

interface GradeRow {
  student_name: string | null
  score: number | null
  total: number | null
  created_at: string | null
}

export function exportGradesToExcel(
  className: string,
  results: GradeRow[],
): void {
  const rows = results.map((r) => {
    const pct =
      r.score !== null && r.total !== null && r.total > 0
        ? Math.round((r.score / r.total) * 100)
        : null

    return {
      'Student Name': r.student_name || 'Unknown',
      Score: r.score ?? '',
      Total: r.total ?? '',
      'Percentage (%)': pct !== null ? pct : '',
      Date: r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
    }
  })

  const worksheet = XLSX.utils.json_to_sheet(rows)

  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(
      key.length,
      ...rows.map((r) => String((r as any)[key] || '').length),
    ) + 2,
  }))
  worksheet['!cols'] = colWidths

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Grades')

  const filename = `${className.replace(/\s+/g, '_')}_Grades.xlsx`
  XLSX.writeFile(workbook, filename)
}
