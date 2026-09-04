import { BrowserRouter, Route, Routes } from 'react-router-dom'
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
import { CourseDashboardRedirect } from './pages/CourseDashboardRedirect'

/**
 * The route table.
 *
 * Every course-scoped page lives under `/:courseId/...`, so installing a
 * second course is purely a content change. Static paths such as `/progress`
 * are ranked above the dynamic segment by the router, so they still win.
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
            <Route path="/:courseId" element={<CourseDashboardPage />} />
            <Route path="/:courseId/topics/:topicId" element={<TopicPage />} />
            <Route path="/:courseId/search" element={<SearchPage />} />
            <Route path="/:courseId/practice" element={<PracticePage />} />
            <Route path="/:courseId/practice/:domainId" element={<QuizPage />} />
            <Route path="/:courseId/exams" element={<ExamsPage />} />
            <Route path="/:courseId/exams/run" element={<ExamRunnerPage />} />
            <Route path="/:courseId/exams/attempts/:attemptId" element={<ExamReviewPage />} />
            <Route path="/:courseId/commands" element={<CommandsPage />} />
            {/* Convenience redirect for anyone who bookmarks the old path. */}
            <Route path="/:courseId/dashboard" element={<CourseDashboardRedirect />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <PwaUpdater />
    </ProgressProvider>
  )
}
