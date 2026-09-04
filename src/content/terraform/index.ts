import type { Course } from '../types'
import { terraformDomains } from './domains'
import { terraformTopics } from './topics'
import { terraformQuestions } from './questions'
import { terraformCommandGroups } from './commands'

/**
 * HashiCorp Terraform Associate (004).
 *
 * Objectives and competencies verified 2026-09-04 against HashiCorp's
 * published exam content list. Exam logistics verified the same day against
 * the certification page.
 *
 * IMPORTANT: HashiCorp publishes the objectives, the format (multiple choice),
 * the duration (1 hour) and the cost - but NOT the question count, the pass
 * mark, or a per-objective weighting. The `questionCount`, `passingScore` and
 * `weights` below are therefore this app's own study targets, derived from the
 * number of published sub-objectives per objective. `officialWeights: false`
 * makes the UI say so wherever those figures appear.
 */
export const terraformCourse: Course = {
  id: 'terraform',
  title: 'Terraform Associate (004)',
  subtitle: 'Infrastructure as code with HashiCorp Terraform, from first apply to HCP',
  vendor: 'HashiCorp',
  examCode: 'Terraform Associate',
  targetVersion: 'Terraform v1.16',
  status: 'available',
  route: '/terraform',
  icon: '🏗️',
  domains: terraformDomains,
  topics: terraformTopics,
  questions: terraformQuestions,
  commandGroups: terraformCommandGroups,
  examBlueprint: {
    // Published: the real exam is 1 hour, multiple choice.
    defaultMinutes: 60,
    /*
     * NOT published by HashiCorp. 70% is this app's study target - a
     * conventional threshold that leaves useful headroom. Treat it as a
     * revision goal, not a prediction.
     */
    passingScore: 70,
    questionCount: 25,
    officialWeights: false,
    note: 'HashiCorp publishes no per-objective weighting and no pass mark for this exam. The weights and target score used here are this app’s own study aids, proportional to the number of published sub-objectives per objective.',
    /*
     * Proportional to published sub-objective count (37 in total):
     * obj1 3, obj2 4, obj3 7, obj4 8, obj5 4, obj6 4, obj7 3, obj8 4.
     * Rounded to sum to 100. The exam-technique section carries no weight,
     * so its questions appear in topic drills but not in mock exams.
     */
    weights: {
      'tf-iac': 8,
      'tf-fundamentals': 11,
      'tf-workflow': 19,
      'tf-configuration': 22,
      'tf-modules': 11,
      'tf-state': 11,
      'tf-maintenance': 8,
      'tf-hcp': 10,
    },
  },
  copy: {
    studyPath:
      'Work through the objectives in order. Objectives 1 to 3 are the foundation and can be practised entirely with credential-free providers; objective 4 is the largest and rewards time in terraform console; objective 8 needs an HCP Terraform account, and the free tier is enough.',
    provenance:
      'Objectives and competencies are quoted from HashiCorp’s published Terraform Associate (004) exam content list, verified 2026-09-04.',
    commandReference:
      'Searchable Terraform CLI reference with copy buttons, plus HCL block templates for the shapes you write most often.',
    examWeighting:
      'Timed papers weighted by published sub-objective count. HashiCorp publishes no official weighting, so this is a study aid.',
  },
  sources: [
    {
      title: 'Exam content list (004)',
      url: 'https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004',
    },
    {
      title: 'Certification overview',
      url: 'https://developer.hashicorp.com/certifications/infrastructure-automation',
    },
    {
      title: 'Terraform documentation',
      url: 'https://developer.hashicorp.com/terraform/docs',
    },
    {
      title: 'HCP Terraform documentation',
      url: 'https://developer.hashicorp.com/terraform/cloud-docs',
    },
  ],
}
