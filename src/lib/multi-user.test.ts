import { beforeEach, describe, expect, it } from 'vitest'
import {
  CLAIMED_KEY,
  STORAGE_KEY,
  adoptSharedProgress,
  clearState,
  createEmptyState,
  loadState,
  progressKey,
  saveState,
  type ProgressState,
} from './storage'
import { clearSession, writeSession } from './access'

/**
 * One browser, several learners.
 *
 * The email gate exists as much to keep two people's study records apart as to
 * keep strangers out, so these tests pin down the separation: signing in picks
 * a record, signing out puts it back untouched, and nothing one learner does
 * can appear in another's app.
 */

/*
 * ALICE is on the shipped access list, so she can hold a session. BOB is only
 * ever addressed explicitly: storage keys are derived from the address alone,
 * and deliberately do not consult the list.
 */
const ALICE = 'saichand.kanimeraka@tenetic.com'
const BOB_EMAIL = 'someone.else@tenetic.com'

const withTopic = (topicId: string): ProgressState => {
  const state = createEmptyState(1000)
  state.topics[topicId] = { status: 'completed', completedAt: 2000, lastVisitedAt: 2000 }
  state.lastVisitedTopicId = topicId
  state.studyDays = ['2026-09-16']
  return state
}

describe('progress is per signed-in address', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('keeps each address under its own key', () => {
    expect(progressKey(ALICE)).toBe(`${STORAGE_KEY}.user.${ALICE}`)
    expect(progressKey(ALICE)).not.toBe(progressKey(BOB_EMAIL))
  })

  it('treats a differently-cased address as the same person', () => {
    expect(progressKey(' Saichand.Kanimeraka@Tenetic.com ')).toBe(progressKey(ALICE))
  })

  it('falls back to the shared record when nobody is signed in', () => {
    expect(progressKey()).toBe(STORAGE_KEY)
  })

  it('follows whoever is signed in when no address is passed', () => {
    writeSession(ALICE)
    expect(progressKey()).toBe(`${STORAGE_KEY}.user.${ALICE}`)
  })

  it('does not show one learner anything the other did', () => {
    saveState(withTopic('pods'), ALICE)
    saveState(withTopic('probes'), BOB_EMAIL)

    const alice = loadState(ALICE)
    const bob = loadState(BOB_EMAIL)

    expect(alice.topics['pods'].status).toBe('completed')
    expect(alice.topics['probes']).toBeUndefined()
    expect(alice.lastVisitedTopicId).toBe('pods')

    expect(bob.topics['probes'].status).toBe('completed')
    expect(bob.topics['pods']).toBeUndefined()
    expect(bob.lastVisitedTopicId).toBe('probes')
  })

  it('starts an address that has never signed in here with an empty record', () => {
    saveState(withTopic('pods'), ALICE)

    const fresh = loadState('nobody@tenetic.com')
    expect(fresh.topics).toEqual({})
    expect(fresh.exams).toEqual([])
    expect(fresh.studyDays).toEqual([])
  })

  it('gives a learner their record back after signing out and in again', () => {
    writeSession(ALICE)
    saveState(withTopic('pods'))

    clearSession()
    expect(loadState().topics).toEqual({})

    writeSession(ALICE)
    expect(loadState().topics['pods'].status).toBe('completed')
  })

  it('leaves the other learner alone when one resets everything', () => {
    saveState(withTopic('pods'), ALICE)
    saveState(withTopic('probes'), BOB_EMAIL)

    clearState(ALICE)

    expect(loadState(ALICE).topics).toEqual({})
    expect(loadState(BOB_EMAIL).topics['probes'].status).toBe('completed')
  })

  it('keys two people on the same domain separately', () => {
    // A guard against ever keying storage on the matching list entry (here a
    // domain rule) rather than on the individual address.
    expect(progressKey('first@tenetic.com')).not.toBe(progressKey('second@tenetic.com'))
  })
})

describe('progress made before the sign-in gate existed', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('is handed to the first person who signs in', () => {
    saveState(withTopic('pods'), null)

    expect(adoptSharedProgress(ALICE)).toBe(true)
    expect(loadState(ALICE).topics['pods'].status).toBe('completed')
    expect(window.localStorage.getItem(CLAIMED_KEY)).toBe(ALICE)
  })

  it('is not handed to the second person, who starts fresh', () => {
    saveState(withTopic('pods'), null)
    adoptSharedProgress(ALICE)

    expect(adoptSharedProgress(BOB_EMAIL)).toBe(false)
    expect(loadState(BOB_EMAIL).topics).toEqual({})
  })

  it('never overwrites a record the learner already has', () => {
    saveState(withTopic('pods'), null)
    saveState(withTopic('probes'), ALICE)

    expect(adoptSharedProgress(ALICE)).toBe(false)
    expect(loadState(ALICE).topics['probes'].status).toBe('completed')
    expect(loadState(ALICE).topics['pods']).toBeUndefined()
  })

  it('does nothing on a browser that has never run the app', () => {
    expect(adoptSharedProgress(ALICE)).toBe(false)
    expect(window.localStorage.getItem(CLAIMED_KEY)).toBeNull()
  })
})
