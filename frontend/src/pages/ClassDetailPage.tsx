import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Loader2,
  ClipboardCheck,
  FileDown,
  ScanLine,
  BarChart3,
  Trash2,
  Save,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  Minus,
  Image as ImageIcon,
} from 'lucide-react'
import {
  getClass,
  getAnswerKeys,
  createAnswerKey,
  deleteAnswerKey,
  getResults,
  deleteResult,
  scanUploadedImage,
} from '../lib/api'
import { generateOMRPDF } from '../utils/pdfGenerator'
import { exportGradesToExcel } from '../utils/excelExport'
import { ensureJpeg } from '../utils/imageConvert'

const CHOICES = ['A', 'B', 'C', 'D', 'E']
const MAX_QUESTIONS = 100

interface ClassData {
  id: string
  name: string
  section: string | null
  subject: string | null
  total_items: number
}

interface AnswerKeyData {
  id: string
  name: string
  answers: Record<string, string>
  marking_scheme?: { correct: number; incorrect: number; unmarked: number }
  total_items?: number | null
}

interface BubbleDetail {
  question: string
  marked: string
  correct: string | null
  is_correct: boolean | null
}

interface ScanResultData {
  detected_answers: Record<string, string>
  score: number | null
  total: number | null
  percentage: number | null
  bubble_details: BubbleDetail[]
  multi_marked_count: number
  unmarked_count: number
  annotated_image_base64: string | null
}

interface ResultRow {
  id: string
  student_name: string | null
  detected_answers: Record<string, string>
  score: number | null
  total: number | null
  created_at: string | null
}

type Tab = 'answer-keys' | 'pdf' | 'scan' | 'grades'

