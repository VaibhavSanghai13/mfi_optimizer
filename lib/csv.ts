/** CSV export for the Reports page — built in the browser, so no server round-trip. */

type Cell = string | number | null | undefined

const escape = (cell: Cell) => {
  const text = cell === null || cell === undefined ? '' : String(cell)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export const toCsv = (rows: Cell[][]) => rows.map((row) => row.map(escape).join(',')).join('\r\n')

export function downloadCsv(filename: string, rows: Cell[][]) {
  // The BOM makes Excel open UTF-8 (officer names, ₹) correctly.
  const blob = new Blob([`﻿${toCsv(rows)}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
