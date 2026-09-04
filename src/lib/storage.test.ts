import { beforeEach, describe, expect, it } from 'vitest'
import {
  BACKUP_KEY,
  SCHEMA_VERSION,
  STORAGE_KEY,
  clearState,
  createEmptyState,
  loadState,
  mergeStates,
  migrate,
  parseImport,
  saveState,
  toExportEnvelope,
} from './storage'

describe('storage: persistence', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('round-trips a saved state', () => {
    const state = createEmptyState(1000)
    state.topics['pods'] = { status: 'completed', completedAt: 1234 }
    state.questions['db-q01'] = {
      lastCorrect: true,
      attempts: 2,
      correctCount: 1,
      incorrectCount: 1,
      lastAnsweredAt: 5000,
    }

    expect(saveState(state)).toBe(true)
    const loaded = loadState()
    expect(loaded.topics['pods'].status).toBe('completed')
    expect(loaded.questions['db-q01'].attempts).toBe(2)
    expect(loaded.schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('returns an empty state when nothing is stored', () => {
    expect(loadState().topics).toEqual({})
  })

  it('quarantines an unparseable record instead of losing it silently', () => {
    window.localStorage.setItem(STORAGE_KEY, 'this is not json{')
    const loaded = loadState()
    expect(loaded.topics).toEqual({})
    // The corrupt payload is kept so nothing is destroyed without a copy.
    expect(window.localStorage.getItem(BACKUP_KEY)).toBe('this is not json{')
  })

  it('clearState removes only the progress key', () => {
    saveState(createEmptyState())
    window.localStorage.setItem('unrelated', 'keep me')
    clearState()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem('unrelated')).toBe('keep me')
  })
})

describe('storage: migration is non-destructive', () => {
  it('coerces an unknown shape to a valid empty state', () => {
    expect(migrate(null).topics).toEqual({})
    expect(migrate('nonsense').exams).toEqual([])
    expect(migrate(42).schemaVersion).toBe(SCHEMA_VERSION)
  })

  it('upgrades a legacy boolean topic map rather than dropping it', () => {
    const migrated = migrate({ topics: { pods: true, secrets: false } })
    expect(migrated.topics['pods'].status).toBe('completed')
    // `false` carries no information worth keeping, so it is simply absent.
    expect(migrated.topics['secrets']).toBeUndefined()
  })

  it('keeps valid records and defaults missing fields', () => {
    const migrated = migrate({
      schemaVersion: 1,
      createdAt: 100,
      theme: 'dark',
      topics: { pods: { status: 'in-progress' } },
      questions: { q1: { lastCorrect: true } },
      exams: [{ id: 'a1', scorePercent: 70, passed: true }],
      studyDays: ['2026-01-02', '2026-01-01', '2026-01-01'],
    })
    expect(migrated.createdAt).toBe(100)
    expect(migrated.theme).toBe('dark')
    expect(migrated.topics['pods'].status).toBe('in-progress')
    expect(migrated.questions['q1'].attempts).toBe(0)
    expect(migrated.exams[0].courseId).toBe('ckad')
    expect(migrated.exams[0].minutesAllowed).toBe(120)
    // Study days are deduplicated and sorted.
    expect(migrated.studyDays).toEqual(['2026-01-01', '2026-01-02'])
  })

  it('falls back to a safe theme for an invalid value', () => {
    expect(migrate({ theme: 'neon' }).theme).toBe('system')
  })

  it('discards malformed nested records without throwing', () => {
    const migrated = migrate({
      topics: { a: 'nope' },
      questions: { b: 7 },
      exams: ['not an object', { id: 'ok' }],
    })
    expect(migrated.topics).toEqual({})
    expect(migrated.questions).toEqual({})
    expect(migrated.exams).toHaveLength(1)
    expect(migrated.exams[0].id).toBe('ok')
  })
})

describe('storage: export and import', () => {
  it('exports an envelope that imports back', () => {
    const state = createEmptyState()
    state.topics['pods'] = { status: 'completed' }
    const envelope = toExportEnvelope(state)
    expect(envelope.app).toBe('devops-learning-hub')

    const result = parseImport(JSON.stringify(envelope))
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.state.topics['pods'].status).toBe('completed')
  })

  it('accepts a bare state object as well as an envelope', () => {
    const result = parseImport(JSON.stringify({ topics: { pods: { status: 'completed' } } }))
    expect(result.ok).toBe(true)
  })

  it('rejects invalid JSON with a readable message', () => {
    const result = parseImport('{ not json')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not valid JSON/i)
  })

  it('rejects a JSON file that is not a progress export', () => {
    const result = parseImport(JSON.stringify({ hello: 'world' }))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/does not look like/i)
  })
})

describe('storage: merge keeps the better result', () => {
  it('promotes a topic status but never demotes one', () => {
    const current = createEmptyState()
    current.topics['a'] = { status: 'completed' }
    current.topics['b'] = { status: 'not-started' }

    const incoming = createEmptyState()
    incoming.topics['a'] = { status: 'in-progress' }
    incoming.topics['b'] = { status: 'completed' }
    incoming.topics['c'] = { status: 'in-progress' }

    const merged = mergeStates(current, incoming)
    expect(merged.topics['a'].status).toBe('completed')
    expect(merged.topics['b'].status).toBe('completed')
    expect(merged.topics['c'].status).toBe('in-progress')
  })

  it('sums question attempt counts and takes the newest result', () => {
    const current = createEmptyState()
    current.questions['q'] = {
      lastCorrect: false,
      attempts: 2,
      correctCount: 0,
      incorrectCount: 2,
      lastAnsweredAt: 100,
    }
    const incoming = createEmptyState()
    incoming.questions['q'] = {
      lastCorrect: true,
      attempts: 1,
      correctCount: 1,
      incorrectCount: 0,
      lastAnsweredAt: 200,
    }

    const merged = mergeStates(current, incoming)
    expect(merged.questions['q'].lastCorrect).toBe(true)
    expect(merged.questions['q'].attempts).toBe(3)
    expect(merged.questions['q'].correctCount).toBe(1)
    expect(merged.questions['q'].incorrectCount).toBe(2)
  })

  it('unions exam attempts by id and unions study days', () => {
    const current = createEmptyState()
    current.exams = [{ ...createEmptyState().exams[0], ...{} } as never].slice(0, 0)
    current.studyDays = ['2026-01-01']

    const incoming = migrate({
      exams: [{ id: 'x1', submittedAt: 10 }],
      studyDays: ['2026-01-02'],
    })

    const merged = mergeStates(current, incoming)
    expect(merged.exams.map((attempt) => attempt.id)).toEqual(['x1'])
    expect(merged.studyDays).toEqual(['2026-01-01', '2026-01-02'])
  })
})
