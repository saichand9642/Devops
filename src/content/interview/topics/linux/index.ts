import type { InterviewTopic } from '../../../types'
import { linuxCoreQuestions } from './core'
import { linuxFundamentalQuestions } from './fundamentals'
import { linuxOperationsQuestions } from './operations'
import { linuxPracticeQuestions } from './practice'

export const linuxTopic: InterviewTopic = {
  id: 'linux',
  title: 'Linux & troubleshooting',
  shortTitle: 'Linux',
  icon: '🐧',
  order: 13,
  oneLiner:
    'Permissions, processes, disk, memory, networking and the "the server is slow" question you will definitely be asked.',
  headlines: [
    'Permissions are read/write/execute for user, group and other. On a **directory**, `x` means "may enter", not "may run".',
    'Load average is the number of processes running **or waiting**, including on disk I/O - not CPU percentage.',
    'Linux deliberately uses free memory for cache. Look at **available**, not **free**.',
    'A deleted file still consuming disk means a process holds the file handle open. `lsof +L1` finds it.',
    '`systemctl status`, then `journalctl -u <unit>` - that pair answers most "service is broken" questions.',
    'For "what is it doing?": `strace` for syscalls, `lsof` for open files, `ss` for sockets.',
  ],
  questions: [
    ...linuxCoreQuestions,
    ...linuxFundamentalQuestions,
    ...linuxOperationsQuestions,
    ...linuxPracticeQuestions,
  ],
}
