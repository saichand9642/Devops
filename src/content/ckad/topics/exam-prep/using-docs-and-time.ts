import type { Topic } from '../../../types'

export const usingDocsAndTime: Topic = {
  id: 'using-docs-and-time',
  title: 'Using the documentation and managing the clock',
  domainId: 'exam-prep',
  difficulty: 'intermediate',
  estimatedMinutes: 18,
  order: 2,
  tags: ['documentation', 'time management', 'strategy', 'search', 'flagging', 'paste'],
  oneLiner:
    'What you are allowed to look up, how to find it in under a minute, and how to spend 120 minutes so that you finish.',
  explanation: [
    'The exam permits one browser tab on the official Kubernetes documentation (kubernetes.io/docs, including the blog, and for CKAD the Helm documentation). It does not permit your own notes, other sites, or a second tab. Check the current allowed-resources page before your exam, because the details do change.',
    'The documentation is a fallback, not a first resort. `kubectl explain <kind>.<path> --recursive` answers most field questions faster than any search, and a working object (`kubectl get <kind> <name> -o yaml`) is the best template you will find.',
    'When you do use the docs, go for the **task pages**, not the concept pages. Task pages contain complete, copyable YAML. The fastest route is the search box with the object name plus the action: "configure liveness probe", "declare network policy", "configure a security context".',
    'Time management is arithmetic. Roughly 15-20 tasks in 120 minutes is about six to eight minutes each, and tasks are weighted differently. Spending fifteen minutes on one hard task costs you two easy ones.',
    'The strategy that works: one fast pass doing everything you can finish quickly, flagging anything that looks long; a second pass on the flagged tasks in order of weight; then a final sweep to verify and to secure partial credit on whatever remains.',
  ],
  whyItMatters: [
    'Most people who fail CKAD run out of time rather than out of knowledge, so strategy is worth as much as any single topic.',
    'Knowing the three fast lookup routes means an unfamiliar field costs one minute instead of five.',
    'Partial credit is real: each task is scored on what you achieved, so half of every task beats all of half the tasks.',
  ],
  howItWorks: [
    'Escalation order for "what is the field called?": (1) `kubectl explain <kind>.<path> --recursive`; (2) `kubectl get <kind> <existing> -o yaml` from something already working; (3) `kubectl api-resources | grep -i <word>` for the apiVersion; (4) the docs search box.',
    'Task pages are structured as: what you need, the YAML, the commands, then verification. Copy the YAML, adjust names and namespaces, apply. Concept pages explain rather than provide, so they are slower when you need to copy something.',
    'Copy and paste works in the exam terminal, but pasting into vim while in insert mode with autoindent on makes each line inherit the previous line indentation, so the nesting cascades and the YAML becomes invalid. Use `:set paste` first, or write the file with a shell heredoc instead.',
    'Weighting: not every task carries the same marks, and the exam indicates the percentage. Do the high-weight tasks you can complete before the low-weight ones.',
    'Flagging: the exam interface lets you mark a task for review. Use it aggressively on the first pass - deciding to skip is a strategy, not a failure.',
    'Budget the last ten to fifteen minutes for verification only. Re-running `kubectl get`, `rollout status` and `get endpoints` across your tasks catches the ones that silently did not take effect.',
    'Objects created in the wrong namespace are the most common silent failure, which is why the verification pass starts with context and namespace.',
  ],
  diagrams: [
    {
      kind: 'flow',
      title: 'Where to look, in order of speed',
      caption:
        'The docs tab is the slowest option. Try the two offline ones first - they are faster and always match your cluster.',
      nodes: [
        {
          label: 'kubectl explain <kind>.<path>',
          detail: 'Fastest. Field names, types, and whether it is required.',
          tone: 'accent',
        },
        {
          label: 'kubectl create ... --dry-run=client -o yaml',
          detail: 'Gives you a correct skeleton to edit',
          arrowLabel: 'if you need a whole object',
        },
        {
          label: 'kubectl get <existing> -o yaml',
          detail: 'Copy the shape from something already working',
          arrowLabel: 'if a similar object exists',
        },
        {
          label: 'The allowed documentation site',
          detail: 'Search, then copy from the example blocks',
          arrowLabel: 'last resort',
          branch: {
            label: 'Browsing instead of searching',
            detail: 'Search the exact field name; never read a page top to bottom',
          },
        },
        {
          label: 'Field written and validated',
          detail: 'kubectl apply --dry-run=server confirms it',
          tone: 'success',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Exam strategy (not a Kubernetes object)',
      apiVersion: 'n/a',
      purpose: 'The numbers that drive every decision during the exam.',
      fields: [
        { path: 'duration', meaning: '120 minutes.' },
        { path: 'tasks', meaning: 'Roughly 15-20 performance-based tasks, individually weighted.' },
        { path: 'pass mark', meaning: '66%.' },
        {
          path: 'time per task',
          meaning: 'About 6-8 minutes average, so anything past 8 should be flagged.',
        },
        {
          path: 'scoring',
          meaning: 'Partial credit per task - always leave something correct behind.',
        },
        {
          path: 'allowed resources',
          meaning:
            'One tab on kubernetes.io/docs (plus the blog and Helm docs). Verify the current list before your exam.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Two candidates, the same knowledge, one pass',
    story: [
      'Both candidates knew the material. Both sat 17 tasks in 120 minutes.',
      'Candidate A worked in order. Task 4 was a NetworkPolicy with an unfamiliar cross-namespace selector; they spent nineteen minutes on it, got it right, and never reached tasks 15-17. Task 9 was a StatefulSet with storage, another twelve minutes. They finished 13 of 17 and scored 61%.',
      'Candidate B did a first pass in 55 minutes, completing 12 straightforward tasks and flagging 5. Second pass: 40 minutes on the flagged ones in weight order, finishing 3 of the 5 and leaving partial work on the other 2. Final 20 minutes: verification, which caught two tasks where the object had been created in the wrong namespace. Scored 79%.',
      'The difference was not skill on any single task. It was that B never let one task consume the time of three, and reserved time to verify.',
      'B\'s NetworkPolicy task, incidentally, took four minutes on the second pass - because they stopped trying to recall the syntax and opened the "Declare Network Policy" task page instead.',
    ],
    code: [
      {
        title: 'The three-pass structure',
        language: 'text',
        code: `PASS 1  (target: 55-65 minutes)
  Read each task. Ask: "can I finish this in under 8 minutes?"
    YES -> do it now, verify, move on
    NO  -> flag it and move on IMMEDIATELY
  Goal: every easy mark banked before any hard task is attempted.

PASS 2  (target: 35-45 minutes)
  Revisit flagged tasks, highest weight first.
  Give each a hard cap. When the cap is hit, leave whatever works
  in place (partial credit) and move to the next.

PASS 3  (target: final 10-15 minutes)
  Verify only. For each task you attempted:
    - right context? right namespace?
    - does the object exist, and is it Ready?
    - kubectl rollout status / get endpoints / auth can-i / exec -- printenv
  This pass routinely finds one or two silent failures.`,
        explanation:
          'The single most valuable habit is the eight-minute question on the first pass, answered honestly.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The lookup escalation, in commands',
      language: 'bash',
      code: `# LEVEL 1 - the cluster itself (fastest, always correct for this version)
kubectl explain pod.spec.containers.readinessProbe --recursive
kubectl explain networkpolicy.spec --recursive
kubectl api-resources | grep -i ingress          # -> the right apiVersion

# LEVEL 2 - an object that already works (best template available)
kubectl get deploy some-existing-deploy -o yaml > /tmp/template.yaml
kubectl get netpol existing-policy -o yaml       # copy its shape

# LEVEL 3 - a generator plus dry-run (correct boilerplate, free)
kubectl create ingress x --class=nginx --rule="h/p*=s:80" --dry-run=client -o yaml

# LEVEL 4 - the documentation, searched precisely
#   kubernetes.io/docs -> search box -> OBJECT plus ACTION:
#     "configure liveness probe"
#     "declare network policy"
#     "configure a pod to use a persistentvolume"
#     "configure a security context"
#     "configure pod to use a configmap"
#   Prefer results under /docs/tasks/ - they contain complete YAML.
#   Avoid /docs/concepts/ when you need something to copy.`,
      explanation:
        'Levels 1-3 need no browser and cover the large majority of questions. Level 4 is for whole-object shapes you genuinely cannot recall.',
    },
    {
      title: 'Pasting YAML from the docs without breaking it',
      language: 'bash',
      code: `# SAFEST: write the file with a heredoc, paste inside it, finish with Ctrl+D
cat > policy.yaml <<'YAML_END'
<paste the YAML block here>
YAML_END
kubectl apply -f policy.yaml

# IN VIM: turn off autoindent BEFORE pasting, or every line gets
# progressively more indented and the YAML becomes invalid.
#   vi policy.yaml
#   :set paste
#   i            (insert mode)
#   <paste>
#   Esc  :set nopaste  :wq

# ALWAYS validate after pasting
kubectl apply -f policy.yaml --dry-run=server
grep -Pn "\\t" policy.yaml || echo "no tabs - good"`,
      explanation:
        'The cascading-indentation problem from pasting into vim with autoindent on is a classic time sink. `:set paste` prevents it entirely; a heredoc avoids the editor altogether.',
    },
    {
      title: 'A pre-exam navigation checklist',
      language: 'text',
      code: `Practise finding these from the docs search box, timed. Under 45 seconds
each is achievable and is a real skill worth rehearsing.

  Probes           search: "configure liveness readiness startup probes"
  ConfigMap        search: "configure pod to use a configmap"
  Secret           search: "distribute credentials securely"
  SecurityContext  search: "configure a security context"
  Resources        search: "assign cpu resource" / "assign memory resource"
  Volumes          search: "configure a pod to use a persistentvolume"
  NetworkPolicy    search: "declare network policy"
  Ingress          search: "ingress"
  Jobs / CronJobs  search: "jobs run to completion" / "cronjob"
  RBAC             search: "using rbac authorization"
  Multi-container  search: "sidecar containers" / "init containers"
  Helm             helm.sh/docs   (allowed for CKAD)

For each page, the useful part is the FIRST complete YAML block.
The skill is navigation speed, not memorisation.`,
      explanation:
        'Rehearsing this a few times before the exam removes the panic of hunting for a page you know exists but cannot locate.',
    },
  ],
  imperative: [
    {
      command: 'kubectl explain networkpolicy.spec --recursive | head -30',
      what: 'The fastest field reference for objects that have no generator.',
      expected: 'The full spec tree.',
    },
    {
      command: 'kubectl api-resources | grep -i ingress',
      what: 'Resolves an apiVersion, a short name and whether a kind is namespaced, in one line.',
      expected: 'ingresses ing networking.k8s.io/v1 true Ingress',
    },
    {
      command: 'kubectl get deploy existing-app -o yaml > /tmp/template.yaml',
      what: 'Turns something that already works into a template - usually better than any documentation example.',
      expected: 'A file to adapt.',
      placeholders: ['existing-app'],
    },
    {
      command: 'kubectl explain pod.spec.containers.livenessProbe.httpGet',
      what: 'Targeted lookup when you need only one level of nesting.',
      expected: 'host, httpHeaders, path, port, scheme.',
    },
    {
      command: 'kubectl apply -f policy.yaml --dry-run=server',
      what: 'Validate immediately after pasting, before wondering why nothing happened.',
      expected: '"(server dry run)" or a precise error.',
      placeholders: ['policy.yaml'],
    },
    {
      command: 'grep -Pn "\\t" policy.yaml',
      what: 'Checks a pasted file for literal tabs, which YAML rejects and editors hide.',
      expected: 'No output when clean.',
      placeholders: ['policy.yaml'],
    },
    {
      command: 'kubectl config get-contexts',
      what: 'Ten seconds at the start of every task, and again during the verification pass.',
      expected: 'An asterisk on the context the task named.',
    },
    {
      command: 'kubectl get pods -A | grep -vE "Running|Completed"',
      what: 'The one-line verification sweep: anything not Running or Completed is worth a look.',
      expected: 'Ideally no output.',
    },
    {
      command: 'kubectl get endpoints -A | grep "<none>"',
      what: 'Finds Services you created that route nowhere - the most common silent Service failure.',
      expected: 'No output, apart from expected headless or selector-less Services.',
    },
    {
      command:
        'kubectl get deploy -A -o custom-columns=NS:.metadata.namespace,NAME:.metadata.name,READY:.status.readyReplicas,WANT:.spec.replicas',
      what: 'Every Deployment in the cluster with its ready-versus-desired count, for the final sweep.',
      expected: 'READY equal to WANT on everything you touched.',
    },
  ],
  declarative: {
    steps: [
      'Before the exam: practise finding five documentation pages from the search box, timed.',
      'At the start: 60 seconds of shell setup, then read every task once and note the weights.',
      'Pass 1: complete everything under eight minutes; flag the rest without hesitating.',
      'Pass 2: flagged tasks, highest weight first, with a hard cap each. Leave partial work in place.',
      'Pass 3: verify only - context, namespace, object exists, object is Ready.',
      'Never leave a task completely empty; a partially correct object scores more than nothing.',
    ],
    code: [
      {
        title: 'The verification sweep, as commands',
        language: 'bash',
        code: `# Run this for each context you worked in during the exam.

# 1. Am I where I think I am?
kubectl config get-contexts

# 2. Is anything obviously broken?
kubectl get pods -A | grep -vE 'Running|Completed'

# 3. Did every Deployment I touched actually roll out?
kubectl get deploy -A -o custom-columns='NS:.metadata.namespace,NAME:.metadata.name,READY:.status.readyReplicas,WANT:.spec.replicas'

# 4. Do the Services I created have endpoints?
kubectl get endpoints -A | grep '<none>' && echo "^ empty endpoints - investigate"

# 5. Was anything rejected by admission or failing probes?
kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp 2>/dev/null | tail -10`,
        explanation:
          'The endpoints check and the warning-events check are the two that most often reveal a silent failure.',
      },
    ],
  },
  verification: [
    {
      command: 'kubectl config get-contexts',
      what: 'The cheapest and most valuable verification: were you in the right cluster?',
      expected: 'The context the task named, marked current.',
    },
    {
      command: 'kubectl get pods -A | grep -vE "Running|Completed"',
      what: 'A whole-cluster health sweep in one line.',
      expected: 'No output.',
    },
    {
      command: 'kubectl get endpoints -A | grep "<none>"',
      what: 'Catches Services with no backends.',
      expected: 'No unexpected output.',
    },
    {
      command:
        'kubectl get events -A --field-selector type=Warning --sort-by=.lastTimestamp | tail -10',
      what: 'Catches quota rejections, failed probes and scheduling failures across everything you did.',
      expected: 'Nothing recent.',
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl explain deployment.spec --recursive | grep -i probe',
      what: 'When you are about to search the docs for a field name, grep the explain output first.',
      expected: 'The path to livenessProbe/readinessProbe.',
    },
    {
      command: 'kubectl apply -f pasted.yaml --dry-run=server',
      what: 'Catches both a mangled paste and a wrong apiVersion in one step.',
      expected: '"(server dry run)".',
      placeholders: ['pasted.yaml'],
    },
    {
      command: 'kubectl get deploy api -A',
      what: 'When a graded object "does not exist", it is usually in the wrong namespace. This finds it.',
      expected: 'The object, with its actual namespace.',
      placeholders: ['api'],
    },
    {
      command: 'kubectl get all -n shop',
      what: 'A quick survey that the objects a task asked for really landed where you intended.',
      expected: 'The Pods, Services and Deployments for that task.',
      placeholders: ['shop'],
    },
  ],
  commonMistakes: [
    'Working tasks strictly in order, so one hard task early consumes the time of several easy ones later.',
    'Going to the documentation for a field name when `kubectl explain` would answer in two seconds.',
    'Reading concept pages when you need copyable YAML. Task pages have the YAML.',
    'Pasting into vim without `:set paste`, producing cascading indentation and invalid YAML.',
    'Leaving a task completely empty because it could not be finished. Partial credit is real.',
    'Not reserving time to verify, so a task that silently failed scores zero despite the work.',
    'Forgetting to switch context, and doing perfect work in the wrong cluster.',
    'Opening extra browser tabs or unauthorised material, which can void the exam.',
    'Not practising documentation navigation beforehand, then discovering it is slow under pressure.',
  ],
  examTips: [
    'Ask "under eight minutes?" for every task on the first pass, and answer honestly.',
    'Flag aggressively. Skipping is a strategy, and the interface exists for it.',
    'Do high-weight tasks before low-weight ones when you have to choose.',
    'Escalate lookups: `kubectl explain` -> an existing object -> a generator -> the docs.',
    'In the docs, search the object plus the action, and prefer `/docs/tasks/` results.',
    'Paste with a shell heredoc, or `:set paste` in vim, then validate with `--dry-run=server`.',
    'Reserve the last ten to fifteen minutes for verification. It routinely finds a silent failure.',
    'Never leave a task blank - create what you can, even if it is incomplete.',
  ],
  summary: [
    'One documentation tab is allowed; verify the current allowed-resources list before your exam.',
    'Escalate: `kubectl explain` -> existing object -> generator -> docs task page.',
    'Three passes: easy tasks first, flagged tasks by weight, then verification only.',
    'Roughly 6-8 minutes per task; anything longer should be flagged on the first pass.',
    'Partial credit is real, so always leave something correct behind.',
    'Paste with a heredoc or `:set paste`, and validate with `--dry-run=server`.',
  ],
  practice: [
    {
      id: 'time-p1',
      level: 'beginner',
      prompt:
        'You cannot remember whether the field is `readinessProbe.httpGet.path` or `readinessProbe.http.path`. What is the fastest way to find out?',
      answer: 'kubectl explain pod.spec.containers.readinessProbe --recursive',
      explanation:
        'It reads the running cluster OpenAPI schema, so it is both faster than a browser and guaranteed correct for the exam Kubernetes version. Reach for the docs only when you need a whole object shape you cannot recall.',
    },
    {
      id: 'time-p2',
      level: 'intermediate',
      prompt:
        'Twenty minutes remain and three tasks are unfinished: one worth 4%, one worth 8%, one worth 2%. How do you spend the time?',
      answer:
        'Start with the 8% task, since it is worth as much as the other two combined. Cap it at about ten minutes and leave whatever works in place for partial credit. Then the 4% task with the remaining time, doing the parts you can complete quickly. If anything is left, spend the final two or three minutes on the 2% task and on a verification sweep rather than starting something new.',
      explanation:
        'Weight ordering plus hard caps plus partial credit. The mistake to avoid is starting the 2% task first because it looks easiest - easiness only matters when the weights are similar.',
    },
    {
      id: 'time-p3',
      level: 'advanced',
      prompt:
        'You paste a NetworkPolicy from the documentation into vim and the apply fails with a YAML parse error. Explain the likely cause and two ways to avoid it.',
      answer:
        'Vim was in insert mode with `autoindent` on, so each pasted line inherited the previous line indentation and the nesting cascaded deeper on every line.\n\nAvoid it by either:\n1. `:set paste` before entering insert mode (and `:set nopaste` afterwards), or\n2. Not using vim for the paste: write the file with a shell heredoc, paste inside it, and finish with Ctrl+D.\n\nThen validate: `kubectl apply -f policy.yaml --dry-run=server` and `grep -Pn "\\t" policy.yaml`.',
      explanation:
        'This costs people several minutes and looks like a documentation error rather than an editor setting. `set expandtab ts=2 sw=2` in `~/.vimrc` plus `:set paste` when pasting removes the whole class of problem.',
    },
  ],
  lab: {
    title: 'Rehearse the exam, not just the content',
    scenario:
      'You will practise the two skills that never appear in a topic list: finding documentation fast, and running a timed three-pass strategy over a set of tasks.',
    prerequisites: ['A cluster, a browser open on kubernetes.io/docs, and a timer'],
    tasks: [
      {
        instruction:
          'Timed drill: from the docs search box, find the complete YAML for a NetworkPolicy, a liveness probe, a PVC and a SecurityContext. Time each; aim for under 45 seconds.',
      },
      {
        instruction:
          'Answer the same four questions with `kubectl explain` instead, and compare the times.',
      },
      {
        instruction:
          'Practise the safe paste: get a NetworkPolicy from the docs into a file using a heredoc, then validate it with --dry-run=server.',
      },
      {
        instruction:
          'Write six small tasks on paper with made-up weights (2-8%), covering different domains.',
      },
      {
        instruction:
          'Set a 30-minute timer and run the three-pass strategy over them: easy first, flag the rest, then weight order, then verify.',
      },
      {
        instruction:
          'Run the verification sweep commands and see whether they catch anything you missed.',
      },
      {
        instruction:
          'Review which lookup route you used for each task, and whether a faster one existed.',
      },
      { instruction: 'Clean up the practice namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - docs versus explain, timed',
        language: 'bash',
        code: `# Do these with a stopwatch and record BOTH numbers.

# --- Route A: the documentation (browser) ---
#   search "declare network policy"                 -> complete NetworkPolicy YAML
#   search "configure liveness readiness startup probes"
#   search "configure a pod to use a persistentvolume"
#   search "configure a security context"

# --- Route B: the cluster ---
time kubectl explain networkpolicy.spec --recursive | head -20
time kubectl explain pod.spec.containers.livenessProbe --recursive
time kubectl explain persistentvolumeclaim.spec --recursive | head -15
time kubectl explain pod.spec.securityContext --recursive

# Typical outcome: Route B is 2-5 seconds and gives you FIELD NAMES.
# Route A is 20-60 seconds and gives you a COMPLETE OBJECT.
# Use B for "what is it called", A for "what does the whole thing look like".`,
      },
      {
        title: 'Step 3 - the safe paste drill',
        language: 'bash',
        code: `kubectl create namespace docs-lab
kubectl config set-context --current --namespace=docs-lab

# CORRECT: heredoc, paste, then the terminator on its own line
cat > policy.yaml <<'YAML_END'
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: test-network-policy
  namespace: docs-lab
spec:
  podSelector:
    matchLabels:
      role: db
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - ipBlock:
            cidr: 172.17.0.0/16
            except:
              - 172.17.1.0/24
        - namespaceSelector:
            matchLabels:
              project: myproject
        - podSelector:
            matchLabels:
              role: frontend
      ports:
        - protocol: TCP
          port: 6379
  egress:
    - to:
        - ipBlock:
            cidr: 10.0.0.0/24
      ports:
        - protocol: TCP
          port: 5978
YAML_END

kubectl apply -f policy.yaml --dry-run=server
# networkpolicy.networking.k8s.io/test-network-policy created (server dry run)
grep -Pn "\\t" policy.yaml || echo "no tabs - good"

kubectl apply -f policy.yaml
kubectl describe netpol test-network-policy | head -12

# NOW note the WRONG way so you recognise the symptom:
#   vi bad.yaml ; i ; <paste>     -> with autoindent on, you get
#     spec:
#       podSelector:
#           matchLabels:
#               role: db
#   ...each line deeper than the last, and apply fails with a parse error.
#   The fix, every time:  :set paste  i  <paste>  Esc  :set nopaste  :wq`,
      },
      {
        title: 'Steps 4-5 - the timed three-pass drill',
        language: 'text',
        code: `Write these on paper with the weights, then set a 30-minute timer.

  T1 (3%)  In ns docs-lab, create a Pod "quick" running busybox:1.36
           that sleeps 3600.
  T2 (7%)  Create a Deployment "api" with 3 replicas of nginx:1.27-alpine,
           a readiness probe on / port 80, and a ClusterIP Service on 80.
  T3 (2%)  Create a ConfigMap "cfg" with LOG_LEVEL=debug and consume it
           as an env var in a new Pod "reader".
  T4 (8%)  Create a NetworkPolicy allowing ingress to app=api Pods only
           from app=web Pods on TCP 80, plus a namespace-wide DNS egress rule.
  T5 (4%)  Create a CronJob "beat" running every 5 minutes that echoes the
           date, with backoffLimit 2 and history limits of 1.
  T6 (6%)  Create a ServiceAccount "reader-sa", a Role allowing get/list on
           pods and pods/log, and bind them.

PASS 1 (aim 12 min): T1 and T3 are clearly under 8 minutes; T5 and T6 have
  generators and are quick. Do those four. FLAG T2 and T4.

PASS 2 (aim 13 min): T4 first (8%, highest weight), then T2 (7%).
  Cap each at about 6 minutes and accept partial work.

PASS 3 (aim 5 min): verification sweep only.`,
      },
      {
        title: 'Step 6 - the verification sweep',
        language: 'bash',
        code: `kubectl config get-contexts

echo "--- anything not Running/Completed? ---"
kubectl get pods -n docs-lab | grep -vE 'Running|Completed|NAME' || echo "  all healthy"

echo "--- deployments rolled out? ---"
kubectl get deploy -n docs-lab -o custom-columns='NAME:.metadata.name,READY:.status.readyReplicas,WANT:.spec.replicas'

echo "--- services with no endpoints? ---"
kubectl get endpoints -n docs-lab | grep '<none>' || echo "  all services have endpoints"

echo "--- recent warnings? ---"
kubectl get events -n docs-lab --field-selector type=Warning --sort-by=.lastTimestamp 2>/dev/null | tail -5

echo "--- does the RBAC actually work? ---"
kubectl auth can-i get pods/log --as=system:serviceaccount:docs-lab:reader-sa -n docs-lab 2>/dev/null

echo "--- object count in the RIGHT namespace ---"
kubectl get pods,deploy,svc,cm,sa,netpol,cronjob -n docs-lab --no-headers 2>/dev/null | wc -l`,
      },
      {
        title: 'Steps 7-8 - review and cleanup',
        language: 'bash',
        code: `# For each task, ask honestly:
#   - which lookup route did I use, and was there a faster one?
#   - did I verify, or assume?
#   - did I finish inside my cap, or overrun?
#
# The two most common findings on a first attempt:
#   1. Used the docs where kubectl explain would have done.
#   2. Overran on a flagged task instead of taking partial credit.

kubectl config set-context --current --namespace=default
kubectl delete namespace docs-lab
rm -f policy.yaml`,
      },
    ],
    verification: [
      {
        command: 'kubectl get pods,deploy,svc,cm,sa,netpol,cronjob -n docs-lab',
        what: 'Everything the drill asked for should exist, in this namespace.',
        expected: 'One object per completed task.',
      },
      {
        command: 'kubectl get endpoints -n docs-lab | grep "<none>"',
        what: 'The check that most often catches a silently broken Service.',
        expected: 'No output.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace docs-lab',
        what: 'Removes all drill objects.',
        expected: 'namespace "docs-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['efficient-kubectl', 'exam-traps-and-checklist', 'yaml-and-api-discovery'],
  docs: [
    { title: 'Kubernetes documentation home', url: 'https://kubernetes.io/docs/home/' },
    { title: 'Kubernetes tasks (copyable YAML)', url: 'https://kubernetes.io/docs/tasks/' },
    {
      title: 'Linux Foundation - resources allowed during the exam',
      url: 'https://docs.linuxfoundation.org/tc-docs/certification/certification-resources-allowed',
    },
    {
      title: 'CKA/CKAD/CKS FAQ',
      url: 'https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks',
    },
  ],
}
