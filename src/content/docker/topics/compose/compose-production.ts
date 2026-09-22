import type { Topic } from '../../../types'

export const composeProduction: Topic = {
  id: 'dk-compose-production',
  title: 'Compose beyond the laptop',
  domainId: 'dk-compose',
  difficulty: 'advanced',
  estimatedMinutes: 16,
  order: 2,
  tags: ['compose', 'overrides', 'profiles', 'environments', 'orchestration'],
  oneLiner:
    'Override files, profiles and variable interpolation - and an honest account of where Compose stops being the right tool.',
  explanation: [
    'One Compose file rarely serves every environment. Development wants bind-mounted source, debug logging and published database ports; production wants none of those. Compose solves this with **override files** rather than duplicated configuration.',
    '`docker compose up` automatically merges `compose.yaml` with `compose.override.yaml` if it exists. You can also pass files explicitly with repeated `-f` flags, and later files override earlier ones. The common pattern is a base file with what is always true, plus a per-environment file with the differences.',
    '**Profiles** solve a different problem: optional services. A service tagged `profiles: [debug]` is not started by a plain `up` - only by `--profile debug`. That keeps a mailhog, a database admin UI or a load generator in the same file without running them by default.',
    'Variables come from the shell, from a `.env` file next to the Compose file, and from `env_file` entries on individual services. The distinction matters: `.env` values are interpolated into the **Compose file itself**, while `env_file` values are passed into the **container**. Confusing the two produces variables that are mysteriously empty.',
  ],
  whyItMatters: [
    'Duplicating a Compose file per environment guarantees they drift. Overrides keep one source of truth and make the differences between environments explicit and small.',
    'Knowing where Compose stops is a senior judgement. Teams run Compose in production far past the point where it is sensible, and then discover it has no rolling updates, no multi-host scheduling and no self-healing beyond restart policies.',
    'The `.env` versus `env_file` distinction is a recurring, genuinely confusing bug that costs people hours.',
  ],
  howItWorks: [
    'Compose merges files in the order given. Scalars are replaced by later files; most sequences are **appended**, not replaced - which surprises people with `ports` and `volumes`.',
    'The automatic override file is `compose.override.yaml`. Naming a file explicitly with `-f` disables that automatic behaviour, so an explicit invocation must list every file it needs.',
    '`docker compose config` renders the final merged result. This is the only reliable way to know what will actually run.',
    'Profiles attach services to named groups. A service with no `profiles` key always runs; one with profiles runs only when a matching profile is enabled.',
    'Interpolation happens when the file is read: `${VAR}` is substituted from the shell environment or `.env`, with `${VAR:-default}` supported. An unset variable becomes an empty string, and a warning.',
    '`env_file` is different - it is a list of files whose contents become environment variables **inside the container**, and they are never interpolated into the Compose file.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'How Compose resolves a configuration',
      caption:
        'Run config before up when anything is surprising - it shows exactly what Compose decided.',
      nodes: [
        {
          label: 'Read the base compose.yaml',
          detail: 'everything that is true in every environment',
          tone: 'accent',
        },
        {
          label: 'Merge override files in order',
          detail: 'later wins for scalars; sequences usually append',
          arrowLabel: 'merge',
        },
        {
          label: 'Interpolate variables',
          detail: 'from the shell and .env - unset becomes empty plus a warning',
          arrowLabel: 'substitute',
          tone: 'warning',
        },
        {
          label: 'Filter by active profiles',
          detail: 'profiled services are skipped unless enabled',
          arrowLabel: 'select',
        },
        {
          label: 'Final configuration',
          detail: 'exactly what docker compose config prints',
          arrowLabel: 'result',
          tone: 'success',
        },
      ],
    },
    {
      kind: 'decision',
      title: 'Is Compose still the right tool here?',
      caption:
        'Compose is excellent up to one host. Past that the missing features are not small ones.',
      question: 'What does this deployment need?',
      branches: [
        {
          condition: 'Local development, or CI test fixtures',
          result: 'Compose, comfortably',
          detail: 'this is what it is best at, and nothing beats it for the job',
          tone: 'success',
        },
        {
          condition: 'A single small server, downtime acceptable',
          result: 'Compose is defensible',
          detail: 'restart policies cover crashes; accept the deploy gap',
          tone: 'accent',
        },
        {
          condition: 'Zero-downtime deploys or health-based routing',
          result: 'An orchestrator',
          detail: 'Compose has no rolling update and no load-balancer integration',
          tone: 'warning',
        },
        {
          condition: 'More than one host, or autoscaling',
          result: 'Kubernetes or a managed service',
          detail: 'Compose schedules nothing across machines',
          tone: 'danger',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Compose file resolution',
      purpose: 'Where configuration comes from, and in what order it is applied.',
      fields: [
        { path: 'compose.yaml', meaning: 'The base file. Everything true in every environment.' },
        { path: 'compose.override.yaml', meaning: 'Merged automatically when no -f is given.' },
        {
          path: '-f a.yaml -f b.yaml',
          meaning: 'Explicit list. Later files override earlier ones.',
        },
        { path: '.env', meaning: 'Interpolated INTO the Compose file. Not passed to containers.' },
        {
          path: 'env_file:',
          meaning: 'Passed INTO the container. Not interpolated into the file.',
        },
        { path: 'profiles:', meaning: 'Service runs only when that profile is enabled.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'The staging stack that could not be deployed without downtime',
    story: [
      'A team ran their staging environment with Compose on one VM. It worked well for two years: `git pull && docker compose up -d --build` and they were done.',
      'Then staging started being used for customer demos, and a thirty-second gap during every deploy became unacceptable. They tried scripting a blue-green switch with two Compose projects and a reverse proxy, and produced something that mostly worked and that only its author understood.',
      'They moved staging to the same managed Kubernetes service production already used. The honest retrospective was that Compose had been the right tool for two years and the wrong one for the last three months - and that the failure was not noticing the transition, not the original choice. Compose remained in the repository for local development, where it is still the best option available.',
    ],
  },
  yamlExamples: [
    {
      title: 'Base plus environment overrides',
      language: 'yaml',
      explanation:
        'The base holds what is always true. Each override holds only the differences, so they stay short and reviewable.',
      code: `# compose.yaml - the invariant parts
services:
  api:
    image: ghcr.io/acme/api:\${API_TAG:-latest}
    environment:
      LOG_LEVEL: \${LOG_LEVEL:-info}
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'wget', '-qO-', 'http://localhost:8080/healthz']
      interval: 10s
      retries: 3

  db:
    image: postgres:17
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:

---
# compose.override.yaml - picked up automatically, for development
services:
  api:
    build: .                       # build locally instead of pulling
    volumes:
      - ./src:/app/src             # live source
    environment:
      LOG_LEVEL: debug
    ports:
      - '127.0.0.1:8080:8080'

  db:
    ports:
      - '127.0.0.1:5432:5432'      # so a local client can connect

---
# compose.prod.yaml - used explicitly, never automatically
services:
  api:
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    environment:
      LOG_LEVEL: warn
    ports:
      - '8080:8080'`,
    },
    {
      title: 'Profiles for optional services',
      language: 'yaml',
      explanation:
        'A plain `up` starts api and db only. `--profile tools` adds the admin UI; `--profile test` adds the load generator.',
      code: `services:
  api:
    image: ghcr.io/acme/api:latest    # no profiles - always runs
  db:
    image: postgres:17                # no profiles - always runs

  adminer:
    image: adminer:5
    profiles: [tools]
    ports: ['127.0.0.1:8081:8080']

  loadgen:
    image: grafana/k6:latest
    profiles: [test]
    command: run /scripts/load.js

# docker compose up -d                      -> api, db
# docker compose --profile tools up -d      -> api, db, adminer
# docker compose --profile test run loadgen -> one-off load test`,
    },
  ],
  imperative: [
    {
      command: 'docker compose -f compose.yaml -f compose.prod.yaml up -d',
      what: 'Merges base and production overrides explicitly. The automatic override file is ignored.',
    },
    {
      command: 'docker compose --profile tools up -d',
      what: 'Starts the default services plus everything in the named profile.',
    },
    {
      command: 'docker compose config',
      what: 'Prints the fully merged and interpolated configuration.',
      expected: 'The exact configuration that would be applied - check this before any surprise.',
    },
    {
      command: 'docker compose up -d --no-deps --build api',
      what: 'Rebuilds and recreates one service without touching its dependencies.',
    },
  ],
  declarative: {
    steps: [
      'Split a single Compose file into a base plus a development override.',
      'Add a production override and confirm with `config` which values win.',
      'Move an optional tool behind a profile and verify it does not start by default.',
      'Check how a sequence such as `ports` merges compared with a scalar such as `image`.',
    ],
    code: [
      {
        title: 'Seeing what the merge actually produced',
        language: 'bash',
        explanation:
          'Sequences append and scalars replace. Confirming this with config takes seconds and avoids a class of confusing bugs.',
        code: `# What does development resolve to? (override file is automatic)
docker compose config | head -40

# What does production resolve to? (explicit -f disables the automatic override)
docker compose -f compose.yaml -f compose.prod.yaml config | head -40

# Just the differences that matter
docker compose config --services
docker compose -f compose.yaml -f compose.prod.yaml config \\
  | grep -A3 'ports:'

# Variables: .env is interpolated into the FILE
printf 'API_TAG=1.4.2\\nLOG_LEVEL=debug\\n' > .env
docker compose config | grep 'image:'
#   image: ghcr.io/acme/api:1.4.2

# An unset variable becomes empty, with a warning - not an error
unset API_TAG; rm .env
docker compose config | grep 'image:'
#   image: ghcr.io/acme/api:latest   (thanks to the :- default)`,
      },
    ],
  },
  verification: [
    {
      command: 'docker compose config --quiet',
      what: 'Validates the merged file and prints nothing on success. Ideal as a CI check.',
    },
    {
      command: 'docker compose config --profiles',
      what: 'Lists every profile defined across the files.',
    },
    {
      command: 'docker compose ps --all --format "table {{.Service}}\\t{{.Status}}"',
      what: 'Confirms which services actually started, including profiled ones.',
    },
  ],
  troubleshooting: [
    {
      command: 'docker compose config | grep -n "<key>"',
      what: 'Finds which value won a merge when two files set the same key.',
      placeholders: ['<key>'],
    },
    {
      command: 'docker compose --env-file .env.staging config',
      what: 'Renders with a specific variable file, which is how you check an environment before deploying it.',
    },
    {
      command: 'docker compose exec <service> env',
      what: 'Shows the environment inside the container - the fastest way to see whether env_file was applied.',
      placeholders: ['<service>'],
    },
  ],
  commonMistakes: [
    'Maintaining a whole separate Compose file per environment. They drift, and the drift is invisible until something breaks.',
    'Confusing `.env` with `env_file`. The first is interpolated into the Compose file; the second is passed into the container.',
    'Expecting `-f` to still merge `compose.override.yaml`. An explicit `-f` list replaces the automatic behaviour entirely.',
    'Assuming sequences replace on merge. `ports` and `volumes` append, so an override can add a published port you did not want in production.',
    'Running Compose in production past the point where rolling updates and multi-host scheduling matter, then building a bespoke deployment script to compensate.',
  ],
  examTips: [
    'Later `-f` files override earlier ones; scalars replace and sequences generally append.',
    'An explicit `-f` disables automatic pickup of `compose.override.yaml`.',
    '`.env` interpolates into the Compose file; `env_file` sets variables inside the container.',
    'A service with `profiles` does not start unless that profile is enabled.',
    '`docker compose config` is the authoritative view of what will run.',
  ],
  summary: [
    'Use one base file plus small per-environment overrides rather than duplicated files.',
    'Profiles keep optional services in the same file without running them by default.',
    'Know the difference between interpolation (`.env`) and container environment (`env_file`).',
    '`docker compose config` settles every question about what will actually run.',
    'Compose is excellent up to one host; rolling updates and multi-host scheduling are where it ends.',
  ],
  practice: [
    {
      id: 'dk-compose-production-p1',
      level: 'intermediate',
      prompt:
        'You run `docker compose -f compose.yaml -f compose.prod.yaml up` and your development bind mounts are gone. Is that a bug?',
      answer:
        'No, it is the documented behaviour. Naming files explicitly with `-f` disables the automatic pickup of `compose.override.yaml`, which is where the development bind mounts lived.',
      explanation:
        'This is exactly why the pattern works: development is the automatic default, and production requires an explicit, visible command.',
    },
    {
      id: 'dk-compose-production-p2',
      level: 'intermediate',
      prompt:
        'Your production override sets `ports: ["8080:8080"]` but the running container also publishes 5432. Why?',
      answer:
        'Sequences append rather than replace when Compose merges files. The base or the development override contributed the 5432 mapping and the production file added to it instead of replacing it.',
      explanation:
        'Keep anything environment-specific out of the base file, and confirm with `docker compose config` before deploying. Accidentally publishing a database port in production is a real consequence of this rule.',
    },
    {
      id: 'dk-compose-production-p3',
      level: 'intermediate',
      prompt:
        'A variable set in `.env` is visible in `docker compose config` output but not inside the container. Why?',
      answer:
        '`.env` is interpolated into the Compose file itself - it can fill in an image tag or a port. To put a variable inside the container it must be listed under `environment:` or supplied through `env_file:`.',
      explanation:
        'The two mechanisms look similar and do entirely different things. `docker compose exec <svc> env` settles it in one command.',
    },
    {
      id: 'dk-compose-production-p4',
      level: 'advanced',
      prompt:
        'A team wants zero-downtime deploys from their Compose stack on one VM. What would you tell them?',
      answer:
        'Compose has no rolling update: `up` recreates a container, and there is a gap. You can approximate blue-green with two projects behind a reverse proxy that health-checks both, but you are hand-building scheduling, health-based routing and rollback - the things an orchestrator provides. If zero downtime is a requirement rather than a preference, that is the signal to move to an orchestrator or a managed container service.',
      explanation:
        'The useful framing is that Compose is a great development and single-host tool, and that needing rolling updates is a specific, recognisable point at which it stops fitting.',
    },
  ],
  lab: {
    title: 'One base file, two environments, one optional tool',
    scenario:
      'Split a Compose file into base and overrides, add a profiled service, and verify every merge with config.',
    prerequisites: ['Docker with the Compose plugin', 'An empty directory'],
    tasks: [
      {
        instruction:
          'Write a `compose.yaml` with an `api` service using an image tag from `${API_TAG:-latest}` and a `db` service.',
      },
      {
        instruction:
          'Write a `compose.override.yaml` adding a bind mount and a published port to `api`.',
      },
      {
        instruction:
          'Run `docker compose config` and confirm the development values are merged in.',
      },
      {
        instruction:
          'Write a `compose.prod.yaml` with memory limits and a different log level, and render it with two `-f` flags.',
      },
      {
        instruction: 'Confirm the development bind mount is absent from the production rendering.',
      },
      {
        instruction:
          'Add an `adminer` service behind `profiles: [tools]` and confirm it only starts with `--profile tools`.',
      },
      {
        instruction:
          'Create a `.env` setting `API_TAG` and confirm it appears in the rendered image line.',
      },
    ],
    solution: [
      {
        title: 'The files',
        language: 'yaml',
        code: `# compose.yaml
services:
  api:
    image: nginx:\${API_TAG:-1.27}
    restart: unless-stopped
  db:
    image: postgres:17
    environment:
      POSTGRES_PASSWORD: lab
    volumes:
      - pgdata:/var/lib/postgresql/data
  adminer:
    image: adminer:5
    profiles: [tools]
    ports: ['127.0.0.1:8081:8080']
volumes:
  pgdata:

# compose.override.yaml  (development, automatic)
services:
  api:
    volumes:
      - ./html:/usr/share/nginx/html:ro
    ports:
      - '127.0.0.1:8080:80'

# compose.prod.yaml  (explicit only)
services:
  api:
    deploy:
      resources:
        limits:
          memory: 256M
    ports:
      - '8080:80'`,
      },
      {
        title: 'Verifying every step',
        language: 'bash',
        code: `mkdir -p html && echo hello > html/index.html

# Development: override picked up automatically
docker compose config | grep -A4 'api:'

# Production: explicit files, no automatic override
docker compose -f compose.yaml -f compose.prod.yaml config | grep -A6 'api:'
#   no ./html bind mount - correct

# Profiles
docker compose up -d
docker compose ps --services              # api, db - no adminer
docker compose --profile tools up -d
docker compose ps --services              # api, db, adminer

# Interpolation
printf 'API_TAG=1.25\\n' > .env
docker compose config | grep 'image: nginx'
#   image: nginx:1.25

docker compose --profile tools down -v`,
      },
    ],
    verification: [
      {
        command: 'docker compose config --quiet && echo valid',
        what: 'Validates the merged configuration.',
        expected: 'valid',
      },
      {
        command:
          'docker compose -f compose.yaml -f compose.prod.yaml config | grep -c "usr/share/nginx/html"',
        what: 'Confirms the development bind mount is not in the production rendering.',
        expected: '0',
      },
    ],
    cleanup: [
      {
        command: 'docker compose --profile tools down -v 2>/dev/null; rm -rf html .env; true',
        what: 'Removes the stack and the scratch files.',
      },
    ],
  },
  relatedTopicIds: ['dk-compose-basics', 'dk-config-and-resources', 'dk-ci-and-publishing'],
  docs: [
    {
      title: 'Merge Compose files',
      url: 'https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/',
    },
    {
      title: 'Using profiles with Compose',
      url: 'https://docs.docker.com/compose/how-tos/profiles/',
    },
  ],
}
