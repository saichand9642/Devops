import type { Domain } from '../content/types'

/**
 * What to show beside a domain name.
 *
 * A published percentage when the certifying body gives one; otherwise the
 * domain's own `weightLabel` (Terraform's "Objective 4"); otherwise "support",
 * which is how the app marks sections it added itself.
 */
export function weightBadge(domain: Domain): string {
  if (domain.examWeight !== null) return `${domain.examWeight}%`
  return domain.weightLabel ?? 'support'
}
