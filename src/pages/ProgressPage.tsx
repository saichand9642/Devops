import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { courseIdForTopic, courseIndex, courseIndexes } from '../content/registry'
import { useProgress } from '../lib/use-progress'
import { useAccess } from '../lib/use-access'
import { courseCompletion, domainStats, practiceStats, studyStreak } from '../lib/stats'
import { parseImport, toExportEnvelope } from '../lib/storage'
import { weightBadge } from '../lib/domain-label'
import { readFileAsText } from '../lib/read-file'
import { storageMayBeEvicted } from '../lib/install-state'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Badge } from '../components/ui/Badge'

type Notice = { tone: 'success' | 'danger' | 'info'; text: string } | null

export function ProgressPage() {
  const { state, storageAvailable, resetAll, replaceState, mergeIntoState, setTheme } =
    useProgress()
  const { email, signOut } = useAccess()
  const fileInput = useRef<HTMLInputElement>(null)
  const [notice, setNotice] = useState<Notice>(null)
  const [pendingImport, setPendingImport] = useState<ReturnType<typeof parseImport> | null>(null)

  /* Every figure on this page spans all installed courses. */
  const perCourse = courseIndexes.map((entry) => ({
    course: entry.course,
    completion: courseCompletion(entry.course, state),
    practice: practiceStats(entry.course, state),
    domains: domainStats(entry.course, state),
    attempts: state.exams.filter((attempt) => attempt.courseId === entry.course.id),
  }))
  const completed = perCourse.reduce((sum, item) => sum + item.completion.completed, 0)
  const total = perCourse.reduce((sum, item) => sum + item.completion.total, 0)
  const completion = {
    completed,
    total,
    percent: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
  const practice = {
    answered: perCourse.reduce((sum, item) => sum + item.practice.answered, 0),
  }
  const streak = studyStreak(state)
  const attempts = state.exams

  /* Where this learner left off, resolved back to a lesson they can reopen. */
  const currentTopicId = state.lastVisitedTopicId
  const currentCourse = currentTopicId ? courseIndex(courseIdForTopic(currentTopicId)) : undefined
  const currentTopic = currentTopicId ? currentCourse?.topicById.get(currentTopicId) : undefined

  const exportProgress = () => {
    const envelope = toExportEnvelope(state)
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `devops-learning-hub-progress-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    setNotice({ tone: 'success', text: 'Progress exported as a JSON file.' })
  }

  const onFile = async (file: File) => {
    let text: string
    try {
      text = await readFileAsText(file)
    } catch {
      setNotice({ tone: 'danger', text: 'That file could not be read by this browser.' })
      setPendingImport(null)
      return
    }
    const result = parseImport(text)
    if (!result.ok) {
      setNotice({ tone: 'danger', text: result.error })
      setPendingImport(null)
      return
    }
    setPendingImport(result)
    setNotice({
      tone: 'info',
      text: `File read successfully: ${Object.keys(result.state.topics).length} lesson records, ${
        Object.keys(result.state.questions).length
      } question records, ${result.state.exams.length} exam attempt(s). Choose merge or replace below.`,
    })
  }

  const applyImport = (mode: 'merge' | 'replace') => {
    if (!pendingImport?.ok) return
    if (mode === 'replace') {
      if (
        !window.confirm(
          'Replace all current progress with the imported file? Your existing lesson, practice and exam records will be discarded.',
        )
      ) {
        return
      }
      replaceState(pendingImport.state)
    } else {
      mergeIntoState(pendingImport.state)
    }
    setPendingImport(null)
    setNotice({
      tone: 'success',
      text:
        mode === 'replace'
          ? 'Progress replaced from the imported file.'
          : 'Imported progress merged into your existing records.',
    })
  }

  const doReset = () => {
    if (
      !window.confirm(
        'Reset ALL progress? This deletes every lesson completion, practice answer and exam attempt stored on this device. This cannot be undone. Export first if you want a backup.',
      )
    ) {
      return
    }
    if (!window.confirm('Are you certain? This is the last confirmation.')) return
    resetAll()
    setNotice({
      tone: 'success',
      text: 'All progress has been reset. Your theme preference was kept.',
    })
  }

  return (
    <div className="page stack-lg">
      <header className="page-header">
        <nav className="breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span>Progress &amp; data</span>
        </nav>
        <h1>Progress &amp; data</h1>
        <p className="muted">
          Everything is stored in this browser on this device only, under the email address you
          signed in with. There is no server, so your progress stays here across refreshes and
          updates - and a different phone, laptop or browser starts fresh, showing nothing of what
          you have done here, even with the same address. Use export and import below to move it
          deliberately.
        </p>
      </header>

      {!storageAvailable && (
        <div className="notice notice--danger" role="alert">
          <span className="notice__icon" aria-hidden="true">
            ⚠️
          </span>
          <div>
            <strong>Progress cannot be saved in this browser.</strong> Local storage is unavailable
            or full - private browsing mode is the usual cause. You can still use the app, but
            nothing will persist when you close the tab.
          </div>
        </div>
      )}

      {storageAvailable && storageMayBeEvicted() && (
        <div className="notice notice--warning">
          <span className="notice__icon" aria-hidden="true">
            📲
          </span>
          <div>
            <strong>Add this to your Home Screen to keep your progress.</strong> In a Safari tab,
            iOS deletes a site&rsquo;s saved data after about seven days without opening it - so a
            gap between study sessions would clear everything here. Tap the Share button, then{' '}
            <strong>Add to Home Screen</strong>. Installed, it is exempt and your progress stays
            put.
          </div>
        </div>
      )}

      {notice && (
        <div
          className={`notice notice--${notice.tone === 'info' ? 'info' : notice.tone}`}
          role="status"
        >
          <span className="notice__icon" aria-hidden="true">
            {notice.tone === 'danger' ? '⚠️' : notice.tone === 'success' ? '✓' : 'ℹ️'}
          </span>
          <div>{notice.text}</div>
        </div>
      )}

      <section className="card stack" aria-labelledby="account">
        <h2 id="account" className="card__title">
          Signed in
        </h2>
        <p className="muted">
          Everything on this page belongs to <strong className="mono">{email}</strong>. Signing out
          leaves it untouched: sign back in with the same address on this device and it all returns,
          while somebody else signing in here gets their own separate record.
        </p>
        <dl className="account-summary">
          <div>
            <dt>Lessons completed</dt>
            <dd>
              {completion.completed} of {completion.total}
            </dd>
          </div>
          <div>
            <dt>Currently on</dt>
            <dd>
              {currentTopic && currentCourse ? (
                <Link to={`${currentCourse.course.route}/topics/${currentTopic.id}`}>
                  {currentTopic.title}
                </Link>
              ) : (
                'Not started yet'
              )}
            </dd>
          </div>
        </dl>
        <div className="row">
          <button type="button" className="btn btn--secondary" onClick={signOut}>
            Sign out
          </button>
        </div>
      </section>

      <section className="card stack" aria-labelledby="summary">
        <h2 id="summary" className="card__title">
          Summary
        </h2>
        <div className="stat-grid">
          <div className="stat">
            <div className="stat__value">{completion.completed}</div>
            <div className="stat__label">Lessons completed of {completion.total}</div>
          </div>
          <div className="stat">
            <div className="stat__value">{practice.answered}</div>
            <div className="stat__label">Practice questions answered</div>
          </div>
          <div className="stat">
            <div className="stat__value">{attempts.length}</div>
            <div className="stat__label">Mock exam attempts</div>
          </div>
          <div className="stat">
            <div className="stat__value">{streak}</div>
            <div className="stat__label">Day study streak</div>
          </div>
        </div>
        <ProgressBar
          value={completion.percent}
          label="Overall completion across all courses"
          showValue
          large
          tone={completion.percent === 100 ? 'success' : 'primary'}
        />
        <p className="subtle" style={{ marginBottom: 0 }}>
          First saved {new Date(state.createdAt).toLocaleDateString()} · last updated{' '}
          {new Date(state.updatedAt).toLocaleString()} · schema v{state.schemaVersion}
        </p>
      </section>

      <section className="card stack" aria-labelledby="per-domain">
        <h2 id="per-domain" className="card__title">
          Completion by domain
        </h2>
        {perCourse.map((item) => (
          <div className="stack-sm" key={item.course.id}>
            <h3 className="subhead">
              {item.course.icon} {item.course.examCode}
            </h3>
            {item.domains.map((entry) => (
              <div className="stack-sm" key={entry.domain.id}>
                <div className="meter-row">
                  <span>
                    {entry.domain.shortTitle}
                    {` · ${weightBadge(entry.domain)}`}
                  </span>
                  <span className="meter-row__value">
                    {entry.completed}/{entry.total}
                  </span>
                </div>
                <ProgressBar
                  value={entry.percent}
                  tone={entry.percent === 100 ? 'success' : 'primary'}
                />
              </div>
            ))}
          </div>
        ))}
      </section>

      <section className="card stack" aria-labelledby="appearance">
        <h2 id="appearance" className="card__title">
          Appearance
        </h2>
        <div className="field">
          <span className="field__label">Theme</span>
          <div className="chip-row">
            {(['system', 'light', 'dark'] as const).map((theme) => (
              <button
                key={theme}
                type="button"
                className="chip"
                aria-pressed={state.theme === theme}
                onClick={() => setTheme(theme)}
              >
                {theme === 'system' ? 'Follow device' : theme === 'light' ? 'Light' : 'Dark'}
              </button>
            ))}
          </div>
        </div>
        <p className="subtle" style={{ marginBottom: 0 }}>
          The theme is a display preference, so it survives a progress reset.
        </p>
      </section>

      <section className="card stack" aria-labelledby="export-import">
        <h2 id="export-import" className="card__title">
          Export and import
        </h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          Export writes a JSON file containing every lesson status, practice answer and exam
          attempt. Import can either merge it into what you already have (keeping the better result
          for each item) or replace everything.
        </p>
        <div className="row">
          <button type="button" className="btn" onClick={exportProgress}>
            ⬇ Export progress as JSON
          </button>
          <button
            type="button"
            className="btn btn--secondary"
            onClick={() => fileInput.current?.click()}
          >
            ⬆ Choose a file to import
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="visually-hidden"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void onFile(file)
              event.target.value = ''
            }}
          />
        </div>

        {pendingImport?.ok && (
          <div className="notice notice--info">
            <span className="notice__icon" aria-hidden="true">
              📥
            </span>
            <div className="stack-sm">
              <strong>Ready to import.</strong>
              <div className="row">
                <button type="button" className="btn btn--sm" onClick={() => applyImport('merge')}>
                  Merge into my progress
                </button>
                <button
                  type="button"
                  className="btn btn--secondary btn--sm"
                  onClick={() => applyImport('replace')}
                >
                  Replace my progress
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--sm"
                  onClick={() => {
                    setPendingImport(null)
                    setNotice(null)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card stack" aria-labelledby="updates">
        <h2 id="updates" className="card__title">
          App updates and offline use
        </h2>
        <ul style={{ marginBottom: 0 }}>
          <li>
            Lessons you have opened stay available offline. A new deployment appears as a{' '}
            <strong>New version available</strong> banner rather than swapping content while you are
            reading.
          </li>
          <li>
            Updating <strong>never touches your progress</strong> - it lives in this browser&apos;s
            local storage, which a service-worker update does not clear, and the stored record is
            versioned and migrated forward rather than discarded.
          </li>
          <li>
            Old caches are removed when a new version activates, so you cannot get stuck on stale
            content.
          </li>
          <li>
            Export a backup before clearing your browser data, reinstalling the app, or switching
            device - clearing site data removes progress along with the cache.
          </li>
        </ul>
      </section>

      <section className="card stack" aria-labelledby="danger">
        <h2 id="danger" className="card__title">
          Reset
        </h2>
        <p className="muted" style={{ marginBottom: 0 }}>
          This deletes every lesson completion, practice answer and exam attempt stored on this
          device. It asks twice, and it cannot be undone.
        </p>
        <div className="row">
          <Badge tone="danger">Irreversible</Badge>
          <button type="button" className="btn btn--danger" onClick={doReset}>
            Reset all progress
          </button>
        </div>
      </section>
    </div>
  )
}
