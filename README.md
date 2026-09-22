# DevOps Learning Hub

An installable, offline-capable study app for DevOps. It has two sections.

**Certification courses** — two are installed:

- **CKAD — Certified Kubernetes Application Developer** (Kubernetes v1.35)
- **Terraform Associate (004)** (Terraform v1.16)

Each covers its complete published curriculum from beginner level to exam-ready, with flow diagrams on every lesson.

**Interview preparation** — 697 questions across 13 topics (Docker, Kubernetes, Jenkins, GitHub Actions, AWS, Terraform, Prometheus, Grafana & observability, Ansible, Splunk, Python, shell scripting and Linux), from first-round basics through to senior scenario rounds.

Built as a React + TypeScript + Vite Progressive Web App. No backend and no tracking — everything runs in your browser and your progress stays on your device. Opening it asks for your email address and checks it against a list you control, so the app stays with the group you shared it with and each person keeps their own progress.

> **This is an independent learning tool.** It is not affiliated with, endorsed by or sponsored by any certification body — including the Cloud Native Computing Foundation, the Linux Foundation and HashiCorp — and it is not an App Store application. Every practice question, lab and mock exam here is original material written for this app — none are real exam questions, and no leaked or recalled exam content is used.

---

## What is in it

|                             |                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **91 lessons**              | 50 CKAD + 41 Terraform, each with a hands-on lab. Every lesson has a beginner explanation, why it matters, how it works, **flow diagrams**, key objects and fields, a real-world example, complete YAML or HCL, imperative commands, the declarative method, verification commands, troubleshooting commands, common mistakes, exam tips, a summary, three or more practice questions with hidden answers, and a hands-on lab with a full solution |
| **234 practice questions**  | 116 CKAD + 118 Terraform, plus 314 in-lesson practice questions. Multiple choice, multi-select, free-text command, YAML/HCL correction, troubleshooting scenarios and performance-based lab tasks — all with explanations                                                                                                                                                                                                                          |
| **172 diagrams**            | Flow, sequence, containment and decision diagrams, rendered as inline SVG from typed data — theme-aware, offline, and with a text version of every one                                                                                                                                                                                                                                                                                             |
| **Mock exams**              | Timed papers weighted per domain, scored per domain, with attempt history saved locally                                                                                                                                                                                                                                                                                                                                                            |
| **258 reference commands**  | Searchable kubectl / Helm / Kustomize and Terraform CLI references with copy buttons, plus the YAML and HCL templates worth memorising                                                                                                                                                                                                                                                                                                             |
| **Search**                  | Across lesson text, objects and fields, commands and the question bank — filterable by domain, difficulty and result type, per course                                                                                                                                                                                                                                                                                                              |
| **697 interview questions** | 13 topics, 50–83 each, from first-round basics to senior scenario rounds. Every question states what the interviewer is testing, how to answer it, the traps to avoid and the follow-ups they will ask next — with code, diagrams and a self-assessed revision queue                                                                                                                                                                               |
| **Progress tracking**       | Per-lesson status, practice history, exam attempts, study streak and an exam-readiness indicator — plus interview recall — with JSON export and import                                                                                                                                                                                                                                                                                             |

### Diagrams

Every lesson carries at least one diagram. They are authored as **typed data**, not images or Mermaid source, and rendered to inline SVG at runtime:

- **Flow** — an ordered pipeline, with optional failure branches (`terraform apply`, probe outcomes, a rolling update)
- **Sequence** — who calls whom, in order (`kubectl apply` end to end, a DNS lookup, an operator reconcile loop)
- **Containment** — what lives inside what (cluster/node/pod, root and child modules, Service type layering)
- **Decision** — mutually exclusive choices (which workload resource, `count` or `for_each`, which Service type)

Why data rather than a diagram library: nothing extra to download so lessons stay usable offline, colours come from the same design tokens as the rest of the app so every diagram is readable in light and dark themes, and a bad reference is a build error. Geometry lives in `src/lib/diagram-layout.ts` as pure, unit-tested functions; the character-width constants used for text wrapping were measured in a real browser across 365 rendered labels rather than guessed. Each diagram also has a **Text version** disclosure, since an SVG full of absolutely positioned `<text>` nodes is close to useless to a screen reader.

