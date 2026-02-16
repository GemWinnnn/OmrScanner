import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  GraduationCap,
  Plus,
  Trash2,
  Loader2,
  BookOpen,
  ChevronRight,
} from 'lucide-react'
import { getClasses, createClass, deleteClass } from '../lib/api'

interface ClassData {
  id: string
  name: string
  section: string | null
  subject: string | null
  total_items: number
  created_at: string | null
}

export default function ClassesPage() {
  const navigate = useNavigate()
  const [classes, setClasses] = useState<ClassData[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)

  // Form state
  const [name, setName] = useState('')
  const [section, setSection] = useState('')
  const [subject, setSubject] = useState('')
  const [totalItems, setTotalItems] = useState(100)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    loadClasses()
  }, [])

  async function loadClasses() {
    try {
      const data = await getClasses()
      setClasses(data)
    } catch {
      // ok
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    // Validate required fields
    if (!name.trim()) { setFormError('Class name is required.'); return }
    if (!subject.trim()) { setFormError('Subject is required.'); return }
    if (!totalItems || totalItems < 1 || totalItems > 100) { setFormError('Total items must be between 1 and 100.'); return }
    setFormError('')
    setCreating(true)
    try {
      const newClass = await createClass(name.trim(), section.trim() || undefined, subject.trim(), totalItems)
      setName('')
      setSection('')
      setSubject('')
      setTotalItems(100)
      setShowForm(false)
      // Navigate to the new class so the teacher can create an answer key right away
      if (newClass?.id) {
        navigate(`/classes/${newClass.id}`)
      } else {
        await loadClasses()
      }
    } catch {
      // ok
    } finally {
      setCreating(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this class? All linked answer keys and results will be unlinked.')) return
    try {
      await deleteClass(id)
      await loadClasses()
    } catch {
      // ok
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Classes</h1>
          <p className="text-gray-500 mt-1 text-sm sm:text-base">
            Create and manage your classes, answer keys, and student grades
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors w-full sm:w-auto"
        >
          <Plus className="h-4 w-4" />
          New Class
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New Class</h3>
          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {formError}
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Class Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setFormError('') }}
                placeholder="e.g. Mathematics 101"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subject *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setFormError('') }}
                placeholder="e.g. Algebra"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Section
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. Section A"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Total Items *
              </label>
              <input
                type="number"
                min={1}
                max={100}
                value={totalItems || ''}
                onChange={(e) => {
                  const parsed = parseInt(e.target.value)
                  setTotalItems(isNaN(parsed) ? 0 : Math.min(100, parsed))
                  setFormError('')
                }}
                onBlur={() => { if (totalItems < 1) setTotalItems(1) }}
                placeholder="e.g. 50"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleCreate}
              disabled={creating || !name.trim() || !subject.trim()}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {creating ? 'Creating...' : 'Create Class'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Classes List */}
      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto" />
          <p className="text-gray-500 mt-3">Loading classes...</p>
        </div>
      ) : classes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <GraduationCap className="h-12 w-12 text-gray-300 mx-auto" />
          <h3 className="text-lg font-semibold text-gray-900 mt-4">No Classes Yet</h3>
          <p className="text-gray-500 mt-1">
            Create your first class to get started
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {classes.map((cls) => (
            <div
              key={cls.id}
              className="bg-white rounded-xl border border-gray-200 hover:border-indigo-200 hover:shadow-md transition-all group"
            >
              <Link to={`/classes/${cls.id}`} className="block p-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                        {cls.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        {cls.subject && (
                          <span className="text-xs text-gray-500">{cls.subject}</span>
                        )}
                        {cls.subject && cls.section && (
                          <span className="text-xs text-gray-300">|</span>
                        )}
                        {cls.section && (
                          <span className="text-xs text-gray-500">{cls.section}</span>
                        )}
                        <span className="text-xs text-gray-300">|</span>
                        <span className="text-xs text-gray-500">{cls.total_items} items</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
                </div>
                {cls.created_at && (
                  <p className="text-xs text-gray-400 mt-3">
                    Created {new Date(cls.created_at).toLocaleDateString()}
                  </p>
                )}
              </Link>
              <div className="border-t border-gray-100 px-5 py-2 flex justify-end">
                <button
                  onClick={(e) => {
                    e.preventDefault()
                    handleDelete(cls.id)
                  }}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                  title="Delete class"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
