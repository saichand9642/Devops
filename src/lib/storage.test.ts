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

describe('storage: interview recall', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('starts empty on a fresh install', () => {
    expect(createEmptyState().interview).toEqual({})
  })

  it('round-trips a self-assessment', () => {
    const state = createEmptyState(1000)
    state.interview['itv-docker-1'] = { status: 'known', updatedAt: 1500 }
    state.interview['itv-k8s-4'] = { status: 'review', updatedAt: 1600 }
    expect(saveState(state)).toBe(true)

    const loaded = loadState()
    expect(loaded.interview['itv-docker-1']).toEqual({ status: 'known', updatedAt: 1500 })
    expect(loaded.interview['itv-k8s-4']).toEqual({ status: 'review', updatedAt: 1600 })
  })

  it('gives a state written before the interview section an empty map', () => {
    // Exactly what a learner who installed the app last month has stored.
    const older = migrate({
      schemaVersion: SCHEMA_VERSION,
      topics: { pods: { status: 'completed', completedAt: 10 } },
      questions: { 'db-q01': { lastCorrect: true, attempts: 1, correctCount: 1 } },
      studyDays: ['2026-01-01'],
    })

    expect(older.interview).toEqual({})
    // and nothing they had already earned was dropped on the way.
    expect(older.topics['pods'].status).toBe('completed')
    expect(older.questions['db-q01'].attempts).toBe(1)
    expect(older.studyDays).toEqual(['2026-01-01'])
  })

  it('treats an unrecognised status as needing review', () => {
    const migrated = migrate({
      interview: {
        a: { status: 'known', updatedAt: 5 },
        b: { status: 'mastered', updatedAt: 6 },
        c: { status: null, updatedAt: 7 },
      },
    })

    expect(migrated.interview['a'].status).toBe('known')
    expect(migrated.interview['b'].status).toBe('review')
    expect(migrated.interview['c'].status).toBe('review')
  })

  it('ignores malformed interview entries instead of throwing', () => {
    const migrated = migrate({ interview: { a: 'known', b: 42, c: { status: 'known' } } })
    expect(migrated.interview['a']).toBeUndefined()
    expect(migrated.interview['b']).toBeUndefined()
    expect(migrated.interview['c'].status).toBe('known')
  })

  it('survives an interview field that is not an object at all', () => {
    expect(migrate({ interview: 'nope' }).interview).toEqual({})
    expect(migrate({ interview: [1, 2] }).interview).toEqual({})
  })

  it('merges by taking the most recent self-assessment', () => {
    const current = createEmptyState()
    current.interview = {
      both: { status: 'known', updatedAt: 100 },
      'only-here': { status: 'review', updatedAt: 100 },
      newer: { status: 'known', updatedAt: 500 },
    }

    const incoming = migrate({
      interview: {
        both: { status: 'review', updatedAt: 200 },
        'only-there': { status: 'known', updatedAt: 50 },
        newer: { status: 'review', updatedAt: 300 },
      },
    })

    const merged = mergeStates(current, incoming)
    // A newer "review" must override an older "known", not the other way round.
    expect(merged.interview['both']).toEqual({ status: 'review', updatedAt: 200 })
    // A stale incoming entry loses to the newer local one.
    expect(merged.interview['newer'].status).toBe('known')
    // Entries on only one side are kept from both.
    expect(merged.interview['only-here'].status).toBe('review')
    expect(merged.interview['only-there'].status).toBe('known')
  })

  it('carries interview recall through an export and re-import', () => {
    const state = createEmptyState(1000)
    state.interview['itv-tf-2'] = { status: 'known', updatedAt: 2000 }

    const envelope = JSON.stringify(toExportEnvelope(state))
    const parsed = parseImport(envelope)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.state.interview['itv-tf-2']).toEqual({ status: 'known', updatedAt: 2000 })
  })
})
