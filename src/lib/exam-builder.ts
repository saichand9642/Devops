import type { Course, Question } from '../content/types'

/**
 * Deterministic pseudo-random generator (mulberry32).
 *
 * A seed makes an exam reproducible, which matters twice: a learner can retake
 * the exact same paper to compare scores, and the tests can assert on a fixed
 * paper without being flaky.
 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export interface BuiltExam {
  seed: number
  questions: Question[]
  /** Domain id -> how many questions the paper actually contains. */
  composition: Record<string, number>
}

/**
 * Builds an exam paper whose question mix follows the official domain weights.
 *
 * Seats are allocated by largest remainder so, for example, a 20-question
 * paper gets exactly 4/4/3/5/4 questions for the 20/20/15/25/20 weighting.
 * Questions belonging to unweighted study sections (foundations, exam
 * technique) are never selected, because they carry no exam weight.
 */
export function buildExam(course: Course, questionCount: number, seed: number): BuiltExam {
  const random = createRandom(seed)
  const { weights } = course.examBlueprint
  const domainIds = Object.keys(weights)

  const pools = new Map<string, Question[]>()
  for (const domainId of domainIds) {
    const pool = course.questions.filter((question) => question.domainId === domainId)
    pools.set(domainId, shuffle(pool, random))
  }

  const exact = domainIds.map((domainId) => ({
    domainId,
    ideal: (weights[domainId] / 100) * questionCount,
  }))
  const allocation = new Map<string, number>(
    exact.map(({ domainId, ideal }) => [domainId, Math.floor(ideal)]),
  )
  let remaining = questionCount - [...allocation.values()].reduce((sum, count) => sum + count, 0)
  const byRemainder = [...exact].sort(
    (a, b) => b.ideal - Math.floor(b.ideal) - (a.ideal - Math.floor(a.ideal)),
  )
  let index = 0
  while (remaining > 0 && byRemainder.length > 0) {
    const { domainId } = byRemainder[index % byRemainder.length]
    allocation.set(domainId, (allocation.get(domainId) ?? 0) + 1)
    remaining -= 1
    index += 1
  }

  // Cap each domain at the number of questions that actually exist, then hand
  // any leftover seats to domains that still have spare questions so the paper
  // always reaches `questionCount` when the bank is big enough.
  const picked: Question[] = []
  const composition: Record<string, number> = {}
  for (const domainId of domainIds) {
    const pool = pools.get(domainId) ?? []
    const want = Math.min(allocation.get(domainId) ?? 0, pool.length)
    picked.push(...pool.slice(0, want))
    composition[domainId] = want
  }

  let shortfall = questionCount - picked.length
  while (shortfall > 0) {
    const donor = domainIds.find(
      (domainId) => (pools.get(domainId)?.length ?? 0) > (composition[domainId] ?? 0),
    )
    if (!donor) break
    const pool = pools.get(donor) ?? []
    picked.push(pool[composition[donor]])
    composition[donor] += 1
    shortfall -= 1
  }

  // Interleave so a learner does not get five networking questions in a row.
  return { seed, questions: shuffle(picked, random), composition }
}

/** Builds a shorter paper focused on a single domain. */
export function buildDomainDrill(
  course: Course,
  domainId: string,
  questionCount: number,
  seed: number,
): BuiltExam {
  const random = createRandom(seed)
  const pool = shuffle(
    course.questions.filter((question) => question.domainId === domainId),
    random,
  )
  const questions = pool.slice(0, questionCount)
  return { seed, questions, composition: { [domainId]: questions.length } }
}
