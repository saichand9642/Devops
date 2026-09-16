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
export type CodeLanguage = 'yaml' | 'bash' | 'json' | 'dockerfile' | 'hcl' | 'python' | 'text'

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
  /** Kubernetes apiVersion. Omitted by courses whose objects have no version. */
  apiVersion?: string
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

/* --------------------------------------------------------------- diagrams */

/**
 * Diagrams are authored as data, not as images or Mermaid source, and rendered
 * to inline SVG at runtime. That keeps them searchable, theme-aware, offline
 * (no diagram library to download), and it means a lesson can never ship a
 * picture whose colours are unreadable in dark mode.
 */
export type DiagramTone = 'default' | 'accent' | 'success' | 'warning' | 'danger' | 'muted'

/** One box in a flow diagram. */
export interface FlowNode {
  label: string
  detail?: string
  tone?: DiagramTone
  /** Label written beside the arrow that leads INTO this node. */
  arrowLabel?: string
  /** An off-ramp drawn to the side, e.g. what happens when a probe fails. */
  branch?: { label: string; detail?: string; tone?: DiagramTone }
}

export interface SequenceParticipant {
  id: string
  label: string
}

export interface SequenceMessage {
  from: string
  to: string
  label: string
  /** `return` is drawn dashed - replies, watch events, status writes. */
  kind?: 'call' | 'return'
}

/** A containment box. Children are drawn nested inside their parent. */
export interface NestedBox {
  label: string
  detail?: string
  tone?: DiagramTone
  children?: NestedBox[]
}

export interface DecisionBranch {
  /** The condition that selects this branch, e.g. "needs stable hostnames". */
  condition: string
  /** What you should do when the condition holds. */
  result: string
  detail?: string
  tone?: DiagramTone
}

interface DiagramBase {
  title: string
  /** The one thing the learner should take away from the picture. */
  caption?: string
}

/** An ordered pipeline: what happens, in order, with optional failure exits. */
export interface FlowDiagram extends DiagramBase {
  kind: 'flow'
  nodes: FlowNode[]
}

/** Who talks to whom, in order - request paths and control loops. */
export interface SequenceDiagram extends DiagramBase {
  kind: 'sequence'
  participants: SequenceParticipant[]
  messages: SequenceMessage[]
}

/** What lives inside what - cluster/node/pod/container, owner chains. */
export interface NestedDiagram extends DiagramBase {
  kind: 'nested'
  root: NestedBox
}

/** "Which one do I pick?" - a question with mutually exclusive answers. */
export interface DecisionDiagram extends DiagramBase {
  kind: 'decision'
  question: string
  branches: DecisionBranch[]
}

export type Diagram = FlowDiagram | SequenceDiagram | NestedDiagram | DecisionDiagram

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
  /** Flow diagrams that make the mechanism visual. */
  diagrams?: Diagram[]
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
  /**
   * What to show instead of a percentage when `examWeight` is null.
   *
   * HashiCorp publishes the Terraform objectives but no weighting, so those
   * domains show "Objective 3" rather than a made-up percentage. CKAD's own
   * supporting sections leave this unset and show "support".
   */
  weightLabel?: string
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
  /** Domain id -> percentage of the exam. */
  weights: Record<string, number>
  /**
   * True when the certifying body publishes `weights` and `passingScore`.
   *
   * False when it does not - HashiCorp, for instance, publishes neither for
   * the Terraform Associate exam. In that case these numbers are the app's own
   * study targets, `note` must say so, and the UI shows that note wherever the
   * figures appear. Presenting an invented weighting as official would be
   * misleading.
   */
  officialWeights: boolean
  /** Required when `officialWeights` is false. */
  note?: string
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
  /**
   * Course-specific dashboard copy.
   *
   * Kept as data because the wording differs per certification - which
   * sections carry weight, who publishes the curriculum, and what the command
   * reference actually covers. Hard-coding it in the page made the whole
   * dashboard CKAD-only.
   */
  copy: CourseCopy
}

export interface CourseCopy {
  /** How to work through the curriculum, one paragraph. */
  studyPath: string
  /** Where the domain names and weights come from, and when they were checked. */
  provenance: string
  /** What the command reference covers, e.g. "kubectl, Helm and Kustomize". */
  commandReference: string
  /** What a mock exam paper is weighted to. */
  examWeighting: string
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

/* ------------------------------------------------- interview preparation */

/**
 * Interview preparation is modelled separately from a certification course.
 *
 * A course is a curriculum: domains, lessons, a weighted exam. Interview prep
 * is a question bank per technology, where the unit of study is a single
 * question you can answer out loud. Forcing one model to serve both would
 * have meant lessons with no labs and exams with no blueprint.
 */
export type InterviewLevel = 'basic' | 'intermediate' | 'advanced'

/**
 * How the question is asked.
 * - `open`      "explain X" - the staple of a real interview
 * - `mcq`       one correct option, for facts that are easy to half-know
 * - `multi`     several correct options
 * - `scenario`  "production is doing X at 2am - walk me through it"
 */
export type InterviewQuestionKind = 'open' | 'mcq' | 'multi' | 'scenario'

export interface InterviewQuestion {
  id: string
  level: InterviewLevel
  kind: InterviewQuestionKind
  prompt: string
  /**
   * Code shown as part of the question itself - "what does this print?".
   * Distinct from `code`, which illustrates the answer and stays hidden
   * until the learner asks for it.
   */
  promptCode?: CodeSample[]
  /** Required for `mcq` and `multi`. */
  options?: ChoiceOption[]
  /** Ids of the correct options. Required for `mcq` and `multi`. */
  correct?: string[]
  /** What the interviewer is actually checking. Shown before the answer. */
  probing: string
  /**
   * The model answer, one string per paragraph. Written to be said out loud,
   * beginner-first: the plain explanation comes before the nuance.
   */
  answer: string[]
  /** The detail that separates a senior answer from a correct one. */
  deeper?: string[]
  code?: CodeSample[]
  diagrams?: Diagram[]
  /** Answers that sound right and are not. */
  traps?: string[]
  /** What they will very likely ask next. */
  followUps?: string[]
  tags: string[]
}

export interface InterviewTopic {
  id: string
  title: string
  shortTitle: string
  icon: string
  order: number
  /** One sentence, shown on the hub card. */
  oneLiner: string
  /** The things worth revising on the morning of the interview. */
  headlines: string[]
  questions: InterviewQuestion[]
}

export interface InterviewTrack {
  id: string
  title: string
  subtitle: string
  /** Route prefix, e.g. `/interview`. */
  route: string
  topics: InterviewTopic[]
}
