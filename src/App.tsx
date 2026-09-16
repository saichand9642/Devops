import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AccessProvider } from './lib/access-provider'
import { useAccess } from './lib/use-access'
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
import { InterviewHubPage } from './pages/InterviewHubPage'
import { InterviewTopicPage } from './pages/InterviewTopicPage'
import { InterviewReviewPage } from './pages/InterviewReviewPage'
import { SignInPage } from './pages/SignInPage'

/**
 * The route table.
 *
 * Two sections sit side by side: certification courses under
 * `/:courseId/...`, and interview preparation under `/interview/...`.
 *
 * Installing another course is purely a content change. Static paths such as
 * `/progress` and `/interview` are ranked above the dynamic `:courseId`
 * segment by the router, so they win without needing to be declared first.
 *
 * `basename` comes from Vite's BASE_URL so the same build works at a domain
 * root and under a GitHub Pages repository sub-path.
 */
function Routed() {
  return (
    <>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/progress" element={<ProgressPage />} />
            <Route path="/interview" element={<InterviewHubPage />} />
            {/* Static, so it is ranked above /interview/:topicId. */}
            <Route path="/interview/review" element={<InterviewReviewPage />} />
            <Route path="/interview/:topicId" element={<InterviewTopicPage />} />
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
    </>
  )
}

/**
 * The gate, then the app.
 *
 * Nothing routed renders until somebody on the access list has signed in,
 * because the signed-in address is what selects the progress record. Keying
 * the provider on that address means switching learner tears down the old
 * provider entirely, so no part of one person's progress can survive into the
 * next person's session.
 */
function Gated() {
  const { email } = useAccess()
  if (!email) return <SignInPage />
  return (
    <ProgressProvider key={email} userEmail={email}>
      <Routed />
    </ProgressProvider>
  )
}

export function App() {
  return (
    <AccessProvider>
      <Gated />
    </AccessProvider>
  )
}
