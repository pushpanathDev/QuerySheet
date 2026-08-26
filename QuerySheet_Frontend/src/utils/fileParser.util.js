import Papa from 'papaparse'
import * as XLSX from 'xlsx'

/**
 * Returns true if every value in an array is null/undefined/"".
 */
function isColumnEmpty(values) {
  return values.every((v) => v === null || v === undefined || v === '')
}

/**
 * Returns the fraction of null/undefined/"" values in a row.
 */
function nullFraction(row, headers) {
  const nullCount = headers.filter(
    (h) => row[h] === null || row[h] === undefined || row[h] === ''
  ).length
  return nullCount / headers.length
}

/**
 * Post-parse cleanup:
 * - Remove columns where every value is null
 * - Remove rows where >80% of values are null
 * - Trim all string values
 * - Ensures plain serializable objects
 */
function cleanRows(rows) {
  if (!rows || rows.length === 0) return []

  const headers = Object.keys(rows[0])

  const activeHeaders = headers.filter(
    (h) => !isColumnEmpty(rows.map((r) => r[h]))
  )

  const cleanedRows = rows
    .filter((row) => nullFraction(row, activeHeaders) <= 0.8)
    .map((row) => {
      const clean = {}
      activeHeaders.forEach((h) => {
        const val = row[h]
        clean[h] = typeof val === 'string' ? val.trim() : val ?? null
      })
      return clean
    })

  return cleanedRows
}

/**
 * Parses a CSV or XLSX file into one or more sheets.
 *
 * Return shape:
 *   {
 *     sheets: [ { name, headers, rows }, ... ],   // always present
 *     // ---- compatibility shims for the existing UI ----
 *     rows: <first sheet rows>,
 *     headers: <first sheet headers>,
 *   }
 *
 * CSV files always produce a single sheet named "Sheet1".
 * XLSX/XLS files produce one entry per worksheet, in workbook order.
 *
 * The compatibility fields let existing components (preview table, summary
 * card) keep working unchanged while the backend is upgraded to consume the
 * `sheets` array.
 *
 * @param {File} file
 * @returns {Promise<{ sheets: Array<{name:string, headers:string[], rows:object[]}>, rows: object[], headers: string[] }>}
 */
export async function parseFile(file) {
  const ext = file.name.split('.').pop().toLowerCase()

  if (ext === 'csv') {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          const rows = cleanRows(results.data)
          const headers = rows.length > 0 ? Object.keys(rows[0]) : []
          const sheet = { name: 'Sheet1', headers, rows }
          resolve({ sheets: [sheet], rows, headers })
        },
        error: (err) => reject(new Error(`CSV parse error: ${err.message}`)),
      })
    })
  }

  if (ext === 'xlsx' || ext === 'xls') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const buffer = e.target.result
          const workbook = XLSX.read(buffer, { type: 'array' })

          const sheets = workbook.SheetNames.map((name) => {
            const worksheet = workbook.Sheets[name]
            const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: null })
            const cleaned = cleanRows(rawRows)
            const headers = cleaned.length > 0 ? Object.keys(cleaned[0]) : []
            return { name, headers, rows: cleaned }
          }).filter((s) => s.rows.length > 0)

          if (sheets.length === 0) {
            reject(new Error('Workbook contains no readable sheets.'))
            return
          }

          const first = sheets[0]
          resolve({
            sheets,
            // Back-compat: first non-empty sheet drives existing UI
            rows: first.rows,
            headers: first.headers,
          })
        } catch (err) {
          reject(new Error(`XLSX parse error: ${err.message}`))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file.'))
      reader.readAsArrayBuffer(file)
    })
  }

  throw new Error(`Unsupported file type: .${ext}`)
}
