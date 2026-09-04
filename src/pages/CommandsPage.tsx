import { useDeferredValue, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCourseIndex } from '../lib/use-course'
import type { CourseIndex } from '../content/registry'
import { UnknownCourse } from '../components/UnknownCourse'
import type { CommandRefEntry } from '../content/types'
import { CopyButton } from '../components/ui/CopyButton'
import { CodeBlock } from '../components/ui/CodeBlock'
import { Badge } from '../components/ui/Badge'
import { RichText } from '../components/ui/RichText'
import { EmptyState } from '../components/ui/StateBlock'

const matches = (entry: CommandRefEntry, tokens: string[]): boolean => {
  if (tokens.length === 0) return true
  const haystack = [
    entry.command,
    entry.description,
    entry.notes ?? '',
    entry.example ?? '',
    entry.tags.join(' '),
  ]
    .join(' \n ')
    .toLowerCase()
  return tokens.every((token) => haystack.includes(token))
}

/** Multi-line entries are rendered as a code block; one-liners inline. */
const isMultiline = (entry: CommandRefEntry): boolean => entry.command.includes('\n')

function CommandEntry({ entry }: { entry: CommandRefEntry }) {
  return (
    <div className="command-item" id={entry.id}>
      {isMultiline(entry) ? (
        <CodeBlock
          code={entry.command}
          language={
            entry.command.trimStart().startsWith('apiVersion') || entry.command.includes(':\n')
              ? 'yaml'
              : 'text'
          }
          title={entry.description}
        />
      ) : (
        <>
          <div className="row" style={{ alignItems: 'flex-start', gap: '0.5rem' }}>
            <code style={{ flex: '1 1 auto', minWidth: 0, overflowWrap: 'anywhere' }}>
              {entry.command}
            </code>
            <CopyButton text={entry.command} />
          </div>
          <p className="command-item__meta">
            <RichText text={entry.description} />
          </p>
        </>
      )}
      {entry.example && (
        <p className="command-item__meta">
          <strong>Example:</strong> <code>{entry.example}</code>
        </p>
      )}
      {entry.notes && (
        <p className="command-item__meta">
          <strong>Note:</strong> <RichText text={entry.notes} />
        </p>
      )}
      {entry.placeholders && entry.placeholders.length > 0 && (
        <p className="command-item__meta">
          <strong>Replace:</strong>{' '}
          {entry.placeholders.map((placeholder, index) => (
            <span key={placeholder}>
              {index > 0 && ', '}
              <code>{placeholder}</code>
            </span>
          ))}
        </p>
      )}
      <div className="row" style={{ marginTop: '0.35rem' }}>
        {entry.tags.slice(0, 5).map((tag) => (
          <Badge key={tag}>{tag}</Badge>
        ))}
      </div>
    </div>
  )
}

export function CommandsPage() {
  const catalog = useCourseIndex()
  if (!catalog) return <UnknownCourse />
  return <Commands catalog={catalog} />
}

function Commands({ catalog }: { catalog: CourseIndex }) {
  const { course } = catalog
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string>('all')
  const deferred = useDeferredValue(query)

  const tokens = useMemo(
    () =>
      deferred
        .toLowerCase()
        .split(/\s+/)
        .map((token) => token.trim())
        .filter(Boolean),
    [deferred],
  )

  const groups = useMemo(
    () =>
      course.commandGroups
        .filter((candidate) => group === 'all' || candidate.id === group)
        .map((candidate) => ({
          ...candidate,
          entries: candidate.entries.filter((entry) => matches(entry, tokens)),
        }))
        .filter((candidate) => candidate.entries.length > 0),
    [course.commandGroups, group, tokens],
  )

  const totalShown = groups.reduce((sum, candidate) => sum + candidate.entries.length, 0)
  const totalAll = course.commandGroups.reduce(
    (sum, candidate) => sum + candidate.entries.length,
    0,
  )

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <Link to={course.route}>{course.examCode}</Link>
          <span aria-hidden="true">/</span>
          <span>Command reference</span>
        </nav>
        <h1>Command reference</h1>
        <p className="muted">
          {totalAll} kubectl, Helm and Kustomize commands plus YAML templates, all with copy
          buttons. Every placeholder is written in angle brackets so you know what to replace.
        </p>
      </header>

      <section className="card stack" aria-labelledby="cmd-search">
        <h2 id="cmd-search" className="visually-hidden">
          Filter the reference
        </h2>
        <div className="field">
          <label className="field__label" htmlFor="cmd-query">
            Search commands
          </label>
          <input
            id="cmd-query"
            className="search-input"
            type="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="rollout, endpoints, jsonpath, secret, probe, helm…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="field">
          <span className="field__label">Section</span>
          <div className="chip-row">
            <button
              type="button"
              className="chip"
              aria-pressed={group === 'all'}
              onClick={() => setGroup('all')}
            >
              All
            </button>
            {course.commandGroups.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                className="chip"
                aria-pressed={group === candidate.id}
                onClick={() => setGroup(candidate.id)}
              >
                {candidate.title}
              </button>
            ))}
          </div>
        </div>
        <p className="subtle" style={{ marginBottom: 0 }} aria-live="polite">
          Showing {totalShown} of {totalAll} commands.
        </p>
      </section>

      {groups.length === 0 ? (
        <EmptyState
          icon="⌨️"
          title="No commands matched"
          description="Try a single keyword such as rollout, endpoints, secret, probe or jsonpath."
          action={
            <button type="button" className="btn btn--secondary" onClick={() => setQuery('')}>
              Clear search
            </button>
          }
        />
      ) : (
        groups.map((candidate) => (
          <section
            className="card stack"
            key={candidate.id}
            aria-labelledby={`group-${candidate.id}`}
          >
            <h2 id={`group-${candidate.id}`} className="card__title">
              {candidate.title}
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              <RichText text={candidate.description} />
            </p>
            <div>
              {candidate.entries.map((entry) => (
                <CommandEntry key={entry.id} entry={entry} />
              ))}
            </div>
          </section>
        ))
      )}

      <section className="card stack" aria-labelledby="docs-nav">
        <h2 id="docs-nav" className="card__title">
          Navigating the official documentation
        </h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          The exam allows one browser tab on kubernetes.io/docs (plus the blog, and helm.sh/docs for
          CKAD). Verify the current allowed-resources list before your exam.
        </p>
        <ul style={{ marginBottom: 0 }}>
          <li>
            Escalate your lookups: <code>kubectl explain</code> → an existing object with{' '}
            <code>-o yaml</code> → a generator with <code>--dry-run=client -o yaml</code> → the
            docs.
          </li>
          <li>
            In the docs, search the <em>object plus the action</em> - &ldquo;configure liveness
            probe&rdquo;, &ldquo;declare network policy&rdquo;, &ldquo;configure a security
            context&rdquo;.
          </li>
          <li>
            Prefer results under <code>/docs/tasks/</code>: they contain complete, copyable YAML.
            Concept pages explain rather than provide.
          </li>
          <li>
            Paste with a shell heredoc, or <code>:set paste</code> in vim, then validate with{' '}
            <code>kubectl apply -f file.yaml --dry-run=server</code>.
          </li>
        </ul>
        <div className="row">
          {course.sources.map((source) => (
            <a
              key={source.url}
              className="btn btn--secondary btn--sm"
              href={source.url}
              target="_blank"
              rel="noreferrer noopener"
            >
              {source.title}
            </a>
          ))}
        </div>
      </section>
    </div>
  )
}
