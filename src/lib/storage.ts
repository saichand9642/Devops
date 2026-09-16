/**
 * Progress persistence.
 *
 * Everything one learner does is kept in a single versioned localStorage
 * record. Three rules drive the design:
 *
 * 1. An app update must never silently discard progress. `migrate()` only ever
 *    adds missing fields and keeps unknown ones, and a record that cannot be
 *    parsed is quarantined under a backup key rather than overwritten.
 * 2. No backend, so the record must also be exportable and importable as plain
 *    JSON.
 * 3. One record per signed-in address, so two people sharing a browser keep
 *    separate lessons, practice history and exam attempts. The address only
 *    picks the key - nothing is sent anywhere. See `progressKey()`.
 */

import { normalizeEmail, readSession } from './access'

/** The shared record, used when nobody is signed in. Also the key prefix. */
export const STORAGE_KEY = 'devops-learning-hub.progress'
export const BACKUP_KEY = 'devops-learning-hub.progress.corrupt-backup'
/** Which address, if any, has taken over the pre-sign-in shared record. */
export const CLAIMED_KEY = 'devops-learning-hub.progress.claimed-by'
/**
 * The theme, mirrored outside any one learner's record.
 *
 * The sign-in screen renders before anybody is identified, so it has no
 * progress record to read the preference from; this is what it uses instead.
 */
export const THEME_KEY = 'devops-learning-hub.theme'
export const SCHEMA_VERSION = 1

/**
 * Where one learner's record lives.
 *
 * Passing nothing uses whoever is signed in on this device; passing `null`
 * addresses the shared pre-sign-in record explicitly.
 */
export function progressKey(email?: string | null): string {
  const target = email === undefined ? readSession() : email
  return target ? `${STORAGE_KEY}.user.${normalizeEmail(target)}` : STORAGE_KEY
}

const backupKey = (email?: string | null): string => `${progressKey(email)}.corrupt-backup`

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

/**
 * Self-assessed recall for one interview question.
 *
 * Deliberately not scored like a quiz: you cannot auto-mark "explain how a
 * Deployment rolls out". The learner says whether they could answer it aloud,
 * and `review` drives the cross-topic revision queue.
 */
export type InterviewStatus = 'known' | 'review'

export interface InterviewProgress {
  status: InterviewStatus
  updatedAt: number
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
  /** interview question id -> self-assessed recall */
  interview: Record<string, InterviewProgress>
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
    interview: {},
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

  const interview: Record<string, InterviewProgress> = {}
  if (isRecord(raw.interview)) {
    for (const [id, value] of Object.entries(raw.interview)) {
      if (!isRecord(value)) continue
      // Anything that is not a known status is treated as "needs review",
      // which is the safe direction to be wrong in.
      interview[id] = {
        status: value.status === 'known' ? 'known' : 'review',
        updatedAt: asNumber(value.updatedAt, now),
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
    interview,
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

function safeRemoveItem(key: string): void {
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* nothing we can do, and nothing to report to the learner */
  }
}

/** Reads one learner's record. Omit `email` for whoever is signed in here. */
export function loadState(email?: string | null): ProgressState {
  const stored = safeGetItem(progressKey(email))
  if (!stored) return createEmptyState()
  try {
    return migrate(JSON.parse(stored) as unknown)
  } catch {
    // Keep the unreadable payload so nothing is lost, then start fresh.
    safeSetItem(backupKey(email), stored)
    return createEmptyState()
  }
}

export function saveState(state: ProgressState, email?: string | null): boolean {
  return safeSetItem(progressKey(email), JSON.stringify(state))
}

export function clearState(email?: string | null): void {
  safeRemoveItem(progressKey(email))
}

/**
 * Hands the pre-sign-in record to the first person who signs in.
 *
 * Before the email gate existed there was one shared record. Whoever had been
 * studying would otherwise open the new version, sign in, and find an empty
 * app - so the first address to sign in adopts that record, once. `CLAIMED_KEY`
 * records who took it, so the second person to sign in still starts fresh
 * rather than inheriting somebody else's history.
 *
 * Returns true when a record was adopted.
 */
export function adoptSharedProgress(email: string): boolean {
  if (!email) return false
  const key = progressKey(email)
  // Already has their own record - never overwrite it.
  if (safeGetItem(key) !== null) return false

  const shared = safeGetItem(STORAGE_KEY)
  if (shared === null) return false
  if (safeGetItem(CLAIMED_KEY) !== null) return false

  if (!safeSetItem(key, shared)) return false
  safeSetItem(CLAIMED_KEY, normalizeEmail(email))
  return true
}

/** The theme chosen most recently on this device, for the sign-in screen. */
export function readSharedTheme(): ThemePreference {
  return asTheme(safeGetItem(THEME_KEY))
}

export function writeSharedTheme(theme: ThemePreference): void {
  safeSetItem(THEME_KEY, theme)
}

/** Applies a theme preference to the document. */
export function applyTheme(theme: ThemePreference): void {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
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

  const interview: Record<string, InterviewProgress> = { ...current.interview }
  for (const [id, incomingEntry] of Object.entries(incoming.interview)) {
    const existing = interview[id]
    // Most recent self-assessment wins: it is the learner's latest opinion of
    // whether they can answer it, and an older "known" should not mask a
    // newer "review".
    if (!existing || incomingEntry.updatedAt >= existing.updatedAt) {
      interview[id] = incomingEntry
    }
  }

  const examsById = new Map(current.exams.map((attempt) => [attempt.id, attempt]))
  for (const attempt of incoming.exams) examsById.set(attempt.id, attempt)

  return {
    ...current,
    topics,
    questions,
    interview,
    exams: [...examsById.values()].sort((a, b) => b.submittedAt - a.submittedAt),
    studyDays: [...new Set([...current.studyDays, ...incoming.studyDays])].sort(),
    lastVisitedTopicId: current.lastVisitedTopicId ?? incoming.lastVisitedTopicId,
    updatedAt: Date.now(),
  }
}
