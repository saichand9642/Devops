import type { InterviewTopic } from '../../../types'
import { splunkCoreQuestions } from './core'
import { splunkFundamentalQuestions } from './fundamentals'
import { splunkOperationsQuestions } from './operations'
import { splunkPracticeQuestions } from './practice'

export const splunkTopic: InterviewTopic = {
  id: 'splunk',
  title: 'Splunk & log management',
  shortTitle: 'Splunk',
  icon: '🔍',
  order: 10,
  oneLiner:
    'Indexes, SPL, forwarders, index-time versus search-time, and the performance questions that follow.',
  headlines: [
    'Splunk indexes raw machine data and lets you search it with **SPL** - a pipeline language, like a shell pipe.',
    'Architecture: **forwarders** collect, **indexers** store and search, **search heads** coordinate and present.',
    'The four fields that govern everything: `index`, `sourcetype`, `source`, `host`. Filter on them first.',
    'Index-time decisions are permanent; search-time decisions are flexible. Prefer search-time.',
    '`tstats` on accelerated data models is dramatically faster than raw search for large ranges.',
    'The single biggest performance lever is narrowing the **time range** and the **index** before anything else.',
  ],
  questions: [
    ...splunkCoreQuestions,
    ...splunkFundamentalQuestions,
    ...splunkOperationsQuestions,
    ...splunkPracticeQuestions,
  ],
}