### Curriculum coverage

#### CKAD

Domain weights are taken from the official CNCF / Linux Foundation curriculum, verified on **2026-09-03** against **CKAD_Curriculum_v1.35** (exam environment **Kubernetes v1.35**, 2 hours, 66% to pass).

| Domain                                              | Weight                                   | Lessons |
| --------------------------------------------------- | ---------------------------------------- | ------- |
| Kubernetes Foundations                              | _no exam weight — assumed knowledge_     | 7       |
| Application Design and Build                        | 20%                                      | 11      |
| Application Deployment                              | 20%                                      | 6       |
| Application Observability and Maintenance           | 15%                                      | 7       |
| Application Environment, Configuration and Security | 25%                                      | 10      |
| Services and Networking                             | 20%                                      | 6       |
| Exam Technique                                      | _no exam weight — how to finish in time_ | 3       |

Sources, linked in the app itself:

- [CNCF curriculum repository (ckad)](https://github.com/cncf/curriculum/tree/master/ckad)
- [CNCF CKAD certification page](https://www.cncf.io/training/certification/ckad/)
- [Linux Foundation CKAD exam page](https://training.linuxfoundation.org/certification/certified-kubernetes-application-developer-ckad/) — domains and competencies
- [CKA/CKAD/CKS FAQ](https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks) — exam environment version and pass mark

#### Terraform Associate (004)

Objectives and competencies are quoted from HashiCorp's published exam content list, verified on **2026-09-04**. The exam is **multiple choice**, **1 hour**, online proctored, **$70.50 USD**, valid **two years**.

| Objective                                 | Sub-objectives      | Lessons |
| ----------------------------------------- | ------------------- | ------- |
| 1. Infrastructure as Code with Terraform  | 3                   | 3       |
| 2. Terraform fundamentals                 | 4                   | 5       |
| 3. Core Terraform workflow                | 7                   | 5       |
| 4. Terraform configuration                | 8                   | 10      |
| 5. Terraform modules                      | 4                   | 4       |
| 6. Terraform state management             | 4                   | 5       |
| 7. Maintain infrastructure with Terraform | 3                   | 3       |
| 8. HCP Terraform                          | 4                   | 4       |
| Exam Technique                            | _added by this app_ | 2       |

> **Important.** HashiCorp publishes the objectives, the format, the duration and the cost — but **not** the question count, **not** a pass mark, and **not** a per-objective weighting. The mock-exam weights and the 70% target score in this app are therefore its **own study aids**, derived from the number of published sub-objectives per objective. The app says so wherever those figures appear, and no Terraform domain claims an official percentage. Do not treat them as a prediction.

Sources, linked in the app itself:

- [Exam content list (004)](https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004) — objectives and sub-objectives
- [Certification overview](https://developer.hashicorp.com/certifications/infrastructure-automation) — format, duration, cost, validity
- [Terraform documentation](https://developer.hashicorp.com/terraform/docs)
- [HCP Terraform documentation](https://developer.hashicorp.com/terraform/cloud-docs)

**Check the official curriculum before your exam.** Both are updated periodically, and this app is a study aid, not a source of truth.

---

### Interview preparation

A separate section from the courses, at `/interview`. A course teaches a syllabus; this rehearses answers. The unit of study is a single question you can answer out loud, not a lesson you work through — so it has no labs, no mock exam and no blueprint, and it tracks recall rather than a score.

| Topic                  | Questions |     | Topic                      | Questions |
| ---------------------- | --------- | --- | -------------------------- | --------- |
| 🐳 Docker & containers | 52        |     | 🏗️ Terraform & IaC         | 50        |
| ☸️ Kubernetes          | 62        |     | 📈 Prometheus & monitoring | 50        |
| 🔧 Jenkins & CI/CD     | 50        |     | 📊 Grafana & observability | 50        |
| ☁️ AWS                 | 83        |     | 📋 Ansible                 | 50        |
| ⚙️ GitHub Actions      | 50        |     | 🔍 Splunk & log management | 50        |
|                        |           |     | 🐍 Python for DevOps       | 50        |
|                        |           |     | 🐚 Shell scripting         | 50        |
|                        |           |     | 🐧 Linux & troubleshooting | 50        |

**697 questions in total: 164 basic, 303 intermediate and 230 senior.** 137 are multiple choice (99 single-answer, 38 select-all), **93 are scenario questions** of the "production is broken, walk me through it" kind, and the remaining 467 are open questions. They carry 218 diagrams and 789 code samples. AWS and Kubernetes carry the most scenarios (20 and 17), since those are where the troubleshooting rounds concentrate. The AWS topic includes 12 questions on **Amazon Bedrock** (the managed inference API, Knowledge Bases and RAG, Guardrails, data residency) and 11 on **CloudFormation** (template anatomy, change sets and replacement behaviour, nested stacks versus exports, StackSets, drift, custom resources, and the stuck-stack incidents).

Every question has the same shape, and all of it is written for a beginner to follow:

- **What they are testing** — the reason the question is being asked, which is usually not the surface topic
- **How to answer** — the answer in plain language, in the order you would actually say it
- **Code** — real Dockerfiles, manifests, pipelines, HCL, playbooks, Python and shell, syntax-highlighted and copyable
- **Diagrams** — the same typed-data SVG diagrams the lessons use, for anything with a flow worth drawing (image layers and the build cache, a pod's path to Running, a rolling update, OOMKill, a Jenkins pipeline, the Terraform apply loop, Prometheus scraping, the six-link path a log line takes from container stdout to Loki, trace context crossing service boundaries, layered network diagnosis)
- **What makes it a senior answer** — the extra the interviewer is listening for, on the questions that warrant it
- **Traps to avoid** — the wrong answers that sound right
- **Likely follow-ups** — what they ask next once you answer well

The answer is **hidden until you ask for it**, because reading an answer you have not attempted feels like learning and is not. Multiple-choice questions make you commit to an option before they will grade it; open and scenario questions make you click _Show the answer_, which is the moment to have said it out loud.

Progress is **self-assessed**, not scored: mark a question _I know this_ or _Needs review_. An out-loud answer cannot be auto-marked, so pretending otherwise would only produce a dishonest number. Only _I know this_ moves the progress bar — flagging something for review is progress in understanding but not in readiness. Everything flagged collects in a cross-topic **revision queue** at `/interview/review`, which is the page to open the night before an interview.

All of it is original material written for this app, from public documentation and ordinary practice. None of it is drawn from any company's actual interview process.

---

## Who can open it

The app opens onto a sign-in screen asking for an email address. It is checked against **[`src/access/allowed-emails.ts`](src/access/allowed-emails.ts)** — a plain list you edit:

```ts
export const allowedEmails: readonly string[] = [
  'saichand.kanimeraka@tenetic.com',
  'teammate@tenetic.com',
  // '@tenetic.com',   // or admit a whole domain
]
```

Add an address and deploy, and that person can sign in. Delete it and deploy, and they are locked out the next time the app loads — the remembered sign-in is re-checked against the list on every start, not only when it is first entered. Matching ignores case and surrounding spaces, and an entry beginning with `@` matches every address on that domain. [`src/access/README.md`](src/access/README.md) has the details.

The address is also the key to that person's progress: lessons, practice history, exam attempts, the study streak and the "continue where you left off" lesson are all stored per address, under `devops-learning-hub.progress.user.<email>`. Two people can therefore share one laptop or one phone without seeing each other's progress — signing out and back in as somebody else swaps the whole record over, and signing back in with the original address brings it all back untouched. Progress made before the gate existed is handed to the first address that signs in, so nothing is lost by updating.

> **This is a doorway, not a lock.** The app is a static site with no server, so the list ships inside the JavaScript bundle and anyone who opens developer tools can read it, and there is no password proving somebody owns the address they typed. It keeps the app to the intended study group and keeps their progress apart. Do not put anything confidential behind it.

---

## Running it locally

Requires **Node.js 20.19 or newer** and npm.

```bash
npm install        # install dependencies
npm run dev        # start the dev server on http://localhost:5173
```

The dev server runs at the domain root (`/`), so no sub-path handling is needed while developing.

### All the commands

```bash
npm run dev           # dev server with hot reload
npm run build         # production build into dist/ (typecheck + bundle + 404.html)
npm run preview       # serve the production build locally
npm test              # run the test suite once
npm run test:watch    # run tests in watch mode
npm run lint          # ESLint
npm run typecheck     # TypeScript project references, no emit
npm run format        # Prettier, write
npm run format:check  # Prettier, check only
npm run icons         # regenerate the PWA icons from scripts/generate-icons.mjs
npm run validate      # format:check + lint + typecheck + test + build
```

`npm run validate` is what CI runs. Run it before pushing.

### Production build

```bash
npm run build
npm run preview       # then open http://localhost:4173/Devops/
```

The build targets a GitHub Pages repository sub-path by default. To host at a domain root instead:

```bash
BASE_PATH=/ npm run build
```

`BASE_PATH` sets Vite's `base`, the PWA manifest `start_url`/`scope`, and the service-worker navigation fallback. The router reads the same value from `import.meta.env.BASE_URL`, so one variable moves the whole app.

---

## Installing it on an iPhone

The app is a Progressive Web App, so it installs from Safari without an App Store.

1. Open the deployed URL in **Safari** on your iPhone (Chrome on iOS cannot install PWAs).
2. Tap the **Share** button — the square with an arrow pointing up, in the bottom toolbar.
3. Scroll down and tap **Add to Home Screen**.
4. Edit the name if you like, then tap **Add**.

It now appears on your home screen with its own icon and opens full-screen with no Safari chrome. On Android, Chrome shows an **Install app** prompt or an **Add to Home screen** item in its menu; on desktop Chrome and Edge, an install icon appears in the address bar.

### Offline use

Every lesson, question and command is precached on first visit, so after one online visit the whole course works with no network — on a train, on a plane, anywhere. Your progress is written to local storage as you go and does not need a connection.

### How updates reach you

The service worker registers in **prompt** mode, so a new deployment never swaps content out from under you mid-lesson. Instead:

- The app checks for a new version hourly, and again whenever you bring it back to the foreground. That second check is the one that matters on iOS, where a standalone PWA can stay suspended for days.
- When a new version is found you get a **"New version available — Update"** banner. Tapping **Update** activates the new version and reloads. Tapping **Later** dismisses it until the next check.
- Old caches are deleted when the new version activates, so you cannot get stranded on stale content.
- **Your progress is never touched by an update.** It lives in local storage, which a service-worker update does not clear, and the stored record is versioned — `src/lib/storage.ts` migrates old shapes forward field by field rather than discarding anything it does not recognise. A record it cannot parse at all is copied to a backup key instead of being overwritten.

The one thing that _does_ remove progress is clearing your browser's site data or deleting the installed app. **Export a JSON backup first** (Progress & data → Export progress as JSON) if you are about to do either, or if you want to move your progress to another device.

---

## Deploying to GitHub Pages

A workflow is included at `.github/workflows/deploy-pages.yml`. It is not enabled for you — you have to turn Pages on yourself.

1. Push this branch and merge it to `main`.
2. In the repository, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. Push to `main` (or run the workflow manually from the **Actions** tab). The workflow installs dependencies, runs the full validation suite, builds, and publishes `dist/`.
5. The site appears at `https://<your-username>.github.io/<repository-name>/`.

### If your repository is not called `Devops`

The default base path is `/Devops/`, matching this repository. The workflow computes it from the repository name automatically, so a rename needs no code change. If you deploy by hand, pass it explicitly:

```bash
BASE_PATH=/my-repo-name/ npm run build
```

### Why `dist/404.html` exists

GitHub Pages serves static files only, so a deep link such as `/Devops/ckad/topics/probes` has no file behind it and Pages answers with `404.html`. The build copies `index.html` to `404.html`, which lets the client-side router take over — so real URLs work and can be bookmarked and shared. `dist/.nojekyll` stops Pages running Jekyll, which would otherwise drop files whose names begin with an underscore.

### Other hosts

Any static host works. Netlify, Cloudflare Pages, Vercel and S3 + CloudFront all serve `dist/` as-is; configure a SPA fallback to `index.html` (or rely on the generated `404.html`) and set `BASE_PATH` to match the path you serve from.

---

## How the content is organised

Content is plain TypeScript, type-checked against `src/content/types.ts`. There is no CMS and no markdown pipeline, so a broken lesson fails `npm run typecheck` rather than rendering badly at runtime.

```
src/
├── access/
│   ├── allowed-emails.ts           # WHO may open the app - the only file to edit
│   └── README.md                   # how to add and remove people
├── content/
│   ├── types.ts                    # the content model: Topic, Question, Course, ...
│   ├── courses.ts                  # course registry + "planned" courses
│   ├── registry.ts                 # per-course lookup indexes used by every page
│   ├── courses.test.ts             # integrity tests that run over EVERY course
│   ├── content.test.ts             # CKAD-specific content tests
│   ├── ckad/
│   │   ├── index.ts                # the CKAD Course object: weights, pass mark, sources
│   │   ├── domains.ts              # the 5 weighted domains + 2 support sections
│   │   ├── commands.ts             # the searchable command reference
│   │   ├── questions/              # question bank, one file per domain
│   │   └── topics/                 # one directory per domain, one file per lesson
│   ├── terraform/
│   │   ├── index.ts                # the Terraform Course object
│   │   ├── domains.ts              # the 8 published objectives + exam technique
│   │   ├── commands.ts             # CLI reference + HCL templates
│   │   ├── questions/              # question bank, one file per objective
│   │   └── topics/                 # iac, fundamentals, workflow, configuration,
│   │                               #   modules, state, maintenance, hcp, exam-prep
│   ├── interview.test.ts           # interview content integrity tests
│   └── interview/                  # the interview section - NOT a Course
│       ├── index.ts                # the InterviewTrack: topic registry + lookups
│       └── topics/                 # one DIRECTORY per topic, each with an
│           ├── docker/             #   index.ts (the InterviewTopic) plus several
│           │   ├── index.ts        #   question files grouped by theme, so no
│           │   ├── core.ts         #   single file grows unmanageably long
│           │   ├── images.ts
│           │   ├── runtime.ts
│           │   └── operations.ts
│           └── ...                 # kubernetes/, jenkins/, github-actions/, aws/,
│                                   #   terraform/, prometheus/, ansible/, splunk/,
│                                   #   python/, shell/, linux/
├── lib/
│   ├── access.ts                   # the email gate: matching, session, per-user keys
│   ├── diagram-layout.ts           # pure, unit-tested diagram geometry
│   ├── hcl-language.ts             # highlight.js definition for HCL/Terraform
│   ├── use-course.ts               # resolves the course from the route
│   ├── interview-stats.ts          # recall counts, level breakdown, next topic
│   └── ...                         # storage, scoring, exam builder, search, stats, SW update
├── components/
│   ├── ui/Diagram.tsx              # renders a Diagram to inline SVG
│   └── ...                         # UI primitives, layout, question renderer
├── pages/                          # one file per route, course resolved from :courseId
└── styles/                         # design tokens + component CSS
```

Lesson prose supports two inline conventions, rendered by `src/components/ui/RichText.tsx`: `` `code` `` for commands and field paths, and `**bold**` for the term being defined. Nothing else — it builds React elements rather than injecting HTML, so content can never introduce markup. A content test fails the build if a marker is left unbalanced.

### Adding a lesson

1. Create `src/content/<course>/topics/<domain>/<lesson-id>.ts` exporting a `Topic`.
2. Add it to that domain's `index.ts` barrel and to the array in `topics/index.ts`.
3. Give it at least one diagram — `src/content/courses.test.ts` requires one, and the diagram tests also enforce the renderer's limits (3–7 flow nodes, 2–4 sequence participants, containment no deeper than four levels, no markdown markers, and a caption on every diagram).
4. Run `npm test` — the content tests check that every required section is filled in, that cross-references resolve, that ids are globally unique across courses, that YAML samples use two-space indentation and a known `apiVersion`, and that there is no placeholder text.

### Adding another DevOps course

The content model is course-agnostic, and the app reads everything from the registry in `src/content/courses.ts`.

Adding the Terraform course required **no UI changes at all** — only content plus one line in the registry. That is the intended path for a third.

1. Create `src/content/<course-id>/` with the same shape as `ckad/` and `terraform/`: `domains.ts`, `topics/`, `questions/`, `commands.ts` and an `index.ts` exporting a `Course`.
2. Set `route: '/<course-id>'` — it must be exactly `/` plus the `id`, because the router resolves a course from the first path segment. A test enforces this.
3. Add that `Course` to the `courses` array in `src/content/courses.ts`, and remove it from `plannedCourses` if it is listed there.
4. Fill in `copy` (the dashboard wording) and `sources`. If the vendor publishes no per-objective weighting, set `officialWeights: false` and write a `note` — the UI then labels the figures as the app's own, and a test refuses to let an unweighted course claim a percentage.
5. Split its chunk in `vite.config.ts` `manualChunks`, so editing one course's content does not invalidate another's cached bundle.

Every page resolves its course from the `:courseId` route segment via `src/lib/use-course.ts`, so routes, navigation, the sidebar, search, practice, mock exams and the command reference all work for a new course without being touched. The home page and the progress page aggregate across the whole registry automatically.

If a new course's objects are not Kubernetes-shaped, note that `KeyObject.apiVersion` is optional and `CodeLanguage` can be extended — HCL support is a 60-line local `highlight.js` definition in `src/lib/hcl-language.ts`, added because highlight.js does not ship one.

### Adding an interview question or topic

The interview content uses its own model (`InterviewTopic`, `InterviewQuestion` in `src/content/types.ts`), deliberately not `Course`. Reusing `Course` would have meant lessons with no labs and a mock exam with no blueprint; a separate model costs one registry and reuses every UI primitive.

To add a question, append an `InterviewQuestion` to the relevant themed file in `src/content/interview/topics/<topic>/` (or add a new file and spread it into that topic's `index.ts`). To add a topic, create the directory with an `index.ts` exporting an `InterviewTopic`, and add it to the array in `src/content/interview/index.ts` — nothing else needs touching, as the hub, the topic route, the revision queue and the home page all read from that registry.

`src/content/interview.test.ts` enforces the rules: globally unique `itv-`-prefixed ids, every MCQ answer key pointing at an option that exists, never all options correct and never none, `mcq` having exactly one answer and `multi` at least two, every topic spanning basic to advanced, an explanation on every question, only registered code languages, no hardcoded credentials, and no markdown markers in diagram text (SVG would print the backticks literally).

Two things worth knowing if you write the components as well as the content:

- Diagram **captions** render as an HTML paragraph that wraps; everything else in a diagram is SVG `<text>` that cannot. Only the latter has a length budget.
- The option button is a flex container, so `RichText` output must be wrapped in a single child element or each text node and `<code>` becomes its own flex item and lays out side by side.

---

## Testing and validation

```bash
npm run validate
```

That runs, in order: Prettier check, ESLint, TypeScript project build, the Vitest suite, and the production build.

The suite covers:

- **Navigation** — the shell, every route, the not-found states, the skip link, and that a lesson renders all of its required sections
- **Progress persistence** — marking complete, surviving a full remount, the study record, and the localStorage round trip
- **Storage migration** — legacy shapes are upgraded rather than dropped, malformed records are quarantined, merge keeps the better result
- **Per-device isolation** — progress survives reloads and repeated writes, is written under one key only, makes no network request, is not lost when a write fails, and a second device with its own storage starts completely empty; plus the iOS-only install prompt appearing on an iPhone in a tab and nowhere else
- **The email gate** — the shipped list is non-empty and every entry is one this code can match, a listed address opens the app and an unlisted one does not, a deep link is gated as firmly as the home page, a typo is named as a typo rather than as a refusal, an address removed from the list revokes an already-remembered sign-in, case and stray spaces are forgiven, and a domain rule cannot be fooled by a lookalike domain
- **Per-person progress** — two addresses on one browser keep separate records, an address that has never signed in starts empty, signing out and back in returns the same record untouched, one person's reset leaves the other alone, and progress made before the gate existed is inherited by the first signer only
- **Quiz scoring** — every question kind, all-or-nothing multi-select, whitespace-insensitive command matching, retry queue
- **Mock-exam scoring** — domain weighting of generated papers, per-domain breakdown, the pass mark, self-verified performance tasks
- **Search** — index construction, AND semantics, ranking, and each filter
- **Export/import** — round trip, merge versus replace, confirmation flow, and rejection of an unrelated JSON file
- **PWA update behaviour** — the update policy (visibility- and interval-triggered checks, offline and hidden-tab skipping) and the update prompt itself
- **Content integrity** — assertions over the lessons, questions and command reference, run over **every** course: globally unique ids, resolving cross-references, complete lesson sections, no placeholder text, blueprint weights that sum to 100 with enough questions to fill each share, and an explanatory note wherever a weighting is not official
- **Diagram geometry** — the pure layout functions: word wrapping (including hard-splitting an over-long token), boxes tall enough for their content, children strictly inside parents, ordered sequence messages, no overlaps, and the text version covering every node
- **Diagram rendering** — kind labels, captions, the text-version disclosure, `aria-hidden` on the SVG, unique marker ids per instance, and one lifeline per sequence participant
- **HCL highlighting** — the hand-written `highlight.js` definition, pinning each token class the stylesheet colours, plus HTML escaping so a sample can never inject markup
- **Exam generation** — both courses: full-length papers honouring the blueprint, determinism for a given seed, 100% and 0% scoring paths, and per-domain drills
- **Interview content integrity** — the 697 questions: unique prefixed ids, answer keys pointing at options that exist, never all or none correct, `mcq` with one answer and `multi` with several, basic-to-advanced coverage in every topic, registered code languages only, no hardcoded credentials, and no markdown markers in SVG diagram text
- **Interview behaviour** — the answer stays hidden until asked for, a choice question refuses to grade until you commit to an option, an open question reveals without grading, recall persists and un-marks on a second click, a flagged question reaches the cross-topic revision queue, and `/interview/review` outranks the dynamic `/interview/:topicId` route
- **Interview recall accounting** — only _I know this_ moves the bar, review and untouched are counted apart, the suggested next topic moves on as questions are answered, and a state saved before the interview section existed migrates with its courses intact

The layout, console cleanliness and responsive behaviour were additionally verified by driving headless Chrome over every route at several viewport widths: no console errors or warnings, no page errors, no failed requests, no horizontal page scrolling, body text at 16px or larger, form controls at 16px so iOS Safari does not zoom on focus, comfortable touch targets, and exactly one `<h1>` and one `<main>` landmark per page.

Two checks that only a real browser can make were run across **all 91 lessons** in both courses, and again across **all 12 interview topics** with every answer revealed, in both themes:

- **No diagram text escapes its box.** Every `<text>` node's measured bounding box is compared against its SVG `viewBox`. This caught a real class of bug: the character-width constants used for wrapping were too small, so labels overflowed by up to 30px. They were re-derived from 365 measured labels rather than guessed again.
- **No literal markdown markers in prose.** Any `` `code` `` or `**bold**` still visible outside a code block means a field is being rendered without `RichText`. This caught five: code-sample explanations, related-topic one-liners, the home page's daily suggestion, and in the interview section the multiple-choice verdict line and the option buttons — the latter because the button is a flex container, which a unit test cannot see.

That verification used a throwaway script outside the repository, so it adds no dependency here.

---

## Design and accessibility notes

- **Mobile-first.** A bottom tab bar on phones, a sidebar from 900px up, and one scrolling content region. Safe-area insets are respected so the tab bar clears the iPhone home indicator.
- **16px minimum body text**, and 16px form controls, because anything smaller makes iOS Safari zoom when a field gains focus.
- **Light and dark themes**, following the device by default with an in-app override that persists. Dark is defined twice — once for `prefers-color-scheme` and once for the explicit `[data-theme]` attribute — so the toggle wins in both directions.
- **Collapsible lesson sections** use native `<details>`, so they are keyboard accessible, work with in-page find, and need no JavaScript.
- **Syntax highlighting** uses `highlight.js` with only YAML, bash, JSON, Dockerfile and HCL registered, themed with the same CSS custom properties as the rest of the app so it is readable in both themes. HCL is a local definition, because highlight.js does not ship one and pulling in a second highlighting library for one language would cost far more than 60 lines.
- **Diagrams are inline SVG coloured from the design tokens**, so they follow the theme with no second set of assets, and they carry a text version for screen readers. A diagram wider than its column scrolls inside its own container — measured with a `ResizeObserver` rather than guessed from a breakpoint, because how much room a diagram gets depends on the sidebar as well as the viewport — and the page itself never scrolls sideways.
- **Code blocks scroll horizontally inside themselves** and the page never does. Long Kubernetes identifiers in prose wrap rather than overflowing.
- **Copy buttons** on every code sample and command, with a `navigator.clipboard` path and a legacy fallback for non-secure origins.
- **Keyboard and screen reader**: a skip link, semantic landmarks, labelled form controls, `aria-pressed` on filter chips, `aria-current` on the active navigation item and question, a `role="timer"` for the exam clock, and `prefers-reduced-motion` respected.

---

## Known limitations

- **Mock exams cannot fully auto-grade performance-based tasks.** The real CKAD runs in a live cluster; this app has no cluster. Multiple-choice and command questions are auto-scored, and lab tasks are scored from a checkpoint list you confirm after submitting. That is honest but it depends on you being honest with yourself.
- **The content chunks are large.** CKAD is about 1.45 MB (400 KB gzipped), Terraform about 890 KB (250 KB gzipped) and the interview bank about 1.79 MB (594 KB gzipped), for a total precache of roughly 4.5 MB. That is the deliberate cost of every lesson being available offline — the service worker precaches everything on first visit. The chunks are split per course and the interview bank has its own, so editing a CKAD lesson does not invalidate the cached Terraform or interview bundle, and the framework and app-shell chunks are separate. Measured on a phone-sized viewport with a 4× CPU throttle over simulated 4G, first contentful paint is about **2.1 s**; after the first visit the service worker serves from cache. Both course bundles are nonetheless in the critical path, because the home page reads lesson counts and progress from them. The next optimisation is to split course **metadata** from course **content** and lazy-load the content per route — that is a real refactor rather than a config change, so it has not been done.
- **Interview progress is what you say it is.** Whether you can answer a question out loud cannot be measured by a web app, so the interview section asks you and believes you. The percentage is only as honest as your self-marking, and it is deliberately not called a readiness score.
- **Progress is per browser and per person, by design.** Everything you do is written to `localStorage` on the device you did it on, under the email address you signed in with. It survives refreshes, tab closes and app updates; a different phone, laptop or browser opens completely fresh and shows nothing of it, even with the same address. There is no server, so there is nothing to sync and nothing to leak between devices - `src/lib/device-isolation.test.ts` pins that down, including a check that saving progress makes no network request, and `src/lib/multi-user.test.ts` pins down the separation between two people sharing one browser. Use export/import to move it deliberately.
- **The email gate is not authentication.** It is checked in the browser against a list compiled into the bundle, with no password and no server to verify anything, so a determined visitor can read the list or bypass the check. It exists to keep the app with the group it was shared with and to keep their progress records apart — treat it as a doorway, not a lock, and keep confidential material out of the content.
- **iOS clears storage for sites you have not opened in a week.** In a Safari **tab**, iOS deletes a site's script-writable storage after roughly seven days without interaction, which would wipe your progress between study sessions. Installed to the Home Screen the app is exempt, so the progress page shows an install prompt when it detects an iPhone or iPad in a browser tab. This does not affect Android or desktop browsers.
- **Labs need your own tooling.** The CKAD labs need a cluster — kind, minikube or k3d all work — and a few need extras and say so: metrics-server for `kubectl top`, a policy-enforcing CNI such as Calico for the NetworkPolicy lab, and an ingress controller for the Ingress lab. The Terraform labs are deliberately built on the credential-free `local`, `random`, `time` and `null` providers, so objectives 1 to 7 can be practised with **no cloud account at all**. Only objective 8 needs an HCP Terraform account, and the free tier is sufficient.
- **The curriculum moves.** CKAD content was verified against CKAD_Curriculum_v1.35 / Kubernetes v1.35 on 2026-09-03; Terraform content against the published 004 exam content list on 2026-09-04. Re-check the official sources before your exam.
- **The Terraform mock-exam figures are the app's own.** HashiCorp publishes no question count, pass mark or per-objective weighting, so the 25-question papers, the 70% target and the domain weights are study aids derived from sub-objective counts. The app labels them as such wherever they appear.

---

## Licence and attribution

The learning content in this repository is original material written for this app. Kubernetes, CKAD, CNCF, the Linux Foundation, Terraform, HCP Terraform and HashiCorp are trademarks of their respective owners; this project is independent of all of them. Documentation links point only to official Kubernetes, CNCF, Helm, Linux Foundation and HashiCorp pages.
