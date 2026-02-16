import { useEffect, useState } from 'react'
import {
  Save,
  Plus,
  Trash2,
  Loader2,
  Download,
  Upload,
  CheckCircle2,
} from 'lucide-react'
import {
  getAnswerKeys,
  createAnswerKey,
  deleteAnswerKey,
} from '../lib/api'

const CHOICES = ['A', 'B', 'C', 'D', 'E']
const MAX_QUESTIONS = 100

interface AnswerKeyData {
  id: string
  name: string
  answers: Record<string, string>
  marking_scheme?: { correct: number; incorrect: number; unmarked: number }
  total_items?: number | null
}

export default function AnswerKeyEditor() {
  const [answerKeys, setAnswerKeys] = useState<AnswerKeyData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Current editor state
  const [name, setName] = useState('New Answer Key')
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)

  // Total items
  const [totalItems, setTotalItems] = useState(MAX_QUESTIONS)

  // Marking scheme
  const [correctPts, setCorrectPts] = useState(1)
  const [incorrectPts, setIncorrectPts] = useState(0)
  const [unmarkedPts, setUnmarkedPts] = useState(0)

  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    try {
      const data = await getAnswerKeys()
      setAnswerKeys(data)
    } catch {
      // ok
    } finally {
      setLoading(false)
    }
  }

  function handleBubbleClick(question: string, choice: string) {
    setAnswers((prev) => {
      const current = prev[question]
      if (current === choice) {
        const copy = { ...prev }
        delete copy[question]
        return copy
      }
      return { ...prev, [question]: choice }
    })
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    try {
      // Only include answers up to totalItems
      const trimmedAnswers: Record<string, string> = {}
      for (let i = 1; i <= totalItems; i++) {
        const q = `q${i}`
        if (answers[q]) trimmedAnswers[q] = answers[q]
      }
      await createAnswerKey(name, trimmedAnswers, undefined, {
        correct: correctPts,
        incorrect: incorrectPts,
        unmarked: unmarkedPts,
      }, undefined, totalItems)
      setSaved(true)
      await loadKeys()
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // show error
    } finally {
      setSaving(false)
    }
  }

  function handleLoad(key: AnswerKeyData) {
    setName(key.name)
    setAnswers(key.answers || {})
    setEditingId(key.id)
    setTotalItems(key.total_items || Object.keys(key.answers || {}).length || MAX_QUESTIONS)
    if (key.marking_scheme) {
      setCorrectPts(key.marking_scheme.correct)
      setIncorrectPts(key.marking_scheme.incorrect)
      setUnmarkedPts(key.marking_scheme.unmarked)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this answer key?')) return
    try {
      await deleteAnswerKey(id)
      await loadKeys()
      if (editingId === id) {
        setEditingId(null)
        setAnswers({})
        setName('New Answer Key')
      }
    } catch {
      // ok
    }
  }

  function handleClear() {
    setAnswers({})
    setEditingId(null)
    setName('New Answer Key')
    setTotalItems(MAX_QUESTIONS)
    setSaved(false)
  }

  function handleExportCSV() {
    const lines = ['question,answer']
    for (let i = 1; i <= totalItems; i++) {
      const q = `q${i}`
      lines.push(`${q},${answers[q] || ''}`)
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name.replace(/\s+/g, '_')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const [importMessage, setImportMessage] = useState<string | null>(null)

  function handleImportCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.trim().split('\n')
      const imported: Record<string, string> = {}
      for (const line of lines) {
        const [rawQ, a] = line.split(',').map((s) => s.trim())
        if (!rawQ || !a) continue
        if (rawQ.toLowerCase() === 'question' || rawQ.toLowerCase() === 'q#') continue
        if (!CHOICES.includes(a.toUpperCase())) continue
        // Normalize key: "1" -> "q1", "q1" -> "q1"
        const num = rawQ.replace(/^q/i, '')
        if (!num || isNaN(parseInt(num))) continue
        imported[`q${parseInt(num)}`] = a.toUpperCase()
      }
      setAnswers(imported)
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ')
      if (baseName) setName(baseName)
      setSaved(false)
      const count = Object.keys(imported).length
      setImportMessage(`${count} answers imported. Click Save to store.`)
      setTimeout(() => setImportMessage(null), 5000)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const answeredCount = Object.keys(answers).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Answer Key Editor</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            Click on a bubble to set the correct answer for each question
          </p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <span className="text-xs sm:text-sm text-gray-500">
            {answeredCount}/{totalItems} answered
          </span>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Download className="h-4 w-4" />
            Export
          </button>
          <label className="flex items-center gap-1.5 px-3 py-2 text-xs sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
            <Upload className="h-4 w-4" />
            Import
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleImportCSV}
            />
          </label>
        </div>
      </div>

      {/* Import notification */}
      {importMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-700">
          {importMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Saved Answer Keys Sidebar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
          <h3 className="font-semibold text-gray-900 mb-3">Saved Answer Keys</h3>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : answerKeys.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">
              No saved answer keys yet
            </p>
          ) : (
            <div className="space-y-2">
              {answerKeys.map((key) => (
                <div
                  key={key.id}
                  className={`flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer transition-colors ${
                    editingId === key.id
                      ? 'bg-indigo-50 border border-indigo-200'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => handleLoad(key)}
                >
                  <div>
                    <p className="font-medium text-gray-900">{key.name}</p>
                    <p className="text-gray-400 text-xs">
                      {Object.keys(key.answers || {}).length} answers
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      handleDelete(key.id)
                    }}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={handleClear}
            className="w-full mt-3 flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Answer Key
          </button>
        </div>

        {/* Editor Grid */}
        <div className="lg:col-span-3 space-y-4">
          {/* Name & Marking Scheme */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setSaved(false)
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Items
                </label>
                <input
                  type="number"
                  min={1}
                  max={MAX_QUESTIONS}
                  value={totalItems || ''}
                  onChange={(e) => {
                    const parsed = parseInt(e.target.value)
                    setTotalItems(isNaN(parsed) ? 0 : Math.min(MAX_QUESTIONS, parsed))
                    setSaved(false)
                  }}
                  onBlur={() => { if (totalItems < 1) setTotalItems(1) }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Correct pts
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={correctPts}
                  onChange={(e) => setCorrectPts(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Incorrect pts
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={incorrectPts}
                  onChange={(e) => setIncorrectPts(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unmarked pts
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={unmarkedPts}
                  onChange={(e) => setUnmarkedPts(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Bubble Grid */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4 text-sm text-gray-500">
                <span className="font-medium text-gray-700">Answer Grid</span>
                <span>Click to toggle</span>
              </div>
              <button
                onClick={handleSave}
                disabled={saving || answeredCount === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {saving ? 'Saving...' : saved ? 'Saved!' : 'Save'}
              </button>
            </div>
            <div className="p-2 sm:p-4 max-h-[600px] overflow-y-auto">
              {/* Header Row */}
              <div className="grid gap-0.5 sm:gap-1 mb-2" style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}>
                <div className="text-xs font-medium text-gray-500 px-1 sm:px-2">Q#</div>
                {CHOICES.map((c) => (
                  <div key={c} className="text-xs font-medium text-gray-500 text-center">
                    {c}
                  </div>
                ))}
              </div>
              {/* Question Rows */}
              {Array.from({ length: totalItems }, (_, i) => {
                const q = `q${i + 1}`
                return (
                  <div
                    key={q}
                    className="grid gap-0.5 sm:gap-1 py-0.5"
                    style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}
                  >
                    <div className="flex items-center px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-700">
                      {i + 1}
                    </div>
                    {CHOICES.map((choice) => {
                      const selected = answers[q] === choice
                      return (
                        <button
                          key={choice}
                          onClick={() => handleBubbleClick(q, choice)}
                          className={`h-7 sm:h-8 rounded-full border-2 text-[10px] sm:text-xs font-bold transition-all duration-150 ${
                            selected
                              ? 'bg-indigo-600 border-indigo-600 text-white scale-110'
                              : 'bg-white border-gray-300 text-gray-400 hover:border-indigo-400 hover:text-indigo-500'
                          }`}
                        >
                          {choice}
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
