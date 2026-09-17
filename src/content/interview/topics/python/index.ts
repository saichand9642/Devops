import type { InterviewTopic } from '../../../types'
import { pythonCoreQuestions } from './core'
import { pythonLanguageQuestions } from './language'
import { pythonAutomationQuestions } from './automation'
import { pythonPracticeQuestions } from './practice'

export const pythonTopic: InterviewTopic = {
  id: 'python',
  title: 'Python for DevOps',
  shortTitle: 'Python',
  icon: '🐍',
  order: 11,
  oneLiner:
    'The language features, error handling, API and file work, and the coding exercises that come up in DevOps interviews.',
  headlines: [
    'Use `with` for anything with a resource - files, connections, locks. It closes on exception too.',
    'Mutable default arguments (`def f(x=[])`) are shared across calls. This is the classic Python gotcha.',
    'A list comprehension is the idiomatic transform; a generator (`()` not `[]`) is the memory-safe one.',
    '`dict.get(key, default)` and `collections.defaultdict` remove most `KeyError` handling.',
    'Catch specific exceptions. A bare `except:` swallows `KeyboardInterrupt` and real bugs.',
    'For subprocesses use `subprocess.run` with a **list** of arguments and `check=True`. Never `shell=True` with untrusted input.',
  ],
  questions: [
    ...pythonCoreQuestions,
    ...pythonLanguageQuestions,
    ...pythonAutomationQuestions,
    ...pythonPracticeQuestions,
  ],
}
