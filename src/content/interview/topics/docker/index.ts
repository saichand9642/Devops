import type { InterviewTopic } from '../../../types'
import { dockerCoreQuestions } from './core'
import { dockerImageQuestions } from './images'
import { dockerRuntimeQuestions } from './runtime'
import { dockerOperationsQuestions } from './operations'

export const dockerTopic: InterviewTopic = {
  id: 'docker',
  title: 'Docker & containers',
  shortTitle: 'Docker',
  icon: '🐳',
  order: 1,
  oneLiner:
    'Images, layers, the build cache, networking, volumes, and the debugging questions that come up in every round.',
  headlines: [
    'An image is a read-only template; a container is a running instance of it with a thin writable layer on top.',
    'Containers share the host kernel. That is the whole difference from a VM, and the reason they start in milliseconds.',
    'Every `RUN`, `COPY` and `ADD` creates a layer. Layer order decides whether your build cache hits or misses.',
    '`CMD` is the default command and is easy to override; `ENTRYPOINT` is the thing that always runs.',
    'Isolation is Linux namespaces (what a process can see) plus cgroups (how much it can use).',
    'Data in a container dies with it unless it is on a volume.',
  ],
  questions: [
    ...dockerCoreQuestions,
    ...dockerImageQuestions,
    ...dockerRuntimeQuestions,
    ...dockerOperationsQuestions,
  ],
}
