import axios from 'axios'
import { supabase } from './supabase'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL}/api`
    : '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Attach Supabase JWT to every request
api.interceptors.request.use(async (config) => {
  if (supabase) {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    }
  }
  return config
})

// ─── Scan ────────────────────────────────────────────────────────

export async function scanUploadedImage(
  file: File,
  templateConfig?: object,
  answerKey?: Record<string, string>,
  markingScheme?: object,
  studentName?: string,
  classId?: string,
  answerKeyId?: string,
) {
  const formData = new FormData()
  formData.append('file', file)
  if (templateConfig) {
    formData.append('template_config', JSON.stringify(templateConfig))
  }
  if (answerKey) {
    formData.append('answer_key', JSON.stringify(answerKey))
  }
  if (markingScheme) {
    formData.append('marking_scheme', JSON.stringify(markingScheme))
  }
  if (studentName) {
    formData.append('student_name', studentName)
  }
  if (classId) {
    formData.append('class_id', classId)
  }
  if (answerKeyId) {
    formData.append('answer_key_id', answerKeyId)
  }
  const res = await api.post('/scan', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data
}

export async function scanCameraCapture(
  imageBase64: string,
  answerKey?: Record<string, string>,
  templateConfig?: object,
  studentName?: string,
  classId?: string,
  answerKeyId?: string,
) {
  const res = await api.post('/scan/camera', {
    image_base64: imageBase64,
    answer_key: answerKey || null,
    template_config: templateConfig || null,
    student_name: studentName || null,
    class_id: classId || null,
    answer_key_id: answerKeyId || null,
  })
  return res.data
}

// ─── Templates ───────────────────────────────────────────────────

export async function getTemplates() {
  const res = await api.get('/templates')
  return res.data
}

export async function getTemplate(id: string) {
  const res = await api.get(`/templates/${id}`)
  return res.data
}

export async function createTemplate(name: string, config: object) {
  const res = await api.post('/templates', { name, config })
  return res.data
}

// ─── Answer Keys ─────────────────────────────────────────────────

export async function getAnswerKeys(classId?: string) {
  const params = classId ? { class_id: classId } : {}
  const res = await api.get('/answer-keys', { params })
  return res.data
}

export async function getAnswerKey(id: string) {
  const res = await api.get(`/answer-keys/${id}`)
  return res.data
}

export async function createAnswerKey(
  name: string,
  answers: Record<string, string>,
  templateId?: string,
  markingScheme?: object,
  classId?: string,
  totalItems?: number,
) {
  const res = await api.post('/answer-keys', {
    name,
    answers,
    template_id: templateId || null,
    class_id: classId || null,
    marking_scheme: markingScheme || { correct: 1, incorrect: 0, unmarked: 0 },
    total_items: totalItems ?? null,
  })
  return res.data
}

export async function updateAnswerKey(
  id: string,
  name: string,
  answers: Record<string, string>,
  templateId?: string,
  markingScheme?: object,
  classId?: string,
  totalItems?: number,
) {
  const res = await api.put(`/answer-keys/${id}`, {
    name,
    answers,
    template_id: templateId || null,
    class_id: classId || null,
    marking_scheme: markingScheme || { correct: 1, incorrect: 0, unmarked: 0 },
    total_items: totalItems ?? null,
  })
  return res.data
}

export async function deleteAnswerKey(id: string) {
  const res = await api.delete(`/answer-keys/${id}`)
  return res.data
}

// ─── Classes ─────────────────────────────────────────────────────

export async function getClasses() {
  const res = await api.get('/classes')
  return res.data
}

export async function getClass(id: string) {
  const res = await api.get(`/classes/${id}`)
  return res.data
}

export async function createClass(name: string, section?: string, subject?: string, totalItems?: number) {
  const res = await api.post('/classes', { name, section, subject, total_items: totalItems ?? 100 })
  return res.data
}

export async function updateClass(id: string, name: string, section?: string, subject?: string, totalItems?: number) {
  const res = await api.put(`/classes/${id}`, { name, section, subject, total_items: totalItems ?? 100 })
  return res.data
}

export async function deleteClass(id: string) {
  const res = await api.delete(`/classes/${id}`)
  return res.data
}

// ─── Results ─────────────────────────────────────────────────────

export async function getResults(classId?: string) {
  const params = classId ? { class_id: classId } : {}
  const res = await api.get('/results', { params })
  return res.data
}

export async function getResult(id: string) {
  const res = await api.get(`/results/${id}`)
  return res.data
}

export async function deleteResult(id: string) {
  const res = await api.delete(`/results/${id}`)
  return res.data
}
