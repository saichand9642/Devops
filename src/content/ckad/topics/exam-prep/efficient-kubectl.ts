import type { Topic } from '../../../types'

export const efficientKubectl: Topic = {
  id: 'efficient-kubectl',
  title: 'Efficient kubectl: aliases, dry-run and safe edits',
  domainId: 'exam-prep',
  difficulty: 'intermediate',
  estimatedMinutes: 20,
  order: 1,
  tags: ['aliases', 'dry-run', 'vim', 'bash', 'shortcuts', 'backup', 'speed'],
  oneLiner:
    'The setup and habits that turn two hours of typing into enough time to finish: aliases, generators, safe editing and backups.',
  explanation: [
    'CKAD is not a knowledge test with a time limit; it is a speed test that also requires knowledge. Most people who fail knew how to do the tasks. The difference is keystrokes and mistakes.',
    'Three habits do most of the work. **Aliases** cut typing on every command. **Generators with `--dry-run=client -o yaml`** produce correct manifests instead of hand-typed ones. **Backups before edits** mean a mistake costs seconds rather than the whole task.',
    'Set the environment up in the first 60 seconds, once, and it pays for itself within two tasks. `alias k=kubectl`, an export for the dry-run flags, and vim configured for two-space YAML indentation.',
    'The generate-and-edit workflow is the single biggest saving: `k create deploy api --image=nginx $do > api.yaml`, add the three fields the task actually asks for, apply. You never type `apiVersion`, `kind`, `selector` or `template` again, which is where indentation errors come from.',
    'Editing safely means dumping the object first (`k get deploy api -o yaml > backup.yaml`) so any mistake is one `k replace --force -f backup.yaml` away from undone. It costs three seconds and removes the worst-case outcome.',
  ],
  whyItMatters: [
    'Time is the binding constraint. Sixteen tasks in 120 minutes is about seven minutes each, including reading, doing and verifying.',
    'Hand-typed YAML is the main source of self-inflicted failures - a tab, a wrong indent level, a selector that does not match the template.',
    'Being able to undo an edit means you can work fast without being afraid of `kubectl edit`, which is where hesitation costs the most time.',
  ],
  howItWorks: [
    'The exam terminal is a normal Linux shell with bash and vim. Aliases and exports you set persist for that terminal session. Bash completion for kubectl is available and worth enabling.',
    '`--dry-run=client -o yaml` renders the object locally without contacting the cluster; `--dry-run=server` sends it for full validation and admission, then discards it. Use client for generating, server for validating.',
    'Generators exist for: `run` (Pod), `create deployment|job|cronjob|configmap|secret|service|serviceaccount|namespace|quota|role|rolebinding|clusterrole|clusterrolebinding|ingress|poddisruptionbudget`, plus `expose`, `scale`, `set image|env|resources|serviceaccount`, `label`, `annotate` and `autoscale`.',
    'Fields with no generator flag - probes, volumes, securityContext, multiple containers, affinity - must be edited into a generated skeleton. Knowing which is which saves you from hunting for a flag that does not exist.',
    'Immutable fields (a Deployment selector, a Job template, most of a Pod spec) cannot be edited. `kubectl replace --force -f file.yaml` deletes and recreates in one command, which is the accepted answer when a task requires changing one.',
    '`kubectl explain <kind>.<path> --recursive` is faster than the documentation for a field name or nesting question, and it is always correct for the running version.',
    'Output shaping matters for verification: `-o jsonpath` for one value, `-o custom-columns` for a table, `--sort-by` for ordering, `-l` for a subset. A task that asks you to write something into a file is usually one of these plus a redirect.',
  ],
  keyObjects: [
    {
      kind: 'Shell environment (not a Kubernetes object)',
      apiVersion: 'n/a',
      purpose: 'The setup that makes everything else faster.',
      fields: [
        { path: 'alias k=kubectl', meaning: 'Saves seven characters on every single command.' },
        {
          path: 'export do="--dry-run=client -o yaml"',
          meaning: 'Append $do to any generator to get a manifest.',
        },
        {
          path: 'export now="--force --grace-period=0"',
          meaning: 'Fast deletion when a task needs a Pod gone immediately.',
        },
        {
          path: 'export ns="-n <namespace>"',
          meaning: 'Or better, set the namespace on the context once.',
        },
        {
          path: 'complete -o default -F __start_kubectl k',
          meaning: 'Makes bash completion work for the alias too.',
        },
        {
          path: '~/.vimrc: set et ts=2 sw=2 ai',
          meaning: 'Expand tabs, two-space indent, autoindent - correct YAML by default.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The same task, four minutes apart',
    story: [
      'The task: "In namespace `shop`, create a Deployment `api` with 3 replicas of `nginx:1.27-alpine`, a readiness probe on `/` port 80, CPU request 100m and memory limit 256Mi."',
      'Candidate A types the whole manifest from memory. Six minutes in they hit `error: error validating data: ValidationError(Deployment.spec): unknown field "replica"`, fix it, then hit a selector/template label mismatch. Total: about nine minutes, and no time left to verify.',
      'Candidate B runs `k create deploy api --image=nginx:1.27-alpine --replicas=3 $do -n shop > api.yaml`, opens it, adds seven lines of probe and resources under the container, applies, and runs `k rollout status deploy/api -n shop`. Total: about three minutes, verified.',
      'The knowledge was identical. The difference was that B never typed `apiVersion`, `kind`, `metadata`, `selector`, `matchLabels`, `template` or the labels - the parts that are both boilerplate and error-prone.',
      'Across sixteen tasks that gap is the whole exam.',
    ],
    code: [
      {
        title: 'The generate-and-edit loop',
        language: 'bash',
        code: `# 60-second setup, once per terminal
alias k=kubectl
export do="--dry-run=client -o yaml"
export now="--force --grace-period=0"
complete -o default -F __start_kubectl k
printf 'set et ts=2 sw=2 ai nu\\n' >> ~/.vimrc

# Per task
k config set-context --current --namespace=shop

k create deploy api --image=nginx:1.27-alpine --replicas=3 $do > api.yaml
vi api.yaml          # add ONLY the probe and resources
k apply -f api.yaml
k rollout status deploy/api --timeout=60s
# deployment "api" successfully rolled out`,
        explanation:
          'Everything that can be generated is generated. Only the fields the task actually specifies are typed by hand.',
        placeholders: ['shop', 'api'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The 60-second setup, in full',
      language: 'bash',
      code: `# --- aliases and flag shortcuts ---
alias k=kubectl
alias kg='kubectl get'
alias kd='kubectl describe'
alias kdel='kubectl delete'
alias kaf='kubectl apply -f'
alias kex='kubectl explain'

export do="--dry-run=client -o yaml"     # generate a manifest
export now="--force --grace-period=0"    # delete immediately

# Make completion work for the alias
source <(kubectl completion bash)
complete -o default -F __start_kubectl k

# --- vim: correct YAML indentation by default ---
cat >> ~/.vimrc <<'VIMRC'
set expandtab       " never insert a literal tab
set tabstop=2
set shiftwidth=2
set autoindent
set number
" visual guide for YAML nesting
set list
set listchars=tab:>-,trail:.
VIMRC

# --- per task: set the namespace once, then stop typing -n ---
k config set-context --current --namespace=shop
k config view --minify -o jsonpath='{..namespace}{"\\n"}'`,
      explanation:
        'The vim settings matter more than they look: a literal tab in YAML is a hard parse error, and `expandtab` makes it impossible to insert one.',
      placeholders: ['shop'],
    },
    {
      title: 'What each generator can and cannot do',
      language: 'bash',
      code: `# CAN be generated in one line ------------------------------------------
k run web --image=nginx:1.27-alpine                       # Pod
k run web --image=nginx --command -- sleep 3600           # Pod with command
k create deploy api --image=nginx --replicas=3            # Deployment
k create job mig --image=busybox -- sh -c 'echo hi'       # Job
k create cj beat --image=busybox --schedule="*/5 * * * *" -- date
k create cm app-config --from-literal=K=V                 # ConfigMap
k create secret generic creds --from-literal=p=x          # Secret
k create secret docker-registry regcred --docker-server=... --docker-username=... --docker-password=...
k create secret tls web-tls --cert=tls.crt --key=tls.key
k create sa api-sa                                        # ServiceAccount
k create role r --verb=get,list --resource=pods           # Role
k create rolebinding rb --role=r --serviceaccount=ns:sa   # RoleBinding
k create clusterrole cr --verb=get --resource=nodes
k create clusterrolebinding crb --clusterrole=cr --serviceaccount=ns:sa
k create quota q --hard=cpu=1,memory=1Gi                  # ResourceQuota
k create ingress ing --class=nginx --rule="host/path*=svc:80"
k expose deploy api --port=80 --target-port=8080           # Service
k scale deploy api --replicas=5
k set image deploy/api api=nginx:1.27
k set env deploy/api KEY=value
k set resources deploy/api -c=api --requests=cpu=100m --limits=memory=256Mi
k set serviceaccount deploy/api api-sa
k label pod web tier=frontend
k annotate deploy api kubernetes.io/change-cause="..."
k autoscale deploy api --min=2 --max=8 --cpu-percent=70

# MUST be edited into YAML by hand ------------------------------------
#   probes (readiness / liveness / startup)
#   volumes and volumeMounts
#   securityContext (Pod and container)
#   multiple containers, init containers, native sidecars
#   NetworkPolicy (no generator at all)
#   PersistentVolumeClaim (no useful generator)
#   StatefulSet, DaemonSet (no generator - borrow a Deployment and edit kind)
#   affinity, tolerations, topologySpreadConstraints
#   lifecycle hooks`,
      explanation:
        'Memorising which side of this line a field falls on saves you from searching for a flag that does not exist - which is a surprisingly common way to lose two minutes.',
    },
    {
      title: 'Editing safely, and handling immutable fields',
      language: 'bash',
      code: `# ALWAYS back up before an edit you are unsure about
k get deploy api -o yaml > /tmp/api.backup.yaml

# Then edit freely
k edit deploy api
#   ... if you break it:
k replace --force -f /tmp/api.backup.yaml

# Immutable field? edit does not work. Recreate instead:
k get pod web -o yaml > /tmp/web.yaml
vi /tmp/web.yaml                 # change resources, volumes, whatever
k replace --force -f /tmp/web.yaml
# pod "web" deleted
# pod/web replaced

# Preview before applying to something that already exists
k diff -f api.yaml               # "-" lines are fields apply will DELETE

# Validate without creating (catches unknown fields and admission failures)
k apply -f api.yaml --dry-run=server`,
      explanation:
        '`kubectl replace --force -f` is the answer whenever the API says a field is immutable. It deletes and recreates in one command - accept that Pods restart.',
    },
  ],
  imperative: [
    {
      command: 'alias k=kubectl && complete -o default -F __start_kubectl k',
      what: 'The single highest-value line of the exam. Also fixes completion for the alias.',
      expected: 'No output; `k get po` now works with tab completion.',
    },
    {
      command: 'export do="--dry-run=client -o yaml"',
      what: 'Append `$do` to any generator to get a manifest instead of an object.',
      expected: 'No output.',
    },
    {
      command: 'k create deploy api --image=nginx:1.27-alpine --replicas=3 $do > api.yaml',
      what: 'The generate step. Produces a correct skeleton with matching selector and template labels.',
      expected: 'A file you can edit.',
      placeholders: ['api'],
    },
    {
      command: 'k config set-context --current --namespace=shop',
      what: 'Set the namespace once per task and stop typing `-n`.',
      expected: 'Context "..." modified.',
      placeholders: ['shop'],
    },
    {
      command: 'k explain deploy.spec.template.spec.containers.readinessProbe --recursive',
      what: 'The fastest field reference. No browser, always correct for this cluster version.',
      expected: 'The full probe field tree.',
    },
    {
      command: 'k get deploy api -o yaml > /tmp/api.backup.yaml',
      what: 'Three seconds of insurance before any edit.',
      expected: 'A file you can `replace --force` from.',
      placeholders: ['api'],
    },
    {
      command: 'k replace --force -f /tmp/api.backup.yaml',
      what: 'Undo, or the way to change an immutable field. Deletes and recreates.',
      expected: 'deleted then replaced.',
    },
    {
      command: 'k diff -f api.yaml',
      what: 'Shows exactly what an apply would change. `-` lines are removals.',
      expected: 'A unified diff, or nothing when in sync.',
      placeholders: ['api.yaml'],
    },
    {
      command: 'k apply -f api.yaml --dry-run=server',
      what: 'Full server-side validation without creating anything.',
      expected: '"(server dry run)" or a precise error.',
      placeholders: ['api.yaml'],
    },
    {
      command:
        "k get pods -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName,STATUS:.status.phase'",
      what: 'Build exactly the table a task asks for.',
      expected: 'Three columns.',
    },
    {
      command:
        "k get pods -o jsonpath='{.items[*].spec.containers[*].image}{\"\\n\"}' | tr ' ' '\\n' | sort -u",
      what: 'Extract one field across many objects - the shape of many "write X to a file" tasks.',
      expected: 'A deduplicated list of images.',
    },
    {
      command: 'k delete pod web $now',
      what: 'Immediate deletion when a task needs the Pod gone now rather than in 30 seconds.',
      expected: 'A warning about immediate deletion, then "deleted".',
      placeholders: ['web'],
    },
    {
      command: 'k run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh',
      what: 'The debug Pod. Worth being able to type without thinking.',
      expected: 'A shell inside the cluster network.',
    },
  ],
  declarative: {
    steps: [
      'Set up the shell once: alias, `$do`, completion, vim indentation.',
      'Set the context and namespace at the start of every task, from the task text.',
      'Generate whatever can be generated; type only the fields the task specifies.',
      'Back up before editing anything that already exists.',
      'Verify with a command that proves the outcome (`rollout status`, `get endpoints`, `auth can-i`, `exec -- printenv`), not by re-reading your YAML.',
      'Move on. A task that is 90% done and verified beats a task that is perfect and unfinished.',
    ],
    code: [
      {
        title: 'The per-task loop',
        language: 'bash',
        code: `# 1. Context and namespace, from the task text - ALWAYS first
k config use-context k8s-c1-a
k config set-context --current --namespace=shop

# 2. Generate
k create deploy api --image=nginx:1.27-alpine --replicas=3 $do > api.yaml

# 3. Edit only what the task asks for
vi api.yaml

# 4. Apply and verify
k apply -f api.yaml
k rollout status deploy/api --timeout=60s
k get deploy api -o wide

# 5. Move on immediately`,
        placeholders: ['k8s-c1-a', 'shop', 'api'],
      },
    ],
  },
  verification: [
    {
      command:
        'k config view --minify -o jsonpath=\'{.contexts[0].name}{" / "}{..namespace}{"\\n"}\'',
      what: 'Context and namespace in one line - run it at the start of every task.',
      expected: 'k8s-c1-a / shop',
    },
    {
      command: 'k rollout status deploy/api --timeout=60s',
      what: 'The verification for any Deployment change. Exit code 0 means done.',
      expected: 'deployment "api" successfully rolled out',
      placeholders: ['api'],
    },
    {
      command: 'k get all -n shop',
      what: 'A quick survey that the objects a task asked for exist.',
      expected: 'The Pods, Services, Deployments and ReplicaSets you created.',
      placeholders: ['shop'],
    },
    {
      command: 'alias | grep kubectl',
      what: 'Confirms the setup survived - worth checking if a command suddenly gets long.',
      expected: "alias k='kubectl'",
    },
  ],
  troubleshooting: [
    {
      command: 'k apply -f api.yaml --dry-run=server',
      what: 'When an apply fails, this reproduces the failure with the field path named, without changing anything.',
      expected: 'unknown field "spec.replica", or similar.',
      placeholders: ['api.yaml'],
    },
    {
      command: 'grep -Pn "\\t" api.yaml',
      what: 'Finds literal tabs, which YAML forbids and editors hide. `set expandtab` prevents them.',
      expected: 'No output when clean.',
      placeholders: ['api.yaml'],
    },
    {
      command: 'k explain deploy.spec --recursive | grep -i probe',
      what: 'When you cannot remember a field name or its nesting, grep the explain output.',
      expected: 'The path to livenessProbe/readinessProbe.',
    },
    {
      command: 'k get deploy api -o yaml | head -20',
      what: 'A working object is documentation. Copy its shape rather than recalling it.',
      expected: 'The stored manifest.',
      placeholders: ['api'],
    },
    {
      command: 'k replace --force -f /tmp/api.backup.yaml',
      what: 'The undo you set up before editing. Also the fix for an immutable-field error.',
      expected: 'deleted then replaced.',
    },
  ],
  commonMistakes: [
    'Not setting up aliases, and paying seven extra characters on several hundred commands.',
    'Typing manifests by hand when a generator exists.',
    'Forgetting `-o yaml` after `--dry-run=client`, which prints a confirmation line instead of a manifest.',
    'Writing `--dry-run` alone; it must be `--dry-run=client` or `--dry-run=server`.',
    'Editing without a backup, then having no way back when the edit is wrong.',
    'Fighting `kubectl edit` over an immutable field instead of reaching for `replace --force`.',
    'Leaving vim on default settings and inserting a literal tab into YAML.',
    'Skipping verification, so a task that silently failed is scored as failed.',
    'Not setting the namespace on the context and then omitting `-n` on the one command that mattered.',
    'Spending ten minutes perfecting one task while two easier ones go untouched.',
  ],
  examTips: [
    'First 60 seconds: `alias k=kubectl`, `export do="--dry-run=client -o yaml"`, completion, vim `set et ts=2 sw=2 ai`.',
    'First 10 seconds of every task: switch context, set the namespace.',
    'Reach for a generator before you reach for vim; reach for `kubectl explain` before you reach for the docs.',
    '`k get <kind> <name> -o yaml > backup.yaml` before any edit. It costs nothing and saves tasks.',
    '`kubectl replace --force -f` is the answer to every "field is immutable" error.',
    'Verify with a command whose output proves the requirement, then move on.',
    'If a task will take more than about eight minutes, flag it and come back - finishing three easy tasks beats perfecting one hard one.',
  ],
  summary: [
    'Aliases, `$do`, completion and vim indentation: 60 seconds of setup that pays back all exam long.',
    'Generate what can be generated; hand-write only probes, volumes, securityContext, multi-container specs and NetworkPolicies.',
    'Back up before editing; `replace --force -f` is both the undo and the immutable-field workaround.',
    '`kubectl explain --recursive` beats the documentation for field names and nesting.',
    'Verify every task with a command that proves the outcome, then move on.',
  ],
  practice: [
    {
      id: 'eff-p1',
      level: 'beginner',
      prompt: 'Write the four shell lines you would run in the first minute of the exam.',
      answer:
        'alias k=kubectl\nexport do="--dry-run=client -o yaml"\ncomplete -o default -F __start_kubectl k\nprintf \'set et ts=2 sw=2 ai\\n\' >> ~/.vimrc',
      explanation:
        'Optionally add `export now="--force --grace-period=0"`. The vim line is the one people skip and then regret, because a literal tab is a hard YAML error.',
    },
    {
      id: 'eff-p2',
      level: 'intermediate',
      prompt:
        'A task needs a Deployment with a readiness probe and resource limits. Describe the fastest correct sequence and say why typing the YAML from scratch is slower.',
      answer:
        '1. `k create deploy api --image=nginx:1.27-alpine --replicas=3 $do > api.yaml`\n2. `vi api.yaml` - add only `readinessProbe` and `resources` under the container\n3. `k apply -f api.yaml`\n4. `k rollout status deploy/api --timeout=60s`\n\nTyping from scratch is slower because you would hand-write `apiVersion`, `kind`, `metadata`, `spec.selector.matchLabels`, `spec.template.metadata.labels` and the container block - all boilerplate, and the selector/label pair is a common mismatch error.',
      explanation:
        'Probes and resources have no generator flags, so those two blocks are the only hand-written part. Everything else is generated and therefore correct by construction.',
    },
    {
      id: 'eff-p3',
      level: 'advanced',
      prompt:
        'A task says "change the resource limits on Pod `web` without deleting the Deployment that owns it". `kubectl edit pod web` fails with an immutable-field error. What do you do?',
      answer:
        'Pod resource fields are immutable, so you recreate the Pod - but the task forbids touching the Deployment. If `web` is a bare Pod:\n\nk get pod web -o yaml > /tmp/web.yaml\nvi /tmp/web.yaml            # change resources\nk replace --force -f /tmp/web.yaml\n\nIf `web` is owned by a Deployment, editing the Pod is the wrong approach entirely - change `spec.template.spec.containers[].resources` on the Deployment (`k set resources deploy/web -c=<container> --limits=...`), which triggers a rolling update and does not delete the Deployment.',
      explanation:
        'The wording matters: "without deleting the Deployment" permits a rollout, which is what `set resources` does. Reading the constraint carefully tells you which of the two routes is intended.',
    },
  ],
  lab: {
    title: 'Time yourself doing the same task twice',
    scenario:
      'You will complete an identical task twice - once by hand-writing YAML, once with the generate-and-edit workflow - and time both. The point is to feel the difference rather than take it on trust.',
    prerequisites: ['A cluster, a terminal, and a stopwatch (or the shell `time` builtin)'],
    tasks: [
      { instruction: 'Create namespace `eff-lab` and set it as default.' },
      {
        instruction:
          'Round 1: with NO aliases and NO generators, hand-write a Deployment `slow` (3 replicas, nginx:1.27-alpine, readiness probe on / port 80, CPU request 100m, memory limit 256Mi) and apply it. Time it.',
      },
      { instruction: 'Do the 60-second setup: alias, $do, completion, vim settings.' },
      {
        instruction:
          'Round 2: create the identical Deployment named `fast` using generate-and-edit. Time it.',
      },
      { instruction: 'Compare the times and the number of validation errors each round produced.' },
      {
        instruction:
          'Practise the safe-edit loop: back up `fast`, break it deliberately, restore it.',
      },
      { instruction: 'Practise the immutable-field workaround on a bare Pod.' },
      { instruction: 'Build three verification one-liners with jsonpath and custom-columns.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - the slow way, timed',
        language: 'bash',
        code: `kubectl create namespace eff-lab
kubectl config set-context --current --namespace=eff-lab

# Start the clock, then type this WITHOUT copying it - from memory:
time cat > slow.yaml <<'YAML'
apiVersion: apps/v1
kind: Deployment
metadata:
  name: slow
spec:
  replicas: 3
  selector:
    matchLabels:
      app: slow
  template:
    metadata:
      labels:
        app: slow
    spec:
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            periodSeconds: 5
          resources:
            requests:
              cpu: 100m
            limits:
              memory: 256Mi
YAML

kubectl apply -f slow.yaml
kubectl rollout status deploy/slow --timeout=120s
# Note the elapsed time, and how many times you had to fix an error.`,
      },
      {
        title: 'Step 3 - the setup',
        language: 'bash',
        code: `alias k=kubectl
export do="--dry-run=client -o yaml"
export now="--force --grace-period=0"
source <(kubectl completion bash) 2>/dev/null
complete -o default -F __start_kubectl k 2>/dev/null

cat >> ~/.vimrc <<'VIMRC'
set expandtab
set tabstop=2
set shiftwidth=2
set autoindent
set number
VIMRC

alias | grep kubectl
echo "do=$do"`,
      },
      {
        title: 'Step 4 - the fast way, timed',
        language: 'bash',
        code: `# Start the clock again.
k create deploy fast --image=nginx:1.27-alpine --replicas=3 $do > fast.yaml

# Now add ONLY the probe and resources. In vim:
#   navigate under "image: nginx:1.27-alpine" and insert:
#
#           ports:
#             - containerPort: 80
#           readinessProbe:
#             httpGet:
#               path: /
#               port: 80
#             periodSeconds: 5
#           resources:
#             requests:
#               cpu: 100m
#             limits:
#               memory: 256Mi

vi fast.yaml
k apply -f fast.yaml
k rollout status deploy/fast --timeout=120s

# Compare: the generated half (apiVersion, kind, metadata, selector,
# template labels, container name) was never typed, and cannot be wrong.
diff <(grep -c '' slow.yaml) <(grep -c '' fast.yaml) || true
echo "lines typed by hand in round 2: about 12 instead of about 30"`,
      },
      {
        title: 'Steps 5-6 - the safe-edit loop',
        language: 'bash',
        code: `# Back up
k get deploy fast -o yaml > /tmp/fast.backup.yaml

# Break it deliberately: point the image at a tag that does not exist
k set image deploy/fast nginx=nginx:does-not-exist
k rollout status deploy/fast --timeout=45s || echo "stuck, as expected"
k get pods -l app=fast

# Two ways back:
k rollout undo deploy/fast                     # for a template change
k rollout status deploy/fast --timeout=60s

# ...or restore wholesale from the backup
k replace --force -f /tmp/fast.backup.yaml
k rollout status deploy/fast --timeout=120s
k get deploy fast -o jsonpath='{.spec.template.spec.containers[0].image}{"\\n"}'
# nginx:1.27-alpine`,
      },
      {
        title: 'Step 7 - the immutable-field workaround',
        language: 'bash',
        code: `k run bare --image=nginx:1.27-alpine
k wait --for=condition=Ready pod/bare --timeout=90s

# Try to change resources in place
k set resources pod/bare -c=bare --requests=cpu=200m 2>&1 | head -3
# error: ... pod updates may not change fields other than ...

# The workaround
k get pod bare -o yaml > /tmp/bare.yaml
# edit /tmp/bare.yaml to add:
#   resources:
#     requests:
#       cpu: 200m
sed -i 's|image: nginx:1.27-alpine|image: nginx:1.27-alpine\\n    resources:\\n      requests:\\n        cpu: 200m|' /tmp/bare.yaml 2>/dev/null || vi /tmp/bare.yaml

k replace --force -f /tmp/bare.yaml
k get pod bare -o jsonpath='{.spec.containers[0].resources}{"\\n"}'`,
      },
      {
        title: 'Steps 8-9 - verification one-liners, then cleanup',
        language: 'bash',
        code: `# 1. One value
k get deploy fast -o jsonpath='{.status.readyReplicas}/{.spec.replicas}{"\\n"}'
# 3/3

# 2. A table
k get pods -o custom-columns='POD:.metadata.name,READY:.status.containerStatuses[0].ready,NODE:.spec.nodeName'

# 3. A filtered, sorted list written to a file
k get pods --sort-by=.metadata.creationTimestamp -o name > /tmp/pods.txt
cat /tmp/pods.txt

k config set-context --current --namespace=default
k delete namespace eff-lab
rm -f slow.yaml fast.yaml /tmp/fast.backup.yaml /tmp/bare.yaml /tmp/pods.txt`,
      },
    ],
    verification: [
      {
        command:
          'kubectl get deploy -n eff-lab -o custom-columns=NAME:.metadata.name,READY:.status.readyReplicas',
        what: 'Both Deployments should be fully ready and functionally identical.',
        expected: 'slow 3 and fast 3.',
      },
      {
        command:
          'kubectl get deploy fast -n eff-lab -o jsonpath=\'{.spec.template.spec.containers[0].readinessProbe.httpGet.path}{"\\n"}\'',
        what: 'Confirms the hand-added probe landed correctly in the generated skeleton.',
        expected: '/',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace eff-lab',
        what: 'Removes both Deployments and the bare Pod.',
        expected: 'namespace "eff-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['kubectl-basics', 'imperative-vs-declarative', 'using-docs-and-time'],
  docs: [
    {
      title: 'kubectl cheat sheet',
      url: 'https://kubernetes.io/docs/reference/kubectl/quick-reference/',
    },
    { title: 'kubectl reference', url: 'https://kubernetes.io/docs/reference/kubectl/' },
  ],
}
