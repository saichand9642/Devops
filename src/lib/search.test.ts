import { describe, expect, it } from 'vitest'
import { buildSearchIndex, searchCourse } from './search'
import { ckadCourse } from '../content/courses'

const index = buildSearchIndex(ckadCourse)

describe('buildSearchIndex', () => {
  it('indexes topics, key objects, commands and questions', () => {
    const kinds = new Set(index.map((document) => document.kind))
    expect(kinds).toEqual(new Set(['topic', 'concept', 'command', 'question']))
  })

  it('creates one topic document per lesson', () => {
    const topics = index.filter((document) => document.kind === 'topic')
    expect(topics).toHaveLength(ckadCourse.topics.length)
  })

  it('gives every document a route', () => {
    expect(index.every((document) => document.route.startsWith('/ckad'))).toBe(true)
  })
})

describe('searchCourse', () => {
  it('finds a lesson by an exact title word', () => {
    const results = searchCourse(index, 'ingress')
    expect(results.length).toBeGreaterThan(0)
    expect(results.some((result) => result.route.includes('/topics/ingress'))).toBe(true)
  })

  it('ranks a title match above a body-only match', () => {
    const results = searchCourse(index, 'networkpolicy')
    expect(results[0].title.toLowerCase()).toContain('networkpol')
  })

  it('finds content in lesson body text, not just titles', () => {
    const results = searchCourse(index, 'oomkilled')
    expect(results.length).toBeGreaterThan(0)
  })

  it('finds a Kubernetes field name', () => {
    const results = searchCourse(index, 'readonlyrootfilesystem')
    expect(results.length).toBeGreaterThan(0)
  })

  it('requires every token to match (AND semantics)', () => {
    const both = searchCourse(index, 'readiness probe')
    expect(both.length).toBeGreaterThan(0)
    expect(searchCourse(index, 'readiness zzzznotaword')).toHaveLength(0)
  })

  it('returns nothing for a term that does not appear', () => {
    expect(searchCourse(index, 'xyzzyplughquux')).toHaveLength(0)
  })

  it('filters by domain', () => {
    const results = searchCourse(index, 'service', { domainId: 'services-networking' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((result) => result.domainId === 'services-networking')).toBe(true)
  })

  it('filters by difficulty', () => {
    const results = searchCourse(index, 'pod', { difficulty: 'beginner' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((result) => result.difficulty === 'beginner')).toBe(true)
  })

  it('filters by result kind', () => {
    const results = searchCourse(index, 'kubectl', { kind: 'command' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((result) => result.kind === 'command')).toBe(true)
  })

  it('combines filters', () => {
    const results = searchCourse(index, 'probe', {
      domainId: 'observability',
      kind: 'topic',
    })
    expect(results.every((r) => r.domainId === 'observability' && r.kind === 'topic')).toBe(true)
  })

  it('lists topics when there is no query but a filter is set', () => {
    const results = searchCourse(index, '', { domainId: 'deployment' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((result) => result.domainId === 'deployment')).toBe(true)
  })

  it('respects the result limit', () => {
    expect(searchCourse(index, 'kubectl', {}, 5)).toHaveLength(5)
  })

  it('is case insensitive', () => {
    const lower = searchCourse(index, 'configmap').map((r) => r.id)
    const upper = searchCourse(index, 'ConfigMap').map((r) => r.id)
    expect(lower).toEqual(upper)
  })
})