export default function ClassDetailPage() {
  const { id: classId } = useParams<{ id: string }>()
  const [classData, setClassData] = useState<ClassData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<Tab>('answer-keys')

  // Answer Keys state
  const [answerKeys, setAnswerKeys] = useState<AnswerKeyData[]>([])
  const [akLoading, setAkLoading] = useState(false)
  const [akName, setAkName] = useState('New Answer Key')
  const [akAnswers, setAkAnswers] = useState<Record<string, string>>({})
  const [akSaving, setAkSaving] = useState(false)
  const [akSaved, setAkSaved] = useState(false)
  const [akError, setAkError] = useState<string | null>(null)

  // PDF state
  const [pdfGenerating, setPdfGenerating] = useState(false)

  // Scan state
  const [studentName, setStudentName] = useState('')
  const [selectedKeyId, setSelectedKeyId] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Grades state
  const [results, setResults] = useState<ResultRow[]>([])
  const [gradesLoading, setGradesLoading] = useState(false)

  // Total items comes from the class
  const classTotalItems = classData?.total_items ?? MAX_QUESTIONS

  const loadClass = useCallback(async () => {
    try {
      const data = await getClass(classId!)
      setClassData(data)
    } catch {
      // ok
    } finally {
      setLoading(false)
    }
  }, [classId])

  const loadAnswerKeys = useCallback(async () => {
    setAkLoading(true)
    try {
      const data = await getAnswerKeys(classId)
      setAnswerKeys(data)
    } catch {
      // ok
    } finally {
      setAkLoading(false)
    }
  }, [classId])

  const loadGrades = useCallback(async () => {
    setGradesLoading(true)
    try {
      const data = await getResults(classId)
      setResults(data)
    } catch {
      // ok
    } finally {
      setGradesLoading(false)
    }
  }, [classId])

  useEffect(() => {
    if (!classId) return
    loadClass()
  }, [classId, loadClass])

  useEffect(() => {
    if (!classId) return
    if (activeTab === 'answer-keys') loadAnswerKeys()
    if (activeTab === 'grades') loadGrades()
    if (activeTab === 'scan') loadAnswerKeys()
  }, [activeTab, classId, loadAnswerKeys, loadGrades])

  // ─── Answer Key handlers ─────────────────────────────
  function handleBubbleClick(question: string, choice: string) {
    setAkAnswers((prev) => {
      const current = prev[question]
      if (current === choice) {
        const copy = { ...prev }
        delete copy[question]
        return copy
      }
      return { ...prev, [question]: choice }
    })
    setAkSaved(false)
    setAkError(null)
  }

  async function handleSaveAnswerKey() {
    // Validate: all items must be answered
    const answeredCount = Object.keys(akAnswers).filter(k => {
      const num = parseInt(k.replace('q', ''))
      return num >= 1 && num <= classTotalItems
    }).length
    if (answeredCount < classTotalItems) {
      setAkError(`Please fill in all ${classTotalItems} answers. You have ${answeredCount}/${classTotalItems} completed.`)
      return
    }
    setAkError(null)
    setAkSaving(true)
    try {
      // Only include answers up to classTotalItems
      const trimmedAnswers: Record<string, string> = {}
      for (let i = 1; i <= classTotalItems; i++) {
        const q = `q${i}`
        if (akAnswers[q]) trimmedAnswers[q] = akAnswers[q]
      }
      await createAnswerKey(akName, trimmedAnswers, undefined, { correct: 1, incorrect: 0, unmarked: 0 }, classId, classTotalItems)
      setAkSaved(true)
      setAkAnswers({})
      setAkName('New Answer Key')
      await loadAnswerKeys()
      setTimeout(() => setAkSaved(false), 2000)
    } catch {
      // ok
    } finally {
      setAkSaving(false)
    }
  }

  async function handleDeleteAnswerKey(id: string) {
    if (!confirm('Delete this answer key?')) return
    try {
      await deleteAnswerKey(id)
      await loadAnswerKeys()
    } catch {
      // ok
    }
  }

  function handleLoadAnswerKey(key: AnswerKeyData) {
    setAkName(key.name)
    setAkAnswers(key.answers || {})
    setAkError(null)
  }

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
        // Skip header row
        if (rawQ.toLowerCase() === 'question' || rawQ.toLowerCase() === 'q#') continue
        if (!CHOICES.includes(a.toUpperCase())) continue
        // Normalize key: "1" -> "q1", "q1" -> "q1"
        const num = rawQ.replace(/^q/i, '')
        if (!num || isNaN(parseInt(num))) continue
        imported[`q${parseInt(num)}`] = a.toUpperCase()
      }
      setAkAnswers(imported)
      const baseName = file.name.replace(/\.[^.]+$/, '').replace(/_/g, ' ')
      setAkName(baseName || 'Imported Answer Key')
      setAkSaved(false)
      setAkError(null)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ─── Grade handlers ─────────────────────────────────
  async function handleDeleteResult(id: string) {
    if (!confirm('Delete this grade entry?')) return
    try {
      await deleteResult(id)
      await loadGrades()
    } catch {
      // ok
    }
  }

  // ─── PDF handler ─────────────────────────────────────
  async function handleGeneratePDF() {
    setPdfGenerating(true)
    try {
      const pdfName = classData?.subject || classData?.name || 'EXAMINATION'
      await generateOMRPDF({ name: pdfName, totalItems: classTotalItems })
    } catch {
      // ok
    } finally {
      setPdfGenerating(false)
    }
  }

  // ─── Scan handlers ───────────────────────────────────
  async function handleScanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const rawFile = e.target.files?.[0]
    if (!rawFile) return
    setScanError(null)
    setScanResult(null)
    setScanning(true)
    try {
      const file = await ensureJpeg(rawFile)
      setPreviewUrl(URL.createObjectURL(file))
      const selectedKey = answerKeys.find((k) => k.id === selectedKeyId)
      const data = await scanUploadedImage(
        file,
        undefined,
        selectedKey?.answers,
        undefined,
        studentName || undefined,
        classId,
        selectedKeyId || undefined,
      )
      setScanResult(data)
      loadGrades()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string } }; message?: string }
      setScanError(e?.response?.data?.detail || e?.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
    e.target.value = ''
  }

  function handleExportScanCSV() {
    if (!scanResult) return
    const lines = ['question,marked,correct,status']
    if (scanResult.bubble_details.length > 0) {
      for (const d of scanResult.bubble_details) {
        const status = d.is_correct === true ? 'correct' : d.is_correct === false ? 'incorrect' : 'unmarked'
        lines.push(`${d.question},${d.marked},${d.correct || ''},${status}`)
      }
    } else {
      const sorted = Object.entries(scanResult.detected_answers).sort(([a], [b]) => {
        return (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0)
      })
      for (const [q, ans] of sorted) {
        lines.push(`${q},${ans},,`)
      }
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `scan_${studentName || 'result'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ─── Tabs config ─────────────────────────────────────
  const tabs: { key: Tab; label: string; icon: typeof ClipboardCheck }[] = [
    { key: 'answer-keys', label: 'Answer Keys', icon: ClipboardCheck },
    { key: 'pdf', label: 'Generate PDF', icon: FileDown },
    { key: 'scan', label: 'Scan Sheets', icon: ScanLine },
    { key: 'grades', label: 'Student Grades', icon: BarChart3 },
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!classData) {
    return (
      <div className="text-center py-20">
        <p className="text-gray-500">Class not found</p>
        <Link to="/classes" className="text-indigo-600 hover:underline mt-2 inline-block">
          Back to classes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 sm:gap-4">
        <Link
          to="/classes"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 truncate">{classData.name}</h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 flex-wrap">
            {classData.subject && <span>{classData.subject}</span>}
            {classData.subject && classData.section && <span>|</span>}
            {classData.section && <span>{classData.section}</span>}
            <span>|</span>
            <span>{classData.total_items} items</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 -mx-4 sm:mx-0 px-4 sm:px-0">
        <div className="flex gap-0.5 sm:gap-1 overflow-x-auto scrollbar-hide">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0 ${
                activeTab === key
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="hidden xs:inline sm:inline">{label}</span>
              <span className="xs:hidden sm:hidden">{label.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ═══ Answer Keys Tab ═══ */}
      {activeTab === 'answer-keys' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* Saved list */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 h-fit">
            <h3 className="font-semibold text-gray-900 mb-3 text-sm sm:text-base">Saved Answer Keys</h3>
            {akLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : answerKeys.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No answer keys yet</p>
            ) : (
              <div className="space-y-2">
                {answerKeys.map((key) => (
                  <div
                    key={key.id}
                    className="flex items-center justify-between p-2 rounded-lg text-sm cursor-pointer hover:bg-gray-50"
                    onClick={() => handleLoadAnswerKey(key)}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{key.name}</p>
                      <p className="text-gray-400 text-xs">{Object.keys(key.answers || {}).length} answers</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteAnswerKey(key.id) }}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-end gap-3 sm:gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Answer Key Name</label>
                  <input
                    type="text"
                    value={akName}
                    onChange={(e) => { setAkName(e.target.value); setAkSaved(false); setAkError(null) }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors w-full sm:w-auto justify-center">
                    <Upload className="h-4 w-4" />
                    Import CSV
                    <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                  </label>
                </div>
              </div>
              {akError && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {akError}
                </div>
              )}
            </div>

            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-3 sm:px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2">
                <span className={`text-xs sm:text-sm ${Object.keys(akAnswers).length === classTotalItems ? 'text-green-600 font-medium' : 'text-gray-500'}`}>{Object.keys(akAnswers).length}/{classTotalItems} answered</span>
                <button
                  onClick={handleSaveAnswerKey}
                  disabled={akSaving || Object.keys(akAnswers).length === 0}
                  className="flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {akSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : akSaved ? <CheckCircle2 className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {akSaving ? 'Saving...' : akSaved ? 'Saved!' : 'Save'}
                </button>
              </div>
              <div className="p-2 sm:p-4 max-h-[500px] overflow-y-auto">
                <div className="grid gap-0.5 sm:gap-1 mb-2" style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}>
                  <div className="text-xs font-medium text-gray-500 px-1 sm:px-2">Q#</div>
                  {CHOICES.map((c) => (
                    <div key={c} className="text-xs font-medium text-gray-500 text-center">{c}</div>
                  ))}
                </div>
                {Array.from({ length: classTotalItems }, (_, i) => {
                  const q = `q${i + 1}`
                  return (
                    <div key={q} className="grid gap-0.5 sm:gap-1 py-0.5" style={{ gridTemplateColumns: '40px repeat(5, 1fr)' }}>
                      <div className="flex items-center px-1 sm:px-2 text-xs sm:text-sm font-medium text-gray-700">{i + 1}</div>
                      {CHOICES.map((choice) => {
                        const selected = akAnswers[q] === choice
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
      )}

      {/* ═══ Generate PDF Tab ═══ */}
      {activeTab === 'pdf' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-lg">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generate OMR Answer Sheet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Generate a printable OMR answer sheet PDF for this class. The sheet always prints all 100 bubbles for scanning compatibility.
          </p>
          <div className="mb-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Exam Name:</span>
              <span className="text-gray-900">{classData.subject || classData.name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium text-gray-700">Total Items:</span>
              <span className="text-gray-900">{classTotalItems}</span>
            </div>
          </div>
          <button
            onClick={handleGeneratePDF}
            disabled={pdfGenerating}
            className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {pdfGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {pdfGenerating ? 'Generating...' : 'Download PDF'}
          </button>
        </div>
      )}

      {/* ═══ Scan Sheets Tab ═══ */}
      {activeTab === 'scan' && (
        <div className="space-y-4">
          {/* Scan options */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Name</label>
                <input
                  type="text"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="Enter student name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Answer Key</label>
                <select
                  value={selectedKeyId}
                  onChange={(e) => setSelectedKeyId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">No answer key (detect only)</option>
                  {answerKeys.map((k) => (
                    <option key={k.id} value={k.id}>{k.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input area */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-xl m-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors">
                <input type="file" accept="image/*,.heic,.heif" className="hidden" onChange={handleScanFile} />
                {scanning ? (
                  <>
                    <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                    <span className="text-sm font-medium text-indigo-600">Processing...</span>
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-10 w-10 text-gray-400" />
                    <span className="text-sm font-medium text-gray-600">Click to upload OMR sheet</span>
                    <span className="text-xs text-gray-400">JPEG, PNG, HEIC</span>
                  </>
                )}
              </label>

              {/* Preview / Annotated */}
              {(previewUrl || scanResult?.annotated_image_base64) && (
                <div className="p-4 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    {scanResult?.annotated_image_base64 ? 'Detected Bubbles' : 'Preview'}
                  </p>
                  <img
                    src={
                      scanResult?.annotated_image_base64
                        ? `data:image/jpeg;base64,${scanResult.annotated_image_base64}`
                        : previewUrl!
                    }
                    alt="OMR Sheet"
                    className="w-full rounded-lg border border-gray-200"
                  />
                </div>
              )}
            </div>

            {/* Results area */}
            <div className="space-y-4">
              {scanning && (
                <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
                  <p className="mt-3 text-gray-600 font-medium">Processing OMR sheet...</p>
                  <p className="text-gray-400 text-sm mt-1">Detecting bubbles and reading answers</p>
                </div>
              )}

              {scanError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-red-700">
                    <XCircle className="h-5 w-5" />
                    <p className="font-medium">Scan Error</p>
                  </div>
                  <p className="text-red-600 text-sm mt-1">{scanError}</p>
                </div>
              )}

              {scanResult && (
                <>
                  {/* Score card */}
                  {scanResult.score !== null && scanResult.total !== null && (
                    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                          Score {studentName && <span className="text-gray-500 font-normal">- {studentName}</span>}
                        </h3>
                        <button
                          onClick={handleExportScanCSV}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors self-start sm:self-auto"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export CSV
                        </button>
                      </div>
                      <div className="flex items-center gap-4 sm:gap-6">
                        <div className="flex-1">
                          <div className="text-3xl sm:text-4xl font-bold text-indigo-600">
                            {scanResult.score}/{scanResult.total}
                          </div>
                          <div className="text-gray-500 mt-1 text-sm">{scanResult.percentage}% correct</div>
                        </div>
                        <div className="text-right text-xs sm:text-sm text-gray-500 space-y-1">
                          <div>Multi-marked: {scanResult.multi_marked_count}</div>
                          <div>Unmarked: {scanResult.unmarked_count}</div>
                        </div>
                      </div>
                      <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                          style={{ width: `${scanResult.percentage || 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">Result saved automatically.</p>
                    </div>
                  )}

                  {/* Question details breakdown */}
                  {scanResult.bubble_details && scanResult.bubble_details.length > 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100">
                        <h3 className="text-lg font-semibold text-gray-900">Question Details</h3>
                      </div>
                      <div className="max-h-96 overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-gray-600">Q#</th>
                              <th className="px-4 py-2 text-left text-gray-600">Marked</th>
                              <th className="px-4 py-2 text-left text-gray-600">Correct</th>
                              <th className="px-4 py-2 text-center text-gray-600">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {scanResult.bubble_details.map((d) => (
                              <tr key={d.question} className="border-t border-gray-50">
                                <td className="px-4 py-2 font-medium text-gray-900">{d.question}</td>
                                <td className="px-4 py-2 text-gray-700">{d.marked}</td>
                                <td className="px-4 py-2 text-gray-700">{d.correct || '-'}</td>
                                <td className="px-4 py-2 text-center">
                                  {d.is_correct === true && <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />}
                                  {d.is_correct === false && <XCircle className="h-5 w-5 text-red-500 mx-auto" />}
                                  {d.is_correct === null && <Minus className="h-5 w-5 text-gray-400 mx-auto" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    /* Simple grid when no answer key */
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">Detected Answers</h3>
                          <p className="text-gray-500 text-sm mt-1">
                            {Object.keys(scanResult.detected_answers).length} answers detected
                            {scanResult.multi_marked_count > 0 && ` (${scanResult.multi_marked_count} multi-marked)`}
                          </p>
                        </div>
                        <button
                          onClick={handleExportScanCSV}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Export CSV
                        </button>
                      </div>
                      <div className="max-h-96 overflow-y-auto p-4">
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                          {Object.entries(scanResult.detected_answers)
                            .sort(([a], [b]) => (parseInt(a.replace(/\D/g, '')) || 0) - (parseInt(b.replace(/\D/g, '')) || 0))
                            .map(([q, ans]) => (
                              <div
                                key={q}
                                className={`text-center p-2 rounded-lg text-sm ${
                                  ans ? 'bg-indigo-50 text-indigo-700 font-medium' : 'bg-gray-50 text-gray-400'
                                }`}
                              >
                                <div className="text-xs text-gray-500">{q}</div>
                                <div>{ans || '-'}</div>
                              </div>
                            ))}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ═══ Student Grades Tab ═══ */}
      {activeTab === 'grades' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900">Student Grades</h3>
            {results.length > 0 && (
              <button
                onClick={() => exportGradesToExcel(classData.name, results)}
                className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Export to Excel
              </button>
            )}
          </div>

          {gradesLoading ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
            </div>
          ) : results.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <BarChart3 className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-gray-500 mt-3">No grades recorded yet. Scan some sheets to get started.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-3 sm:px-4 py-3 text-left text-gray-600 font-medium">Student Name</th>
                    <th className="px-3 sm:px-4 py-3 text-center text-gray-600 font-medium">Score</th>
                    <th className="px-3 sm:px-4 py-3 text-center text-gray-600 font-medium">Total</th>
                    <th className="px-3 sm:px-4 py-3 text-center text-gray-600 font-medium">Percentage</th>
                    <th className="px-3 sm:px-4 py-3 text-left text-gray-600 font-medium">Date</th>
                    <th className="px-3 sm:px-4 py-3 text-center text-gray-600 font-medium w-12 sm:w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => {
                    const pct = r.score !== null && r.total !== null && r.total > 0
                      ? Math.round((r.score / r.total) * 100)
                      : null
                    return (
                      <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50">
                        <td className="px-3 sm:px-4 py-3 text-gray-900 font-medium">
                          {r.student_name || 'Unknown'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center text-gray-700">
                          {r.score !== null ? r.score : '-'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center text-gray-700">
                          {r.total !== null ? r.total : '-'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          {pct !== null ? (
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                              pct >= 75 ? 'bg-green-100 text-green-700' :
                              pct >= 50 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {pct}%
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-gray-500 whitespace-nowrap">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : '-'}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteResult(r.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete entry"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
