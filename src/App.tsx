import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Jobs from './pages/Jobs'
import JobsKanban from './pages/JobsKanban'
import LearningHub from './pages/LearningHub'
import Learning from './pages/Learning'
import StudyGuide from './pages/StudyGuide'
import QuizTaking from './pages/QuizTaking'
import QuizResults from './pages/QuizResults'
import VoiceQuizPage from './pages/VoiceQuizPage'
import DailyReviews from './pages/DailyReviews'
import LifeShift from './pages/LifeShift'
import TaskBoard from './pages/TaskBoard'
import Setup from './pages/Setup'
import Activity from './pages/Activity'
import Talk from './pages/Talk'
import Topic from './pages/Topic'
import Document from './pages/Document'
import './index.css'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/setup"
              element={
                <ProtectedRoute>
                  <Setup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/tasks"
              element={
                <ProtectedRoute>
                  <TaskBoard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs"
              element={
                <ProtectedRoute>
                  <Jobs />
                </ProtectedRoute>
              }
            />
            <Route
              path="/jobs/kanban"
              element={
                <ProtectedRoute>
                  <JobsKanban />
                </ProtectedRoute>
              }
            />
            <Route path="/learn" element={<Navigate to="/learning" replace />} />
            <Route
              path="/learning-hub"
              element={
                <ProtectedRoute>
                  <LearningHub />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learning"
              element={
                <ProtectedRoute>
                  <Learning />
                </ProtectedRoute>
              }
            />
            <Route
              path="/study-guide/:id"
              element={
                <ProtectedRoute>
                  <StudyGuide />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/:quizId"
              element={
                <ProtectedRoute>
                  <QuizTaking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quiz/results/:quizId"
              element={
                <ProtectedRoute>
                  <QuizResults />
                </ProtectedRoute>
              }
            />
            <Route
              path="/voice-quiz"
              element={
                <ProtectedRoute>
                  <VoiceQuizPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reviews"
              element={
                <ProtectedRoute>
                  <DailyReviews />
                </ProtectedRoute>
              }
            />
            <Route
              path="/schedule"
              element={
                <ProtectedRoute>
                  <LifeShift />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <Activity />
                </ProtectedRoute>
              }
            />
            <Route path="/activity" element={<Navigate to="/history" replace />} />
            <Route
              path="/talk"
              element={
                <ProtectedRoute>
                  <Talk />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn/doc/:id"
              element={
                <ProtectedRoute>
                  <Document />
                </ProtectedRoute>
              }
            />
            <Route
              path="/learn/topic/:key"
              element={
                <ProtectedRoute>
                  <Topic />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
