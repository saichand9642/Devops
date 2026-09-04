/**
 * Content model for the learning app.
 *
 * The model is deliberately course-agnostic: a course is a bundle of domains,
 * topics, questions, a command reference and a mock-exam blueprint. Adding a
 * second DevOps course later means adding one more `Course` object to
 * `src/content/courses.ts` - no UI changes required.
 */

export type Difficulty = 'beginner' | 'intermediate' | 'advanced'

/** Language used for syntax highlighting of a code sample. */
export type CodeLanguage = 'yaml' | 'bash' | 'json' | 'dockerfile' | 'text'

export interface CodeSample {
  title: string
  language: CodeLanguage
  code: string
  /** Plain-language description of what the sample does. */
  explanation?: string
  /** Tokens the learner must replace with their own values, e.g. `<namespace>`. */
  placeholders?: string[]
}

export interface CommandExample {
  command: string
  /** What the command does, in plain language. */
  what: string
  /** What the learner should see when it works. */
  expected?: string
  /** Namespace behaviour worth calling out (defaults, `-n`, `--all-namespaces`). */
  namespaceNote?: string
  placeholders?: string[]
}

export interface KeyField {
  /** Field path as `kubectl explain` spells it, e.g. `spec.containers[].image`. */
  path: string
  meaning: string
  required?: boolean
}

export interface KeyObject {
  kind: string
  apiVersion: string
  purpose: string
  fields: KeyField[]
}

export interface PracticeQuestion {
  id: string
  level: Difficulty
  prompt: string
  /** Hidden until the learner reveals it. */
  answer: string
  explanation?: string
  code?: CodeSample
}

export interface LabTask {
  instruction: string
  hint?: string
}

export interface Lab {
  title: string
  scenario: string
  /** Cluster/tooling assumptions, e.g. "a kind or minikube cluster". */
  prerequisites?: string[]
  tasks: LabTask[]
  /** Ordered solution steps. */
  solution: CodeSample[]
  verification: CommandExample[]
  cleanup?: CommandExample[]
}

export interface RealWorldExample {
  title: string
  story: string[]
  code?: CodeSample[]
}

export interface Topic {
  id: string
  title: string
  domainId: string
  difficulty: Difficulty
  /** Rough focused-study time, used for the study planner. */
  estimatedMinutes: number
  order: number
  tags: string[]
  /** One sentence shown on cards and in search results. */
  oneLiner: string
  /** Beginner-level explanation, one string per paragraph. */
  explanation: string[]
  whyItMatters: string[]
  howItWorks: string[]
  keyObjects: KeyObject[]
  realWorldExample: RealWorldExample
  yamlExamples: CodeSample[]
  imperative: CommandExample[]
  declarative: {
    steps: string[]
    code: CodeSample[]
  }
  verification: CommandExample[]
  troubleshooting: CommandExample[]
  commonMistakes: string[]
  examTips: string[]
  summary: string[]
  practice: PracticeQuestion[]
  lab: Lab
  relatedTopicIds?: string[]
  /** Official Kubernetes documentation deep links for this topic. */
  docs?: { title: string; url: string }[]
}

export interface Domain {
  id: string
  title: string
  shortTitle: string
  /**
   * Official CNCF exam weight as a percentage. `null` for supporting sections
   * that the app adds (foundations, exam technique) which carry no official
   * weight of their own.
   */
  examWeight: number | null
  description: string
  /** Competencies as published by the CNCF/Linux Foundation curriculum. */
  officialCompetencies: string[]
  /** CSS custom-property suffix used for the domain accent colour. */
  accent: 'blue' | 'violet' | 'amber' | 'emerald' | 'rose' | 'cyan' | 'slate'
  order: number
}

/* --------------------------------------------------------------- questions */

/**
 * How a question is answered and scored.
 * - `mcq`      one correct option, auto-scored
 * - `multi`    several correct options, auto-scored (all-or-nothing)
 * - `command`  free-text command, auto-scored against normalised accepted answers
 * - `task`     performance-based task, scored from self-verified checkpoints
 */
export type QuestionKind = 'mcq' | 'multi' | 'command' | 'task'

/** What the question looks like, used for filtering and labelling. */
export type QuestionCategory = 'concept' | 'command' | 'yaml' | 'troubleshoot' | 'lab'

interface QuestionBase {
  id: string
  domainId: string
  topicId: string
  category: QuestionCategory
  difficulty: Difficulty
  prompt: string
  /** Shown after the answer is revealed or the exam is submitted. */
  explanation: string
  /** Weight in mock-exam scoring. */
  points: number
  /** Optional code shown with the question (broken YAML, log output, ...). */
  code?: CodeSample
}

export interface ChoiceOption {
  id: string
  text: string
}

export interface ChoiceQuestion extends QuestionBase {
  kind: 'mcq' | 'multi'
  options: ChoiceOption[]
  /** Ids of the correct options. */
  correct: string[]
}

export interface CommandQuestion extends QuestionBase {
  kind: 'command'
  /**
   * Any of these counts as correct. Comparison is whitespace- and
   * quote-normalised, so learners do not lose marks for formatting.
   */
  acceptedAnswers: string[]
  /** Shown as a greyed hint inside the input. */
  answerHint?: string
}

export interface TaskCheckpoint {
  id: string
  text: string
}

export interface TaskQuestion extends QuestionBase {
  kind: 'task'
  /** Cluster context the task takes place in. */
  context?: string
  /**
   * Objectively checkable outcomes. In a mock exam the learner confirms these
   * after submission, and the score is the fraction confirmed.
   */
  checkpoints: TaskCheckpoint[]
  solution: CodeSample[]
}

export type Question = ChoiceQuestion | CommandQuestion | TaskQuestion

/* -------------------------------------------------------- command reference */

export interface CommandRefEntry {
  id: string
  command: string
  description: string
  placeholders?: string[]
  example?: string
  notes?: string
  tags: string[]
}

export interface CommandGroup {
  id: string
  title: string
  description: string
  entries: CommandRefEntry[]
}

/* ------------------------------------------------------------- mock exams */

export interface ExamBlueprint {
  /** Default timer in minutes (the real CKAD is 120 minutes). */
  defaultMinutes: number
  /** Official pass mark as a percentage. */
  passingScore: number
  /** Number of questions in a generated full-length exam. */
  questionCount: number
  /** Domain id -> percentage of the exam, matching the official weights. */
  weights: Record<string, number>
}

export interface Course {
  id: string
  title: string
  subtitle: string
  vendor: string
  examCode: string
  /** Platform version the content targets, e.g. "Kubernetes v1.35". */
  targetVersion: string
  status: 'available' | 'planned'
  /** Route prefix, e.g. `/ckad`. */
  route: string
  icon: string
  domains: Domain[]
  topics: Topic[]
  questions: Question[]
  commandGroups: CommandGroup[]
  examBlueprint: ExamBlueprint
  /** Source-of-truth links shown in the app for verification. */
  sources: { title: string; url: string }[]
}

/**
 * A course that is announced but has no content yet. Kept as its own type so
 * the app never has to render an empty `Course` with fake zero-length domains.
 */
export interface PlannedCourse {
  id: string
  title: string
  subtitle: string
  icon: string
  note: string
}
