import type { Question } from '../../types'

/** Original practice questions for section 2. */
export const dockerBuildQuestions: Question[] = [
  {
    id: 'dkq-bld-1',
    domainId: 'dk-build',
    topicId: 'dk-dockerfile-basics',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'An image has `ENTRYPOINT ["python", "app.py"]` and `CMD ["--verbose"]`. What runs for `docker run img --quiet`?',
    options: [
      { id: 'a', text: 'python app.py --verbose --quiet' },
      { id: 'b', text: 'python app.py --quiet' },
      { id: 'c', text: '--quiet' },
      { id: 'd', text: 'python app.py --verbose' },
    ],
    correct: ['b'],
    explanation:
      'Arguments given on `docker run` replace CMD entirely and are appended to ENTRYPOINT. This is what makes an image behave like a command-line tool with default arguments.',
  },
  {
    id: 'dkq-bld-2',
    domainId: 'dk-build',
    topicId: 'dk-dockerfile-basics',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Containers take ten seconds to stop and the application’s SIGTERM handler never runs. The Dockerfile ends `CMD node server.js`. What is the cause?',
    options: [
      { id: 'a', text: 'The stop grace period is too short' },
      { id: 'b', text: 'Shell form makes /bin/sh PID 1, and it does not forward SIGTERM to node' },
      { id: 'c', text: 'Node cannot handle SIGTERM' },
      { id: 'd', text: 'The container has no init system installed' },
    ],
    correct: ['b'],
    explanation:
      'Shell form wraps the command in `/bin/sh -c`, so the shell is PID 1 and node is its child. Docker signals PID 1 only. Use exec form - `CMD ["node", "server.js"]` - so node is PID 1 and receives the signal directly.',
  },
  {
    id: 'dkq-bld-3',
    domainId: 'dk-build',
    topicId: 'dk-dockerfile-basics',
    kind: 'multi',
    category: 'yaml',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'Which Dockerfile instructions create a new image layer? (Select all that apply.)',
    options: [
      { id: 'a', text: 'RUN' },
      { id: 'b', text: 'COPY' },
      { id: 'c', text: 'ENV' },
      { id: 'd', text: 'ADD' },
      { id: 'e', text: 'WORKDIR' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'Only instructions that change the filesystem commit a layer: RUN, COPY and ADD. ENV, WORKDIR, USER, LABEL, EXPOSE, CMD and ENTRYPOINT update the image configuration metadata instead.',
  },
  {
    id: 'dkq-bld-4',
    domainId: 'dk-build',
    topicId: 'dk-build-cache',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You edit README.md and the whole `npm ci` step re-runs. Which change fixes it most directly?',
    options: [
      { id: 'a', text: 'Add --no-cache to the build' },
      {
        id: 'b',
        text: 'Copy package.json and the lockfile before the install, and the rest of the source after it',
      },
      { id: 'c', text: 'Move the RUN npm ci to the end of the Dockerfile' },
      { id: 'd', text: 'Use ADD instead of COPY' },
    ],
    correct: ['b'],
    explanation:
      'The COPY cache key includes a checksum of the copied files, so `COPY . .` before the install invalidates it on any file change. Copying only the dependency manifest first means source edits leave the install layer cached. Adding README.md to .dockerignore helps too.',
  },
  {
    id: 'dkq-bld-5',
    domainId: 'dk-build',
    topicId: 'dk-build-cache',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt: 'Why is a long-cached `RUN apt-get update` layer dangerous?',
    options: [
      { id: 'a', text: 'It makes the image larger over time' },
      {
        id: 'b',
        text: 'Its cache key is only the command text, so a months-old package index is reused',
      },
      { id: 'c', text: 'apt-get cannot be cached at all' },
      { id: 'd', text: 'It invalidates every later layer on each build' },
    ],
    correct: ['b'],
    explanation:
      'Docker cannot know whether `apt-get update` would fetch something new - it sees an unchanged command string and reuses the layer. Always combine it with the install in one RUN (`apt-get update && apt-get install -y ...`) so they share a cache key.',
  },
  {
    id: 'dkq-bld-6',
    domainId: 'dk-build',
    topicId: 'dk-build-cache',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which command builds the current directory as `myapp:1.0` while ignoring all cached layers?',
    acceptedAnswers: [
      'docker build --no-cache -t myapp:1.0 .',
      'docker build -t myapp:1.0 --no-cache .',
      'docker buildx build --no-cache -t myapp:1.0 .',
    ],
    answerHint: 'docker build ... -t myapp:1.0 .',
    explanation:
      '`--no-cache` forces every instruction to execute, which is how you prove whether a problem is a stale cached layer or a genuine code issue.',
  },
  {
    id: 'dkq-bld-7',
    domainId: 'dk-build',
    topicId: 'dk-multi-stage-builds',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'In a multi-stage build, what ends up in the final image from an earlier stage?',
    options: [
      { id: 'a', text: 'Everything from every stage, merged' },
      { id: 'b', text: 'Only what is explicitly brought across with COPY --from' },
      { id: 'c', text: 'The last three layers of each stage' },
      { id: 'd', text: 'Whatever the earlier stage declared as a VOLUME' },
    ],
    correct: ['b'],
    explanation:
      'Each FROM starts a stage with its own filesystem, and only `COPY --from` carries anything forward. This is why a build secret confined to a builder stage is genuinely safe, unlike one copied in and deleted later.',
  },
  {
    id: 'dkq-bld-8',
    domainId: 'dk-build',
    topicId: 'dk-multi-stage-builds',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Your Go binary runs in the builder stage but a `scratch`-based image exits with "no such file or directory", although the binary is present. Why?',
    options: [
      { id: 'a', text: 'The binary was copied to the wrong path' },
      { id: 'b', text: 'The binary is dynamically linked and scratch has no dynamic linker' },
      { id: 'c', text: 'scratch images cannot run ENTRYPOINT in exec form' },
      { id: 'd', text: 'The binary needs executable permissions set with chmod' },
    ],
    correct: ['b'],
    explanation:
      'The message refers to the missing dynamic linker, not to your binary - which is why it is so misleading. Build with `CGO_ENABLED=0` for a static binary, or use a base image that provides libc. `ldd` on the binary confirms it.',
  },
]
