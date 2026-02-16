import { useEffect, useState } from 'react'
import { Loader2, FileText, Trash2 } from 'lucide-react'
import { getTemplates } from '../lib/api'

interface TemplateRow {
  id: string
  name: string
  config: {
    pageDimensions: number[]
    bubbleDimensions: number[]
    fieldBlocks: Record<string, any>
    outputColumns: string[]
  }
  created_at: string | null
}

export default function TemplateManager() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    getTemplates()
      .then((data: TemplateRow[]) => setTemplates(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
        <p className="text-gray-500 mt-1">
          Manage OMR sheet templates that define question layout and bubble
          positions
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-500 mt-3">Loading templates...</p>
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <FileText className="h-12 w-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900 mt-4">
            No Templates
          </h3>
          <p className="text-gray-500 mt-1">
            The default 100-question template is used automatically
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-sm transition-shadow"
            >
              <div
                className="p-4 cursor-pointer"
                onClick={() =>
                  setExpandedId(expandedId === t.id ? null : t.id)
                }
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{t.name}</h3>
                    <div className="flex items-center gap-3 mt-2 text-sm text-gray-500">
                      <span>
                        {t.config.pageDimensions?.[0]}x
                        {t.config.pageDimensions?.[1]}px
                      </span>
                      <span>
                        {t.config.outputColumns?.length || '?'} questions
                      </span>
                      <span>
                        {Object.keys(t.config.fieldBlocks || {}).length} columns
                      </span>
                    </div>
                  </div>
                  {t.id === 'default' && (
                    <span className="inline-flex items-center px-2 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                      Default
                    </span>
                  )}
                </div>
              </div>

              {expandedId === t.id && (
                <div className="border-t border-gray-100 p-4 bg-gray-50">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    Field Blocks
                  </h4>
                  <div className="space-y-2 text-sm">
                    {Object.entries(t.config.fieldBlocks || {}).map(
                      ([name, block]: [string, any]) => (
                        <div
                          key={name}
                          className="flex items-center justify-between bg-white p-2 rounded border border-gray-200"
                        >
                          <span className="font-medium text-gray-700">
                            {name}
                          </span>
                          <span className="text-gray-500">
                            {block.fieldLabels?.length || '?'} questions at [
                            {block.origin?.join(', ')}]
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                  <div className="mt-3 text-xs text-gray-400">
                    Bubble size: {t.config.bubbleDimensions?.[0]}x
                    {t.config.bubbleDimensions?.[1]}px
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
