import type { Course } from '../types'
import { dockerDomains } from './domains'
import { dockerTopics } from './topics'
import { dockerQuestions } from './questions'
import { dockerCommandGroups } from './commands'

/**
 * Containers & Docker fundamentals.
 *
 * IMPORTANT: unlike CKAD and Terraform, this course has no vendor exam behind
 * it. Docker's own certification (the Docker Certified Associate) was retired,
 * so there is no published curriculum, no official weighting and no pass mark
 * to quote. Every figure in `examBlueprint` is therefore this app's own study
 * aid - `officialWeights: false` makes the UI say so wherever they appear, and
 * every domain carries `examWeight: null` so no section claims a percentage it
 * was never given.
 *
 * Content verified against the Docker documentation on 2026-09-22.
 */
export const dockerCourse: Course = {
  id: 'docker',
  title: 'Containers & Docker fundamentals',
  subtitle: 'Images, layers, registries, Compose and build strategy, from first container to CI',
  vendor: 'Docker',
  examCode: 'Docker',
  targetVersion: 'Docker Engine 27 / Compose v2',
  status: 'available',
  route: '/docker',
  icon: '📦',
  domains: dockerDomains,
  topics: dockerTopics,
  questions: dockerQuestions,
  commandGroups: dockerCommandGroups,
  examBlueprint: {
    defaultMinutes: 45,
    /*
     * Not published by anybody - there is no Docker exam. 70% is a
     * conventional revision target with useful headroom.
     */
    passingScore: 70,
    questionCount: 25,
    officialWeights: false,
    note: 'There is no current Docker certification, so no vendor publishes a curriculum, a weighting or a pass mark for this material. The section weights, question count and target score used here are this app’s own study aids, proportional to how much of the subject each section covers. Treat the result as revision feedback, not as a prediction of anything.',
    /* Proportional to the depth of each section, rounded to sum to 100. */
    weights: {
      'dk-foundations': 15,
      'dk-build': 25,
      'dk-run': 20,
      'dk-data': 15,
      'dk-compose': 10,
      'dk-operations': 15,
    },
  },
  copy: {
    studyPath:
      'Work through the sections in order - each one assumes the last. Sections 1 to 3 need only Docker installed; section 4 adds volumes and networks; section 5 needs the Compose plugin, which ships with Docker Desktop and modern Docker Engine. Every lab runs on a single machine with no cloud account.',
    provenance:
      'There is no current Docker certification, so this course follows no vendor curriculum. The sections are a teaching order chosen for this app, and the content was verified against the official Docker documentation on 2026-09-22.',
    commandReference:
      'Searchable Docker CLI reference with copy buttons, grouped by what you are trying to do - running containers, building images, storage and networking, Compose, and diagnostics.',
    examWeighting:
      'Timed papers weighted across the six sections. No vendor publishes a weighting for this material, so these figures are the app’s own study aid.',
  },
  sources: [
    { title: 'Docker documentation', url: 'https://docs.docker.com/' },
    { title: 'Dockerfile reference', url: 'https://docs.docker.com/reference/dockerfile/' },
    {
      title: 'Building best practices',
      url: 'https://docs.docker.com/build/building/best-practices/',
    },
    { title: 'Compose file reference', url: 'https://docs.docker.com/reference/compose-file/' },
    {
      title: 'OCI image specification',
      url: 'https://github.com/opencontainers/image-spec/blob/main/spec.md',
    },
  ],
}
