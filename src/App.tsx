import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import JobBoard from './pages/JobBoard'
import LearningHub from './pages/LearningHub'
import LifeShift from './pages/LifeShift'
import KnowledgeBase from './pages/KnowledgeBase'
import './index.css'

const queryClient = new QueryClient()

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<JobBoard />} />
          <Route path="/learn" element={<LearningHub />} />
          <Route path="/schedule" element={<LifeShift />} />
          <Route path="/knowledge" element={<KnowledgeBase />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
