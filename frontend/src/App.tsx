import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuthContext } from './context/AuthContext'
import Navbar from './components/Navbar'
import LoginPage from './pages/LoginPage'
import ScanPage from './pages/ScanPage'
import AnswerKeyEditor from './pages/AnswerKeyEditor'
import InstructionsPage from './pages/InstructionsPage'
import ClassesPage from './pages/ClassesPage'
import ClassDetailPage from './pages/ClassDetailPage'
import { Loader2 } from 'lucide-react'

function ProtectedRoutes() {
  const { user, loading } = useAuthContext()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Routes>
          <Route path="/" element={<ScanPage />} />
          <Route path="/classes" element={<ClassesPage />} />
          <Route path="/classes/:id" element={<ClassDetailPage />} />
          <Route path="/answer-keys" element={<AnswerKeyEditor />} />
          <Route path="/instructions" element={<InstructionsPage />} />
          <Route path="/results" element={<Navigate to="/classes" replace />} />
          <Route path="/templates" element={<Navigate to="/instructions" replace />} />
        </Routes>
      </main>
    </div>
  )
}

function AppRoutes() {
  const { user, loading } = useAuthContext()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/" replace /> : <LoginPage />}
      />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  )
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App
