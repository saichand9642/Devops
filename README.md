# DevOps Learning Hub

An installable, offline-capable study app for DevOps certifications. The first course is **CKAD — Certified Kubernetes Application Developer**, covering the complete published curriculum from beginner level to exam-ready.

Built as a React + TypeScript + Vite Progressive Web App. No backend, no account, no tracking — everything runs in your browser and your progress stays on your device.

> **This is an independent learning tool.** It is not affiliated with, endorsed by or sponsored by the Cloud Native Computing Foundation or the Linux Foundation, and it is not an App Store application. Every practice question, lab and mock exam here is original material written for this app — none are real exam questions, and no leaked or recalled exam content is used.

---

## What is in it

|                             |                                                                                                                                                                                                                                                                                                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **50 lessons**              | Every lesson has a beginner explanation, why it matters, how it works, key objects and fields, a real-world example, complete YAML, imperative commands, the declarative method, verification commands, troubleshooting commands, common mistakes, exam tips, a summary, three or more practice questions with hidden answers, and a hands-on lab with a full solution |
| **116 practice questions**  | Multiple choice, multi-select, free-text command, YAML correction, troubleshooting scenarios and performance-based lab tasks — all with explanations                                                                                                                                                                                                                   |
| **Mock exams**              | Timed papers whose question mix follows the official domain weights, scored per domain against the 66% pass mark, with attempt history saved locally                                                                                                                                                                                                                   |
| **~130 reference commands** | Searchable kubectl, Helm and Kustomize cheat sheet with copy buttons, plus the YAML templates worth memorising                                                                                                                                                                                                                                                         |
| **Search**                  | Across lesson text, Kubernetes objects and fields, commands and the question bank, filterable by domain, difficulty and result type                                                                                                                                                                                                                                    |
| **Progress tracking**       | Per-lesson status, practice history, exam attempts, study streak and an exam-readiness indicator — with JSON export and import                                                                                                                                                                                                                                         |

### Curriculum coverage

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

