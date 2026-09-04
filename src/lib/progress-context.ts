import { createContext } from 'react'
import type { ExamAttempt, ProgressState, ThemePreference, TopicStatus } from './storage'

export interface ProgressApi {
  state: ProgressState
  /** False in private-browsing modes where localStorage writes are rejected. */
  storageAvailable: boolean
  setTheme: (theme: ThemePreference) => void
  markTopicVisited: (topicId: string) => void
  setTopicStatus: (topicId: string, status: TopicStatus) => void
  toggleTopicCompleted: (topicId: string) => void
  recordAnswer: (questionId: string, correct: boolean) => void
  clearAnswer: (questionId: string) => void
  saveExamAttempt: (attempt: ExamAttempt) => void
  updateExamAttempt: (attemptId: string, next: ExamAttempt) => void
  deleteExamAttempt: (attemptId: string) => void
  resetAll: () => void
  replaceState: (state: ProgressState) => void
  mergeIntoState: (state: ProgressState) => void
}

export const ProgressContext = createContext<ProgressApi | null>(null)
