import type { Question } from '../../types'

/** Original practice questions for section 3. */
export const dockerRunQuestions: Question[] = [
  {
    id: 'dkq-run-1',
    domainId: 'dk-run',
    topicId: 'dk-container-lifecycle',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What does `docker stop` do that `docker kill` does not?',
    options: [
      { id: 'a', text: 'It removes the container afterwards' },
      { id: 'b', text: 'It sends SIGTERM first and waits a grace period before SIGKILL' },
      { id: 'c', text: 'It flushes the container logs to disk' },
      { id: 'd', text: 'It preserves the writable layer' },
    ],
    correct: ['b'],
    explanation:
      '`docker stop` sends SIGTERM to PID 1 and waits - ten seconds by default - giving the application a chance to drain in-flight work before SIGKILL. `docker kill` sends SIGKILL immediately. Both preserve the writable layer until `docker rm`.',
  },
  {
    id: 'dkq-run-2',
    domainId: 'dk-run',
    topicId: 'dk-container-lifecycle',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A container exited with code 137. Which single command best distinguishes the two common causes?',
    options: [
      { id: 'a', text: 'docker logs <container>' },
      { id: 'b', text: 'docker inspect -f "{{.State.OOMKilled}}" <container>' },
      { id: 'c', text: 'docker stats <container>' },
      { id: 'd', text: 'docker events --filter container=<container>' },
    ],
    correct: ['b'],
    explanation:
      '137 is 128 + 9, meaning the process died of SIGKILL - but that could be the kernel enforcing the memory limit or a `docker stop` that timed out. `OOMKilled` is true only for the first, which settles it immediately.',
  },
  {
    id: 'dkq-run-3',
    domainId: 'dk-run',
    topicId: 'dk-container-lifecycle',
    kind: 'command',
    category: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which command stops the container `api` but allows 30 seconds for graceful shutdown instead of the default?',
    acceptedAnswers: [
      'docker stop --time 30 api',
      'docker stop -t 30 api',
      'docker stop --time=30 api',
      'docker container stop --time 30 api',
    ],
    answerHint: 'docker stop ... api',
    explanation:
      'The grace period is the window between SIGTERM and SIGKILL. A service with long-lived connections often needs more than the default ten seconds - and every layer above it (orchestrator, load balancer) must allow at least as long.',
  },
  {
    id: 'dkq-run-4',
    domainId: 'dk-run',
    topicId: 'dk-config-and-resources',
    kind: 'mcq',
    category: 'concept',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'What happens when a container exceeds its `--cpus` quota?',
    options: [
      { id: 'a', text: 'The kernel kills the process, as with a memory limit' },
      { id: 'b', text: 'It is throttled - paused until the next scheduling period' },
      { id: 'c', text: 'Docker restarts the container' },
      { id: 'd', text: 'The quota is raised automatically if the host has capacity' },
    ],
    correct: ['b'],
    explanation:
      'CPU is a compressible resource, so exceeding the quota produces latency, not death. Memory is incompressible - there is nothing to throttle, so the kernel OOM-kills immediately. That asymmetry is the most important thing to know about limits.',
  },
  {
    id: 'dkq-run-5',
    domainId: 'dk-run',
    topicId: 'dk-config-and-resources',
    kind: 'multi',
    category: 'concept',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Why is `-e DB_PASSWORD=secret` a poor way to pass a secret into a container? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Anyone who can run docker inspect sees it in plain text' },
      { id: 'b', text: 'It is readable from /proc/<pid>/environ inside the container' },
      { id: 'c', text: 'Environment variables are stored unencrypted in the image layers' },
      { id: 'd', text: 'It is inherited by child processes and often captured by crash reporters' },
      { id: 'e', text: 'Docker refuses to start containers with secrets in environment variables' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'Run-time environment variables are not in the image (that would be ENV in the Dockerfile), but they are visible through `docker inspect`, through `/proc`, and to every child process - which is how they end up in error-reporting payloads. Mount a file and read it instead.',
  },
  {
    id: 'dkq-run-6',
    domainId: 'dk-run',
    topicId: 'dk-config-and-resources',
    kind: 'mcq',
    category: 'troubleshoot',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You deliberately stop a container, restart the Docker daemon, and the container is running again. Which restart policy is set?',
    options: [
      { id: 'a', text: 'no' },
      { id: 'b', text: 'on-failure' },
      { id: 'c', text: 'always' },
      { id: 'd', text: 'unless-stopped' },
    ],
    correct: ['c'],
    explanation:
      '`always` restarts the container whenever the daemon starts, regardless of a manual stop. `unless-stopped` is otherwise identical but remembers that you stopped it on purpose, which is why it suits most long-running services.',
  },
  {
    id: 'dkq-run-7',
    domainId: 'dk-run',
    topicId: 'dk-config-and-resources',
    kind: 'task',
    category: 'lab',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'Run an image `api:1.0` so that it is limited to 512MB of memory and one CPU, restarts unless you stop it yourself, and publishes port 8080 only on the host loopback interface.',
    context: 'A single Docker host shared with other services.',
    checkpoints: [
      { id: 'c1', text: 'Memory is limited to 512m and swap is not used to exceed it' },
      { id: 'c2', text: 'CPU is limited to 1.0' },
      { id: 'c3', text: 'The restart policy is unless-stopped' },
      { id: 'c4', text: 'Port 8080 is bound to 127.0.0.1 only, not 0.0.0.0' },
    ],
    solution: [
      {
        title: 'The run command',
        language: 'bash',
        code: `docker run -d --name api \\
  --memory 512m --memory-swap 512m \\
  --cpus 1.0 \\
  --restart unless-stopped \\
  -p 127.0.0.1:8080:8080 \\
  api:1.0

# Verify
docker inspect -f '{{.HostConfig.Memory}} {{.HostConfig.NanoCpus}}' api
docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' api
docker port api      # 8080/tcp -> 127.0.0.1:8080`,
      },
    ],
    explanation:
      'Setting `--memory-swap` equal to `--memory` prevents swap being used to exceed the ceiling. Binding to 127.0.0.1 matters on any host with a public address - the default binds on every interface.',
  },
]
