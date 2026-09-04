/**
 * Progress persistence.
 *
 * Everything the learner does is kept in a single versioned localStorage
 * record. Two rules drive the design:
 *
 * 1. An app update must never silently discard progress. `migrate()` only ever
 *    adds missing fields and keeps unknown ones, and a record that cannot be
 *    parsed is quarantined under a backup key rather than overwritten.
 * 2. No login and no backend, so the record must also be exportable and
 *    importable as plain JSON.
 */

export const STORAGE_KEY = 'devops-learning-hub.progress'
export const BACKUP_KEY = 'devops-learning-hub.progress.corrupt-backup'
export const SCHEMA_VERSION = 1

export type TopicStatus = 'not-started' | 'in-progress' | 'completed'
export type ThemePreference = 'light' | 'dark' | 'system'

export interface TopicProgress {
  status: TopicStatus
  lastVisitedAt?: number
  completedAt?: number
}

export interface QuestionProgress {
  /** Result of the most recent attempt. */
  lastCorrect: boolean
  attempts: number
  correctCount: number
  incorrectCount: number
  lastAnsweredAt: number
}

export interface ExamAnswerRecord {
  questionId: string
  domainId: string
  /** What the learner submitted: option ids, a command string, or checkpoint ids. */
  response: string[]
  earned: number
  total: number
  /** null for self-verified task questions that were left unconfirmed. */
  correct: boolean | null
}

export interface ExamAttempt {
  id: string
  courseId: string
  label: string
  startedAt: number
  submittedAt: number
  /** Seconds actually spent, which may be less than the allowance. */
  elapsedSeconds: number
  minutesAllowed: number
  earnedPoints: number
  totalPoints: number
  scorePercent: number
  passingScore: number
  passed: boolean
  byDomain: Record<string, { earned: number; total: number }>
  answers: ExamAnswerRecord[]
}

export interface ProgressState {
  schemaVersion: number
  createdAt: number
  updatedAt: number
  theme: ThemePreference
  /** topic id -> progress */
  topics: Record<string, TopicProgress>
  /** question id -> practice history */
  questions: Record<string, QuestionProgress>
  /** Newest first. */
  exams: ExamAttempt[]
  lastVisitedTopicId?: string
  /** ISO date (YYYY-MM-DD) strings on which the learner opened a lesson. */
  studyDays: string[]
}

