import type { Domain } from '../types'

/**
 * The six sections of this course.
 *
 * Unlike CKAD and Terraform, there is no vendor exam behind this material.
 * Docker's own certification (the Docker Certified Associate) was retired, so
 * there is no published curriculum, no official weighting and no pass mark to
 * quote. Every domain therefore carries `examWeight: null` and shows a section
 * number rather than a percentage, and the mock-exam blueprint is explicitly
 * labelled as this app's own study aid.
 *
 * The section order is a teaching order: what a container is, how to build
 * one, how to run it, how to give it data and a network, how to compose
 * several, and how to operate the result.
 */
export const dockerDomains: Domain[] = [
  {
    id: 'dk-foundations',
    title: 'Containers, images and registries',
    shortTitle: 'Foundations',
    examWeight: null,
    weightLabel: 'Section 1',
    description:
      'What a container actually is, how an image differs from a running container, why images are made of layers, and how tags and registries work.',
    officialCompetencies: [
      'Explain what a container is and how it differs from a virtual machine',
      'Distinguish an image from a container',
      'Describe the layered filesystem and the copy-on-write container layer',
      'Use tags, digests and registries correctly',
    ],
    accent: 'blue',
    order: 1,
  },
  {
    id: 'dk-build',
    title: 'Building images',
    shortTitle: 'Building',
    examWeight: null,
    weightLabel: 'Section 2',
    description:
      'Writing a Dockerfile, understanding the build cache, multi-stage builds, and choosing a base image that is small and safe.',
    officialCompetencies: [
      'Write a Dockerfile using the common instructions correctly',
      'Order instructions so the build cache actually helps',
      'Use multi-stage builds to separate build tooling from the runtime image',
      'Choose an appropriate base image and justify the choice',
    ],
    accent: 'violet',
    order: 2,
  },
  {
    id: 'dk-run',
    title: 'Running containers',
    shortTitle: 'Running',
    examWeight: null,
    weightLabel: 'Section 3',
    description:
      'The container lifecycle, passing configuration in, and controlling what happens when a container uses too much memory or exits unexpectedly.',
    officialCompetencies: [
      'Describe the container lifecycle and the states a container moves through',
      'Supply configuration through environment variables and files',
      'Apply CPU and memory limits, and predict what happens when they are hit',
      'Choose an appropriate restart policy',
    ],
    accent: 'emerald',
    order: 3,
  },
  {
    id: 'dk-data',
    title: 'Storage and networking',
    shortTitle: 'Data & network',
    examWeight: null,
    weightLabel: 'Section 4',
    description:
      'Making data outlive a container, publishing ports, and how containers find and talk to each other.',
    officialCompetencies: [
      'Choose between a named volume, a bind mount and tmpfs',
      'Publish ports and explain the difference between publishing and exposing',
      'Use user-defined networks and container DNS',
      'Explain how a container reaches the host and the outside world',
    ],
    accent: 'cyan',
    order: 4,
  },
  {
    id: 'dk-compose',
    title: 'Docker Compose',
    shortTitle: 'Compose',
    examWeight: null,
    weightLabel: 'Section 5',
    description:
      'Describing a multi-container application in one file, and the differences that matter when the same file is used beyond a laptop.',
    officialCompetencies: [
      'Define a multi-service application in a Compose file',
      'Express dependencies and wait for a dependency to be genuinely ready',
      'Use profiles, override files and variable interpolation',
      'Know where Compose stops and an orchestrator begins',
    ],
    accent: 'amber',
    order: 5,
  },
  {
    id: 'dk-operations',
    title: 'Security and operations',
    shortTitle: 'Operations',
    examWeight: null,
    weightLabel: 'Section 6',
    description:
      'Hardening an image, getting logs and diagnostics out of a container, and publishing images from a pipeline.',
    officialCompetencies: [
      'Reduce the attack surface of an image and run as a non-root user',
      'Scan images for known vulnerabilities and act on the results',
      'Collect logs and debug a container that will not start',
      'Build, tag and publish images from CI safely',
    ],
    accent: 'rose',
    order: 6,
  },
]
