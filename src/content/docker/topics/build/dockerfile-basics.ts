import type { Topic } from '../../../types'

export const dockerfileBasics: Topic = {
  id: 'dk-dockerfile-basics',
  title: 'Writing a Dockerfile',
  domainId: 'dk-build',
  difficulty: 'beginner',
  estimatedMinutes: 18,
  order: 1,
  tags: ['dockerfile', 'build', 'entrypoint', 'cmd', 'copy', 'workdir'],
  oneLiner:
    'The instructions that matter, what each one commits to a layer, and the ENTRYPOINT/CMD pairing everyone gets wrong once.',
  explanation: [
    'A **Dockerfile** is a recipe. Each instruction is executed in order against the result of the previous one, and the instructions that change the filesystem commit a new layer. `docker build` runs it and produces an image.',
    'You will use perhaps ten instructions in practice. `FROM` sets the base. `WORKDIR` sets the directory for everything after it. `COPY` brings files in. `RUN` executes a command at **build** time. `ENV` sets environment variables that persist into the running container. `EXPOSE` documents a port. `USER` switches the account. `ENTRYPOINT` and `CMD` decide what runs at **start** time.',
    'The distinction that causes the most confusion is **build time versus run time**. `RUN` happens once, while the image is being built, and its result is baked into a layer. `CMD` happens every time a container starts and nothing about it is baked in. Putting `RUN npm start` in a Dockerfile hangs the build; putting `CMD npm ci` reinstalls dependencies on every start.',
    'The second is **ENTRYPOINT versus CMD**. `ENTRYPOINT` is the executable; `CMD` provides default arguments to it. Anything you type after the image name on `docker run` replaces `CMD` but not `ENTRYPOINT` - which is exactly how you make an image behave like a command-line tool.',
  ],
  whyItMatters: [
    'A Dockerfile is the contract for how your application is packaged. Getting the instruction order wrong costs minutes on every build; getting ENTRYPOINT wrong costs an outage when a signal is not delivered.',
    'Shell form versus exec form decides whether your process is PID 1 and whether it receives SIGTERM. That single choice is the difference between a graceful shutdown and a ten-second kill on every deploy.',
    'Most image-size and build-speed problems are visible in the Dockerfile before you build anything.',
  ],
  howItWorks: [
    '`docker build` sends the **build context** - the directory you point it at - to the builder. Everything in it is uploaded unless excluded by `.dockerignore`, which is why a context containing `node_modules` or `.git` makes builds slow.',
    'Instructions execute in order. Filesystem-changing ones (`RUN`, `COPY`, `ADD`) commit a layer; metadata ones (`ENV`, `LABEL`, `EXPOSE`, `WORKDIR`, `USER`, `CMD`, `ENTRYPOINT`) only update the image config.',
    'Each instruction is checked against the **build cache** first. A cache hit reuses the existing layer; the first miss invalidates every instruction after it.',
    '`COPY` takes files from the build context. `ADD` does the same but also unpacks local tar archives and fetches URLs - behaviour surprising enough that `COPY` is the recommended default.',
    'At run time the daemon executes `ENTRYPOINT` followed by `CMD` as a single argument vector. With no `ENTRYPOINT`, `CMD` is simply the command.',
    '**Exec form** (`CMD ["node", "server.js"]`) runs the binary directly as PID 1. **Shell form** (`CMD node server.js`) wraps it in `/bin/sh -c`, so the shell is PID 1 and, unless it execs, your process never receives signals sent to the container.',
  ],
  diagrams: [
    {
      kind: 'decision',
      title: 'ENTRYPOINT, CMD, or both?',
      caption:
        'Arguments on docker run replace CMD and are appended to ENTRYPOINT. That is the whole rule.',
      question: 'What should happen when somebody passes arguments to docker run?',
      branches: [
        {
          condition: 'They should replace the whole command',
          result: 'CMD only',
          detail: 'a general-purpose image such as a base language image',
          tone: 'accent',
        },
        {
          condition: 'They should be arguments to a fixed program',
          result: 'ENTRYPOINT plus CMD defaults',
          detail: 'the image behaves like a command-line tool',
          tone: 'success',
        },
        {
          condition: 'Nothing should be overridable',
          result: 'ENTRYPOINT in exec form only',
          detail: 'overriding then needs an explicit --entrypoint flag',
          tone: 'warning',
        },
      ],
    },
    {
      kind: 'flow',
      title: 'Build time versus run time',
      caption:
        'Everything left of the image happens once. Everything right of it happens on every container start.',
      nodes: [
        {
          label: 'Build context uploaded',
          detail: 'the whole directory, minus .dockerignore',
          tone: 'accent',
        },
        {
          label: 'RUN, COPY and ADD execute',
          detail: 'build time - each commits a layer into the image',
          arrowLabel: 'docker build',
        },
        {
          label: 'Image produced',
          detail: 'read-only layers plus config holding ENV, CMD and ENTRYPOINT',
          arrowLabel: 'result',
          tone: 'success',
        },
        {
          label: 'ENTRYPOINT plus CMD executed',
          detail: 'run time - once per container, nothing is baked in',
          arrowLabel: 'docker run',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Dockerfile instruction',
      purpose: 'One step in the recipe. Some commit a layer; the rest only change image metadata.',
      fields: [
        { path: 'FROM', meaning: 'Base image. Must be first (after any ARG).', required: true },
        {
          path: 'WORKDIR',
          meaning: 'Sets the directory for later instructions. Creates it if absent.',
        },
        { path: 'COPY src dest', meaning: 'Copies from the build context into the image.' },
        { path: 'RUN cmd', meaning: 'Executes at BUILD time and commits the result to a layer.' },
        { path: 'ENV key=value', meaning: 'Environment variable present at build and run time.' },
        {
          path: 'USER name',
          meaning: 'Account for later RUN steps and for the running container.',
        },
        {
          path: 'ENTRYPOINT ["exe"]',
          meaning: 'The executable. Not replaced by docker run arguments.',
        },
        {
          path: 'CMD ["args"]',
          meaning: 'Default command or default arguments. Replaced by docker run arguments.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The deploy that always took thirty seconds too long',
    story: [
      'A team notices every rolling deploy pauses about ten seconds per container before the old one disappears. Nothing in the application logs explains it, and the shutdown handler they wrote never seems to run.',
      'The Dockerfile ended `CMD npm start`. Shell form, so PID 1 was `/bin/sh -c npm start`, with node as a child. Docker sends SIGTERM to PID 1; `sh` did not forward it, node never saw it, and after the ten-second grace period Docker sent SIGKILL.',
      'Changing it to `CMD ["node", "server.js"]` made node PID 1, so SIGTERM arrived directly, the shutdown handler ran, in-flight requests drained, and the container exited in under a second. One line, and deploys got thirty seconds shorter per batch.',
    ],
  },
  yamlExamples: [
    {
      title: 'A Dockerfile with the common mistakes in it',
      language: 'dockerfile',
      explanation:
        'Every line here is legal and several are wrong. It builds, runs, and misbehaves in ways that are hard to attribute later.',
      code: `FROM node:latest                 # unpinned - moves under you
WORKDIR /app
COPY . .                         # kills the cache on every source change
RUN npm install                  # installs devDependencies too
ENV NODE_ENV=production          # set AFTER install, so it had no effect
EXPOSE 3000
CMD npm start                    # shell form - PID 1 is sh, signals lost`,
    },
    {
      title: 'The same application, written properly',
      language: 'dockerfile',
      explanation:
        'Pinned base, cache-friendly order, non-root user, exec form. Nothing exotic - just the defaults being correct.',
      code: `FROM node:22-alpine

# Set before the install so it actually affects it
ENV NODE_ENV=production

WORKDIR /app

# Manifest first: this layer is cached until dependencies change
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Source last: a code edit rebuilds only from here down
COPY . .

# The node image already provides an unprivileged 'node' user
USER node

EXPOSE 3000

# Exec form: node is PID 1 and receives SIGTERM directly
CMD ["node", "server.js"]`,
    },
    {
      title: 'ENTRYPOINT plus CMD, making the image behave like a tool',
      language: 'dockerfile',
      explanation:
        'docker run img            -> curl --silent https://example.com\ndocker run img -v https://x -> curl -v https://x',
      code: `FROM alpine:3.20
RUN apk add --no-cache curl

ENTRYPOINT ["curl"]
CMD ["--silent", "https://example.com"]`,
    },
  ],
  imperative: [
    {
      command: 'docker build -t myapp:1.0 .',
      what: 'Builds the Dockerfile in the current directory, using it as the build context.',
      expected: 'Successfully tagged myapp:1.0',
    },
    {
      command: 'docker build -f Dockerfile.prod -t myapp:prod .',
      what: 'Builds a differently named Dockerfile with the same context.',
    },
    {
      command: 'docker run --rm myapp:1.0',
      what: 'Runs the image with its default ENTRYPOINT and CMD.',
    },
    {
      command: 'docker run --rm myapp:1.0 --help',
      what: 'Replaces CMD with --help. With an ENTRYPOINT set, this becomes an argument to it.',
    },
  ],
  declarative: {
    steps: [
      'Write a Dockerfile with the dependency manifest copied before the source.',
      'Build it and note how long each step takes.',
      'Edit a source file, rebuild, and confirm only the final layers are rebuilt.',
      'Switch CMD between shell and exec form and observe which process is PID 1.',
    ],
    code: [
      {
        title: 'Seeing the shell-form signal problem directly',
        language: 'bash',
        explanation:
          'The exec-form container stops almost instantly; the shell-form one waits out the full grace period.',
        code: `# Shell form: sh is PID 1 and swallows the signal
printf 'FROM alpine:3.20\\nCMD sleep 300\\n' > Dockerfile.shell
docker build -f Dockerfile.shell -t sig:shell .
docker run -d --name s1 sig:shell
docker exec s1 ps -o pid,comm      # PID 1 is sh
time docker stop s1                # about 10 seconds - SIGKILL ended it

# Exec form: sleep is PID 1 and gets the signal
printf 'FROM alpine:3.20\\nCMD ["sleep","300"]\\n' > Dockerfile.exec
docker build -f Dockerfile.exec -t sig:exec .
docker run -d --name s2 sig:exec
docker exec s2 ps -o pid,comm      # PID 1 is sleep
time docker stop s2                # immediate

docker rm s1 s2`,
      },
    ],
  },
  verification: [
    {
      command:
        'docker image inspect <image> --format "{{json .Config.Cmd}} {{json .Config.Entrypoint}}"',
      what: 'Shows exactly what will run, and in which form.',
      expected:
        'An array means exec form; a three-element array starting with /bin/sh -c means shell form.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker exec <container> ps -o pid,comm',
      what: 'Confirms which process is PID 1.',
      expected: 'Your application, not sh.',
      placeholders: ['<container>'],
    },
    {
      command: 'docker image history <image>',
      what: 'Shows the instruction behind each layer and its size.',
      placeholders: ['<image>'],
    },
  ],
  troubleshooting: [
    {
      command: 'docker build --progress=plain --no-cache -t myapp .',
      what: 'Full build output with no cache, which is how you see the real error from a failing step.',
    },
    {
      command: 'docker run --rm -it --entrypoint sh <image>',
      what: 'Overrides ENTRYPOINT to get a shell in an image that otherwise runs one command.',
      placeholders: ['<image>'],
    },
    {
      command: 'docker build -t myapp . 2>&1 | grep -i "no such file"',
      what: 'A COPY failing this way almost always means the path is outside the build context or excluded by .dockerignore.',
    },
  ],
  commonMistakes: [
    'Using shell form for CMD or ENTRYPOINT, so `/bin/sh` is PID 1 and your process never receives SIGTERM.',
    'Putting `COPY . .` before the dependency install, throwing away the build cache on every source change.',
    'Setting `ENV NODE_ENV=production` after the install step, so the install never saw it.',
    'Using `ADD` for a plain local file. It also unpacks archives and fetches URLs - `COPY` is the predictable choice.',
    'Believing `EXPOSE` publishes a port. It is documentation; `-p` is what publishes.',
  ],
  examTips: [
    'RUN is build time, CMD is run time. Every confusing Dockerfile question reduces to this.',
    'Arguments after the image name replace CMD and are appended to ENTRYPOINT.',
    'Exec form makes your process PID 1; shell form makes `/bin/sh -c` PID 1.',
    'Only RUN, COPY and ADD create layers. ENV, LABEL, WORKDIR and USER are metadata.',
    'EXPOSE documents intent and does nothing at run time on its own.',
  ],
  summary: [
    'Instructions execute in order; RUN, COPY and ADD commit layers, the rest set metadata.',
    'ENTRYPOINT is the executable, CMD supplies default arguments that docker run replaces.',
    'Exec form runs your binary as PID 1 so signals reach it; shell form does not.',
    'Copy the dependency manifest before the source so the cache survives code edits.',
    'Prefer COPY over ADD, and pin the base image.',
  ],
  practice: [
    {
      id: 'dk-dockerfile-basics-p1',
      level: 'beginner',
      prompt:
        'The image ends `ENTRYPOINT ["python", "app.py"]` and `CMD ["--verbose"]`. What runs for `docker run img --quiet`?',
      answer: '`python app.py --quiet`. The argument replaced CMD; ENTRYPOINT was untouched.',
      explanation:
        'That is the whole ENTRYPOINT/CMD contract, and it is what lets an image behave like a command-line tool with sensible defaults.',
    },
    {
      id: 'dk-dockerfile-basics-p2',
      level: 'beginner',
      prompt: 'Why does `RUN npm start` hang the build?',
      answer:
        'RUN executes at build time and waits for the command to finish. A server never finishes, so the build blocks until it is cancelled. Starting the application belongs in CMD, which runs when a container starts.',
      explanation:
        'The build/run distinction is the single most common beginner error, and the symptom - a build that appears to freeze - is unmistakable once you know it.',
    },
    {
      id: 'dk-dockerfile-basics-p3',
      level: 'intermediate',
      prompt:
        'Containers take ten seconds to stop and your shutdown handler never runs. The Dockerfile ends `CMD node server.js`. What is wrong?',
      answer:
        'Shell form makes `/bin/sh -c` PID 1, and it does not forward SIGTERM to node. Docker waits out the grace period and then sends SIGKILL. Use exec form: `CMD ["node", "server.js"]`.',
      explanation:
        'You can confirm it with `docker exec <c> ps -o pid,comm` - PID 1 should be your application, not sh.',
    },
    {
      id: 'dk-dockerfile-basics-p4',
      level: 'advanced',
      prompt:
        'Your image must run a shell wrapper for initialisation but still handle signals correctly. How?',
      answer:
        'Have the wrapper `exec` the real program as its final line, so the process replaces the shell and inherits PID 1. Alternatively add a minimal init such as tini as the ENTRYPOINT, which forwards signals and reaps zombies.',
      explanation:
        '`exec "$@"` at the end of an entrypoint script is the standard pattern. `docker run --init` injects an init process without changing the image at all.',
    },
  ],
  lab: {
    title: 'Build an image properly, then break it on purpose',
    scenario:
      'Write a small web application image, verify signal handling, then reorder the Dockerfile to see the cache behaviour change.',
    prerequisites: ['Docker installed', 'An empty directory'],
    tasks: [
      {
        instruction:
          'Create `server.js` that listens on port 3000 and logs on SIGTERM before exiting.',
      },
      {
        instruction:
          'Write a Dockerfile using `node:22-alpine`, copying `package.json` before the source, running as the `node` user, with exec-form CMD.',
      },
      { instruction: 'Build it as `lab:good` and run it with `-p 3000:3000`.' },
      {
        instruction:
          'Stop the container and confirm your SIGTERM log line appears and it stops quickly.',
        hint: '`time docker stop <name>` should be well under a second.',
      },
      {
        instruction: 'Change CMD to shell form, rebuild, and time the stop again.',
      },
      {
        instruction: 'Edit `server.js`, rebuild, and note which layers are reused from cache.',
      },
    ],
    solution: [
      {
        title: 'server.js and Dockerfile',
        language: 'dockerfile',
        code: `# server.js
#   const http = require('http')
#   const s = http.createServer((_, res) => res.end('ok'))
#   s.listen(3000, () => console.log('listening'))
#   process.on('SIGTERM', () => { console.log('SIGTERM received'); s.close(() => process.exit(0)) })

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm ci --omit=dev || true
COPY . .
USER node
EXPOSE 3000
CMD ["node", "server.js"]`,
      },
      {
        title: 'Build, run and compare',
        language: 'bash',
        code: `docker build -t lab:good .
docker run -d --name good -p 3000:3000 lab:good
curl -s localhost:3000            # ok

time docker stop good             # fast, and the log shows SIGTERM received
docker logs good | tail -2

# Now break it deliberately
sed -i 's|CMD \\["node", "server.js"\\]|CMD node server.js|' Dockerfile
docker build -t lab:bad .
docker run -d --name bad -p 3001:3000 lab:bad
time docker stop bad              # about 10 seconds, no SIGTERM log

docker rm good bad`,
      },
    ],
    verification: [
      {
        command: 'docker exec good ps -o pid,comm',
        what: 'Confirms node is PID 1 in the correctly built image.',
        expected: '1 node',
      },
      {
        command: 'docker logs good | grep SIGTERM',
        what: 'Proves the signal reached the application.',
        expected: 'SIGTERM received',
      },
    ],
    cleanup: [
      {
        command: 'docker rm -f good bad 2>/dev/null; docker rmi lab:good lab:bad 2>/dev/null; true',
        what: 'Removes the lab containers and images.',
      },
    ],
  },
  relatedTopicIds: ['dk-build-cache', 'dk-multi-stage-builds', 'dk-container-lifecycle'],
  docs: [
    { title: 'Dockerfile reference', url: 'https://docs.docker.com/reference/dockerfile/' },
    {
      title: 'Building best practices',
      url: 'https://docs.docker.com/build/building/best-practices/',
    },
  ],
}