export function createEmptyState(now = Date.now()): ProgressState {
  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: now,
    updatedAt: now,
    theme: 'system',
    topics: {},
    questions: {},
    exams: [],
    studyDays: [],
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const asNumber = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const asTheme = (value: unknown): ThemePreference =>
  value === 'light' || value === 'dark' || value === 'system' ? value : 'system'

const asStatus = (value: unknown): TopicStatus =>
  value === 'completed' || value === 'in-progress' || value === 'not-started'
    ? value
    : 'not-started'

/**
 * Brings any previously stored record up to the current schema.
 *
 * Written defensively on purpose: a learner who has been using an older
 * deployment for weeks must not lose their history because one field moved.
 * Anything unrecognised is dropped only if it cannot be coerced, and known
 * fields always fall back to a safe default instead of throwing.
 */
export function migrate(raw: unknown, now = Date.now()): ProgressState {
  const empty = createEmptyState(now)
  if (!isRecord(raw)) return empty

  const topics: Record<string, TopicProgress> = {}
  if (isRecord(raw.topics)) {
    for (const [id, value] of Object.entries(raw.topics)) {
      if (!isRecord(value)) {
        // Tolerate an older boolean-only shape: { "pods": true }
        if (value === true) topics[id] = { status: 'completed', completedAt: now }
        continue
      }
      topics[id] = {
        status: asStatus(value.status),
        ...(typeof value.lastVisitedAt === 'number'
          ? { lastVisitedAt: value.lastVisitedAt }
          : undefined),
        ...(typeof value.completedAt === 'number' ? { completedAt: value.completedAt } : undefined),
      }
    }
  }

  const questions: Record<string, QuestionProgress> = {}
  if (isRecord(raw.questions)) {
    for (const [id, value] of Object.entries(raw.questions)) {
      if (!isRecord(value)) continue
      questions[id] = {
        lastCorrect: value.lastCorrect === true,
        attempts: asNumber(value.attempts, 0),
        correctCount: asNumber(value.correctCount, 0),
        incorrectCount: asNumber(value.incorrectCount, 0),
        lastAnsweredAt: asNumber(value.lastAnsweredAt, now),
      }
    }
  }

  const exams: ExamAttempt[] = Array.isArray(raw.exams)
    ? raw.exams.filter(isRecord).map((attempt) => ({
        id:
          typeof attempt.id === 'string'
            ? attempt.id
            : `attempt-${Math.random().toString(36).slice(2)}`,
        courseId: typeof attempt.courseId === 'string' ? attempt.courseId : 'ckad',
        label: typeof attempt.label === 'string' ? attempt.label : 'Mock exam',
        startedAt: asNumber(attempt.startedAt, now),
        submittedAt: asNumber(attempt.submittedAt, now),
        elapsedSeconds: asNumber(attempt.elapsedSeconds, 0),
        minutesAllowed: asNumber(attempt.minutesAllowed, 120),
        earnedPoints: asNumber(attempt.earnedPoints, 0),
        totalPoints: asNumber(attempt.totalPoints, 0),
        scorePercent: asNumber(attempt.scorePercent, 0),
        passingScore: asNumber(attempt.passingScore, 66),
        passed: attempt.passed === true,
        byDomain: isRecord(attempt.byDomain)
          ? Object.fromEntries(
              Object.entries(attempt.byDomain)
                .filter((entry): entry is [string, Record<string, unknown>] => isRecord(entry[1]))
                .map(([domainId, value]) => [
                  domainId,
                  { earned: asNumber(value.earned, 0), total: asNumber(value.total, 0) },
                ]),
            )
          : {},
        answers: Array.isArray(attempt.answers)
          ? attempt.answers.filter(isRecord).map((answer) => ({
              questionId: typeof answer.questionId === 'string' ? answer.questionId : '',
              domainId: typeof answer.domainId === 'string' ? answer.domainId : '',
              response: Array.isArray(answer.response)
                ? answer.response.filter((item): item is string => typeof item === 'string')
                : [],
              earned: asNumber(answer.earned, 0),
              total: asNumber(answer.total, 0),
              correct: typeof answer.correct === 'boolean' ? answer.correct : null,
            }))
          : [],
      }))
    : []

  return {
    schemaVersion: SCHEMA_VERSION,
    createdAt: asNumber(raw.createdAt, now),
    updatedAt: asNumber(raw.updatedAt, now),
    theme: asTheme(raw.theme),
    topics,
    questions,
    exams,
    ...(typeof raw.lastVisitedTopicId === 'string'
      ? { lastVisitedTopicId: raw.lastVisitedTopicId }
      : undefined),
    studyDays: Array.isArray(raw.studyDays)
      ? [...new Set(raw.studyDays.filter((day): day is string => typeof day === 'string'))].sort()
      : empty.studyDays,
  }
}

/** localStorage can throw in private browsing modes, so every access is guarded. */
function safeGetItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSetItem(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

export function loadState(): ProgressState {
  const stored = safeGetItem(STORAGE_KEY)
  if (!stored) return createEmptyState()
  try {
    return migrate(JSON.parse(stored) as unknown)
  } catch {
    // Keep the unreadable payload so nothing is lost, then start fresh.
    safeSetItem(BACKUP_KEY, stored)
    return createEmptyState()
  }
}

export function saveState(state: ProgressState): boolean {
  return safeSetItem(STORAGE_KEY, JSON.stringify(state))
}

export function clearState(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* nothing we can do, and nothing to report to the learner */
  }
}

export interface ExportEnvelope {
  app: 'devops-learning-hub'
  schemaVersion: number
  exportedAt: string
  state: ProgressState
}

export function toExportEnvelope(state: ProgressState): ExportEnvelope {
  return {
    app: 'devops-learning-hub',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    state,
  }
}

export type ImportResult = { ok: true; state: ProgressState } | { ok: false; error: string }

/**
 * Accepts either a full export envelope or a bare state object, so a file
 * hand-edited by the learner still imports.
 */
export function parseImport(text: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  if (!isRecord(parsed)) {
    return { ok: false, error: 'Expected a JSON object at the top level of the file.' }
  }
  const candidate = isRecord(parsed.state) ? parsed.state : parsed
  if (!isRecord(candidate.topics) && !Array.isArray(candidate.exams)) {
    return {
      ok: false,
      error: 'This does not look like a DevOps Learning Hub export (no topics or exams found).',
    }
  }
  return { ok: true, state: migrate(candidate) }
}

/** Merges an imported record into the current one, keeping the better result. */
export function mergeStates(current: ProgressState, incoming: ProgressState): ProgressState {
  const topics: Record<string, TopicProgress> = { ...current.topics }
  for (const [id, incomingTopic] of Object.entries(incoming.topics)) {
    const existing = topics[id]
    if (!existing) {
      topics[id] = incomingTopic
      continue
    }
    const rank = { 'not-started': 0, 'in-progress': 1, completed: 2 } as const
    topics[id] = rank[incomingTopic.status] > rank[existing.status] ? incomingTopic : existing
  }

  const questions: Record<string, QuestionProgress> = { ...current.questions }
  for (const [id, incomingQuestion] of Object.entries(incoming.questions)) {
    const existing = questions[id]
    if (!existing) {
      questions[id] = incomingQuestion
      continue
    }
    questions[id] =
      incomingQuestion.lastAnsweredAt >= existing.lastAnsweredAt
        ? {
            ...incomingQuestion,
            attempts: existing.attempts + incomingQuestion.attempts,
            correctCount: existing.correctCount + incomingQuestion.correctCount,
            incorrectCount: existing.incorrectCount + incomingQuestion.incorrectCount,
          }
        : {
            ...existing,
            attempts: existing.attempts + incomingQuestion.attempts,
            correctCount: existing.correctCount + incomingQuestion.correctCount,
            incorrectCount: existing.incorrectCount + incomingQuestion.incorrectCount,
          }
  }

  const examsById = new Map(current.exams.map((attempt) => [attempt.id, attempt]))
  for (const attempt of incoming.exams) examsById.set(attempt.id, attempt)

  return {
    ...current,
    topics,
    questions,
    exams: [...examsById.values()].sort((a, b) => b.submittedAt - a.submittedAt),
    studyDays: [...new Set([...current.studyDays, ...incoming.studyDays])].sort(),
    lastVisitedTopicId: current.lastVisitedTopicId ?? incoming.lastVisitedTopicId,
    updatedAt: Date.now(),
  }
}
