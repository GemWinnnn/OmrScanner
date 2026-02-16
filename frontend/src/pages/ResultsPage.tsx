import { useEffect, useState } from 'react'
import { Loader2, Download, BarChart3, FileText } from 'lucide-react'
import { getResults } from '../lib/api'

interface ResultRow {
  id: string
  template_id: string | null
  answer_key_id: string | null
  detected_answers: Record<string, string>
  score: number | null
  total: number | null
  created_at: string | null
}

export default function ResultsPage() {
  const [results, setResults] = useState<ResultRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    getResults()
      .then((data: ResultRow[]) => setResults(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function exportCSV() {
    if (results.length === 0) return

    // Build CSV with all question columns
    const allQuestions = new Set<string>()
    results.forEach((r) =>
      Object.keys(r.detected_answers).forEach((q) => allQuestions.add(q)),
    )
    const sortedQs = Array.from(allQuestions).sort((a, b) => {
      const na = parseInt(a.replace(/\D/g, '')) || 0
      const nb = parseInt(b.replace(/\D/g, '')) || 0
      return na - nb
    })

    const header = ['id', 'score', 'total', 'date', ...sortedQs]
    const lines = [header.join(',')]

    for (const r of results) {
      const row = [
        r.id.slice(0, 8),
        r.score?.toString() || '',
        r.total?.toString() || '',
        r.created_at ? new Date(r.created_at).toLocaleDateString() : '',
        ...sortedQs.map((q) => r.detected_answers[q] || ''),
      ]
      lines.push(row.join(','))
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'scan_results.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scan Results</h1>
          <p className="text-gray-500 mt-1">
            History of all scanned OMR sheets
          </p>
        </div>
        {results.length > 0 && (
          <button
            onClick={exportCSV}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export All to CSV
          </button>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-500 mt-3">Loading results...</p>
        </div>
      ) : results.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900 mt-4">No Results Yet</h3>
          <p className="text-gray-500 mt-1">
            Scan an OMR sheet to see results here
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">ID</th>
                <th className="px-4 py-3 text-left text-gray-600 font-medium">Date</th>
                <th className="px-4 py-3 text-center text-gray-600 font-medium">Score</th>
                <th className="px-4 py-3 text-center text-gray-600 font-medium">
                  Answers
                </th>
                <th className="px-4 py-3 text-right text-gray-600 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-gray-50 hover:bg-gray-50 cursor-pointer"
                  onClick={() =>
                    setExpandedId(expandedId === r.id ? null : r.id)
                  }
                >
                  <td className="px-4 py-3 font-mono text-gray-700">
                    {r.id.slice(0, 8)}...
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.created_at
                      ? new Date(r.created_at).toLocaleString()
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {r.score !== null && r.total !== null ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium">
                        {r.score}/{r.total}
                      </span>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-600">
                    {Object.keys(r.detected_answers).length}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <FileText className="h-4 w-4 text-gray-400 inline" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Expanded Row Detail */}
          {expandedId && (
            <div className="border-t border-gray-200 bg-gray-50 p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">
                Detected Answers
              </h4>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                {Object.entries(
                  results.find((r) => r.id === expandedId)?.detected_answers ||
                    {},
                )
                  .sort(([a], [b]) => {
                    const na = parseInt(a.replace(/\D/g, '')) || 0
                    const nb = parseInt(b.replace(/\D/g, '')) || 0
                    return na - nb
                  })
                  .map(([q, ans]) => (
                    <div
                      key={q}
                      className="text-center p-1.5 bg-white rounded border border-gray-200 text-xs"
                    >
                      <div className="text-gray-400">{q}</div>
                      <div className="font-bold text-gray-700">{ans || '-'}</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
