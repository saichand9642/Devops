import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  applyTheme,
  createEmptyState,
  loadState,
  mergeStates,
  saveState,
  clearState,
  writeSharedTheme,
  type ExamAttempt,
  type InterviewStatus,
  type ProgressState,
  type ThemePreference,
  type TopicStatus,
} from './storage'
import { ProgressContext, type ProgressApi } from './progress-context'

const todayIso = (): string => new Date().toISOString().slice(0, 10)

/**
 * Holds one learner's progress.
 *
 * `userEmail` chooses which stored record this instance reads and writes, so
 * two people sharing a browser never see each other's lessons, practice
 * history or exam attempts. It is expected to be mounted with a `key` of the
 * same address: changing learner then re-creates the provider and re-reads
 * from scratch rather than carrying the previous record in memory.
 */
export function ProgressProvider({
  userEmail = null,
  children,
}: {
  userEmail?: string | null
  children: ReactNode
}) {
  const [state, setState] = useState<ProgressState>(() => loadState(userEmail))
  const [storageAvailable, setStorageAvailable] = useState(true)
  // The first render must not immediately write back what we just read.
  const hydrated = useRef(false)
  // Actions must not close over `state`, or their identity would change on
  // every update and any effect depending on them would loop. Where an action
  // genuinely needs the current value, it reads this ref instead.
  const latest = useRef(state)
  latest.current = state

  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    setStorageAvailable(saveState(state, userEmail))
  }, [state, userEmail])

  // Keep the document theme attribute in sync with the stored preference, and
  // mirror it outside the record so the sign-in screen - which renders before
  // any learner is known - can use the same appearance.
  useEffect(() => {
    applyTheme(state.theme)
    writeSharedTheme(state.theme)
  }, [state.theme])

  /** Every mutation goes through here, which is stable for the app's lifetime. */
  const update = useCallback((updater: (previous: ProgressState) => ProgressState) => {
    setState((previous) => ({ ...updater(previous), updatedAt: Date.now() }))
  }, [])

  const setTheme = useCallback(
    (theme: ThemePreference) => update((previous) => ({ ...previous, theme })),
    [update],
  )

  const markTopicVisited = useCallback(
    (topicId: string) =>
      update((previous) => {
        const existing = previous.topics[topicId]
        const day = todayIso()
        return {
          ...previous,
          lastVisitedTopicId: topicId,
          studyDays: previous.studyDays.includes(day)
            ? previous.studyDays
            : [...previous.studyDays, day],
          topics: {
            ...previous.topics,
            [topicId]: {
              status: existing?.status === 'completed' ? 'completed' : 'in-progress',
              completedAt: existing?.completedAt,
              lastVisitedAt: Date.now(),
            },
          },
        }
      }),
    [update],
  )

  const setTopicStatus = useCallback(
    (topicId: string, status: TopicStatus) =>
      update((previous) => ({
        ...previous,
        topics: {
          ...previous.topics,
          [topicId]: {
            status,
            lastVisitedAt: previous.topics[topicId]?.lastVisitedAt ?? Date.now(),
            completedAt: status === 'completed' ? Date.now() : undefined,
          },
        },
      })),
    [update],
  )

  const toggleTopicCompleted = useCallback(
    (topicId: string) =>
      update((previous) => {
        const wasCompleted = previous.topics[topicId]?.status === 'completed'
        return {
          ...previous,
          topics: {
            ...previous.topics,
            [topicId]: {
              status: wasCompleted ? 'in-progress' : 'completed',
              lastVisitedAt: previous.topics[topicId]?.lastVisitedAt ?? Date.now(),
              completedAt: wasCompleted ? undefined : Date.now(),
            },
          },
        }
      }),
    [update],
  )

  const recordAnswer = useCallback(
    (questionId: string, correct: boolean) =>
      update((previous) => {
        const existing = previous.questions[questionId]
        return {
          ...previous,
          questions: {
            ...previous.questions,
            [questionId]: {
              lastCorrect: correct,
              attempts: (existing?.attempts ?? 0) + 1,
              correctCount: (existing?.correctCount ?? 0) + (correct ? 1 : 0),
              incorrectCount: (existing?.incorrectCount ?? 0) + (correct ? 0 : 1),
              lastAnsweredAt: Date.now(),
            },
          },
        }
      }),
    [update],
  )

  const clearAnswer = useCallback(
    (questionId: string) =>
      update((previous) => {
        const questions = { ...previous.questions }
        delete questions[questionId]
        return { ...previous, questions }
      }),
    [update],
  )

  const setInterviewStatus = useCallback(
    (questionId: string, status: InterviewStatus | null) =>
      update((previous) => {
        const interview = { ...previous.interview }
        if (status === null) delete interview[questionId]
        else interview[questionId] = { status, updatedAt: Date.now() }
        return { ...previous, interview }
      }),
    [update],
  )

  const saveExamAttempt = useCallback(
    (attempt: ExamAttempt) =>
      update((previous) => ({
        ...previous,
        exams: [attempt, ...previous.exams.filter((existing) => existing.id !== attempt.id)].slice(
          0,
          50,
        ),
      })),
    [update],
  )

  const updateExamAttempt = useCallback(
    (attemptId: string, next: ExamAttempt) =>
      update((previous) => ({
        ...previous,
        exams: previous.exams.map((attempt) => (attempt.id === attemptId ? next : attempt)),
      })),
    [update],
  )

  const deleteExamAttempt = useCallback(
    (attemptId: string) =>
      update((previous) => ({
        ...previous,
        exams: previous.exams.filter((attempt) => attempt.id !== attemptId),
      })),
    [update],
  )

  const resetAll = useCallback(() => {
    clearState(userEmail)
    // The theme is a display preference, not progress, so it survives a reset.
    setState({ ...createEmptyState(), theme: latest.current.theme })
  }, [userEmail])

  const replaceState = useCallback(
    (next: ProgressState) => update(() => ({ ...next, theme: latest.current.theme })),
    [update],
  )

  const mergeIntoState = useCallback(
    (incoming: ProgressState) => update((previous) => mergeStates(previous, incoming)),
    [update],
  )

  const api = useMemo<ProgressApi>(
    () => ({
      state,
      storageAvailable,
      setTheme,
      markTopicVisited,
      setTopicStatus,
      toggleTopicCompleted,
      recordAnswer,
      clearAnswer,
      setInterviewStatus,
      saveExamAttempt,
      updateExamAttempt,
      deleteExamAttempt,
      resetAll,
      replaceState,
      mergeIntoState,
    }),
    [
      state,
      storageAvailable,
      setTheme,
      markTopicVisited,
      setTopicStatus,
      toggleTopicCompleted,
      recordAnswer,
      clearAnswer,
      setInterviewStatus,
      saveExamAttempt,
      updateExamAttempt,
      deleteExamAttempt,
      resetAll,
      replaceState,
      mergeIntoState,
    ],
  )

  return <ProgressContext.Provider value={api}>{children}</ProgressContext.Provider>
}
