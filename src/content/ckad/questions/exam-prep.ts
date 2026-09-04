import type { Question } from '../../types'

export const examPrepQuestions: Question[] = [
  {
    id: 'exm-q01',
    domainId: 'exam-prep',
    topicId: 'efficient-kubectl',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the shell line that lets you append a shortcut variable to any generator command to produce YAML instead of creating an object.',
    acceptedAnswers: [
      'export do="--dry-run=client -o yaml"',
      "export do='--dry-run=client -o yaml'",
      'export do=--dry-run=client -o yaml',
    ],
    answerHint: 'export do=...',
    explanation:
      'With this set, `kubectl create deploy api --image=nginx $do > api.yaml` generates a correct skeleton. Pair it with `alias k=kubectl` and `complete -o default -F __start_kubectl k` in the first minute of the exam.',
  },
  {
    id: 'exm-q02',
    domainId: 'exam-prep',
    topicId: 'efficient-kubectl',
    category: 'concept',
    kind: 'multi',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which of these have NO imperative generator flag and must be written into YAML by hand? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Readiness and liveness probes' },
      { id: 'b', text: 'Volumes and volumeMounts' },
      { id: 'c', text: 'Replica count on a Deployment' },
      { id: 'd', text: 'NetworkPolicy' },
      { id: 'e', text: 'Container image' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'Replicas (`--replicas`) and images (`--image`, `kubectl set image`) have flags. Probes, volumes, securityContext, multi-container specs and NetworkPolicy do not - generate the skeleton and edit those in. NetworkPolicy has no generator at all.',
  },
  {
    id: 'exm-q03',
    domainId: 'exam-prep',
    topicId: 'efficient-kubectl',
    category: 'command',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A task requires changing an immutable field on Deployment api in namespace shop, and you have the corrected manifest in api.yaml. Write the command that applies it.',
    acceptedAnswers: [
      'kubectl replace --force -f api.yaml',
      'kubectl replace -f api.yaml --force',
      'kubectl replace --force -f api.yaml -n shop',
      'kubectl -n shop replace --force -f api.yaml',
    ],
    answerHint: 'kubectl replace ...',
    explanation:
      '`replace --force` deletes and recreates the object in one command, which is the accepted way to change an immutable field such as a Deployment selector or a Job template. Accept that Pods restart. Back up first with `kubectl get <kind> <name> -o yaml > backup.yaml`.',
  },
  {
    id: 'exm-q04',
    domainId: 'exam-prep',
    topicId: 'using-docs-and-time',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'You cannot recall whether a field is `readinessProbe.httpGet.path` or `readinessProbe.http.path`. What is the fastest reliable check?',
    options: [
      { id: 'a', text: 'Search the Kubernetes documentation' },
      { id: 'b', text: 'kubectl explain pod.spec.containers.readinessProbe --recursive' },
      { id: 'c', text: 'Try both and see which applies' },
      { id: 'd', text: 'kubectl api-resources | grep probe' },
    ],
    correct: ['b'],
    explanation:
      "`kubectl explain` reads the running cluster's OpenAPI schema, so it is both faster than a browser and guaranteed correct for the exam's Kubernetes version. Use the docs when you need a whole object shape you cannot recall, not for a single field name.",
  },
  {
    id: 'exm-q05',
    domainId: 'exam-prep',
    topicId: 'using-docs-and-time',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Twenty minutes remain and three tasks are unfinished, worth 4%, 8% and 2%. What is the best use of the time?',
    options: [
      { id: 'a', text: 'The 2% task first, since it is quickest, then the others' },
      {
        id: 'b',
        text: 'The 8% task first with a hard cap, then the 4%, leaving partial work everywhere',
      },
      { id: 'c', text: 'Split the time evenly across all three' },
      { id: 'd', text: 'Spend the whole time perfecting the 8% task' },
    ],
    correct: ['b'],
    explanation:
      'The 8% task is worth as much as the other two combined, so it goes first - with a cap, because partial credit means an incomplete attempt still scores. Spending all twenty minutes on one task risks scoring 8% instead of a possible 10-12%.',
  },
  {
    id: 'exm-q06',
    domainId: 'exam-prep',
    topicId: 'exam-traps-and-checklist',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt: 'What are the two commands you should run at the start of every single exam task?',
    options: [
      { id: 'a', text: 'kubectl get nodes and kubectl get pods -A' },
      {
        id: 'b',
        text: 'kubectl config use-context <ctx> and kubectl config set-context --current --namespace=<ns>',
      },
      { id: 'c', text: 'kubectl cluster-info and kubectl version' },
      { id: 'd', text: 'kubectl api-resources and kubectl api-versions' },
    ],
    correct: ['b'],
    explanation:
      'Wrong cluster and wrong namespace are the two most expensive mistakes available, and both are stated in the task text. Setting the namespace on the context also means you can stop typing `-n` for the rest of that task.',
  },
  {
    id: 'exm-q07',
    domainId: 'exam-prep',
    topicId: 'exam-traps-and-checklist',
    category: 'troubleshoot',
    kind: 'command',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A graded object "does not exist" although you created it. Write the command that most quickly finds where it actually is.',
    acceptedAnswers: [
      'kubectl get all -A | grep api',
      'kubectl get pods -A | grep api',
      'kubectl get all --all-namespaces | grep api',
      'kubectl get pods --all-namespaces | grep api',
    ],
    answerHint: 'kubectl get ... -A | grep ...',
    explanation:
      'Nine times out of ten it is in the wrong namespace. The first column of the output is the namespace. `kubectl get all -A` misses ConfigMaps, Secrets and Ingresses, so name the specific kind if the object is one of those.',
  },
  {
    id: 'exm-q08',
    domainId: 'exam-prep',
    topicId: 'exam-traps-and-checklist',
    category: 'concept',
    kind: 'multi',
    difficulty: 'advanced',
    points: 3,
    prompt: 'Which verification commands correctly match their domain? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Deployment: kubectl rollout status deploy/<name>' },
      { id: 'b', text: 'Service: kubectl get endpoints <name>' },
      {
        id: 'c',
        text: 'RBAC: kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa>',
      },
      { id: 'd', text: 'ConfigMap injection: kubectl get configmap <name> -o yaml' },
    ],
    correct: ['a', 'b', 'c'],
    explanation:
      'Option D verifies that the ConfigMap exists, not that the Pod received its values - which is what a task actually asks for. The correct check is `kubectl exec <pod> -- printenv <VAR>` or `kubectl exec <pod> -- cat <mount>/<file>`.',
  },
]
