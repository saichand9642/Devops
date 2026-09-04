import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ProgressProvider } from './lib/progress-provider'
import { AppShell } from './components/layout/AppShell'
import { PwaUpdater } from './components/PwaUpdater'
import { HomePage } from './pages/HomePage'
import { CourseDashboardPage } from './pages/CourseDashboardPage'
import { TopicPage } from './pages/TopicPage'
import { SearchPage } from './pages/SearchPage'
import { PracticePage } from './pages/PracticePage'
import { QuizPage } from './pages/QuizPage'
import { ExamsPage } from './pages/ExamsPage'
import { ExamRunnerPage } from './pages/ExamRunnerPage'
import { ExamReviewPage } from './pages/ExamReviewPage'
import { CommandsPage } from './pages/CommandsPage'
import { ProgressPage } from './pages/ProgressPage'
import { NotFoundPage } from './pages/NotFoundPage'

/**
 * The route table.
 *
 * Routes are namespaced under the course id (`/ckad/...`) so a second course
 * can be added later without touching any of these paths.
 *
 * `basename` comes from Vite's BASE_URL so the same build works at a domain
 * root and under a GitHub Pages repository sub-path.
 */
export function App() {
  return (
    <ProgressProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/ckad" element={<CourseDashboardPage />} />
            <Route path="/ckad/topics/:topicId" element={<TopicPage />} />
            <Route path="/ckad/search" element={<SearchPage />} />
            <Route path="/ckad/practice" element={<PracticePage />} />
            <Route path="/ckad/practice/:domainId" element={<QuizPage />} />
            <Route path="/ckad/exams" element={<ExamsPage />} />
            <Route path="/ckad/exams/run" element={<ExamRunnerPage />} />
            <Route path="/ckad/exams/attempts/:attemptId" element={<ExamReviewPage />} />
            <Route path="/ckad/commands" element={<CommandsPage />} />
            {/* Convenience redirect for anyone who bookmarks the old path. */}
            <Route path="/ckad/dashboard" element={<Navigate to="/ckad" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <PwaUpdater />
    </ProgressProvider>
  )
}