**Check the official curriculum before your exam.** It is updated roughly quarterly to track Kubernetes releases, and this app is a study aid, not a source of truth.

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
├── content/
│   ├── types.ts                    # the content model: Topic, Question, Course, ...
│   ├── courses.ts                  # course registry + "planned" courses
│   ├── content.test.ts             # integrity tests over all content
│   └── ckad/
│       ├── index.ts                # the CKAD Course object: weights, pass mark, sources
│       ├── domains.ts              # the 5 weighted domains + 2 support sections
│       ├── commands.ts             # the searchable command reference
│       ├── questions/              # question bank, one file per domain
│       └── topics/
│           ├── index.ts            # aggregates every topic
│           ├── foundations/        # one file per lesson
│           ├── design-build/
│           ├── deployment/
│           ├── observability/
│           ├── environment-security/
│           ├── services-networking/
│           └── exam-prep/
├── lib/                            # storage, scoring, exam builder, search, stats, SW update
├── components/                     # UI primitives, layout, question renderer
├── pages/                          # one file per route
└── styles/                         # design tokens + component CSS
```

Lesson prose supports two inline conventions, rendered by `src/components/ui/RichText.tsx`: `` `code` `` for commands and field paths, and `**bold**` for the term being defined. Nothing else — it builds React elements rather than injecting HTML, so content can never introduce markup. A content test fails the build if a marker is left unbalanced.

### Adding a lesson

1. Create `src/content/ckad/topics/<domain>/<lesson-id>.ts` exporting a `Topic`.
2. Add it to that domain's `index.ts` barrel and to the array in `topics/index.ts`.
3. Run `npm test` — the content tests check that every required section is filled in, that cross-references resolve, that YAML samples use two-space indentation and a known `apiVersion`, and that there is no placeholder text.

### Adding another DevOps course

The content model is course-agnostic, and the app reads everything from the registry in `src/content/courses.ts`.

1. Create `src/content/<course-id>/` with the same shape as `ckad/`: `domains.ts`, `topics/`, `questions/`, `commands.ts` and an `index.ts` exporting a `Course`.
2. Add that `Course` to the `courses` array in `src/content/courses.ts`, and remove it from `plannedCourses` if it is listed there.
3. Add routes for it in `src/App.tsx`, mirroring the `/ckad/...` block. Routes are namespaced by course id, so nothing existing needs to change.

The home page already renders every entry in the registry, including the "planned" placeholders shown as coming soon.

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
- **Quiz scoring** — every question kind, all-or-nothing multi-select, whitespace-insensitive command matching, retry queue
- **Mock-exam scoring** — domain weighting of generated papers, per-domain breakdown, the pass mark, self-verified performance tasks
- **Search** — index construction, AND semantics, ranking, and each filter
- **Export/import** — round trip, merge versus replace, confirmation flow, and rejection of an unrelated JSON file
- **PWA update behaviour** — the update policy (visibility- and interval-triggered checks, offline and hidden-tab skipping) and the update prompt itself
- **Content integrity** — 44 assertions over the lessons, questions and command reference

The layout, console cleanliness and responsive behaviour were additionally verified by driving headless Chrome over every route at four viewport widths (375, 393, 820 and 1440 CSS pixels): no console errors or warnings, no page errors, no failed requests, no horizontal page scrolling, body text at 16px or larger, form controls at 16px so iOS Safari does not zoom on focus, comfortable touch targets, and exactly one `<h1>` and one `<main>` landmark per page. That verification used a throwaway script outside the repository, so it adds no dependency here.

---

## Design and accessibility notes

- **Mobile-first.** A bottom tab bar on phones, a sidebar from 900px up, and one scrolling content region. Safe-area insets are respected so the tab bar clears the iPhone home indicator.
- **16px minimum body text**, and 16px form controls, because anything smaller makes iOS Safari zoom when a field gains focus.
- **Light and dark themes**, following the device by default with an in-app override that persists. Dark is defined twice — once for `prefers-color-scheme` and once for the explicit `[data-theme]` attribute — so the toggle wins in both directions.
- **Collapsible lesson sections** use native `<details>`, so they are keyboard accessible, work with in-page find, and need no JavaScript.
- **Syntax highlighting** uses `highlight.js` with only YAML, bash, JSON and Dockerfile registered, themed with the same CSS custom properties as the rest of the app so it is readable in both themes.
- **Code blocks scroll horizontally inside themselves** and the page never does. Long Kubernetes identifiers in prose wrap rather than overflowing.
- **Copy buttons** on every code sample and command, with a `navigator.clipboard` path and a legacy fallback for non-secure origins.
- **Keyboard and screen reader**: a skip link, semantic landmarks, labelled form controls, `aria-pressed` on filter chips, `aria-current` on the active navigation item and question, a `role="timer"` for the exam clock, and `prefers-reduced-motion` respected.

---

## Known limitations

- **Mock exams cannot fully auto-grade performance-based tasks.** The real CKAD runs in a live cluster; this app has no cluster. Multiple-choice and command questions are auto-scored, and lab tasks are scored from a checkpoint list you confirm after submitting. That is honest but it depends on you being honest with yourself.
- **The content chunk is large** (about 1.4 MB, 380 KB gzipped) because 50 full lessons ship as one module. That is deliberate for an offline-first app — the service worker precaches everything on first visit — and the framework and app-shell chunks are split out so first paint does not wait on it. Splitting content per domain behind dynamic imports would reduce the initial download and is the obvious next optimisation.
- **Progress is per browser.** There is no account, so it does not follow you between devices or between Safari and Chrome on the same phone. Use export/import to move it.
- **Labs need your own cluster.** kind, minikube or k3d all work. A few labs need extras and say so: metrics-server for `kubectl top`, a policy-enforcing CNI such as Calico for the NetworkPolicy lab, and an ingress controller for the Ingress lab.
- **The curriculum moves.** Content was verified against CKAD_Curriculum_v1.35 / Kubernetes v1.35 on 2026-09-03. Re-check the official sources before your exam.

---

## Licence and attribution

The learning content in this repository is original material written for this app. Kubernetes, CKAD, CNCF and the Linux Foundation are trademarks of their respective owners; this project is independent of all of them. Documentation links point only to official Kubernetes, CNCF, Helm and Linux Foundation pages.
