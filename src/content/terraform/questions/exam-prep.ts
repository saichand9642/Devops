import type { Question } from '../../types'

/** Original practice questions for the exam-technique section. */
export const examPrepQuestions: Question[] = [
  {
    id: 'tfq-ep-1',
    domainId: 'tf-exam-prep',
    topicId: 'tf-exam-format-and-strategy',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What format and duration does HashiCorp publish for the Terraform Associate 004 exam?',
    options: [
      { id: 'a', text: 'Performance-based, two hours' },
      { id: 'b', text: 'Multiple choice, one hour' },
      { id: 'c', text: 'Multiple choice, two hours' },
      { id: 'd', text: 'Mixed multiple choice and hands-on, ninety minutes' },
    ],
    correct: ['b'],
    explanation:
      'Multiple choice, one hour, online proctored, $70.50 USD, valid two years. Notably HashiCorp does NOT publish the question count, the pass mark, or a per-objective weighting - treat any specific figure for those as unverified.',
  },
  {
    id: 'tfq-ep-2',
    domainId: 'tf-exam-prep',
    topicId: 'tf-exam-format-and-strategy',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'How many objectives and sub-objectives does the published exam content list contain?',
    options: [
      { id: 'a', text: '5 objectives and 20 sub-objectives' },
      { id: 'b', text: '8 objectives and 37 sub-objectives' },
      { id: 'c', text: '8 objectives and 31 sub-objectives' },
      { id: 'd', text: '8 objectives with no sub-objectives' },
    ],
    correct: ['b'],
    explanation:
      'That list is the most reliable syllabus available. The best self-test is to answer every one of the thirty-seven sub-objectives in one or two sentences without looking anything up.',
  },
  {
    id: 'tfq-ep-3',
    domainId: 'tf-exam-prep',
    topicId: 'tf-terraform-gotchas',
    kind: 'multi',
    category: 'concept',
    difficulty: 'advanced',
    points: 3,
    prompt: 'Which of these statements are FALSE? (Select all that apply.)',
    options: [
      { id: 'a', text: 'sensitive = true encrypts the value in state' },
      { id: 'b', text: '.terraform.lock.hcl records module versions' },
      { id: 'c', text: 'terraform state rm destroys the resource' },
      { id: 'd', text: 'A variable default has the lowest precedence' },
      { id: 'e', text: 'A failed apply rolls back everything it created' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    explanation:
      'Only (d) is true. `sensitive` affects display only; the lock file covers providers alone; `state rm` forgets rather than destroys; and Terraform has no transactions - state records what succeeded and a re-run continues. These four are the highest-value corrections to carry into the exam.',
  },
  {
    id: 'tfq-ep-4',
    domainId: 'tf-exam-prep',
    topicId: 'tf-terraform-gotchas',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which statement about `for_each` and `count` is correct?',
    options: [
      { id: 'a', text: 'Both accept a list; count also accepts a number' },
      {
        id: 'b',
        text: 'for_each accepts a map or a set of strings; removing an early list element under count recreates the rest',
      },
      { id: 'c', text: 'They can be combined on one resource for two-dimensional repetition' },
      { id: 'd', text: 'for_each instances are addressed by numeric index' },
    ],
    correct: ['b'],
    explanation:
      '`for_each` rejects lists, because a list has no stable keys. Under `count` identity is the index, so removing an early element renumbers and recreates everything after it. A block may use one or the other, never both.',
  },
  {
    id: 'tfq-ep-5',
    domainId: 'tf-exam-prep',
    topicId: 'tf-terraform-gotchas',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Why is "Terraform configurations are portable between cloud providers" an effective distractor rather than simply false?',
    options: [
      { id: 'a', text: 'Because it is true for the major clouds but not for SaaS providers' },
      {
        id: 'b',
        text: 'Because the CLI, workflow, language and skills genuinely are portable, so the statement feels right - only the configuration is not',
      },
      { id: 'c', text: 'Because it becomes true once you use modules' },
      { id: 'd', text: 'Because HCP Terraform makes it true' },
    ],
    correct: ['b'],
    explanation:
      'The best distractors are true about something adjacent. Terraform unifies the workflow and the language across providers; resource types and their schemas remain provider-specific, so the configuration itself is not interchangeable. This is why the precise wording of an option matters.',
  },
  {
    id: 'tfq-ep-6',
    domainId: 'tf-exam-prep',
    topicId: 'tf-exam-format-and-strategy',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You reach a question you cannot answer. What is the best action in a one-hour multiple-choice exam?',
    options: [
      { id: 'a', text: 'Leave it blank so it is clearly unanswered' },
      { id: 'b', text: 'Spend up to five minutes reasoning it out before moving on' },
      { id: 'c', text: 'Eliminate what you can, guess, flag it, and move on immediately' },
      { id: 'd', text: 'Skip to the end and answer it last from memory' },
    ],
    correct: ['c'],
    explanation:
      'There is no penalty for a wrong answer, so a blank is strictly worse than a guess. Flagging lets you return with whatever time remains, and moving on immediately protects the questions you do know.',
  },
]
