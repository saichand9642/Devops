import type { Question } from '../../types'

/** Original practice questions for section 1. Written for this app. */
export const dockerFoundationsQuestions: Question[] = [
  {
    id: 'dkq-fnd-1',
    domainId: 'dk-foundations',
    topicId: 'dk-what-is-a-container',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'Which kernel feature determines what a container process can SEE?',
    options: [
      { id: 'a', text: 'Control groups (cgroups)' },
      { id: 'b', text: 'Namespaces' },
      { id: 'c', text: 'The union filesystem' },
      { id: 'd', text: 'seccomp profiles' },
    ],
    correct: ['b'],
    explanation:
      'Namespaces isolate what a process can see - its own process tree, network stack, mount table and hostname. Cgroups control what it can USE (CPU, memory). The union filesystem assembles the image layers, and seccomp restricts which syscalls are permitted.',
  },
  {
    id: 'dkq-fnd-2',
    domainId: 'dk-foundations',
    topicId: 'dk-what-is-a-container',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'beginner',
    points: 1,
    prompt: '`docker run ubuntu bash` exits immediately. What is the most likely reason?',
    options: [
      { id: 'a', text: 'The ubuntu image does not contain bash' },
      {
        id: 'b',
        text: 'bash has no terminal attached, reads EOF and exits - and PID 1 exiting ends the container',
      },
      { id: 'c', text: 'The container ran out of memory' },
      { id: 'd', text: 'Docker requires an ENTRYPOINT to keep a container running' },
    ],
    correct: ['b'],
    explanation:
      'A container lives exactly as long as its PID 1 process. Without `-i` to keep stdin open and `-t` to allocate a terminal, bash immediately reads end-of-file and exits, so the container stops. `docker run -it ubuntu bash` behaves as expected.',
  },
  {
    id: 'dkq-fnd-3',
    domainId: 'dk-foundations',
    topicId: 'dk-what-is-a-container',
    kind: 'multi',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which statements about containers versus virtual machines are correct? (Select all that apply.)',
    options: [
      { id: 'a', text: 'A container shares the host kernel; a VM runs its own' },
      { id: 'b', text: 'Containers start faster because there is no guest OS to boot' },
      { id: 'c', text: 'A container provides stronger isolation than a hypervisor' },
      { id: 'd', text: 'A Linux container image cannot run directly on a Windows kernel' },
      { id: 'e', text: 'Containers each get a private copy of the host kernel for safety' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'Containers share the host kernel, which is what makes them fast and lightweight and also what makes their isolation weaker than a hypervisor boundary. Because the kernel is shared, a Linux image needs a Linux kernel - Docker Desktop runs a Linux VM for exactly this reason.',
  },
  {
    id: 'dkq-fnd-4',
    domainId: 'dk-foundations',
    topicId: 'dk-images-and-layers',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A Dockerfile downloads a 200MB archive in one RUN and removes it in a later RUN. What is the effect on image size?',
    options: [
      { id: 'a', text: 'The image is 200MB smaller, because the file was deleted' },
      {
        id: 'b',
        text: 'The image still contains the 200MB; the later layer only adds a whiteout marker',
      },
      { id: 'c', text: 'Docker automatically compacts layers at the end of the build' },
      { id: 'd', text: 'The size depends on whether the base image uses overlay2' },
    ],
    correct: ['b'],
    explanation:
      'Layers are immutable. A deletion in a later layer records a whiteout marker hiding the file, but the layer that added it is still part of the image and is downloaded by everyone who pulls it. Combine the download, use and removal into a single RUN, or use a multi-stage build.',
  },
  {
    id: 'dkq-fnd-5',
    domainId: 'dk-foundations',
    topicId: 'dk-images-and-layers',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which command shows every layer of the image `myapp:1.0` together with the instruction that created it and its size?',
    acceptedAnswers: ['docker image history myapp:1.0', 'docker history myapp:1.0'],
    answerHint: 'docker ... myapp:1.0',
    explanation:
      '`docker image history` (or the shorter `docker history`) lists each layer with its size and the instruction that produced it, which is how you find the instruction responsible for most of an image.',
  },
  {
    id: 'dkq-fnd-6',
    domainId: 'dk-foundations',
    topicId: 'dk-registries-and-tags',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What does `docker pull redis` actually resolve to?',
    options: [
      { id: 'a', text: 'docker.io/library/redis:latest' },
      { id: 'b', text: 'docker.io/redis:latest' },
      { id: 'c', text: 'redis:stable from the configured default registry' },
      { id: 'd', text: 'The most recently released stable version of Redis' },
    ],
    correct: ['a'],
    explanation:
      'Three defaults are filled in silently: the registry defaults to docker.io, the namespace to `library` for official images, and the tag to `latest`. `latest` is not "newest stable" - it is only the fallback tag name, and it moves whenever the publisher pushes.',
  },
  {
    id: 'dkq-fnd-7',
    domainId: 'dk-foundations',
    topicId: 'dk-registries-and-tags',
    kind: 'multi',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Which of these make a container build genuinely reproducible? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Pinning the base image by sha256 digest' },
      { id: 'b', text: 'Pinning the base image to a specific version tag such as 3.12-slim' },
      { id: 'c', text: 'Committing a dependency lockfile' },
      { id: 'd', text: 'Using the `latest` tag but rebuilding frequently' },
      { id: 'e', text: 'Recording the resulting image digest in the deployment manifest' },
    ],
    correct: ['a', 'c', 'e'],
    explanation:
      'Only a digest is immutable - version tags are moved by publishers for patch releases and rebuilt bases, which is a common cause of "the build broke overnight with no repository change". A lockfile pins dependencies, and deploying by digest ensures what you tested is what runs.',
  },
]
