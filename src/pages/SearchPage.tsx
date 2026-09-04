import { useDeferredValue, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useCourseIndex } from '../lib/use-course'
import type { CourseIndex } from '../content/registry'
import { UnknownCourse } from '../components/UnknownCourse'
import { buildSearchIndex, searchCourse } from '../lib/search'
import { weightBadge } from '../lib/domain-label'
import type { SearchResultKind } from '../lib/search'
import type { Course, Difficulty } from '../content/types'
import { Badge } from '../components/ui/Badge'
import { EmptyState } from '../components/ui/StateBlock'
import { RichText } from '../components/ui/RichText'

const kinds: { id: SearchResultKind | 'all'; label: string }[] = [
  { id: 'all', label: 'Everything' },
  { id: 'topic', label: 'Lessons' },
  { id: 'concept', label: 'Objects & fields' },
  { id: 'command', label: 'Commands' },
  { id: 'question', label: 'Questions' },
]

const difficulties: { id: Difficulty | 'all'; label: string }[] = [
  { id: 'all', label: 'Any level' },
  { id: 'beginner', label: 'Beginner' },
  { id: 'intermediate', label: 'Intermediate' },
  { id: 'advanced', label: 'Exam level' },
]

const kindIcon: Record<SearchResultKind, string> = {
  topic: '📚',
  concept: '🧱',
  command: '⌨️',
  question: '❓',
}

/*
 * Indexes are built once per course and cached, not once per render: the
 * content is static, and building one walks every lesson, question and
 * command in the course.
 */
const indexCache = new Map<string, ReturnType<typeof buildSearchIndex>>()

function searchIndexFor(course: Course) {
  const cached = indexCache.get(course.id)
  if (cached) return cached
  const built = buildSearchIndex(course)
  indexCache.set(course.id, built)
  return built
}

export function SearchPage() {
  const catalog = useCourseIndex()
  if (!catalog) return <UnknownCourse />
  return <SearchView catalog={catalog} />
}

function SearchView({ catalog }: { catalog: CourseIndex }) {
  const { course } = catalog
  const [params, setParams] = useSearchParams()
  const [query, setQuery] = useState(params.get('q') ?? '')
  const deferredQuery = useDeferredValue(query)

  const domainFilter = params.get('domain') ?? 'all'
  const kindFilter = (params.get('kind') as SearchResultKind | null) ?? 'all'
  const difficultyFilter = (params.get('level') as Difficulty | null) ?? 'all'

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (value === 'all' || value === '') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }

  const results = useMemo(
    () =>
      searchCourse(searchIndexFor(course), deferredQuery, {
        domainId: domainFilter === 'all' ? null : domainFilter,
        kind: kindFilter === 'all' ? null : kindFilter,
        difficulty: difficultyFilter === 'all' ? null : difficultyFilter,
      }),
    [course, deferredQuery, domainFilter, kindFilter, difficultyFilter],
  )

  const hasQuery = deferredQuery.trim().length > 0
  const activeFilters =
    (domainFilter !== 'all' ? 1 : 0) +
    (kindFilter !== 'all' ? 1 : 0) +
    (difficultyFilter !== 'all' ? 1 : 0)

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <h1>Search the course</h1>
        <p className="muted">
          Searches lesson text, Kubernetes objects and fields, every reference command, and the
          whole practice question bank. Everything is local, so it works offline.
        </p>
      </header>

      <section className="card stack" aria-labelledby="search-controls">
        <h2 id="search-controls" className="visually-hidden">
          Search and filters
        </h2>

        <div className="field">
          <label className="field__label" htmlFor="search-input">
            Search
          </label>
          <input
            id="search-input"
            className="search-input"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="probe, targetPort, OOMKilled, kubectl expose, NetworkPolicy…"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setParam('q', event.target.value)
            }}
          />
        </div>

        <div className="filter-bar filter-bar--inline">
          <div className="field">
            <label className="field__label" htmlFor="domain-filter">
              Curriculum domain
            </label>
            <select
              id="domain-filter"
              className="select"
              value={domainFilter}
              onChange={(event) => setParam('domain', event.target.value)}
            >
              <option value="all">All domains</option>
              {course.domains.map((domain) => (
                <option key={domain.id} value={domain.id}>
                  {domain.shortTitle}
                  {` (${weightBadge(domain)})`}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label className="field__label" htmlFor="level-filter">
              Difficulty
            </label>
            <select
              id="level-filter"
              className="select"
              value={difficultyFilter}
              onChange={(event) => setParam('level', event.target.value)}
            >
              {difficulties.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <span className="field__label">Result type</span>
            <div className="chip-row">
              {kinds.map((kind) => (
                <button
                  key={kind.id}
                  type="button"
                  className="chip"
                  aria-pressed={kindFilter === kind.id}
                  onClick={() => setParam('kind', kind.id)}
                >
                  {kind.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {activeFilters > 0 && (
          <div className="row">
            <span className="subtle">
              {activeFilters} filter{activeFilters === 1 ? '' : 's'} active
            </span>
            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => {
                const next = new URLSearchParams()
                if (query) next.set('q', query)
                setParams(next, { replace: true })
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>

      <section className="stack" aria-labelledby="results" aria-live="polite">
        <h2 id="results">
          {hasQuery || activeFilters > 0 ? (
            <>
              {results.length} result{results.length === 1 ? '' : 's'}
            </>
          ) : (
            'Browse lessons'
          )}
        </h2>

        {results.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="Nothing matched"
            description={
              activeFilters > 0
                ? 'Try a shorter search term, or clear the filters.'
                : 'Try a shorter or differently spelled search term. Search matches whole words and prefixes.'
            }
            action={
              <Link className="btn btn--secondary" to={course.route}>
                Browse the dashboard instead
              </Link>
            }
          />
        ) : (
          <ul className="result-list">
            {results.map((result) => (
              <li key={result.id}>
                <Link className="result" to={result.route}>
                  <div className="row" style={{ gap: '0.4rem', marginBottom: '0.2rem' }}>
                    <span aria-hidden="true">{kindIcon[result.kind]}</span>
                    <Badge>
                      {kinds.find((kind) => kind.id === result.kind)?.label ?? result.kind}
                    </Badge>
                    {result.difficulty && <Badge tone="info">{result.difficulty}</Badge>}
                  </div>
                  <div
                    className={result.kind === 'command' ? 'result__title mono' : 'result__title'}
                  >
                    {/* Command titles are literal shell text; everything else
                        is prose that may contain `code` or **bold** spans. */}
                    {result.kind === 'command' ? result.title : <RichText text={result.title} />}
                  </div>
                  <div className="result__snippet">
                    <RichText text={result.snippet} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
