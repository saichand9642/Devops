import type { InterviewTopic } from '../../../types'
import { shellCoreQuestions } from './core'
import { shellFundamentalQuestions } from './fundamentals'
import { shellScriptingQuestions } from './scripting'
import { shellPracticeQuestions } from './practice'

export const shellTopic: InterviewTopic = {
  id: 'shell',
  title: 'Shell scripting',
  shortTitle: 'Shell',
  icon: '🐚',
  order: 12,
  oneLiner:
    'Bash that does not break in production: strict mode, quoting, exit codes, traps and text processing.',
  headlines: [
    '`set -euo pipefail` at the top of every script. It turns silent failures into loud ones.',
    '**Always quote your variables.** `"$var"`, not `$var`. Unquoted expansion is the source of most shell bugs.',
    '`$?` is the exit status of the last command. 0 is success; anything else is failure.',
    '`trap ... EXIT` is how you guarantee cleanup, including on error.',
    '`[[ ]]` is the bash test - safer than `[ ]` because it does not word-split.',
    'When a script grows past about 100 lines of logic, it probably wants to be Python.',
  ],
  questions: [
    ...shellCoreQuestions,
    ...shellFundamentalQuestions,
    ...shellScriptingQuestions,
    ...shellPracticeQuestions,
  ],
}
