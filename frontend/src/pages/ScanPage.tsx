import { useCallback, useEffect, useRef, useState } from 'react'
import Webcam from 'react-webcam'
import {
  Upload,
  Camera,
  Loader2,
  CheckCircle2,
  XCircle,
  Minus,
  Image as ImageIcon,
} from 'lucide-react'
import { scanUploadedImage, scanCameraCapture, getAnswerKeys, getClasses } from '../lib/api'
import { ensureJpeg } from '../utils/imageConvert'

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

interface AnswerKeyOption {
  id: string
  name: string
  answers: Record<string, string>
  class_id?: string | null
}

interface ClassOption {
  id: string
  name: string
}

export default function ScanPage() {
  const [mode, setMode] = useState<'upload' | 'camera'>('upload')
  const [scanning, setScanning] = useState(false)
  const [result, setResult] = useState<ScanResultData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [answerKeys, setAnswerKeys] = useState<AnswerKeyOption[]>([])
  const [selectedKeyId, setSelectedKeyId] = useState<string>('')
  const [studentName, setStudentName] = useState('')
  const [classes, setClasses] = useState<ClassOption[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const webcamRef = useRef<Webcam>(null)

  useEffect(() => {
    getAnswerKeys()
      .then((keys: AnswerKeyOption[]) => setAnswerKeys(keys))
      .catch(() => {})
    getClasses()
      .then((cls: ClassOption[]) => setClasses(cls))
      .catch(() => {})
  }, [])

  const selectedAnswerKey = answerKeys.find((k) => k.id === selectedKeyId)

  // Filter answer keys by selected class
  const filteredKeys = selectedClassId
    ? answerKeys.filter((k) => k.class_id === selectedClassId || !k.class_id)
    : answerKeys

  const handleFile = useCallback(
    async (rawFile: File) => {
      setError(null)
      setResult(null)
      setScanning(true)
      try {
        const file = await ensureJpeg(rawFile)
        setPreviewUrl(URL.createObjectURL(file))
        const data = await scanUploadedImage(
          file,
          undefined,
          selectedAnswerKey?.answers,
          undefined,
          studentName || undefined,
          selectedClassId || undefined,
          selectedKeyId || undefined,
        )
        setResult(data)
      } catch (e: unknown) {
        const err = e as { response?: { data?: { detail?: string } }; message?: string }
        setError(err?.response?.data?.detail || err?.message || 'Scan failed')
      } finally {
        setScanning(false)
      }
    },
    [selectedAnswerKey, studentName, selectedClassId, selectedKeyId],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragOver(false)
      const file = e.dataTransfer.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleCapture = useCallback(async () => {
    if (!webcamRef.current) return
    const imageSrc = webcamRef.current.getScreenshot()
    if (!imageSrc) return

    setError(null)
    setResult(null)
    setPreviewUrl(imageSrc)
    setScanning(true)
    try {
      const data = await scanCameraCapture(
        imageSrc,
        selectedAnswerKey?.answers,
        undefined,
        studentName || undefined,
        selectedClassId || undefined,
        selectedKeyId || undefined,
      )
      setResult(data)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { detail?: string } }; message?: string }
      setError(err?.response?.data?.detail || err?.message || 'Scan failed')
    } finally {
      setScanning(false)
    }
  }, [selectedAnswerKey, studentName, selectedClassId, selectedKeyId])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Scan OMR Sheet</h1>
        <p className="text-gray-500 mt-1">
          Upload an image or use your camera to scan an OMR answer sheet
        </p>
      </div>

      {/* Scan Options */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Student Name
            </label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              placeholder="Enter student name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Class (optional)
            </label>
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">No class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Answer Key (optional - enables scoring)
            </label>
            <select
              value={selectedKeyId}
              onChange={(e) => setSelectedKeyId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">No answer key (detect only)</option>
              {filteredKeys.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('upload')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'upload'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Upload className="h-4 w-4" />
          Upload Image
        </button>
        <button
          onClick={() => setMode('camera')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'camera'
              ? 'bg-indigo-600 text-white'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          <Camera className="h-4 w-4" />
          Camera
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Area */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {mode === 'upload' ? (
            <div
              className={`p-8 text-center border-2 border-dashed rounded-xl m-4 transition-colors cursor-pointer ${
                dragOver
                  ? 'border-indigo-400 bg-indigo-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.heic,.heif"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) handleFile(f)
                }}
              />
              <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">
                Drop your OMR sheet image here
              </p>
              <p className="text-gray-400 text-sm mt-1">
                or click to browse (JPEG, PNG)
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="relative rounded-lg overflow-hidden bg-black">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{
                    facingMode: 'environment',
                    width: 1280,
                    height: 720,
                  }}
                  className="w-full"
                />
              </div>
              <button
                onClick={handleCapture}
                disabled={scanning}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {scanning ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Camera className="h-5 w-5" />
                )}
                {scanning ? 'Scanning...' : 'Capture & Scan'}
              </button>
            </div>
          )}

          {/* Preview / Annotated Image */}
          {(previewUrl || result?.annotated_image_base64) && (
            <div className="p-4 border-t border-gray-100">
              <p className="text-sm font-medium text-gray-700 mb-2">
                {result?.annotated_image_base64 ? 'Detected Bubbles' : 'Preview'}
              </p>
              <img
                src={
                  result?.annotated_image_base64
                    ? `data:image/jpeg;base64,${result.annotated_image_base64}`
                    : previewUrl!
                }
                alt="OMR Sheet"
                className="w-full rounded-lg border border-gray-200"
              />
            </div>
          )}
        </div>

        {/* Results Area */}
        <div className="space-y-4">
          {scanning && (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
              <p className="mt-3 text-gray-600 font-medium">Processing OMR sheet...</p>
              <p className="text-gray-400 text-sm mt-1">
                Detecting bubbles and reading answers
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" />
                <p className="font-medium">Scan Error</p>
              </div>
              <p className="text-red-600 text-sm mt-1">{error}</p>
            </div>
          )}

          {result && (
            <>
              {/* Score Card */}
              {result.score !== null && result.total !== null && (
                <div className="bg-white rounded-xl border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Score</h3>
                  <div className="flex items-center gap-6">
                    <div className="flex-1">
                      <div className="text-4xl font-bold text-indigo-600">
                        {result.score}/{result.total}
                      </div>
                      <div className="text-gray-500 mt-1">
                        {result.percentage}% correct
                      </div>
                    </div>
                    <div className="text-right text-sm text-gray-500 space-y-1">
                      <div>Multi-marked: {result.multi_marked_count}</div>
                      <div>Unmarked: {result.unmarked_count}</div>
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                      style={{ width: `${result.percentage || 0}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Detailed Results */}
              {result.bubble_details.length > 0 ? (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Question Details
                    </h3>
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
                        {result.bubble_details.map((d) => (
                          <tr key={d.question} className="border-t border-gray-50">
                            <td className="px-4 py-2 font-medium text-gray-900">
                              {d.question}
                            </td>
                            <td className="px-4 py-2 text-gray-700">{d.marked}</td>
                            <td className="px-4 py-2 text-gray-700">
                              {d.correct || '-'}
                            </td>
                            <td className="px-4 py-2 text-center">
                              {d.is_correct === true && (
                                <CheckCircle2 className="h-5 w-5 text-green-500 mx-auto" />
                              )}
                              {d.is_correct === false && (
                                <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                              )}
                              {d.is_correct === null && (
                                <Minus className="h-5 w-5 text-gray-400 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* Simple answer listing when no answer key was used */
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-900">
                      Detected Answers
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">
                      {Object.keys(result.detected_answers).length} answers detected
                      {result.multi_marked_count > 0 &&
                        ` (${result.multi_marked_count} multi-marked)`}
                    </p>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-4">
                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {Object.entries(result.detected_answers)
                        .sort(([a], [b]) => {
                          const na = parseInt(a.replace(/\D/g, '')) || 0
                          const nb = parseInt(b.replace(/\D/g, '')) || 0
                          return na - nb
                        })
                        .map(([q, ans]) => (
                          <div
                            key={q}
                            className={`text-center p-2 rounded-lg text-sm ${
                              ans
                                ? 'bg-indigo-50 text-indigo-700 font-medium'
                                : 'bg-gray-50 text-gray-400'
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
  )
}
