import type { Course } from '../types'
import { ckadDomains } from './domains'
import { ckadTopics } from './topics'
import { ckadQuestions } from './questions'
import { ckadCommandGroups } from './commands'

/**
 * CKAD course definition.
 *
 * Domain weights, the pass mark and the target Kubernetes version come from
 * the official CNCF / Linux Foundation curriculum listed in `sources`. They
 * were last verified on 2026-09-03 against CKAD_Curriculum_v1.35.
 */
export const ckadCourse: Course = {
  id: 'ckad',
  title: 'CKAD — Certified Kubernetes Application Developer',
  subtitle:
    'Build, deploy, observe, configure and expose applications on Kubernetes, from first principles to exam speed.',
  vendor: 'CNCF / Linux Foundation',
  examCode: 'CKAD',
  targetVersion: 'Kubernetes v1.35',
  status: 'available',
  route: '/ckad',
  icon: '☸️',
  domains: ckadDomains,
  topics: ckadTopics,
  questions: ckadQuestions,
  commandGroups: ckadCommandGroups,
  examBlueprint: {
    // The real exam is 2 hours, performance-based, 66% to pass.
    defaultMinutes: 120,
    passingScore: 66,
    questionCount: 20,
    // CNCF publishes these weights, so the app can present them as official.
    officialWeights: true,
    weights: {
      'design-build': 20,
      deployment: 20,
      observability: 15,
      'environment-security': 25,
      'services-networking': 20,
    },
  },
  copy: {
    studyPath:
      'Work top to bottom the first time through. Foundations and Exam Technique carry no official weight, but the five weighted domains assume the first and are much easier to finish in time with the last.',
    provenance:
      'Domain names and weights are taken from the official CNCF/Linux Foundation CKAD curriculum (verified 2026-09-03 against CKAD_Curriculum_v1.35).',
    commandReference:
      'Searchable kubectl, Helm and Kustomize cheat sheet with copy buttons and YAML templates.',
    examWeighting: 'Timed papers weighted to the official domain percentages, scored per domain.',
  },
  sources: [
    {
      title: 'CNCF curriculum repository (ckad)',
      url: 'https://github.com/cncf/curriculum/tree/master/ckad',
    },
    {
      title: 'CNCF CKAD certification page',
      url: 'https://www.cncf.io/training/certification/ckad/',
    },
    {
      title: 'Linux Foundation CKAD exam page (domains and competencies)',
      url: 'https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/',
    },
    {
      title: 'Linux Foundation CKA/CKAD/CKS FAQ (exam environment version, pass mark)',
      url: 'https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks',
    },
    { title: 'Kubernetes documentation', url: 'https://kubernetes.io/docs/home/' },
  ],
}

export { ckadDomains } from './domains'
