import type { Question } from '../../types'

export const foundationsQuestions: Question[] = [
  {
    id: 'fnd-q01',
    domainId: 'foundations',
    topicId: 'kubernetes-architecture',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'A Pod has been in Pending status for five minutes. Which component has not completed its work?',
    options: [
      { id: 'a', text: 'The kubelet on the target node' },
      { id: 'b', text: 'The kube-scheduler' },
      { id: 'c', text: 'The container runtime' },
      { id: 'd', text: 'CoreDNS' },
    ],
    correct: ['b'],
    explanation:
      "Pending means the Pod has been accepted by the API server but not yet bound to a node, which is the scheduler's job. Common causes are insufficient CPU/memory for the requests, an unsatisfiable nodeSelector or affinity rule, taints without tolerations, or an unbound PersistentVolumeClaim. The kubelet and runtime only act after binding.",
  },
  {
    id: 'fnd-q02',
    domainId: 'foundations',
    topicId: 'kubectl-basics',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that generates a Pod manifest for image nginx:1.27-alpine named web, printing YAML to stdout without creating anything in the cluster.',
    acceptedAnswers: [
      'kubectl run web --image=nginx:1.27-alpine --dry-run=client -o yaml',
      'kubectl run web --image nginx:1.27-alpine --dry-run=client -o yaml',
      'kubectl run web --dry-run=client -o yaml --image=nginx:1.27-alpine',
    ],
    answerHint: 'kubectl run ...',
    explanation:
      '`kubectl run` is the Pod generator. `--dry-run=client` keeps the request local, and `-o yaml` prints the rendered manifest. Without `-o yaml` you only get a confirmation line. Note that bare `--dry-run` is deprecated - the value is required.',
  },
  {
    id: 'fnd-q03',
    domainId: 'foundations',
    topicId: 'contexts-and-namespaces',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that makes namespace ckad-ns the default for the current context, so you no longer need -n.',
    acceptedAnswers: [
      'kubectl config set-context --current --namespace=ckad-ns',
      'kubectl config set-context --current --namespace ckad-ns',
    ],
    explanation:
      "This rewrites only the namespace of the active context. Verify with `kubectl config view --minify -o jsonpath='{..namespace}'`. It does not create the namespace - use `kubectl create namespace` for that.",
  },
  {
    id: 'fnd-q04',
    domainId: 'foundations',
    topicId: 'core-objects',
    category: 'concept',
    kind: 'multi',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Which of these resources are cluster-scoped, so that passing -n has no effect? (Select all that apply.)',
    options: [
      { id: 'a', text: 'Nodes' },
      { id: 'b', text: 'PersistentVolumes' },
      { id: 'c', text: 'PersistentVolumeClaims' },
      { id: 'd', text: 'ClusterRoles' },
      { id: 'e', text: 'ConfigMaps' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'Nodes, PersistentVolumes, StorageClasses, ClusterRoles, ClusterRoleBindings, IngressClasses, CustomResourceDefinitions and Namespaces themselves are cluster-scoped. PersistentVolumeClaims and ConfigMaps are namespaced. Confirm with `kubectl api-resources --namespaced=false`.',
  },
  {
    id: 'fnd-q05',
    domainId: 'foundations',
    topicId: 'yaml-and-api-discovery',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt: 'This ConfigMap is rejected by the API server. What is wrong?',
    code: {
      title: 'cm.yaml',
      language: 'yaml',
      code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: retry-config
data:
  MAX_RETRIES: 3
  ENABLED: true`,
    },
    options: [
      { id: 'a', text: 'ConfigMaps require a namespace field' },
      { id: 'b', text: 'The values must be strings, so they need quoting' },
      { id: 'c', text: '`data` should be `binaryData`' },
      { id: 'd', text: 'The apiVersion should be v1beta1' },
    ],
    correct: ['b'],
    explanation:
      'ConfigMap `data` is typed `map[string]string`. YAML parses `3` as an integer and `true` as a boolean, so the API server rejects both with "got \\"integer\\", expected \\"string\\"". Write `MAX_RETRIES: "3"` and `ENABLED: "true"`. Using `kubectl create configmap --from-literal=` avoids the problem entirely.',
  },
  {
    id: 'fnd-q06',
    domainId: 'foundations',
    topicId: 'labels-selectors-annotations',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A Service was created successfully but `kubectl get endpoints payments` shows `<none>`. Which command best identifies the cause?',
    options: [
      { id: 'a', text: 'kubectl logs -l app=payments' },
      {
        id: 'b',
        text: "kubectl get svc payments -o jsonpath='{.spec.selector}' and kubectl get pods --show-labels",
      },
      { id: 'c', text: 'kubectl describe node' },
      { id: 'd', text: 'kubectl get events --field-selector reason=Scheduled' },
    ],
    correct: ['b'],
    explanation:
      'An empty endpoints list means the Service selector matched no Ready Pods. Comparing the selector with the actual Pod labels finds a typo immediately; if they match, the next check is whether the Pods are Ready, since unready Pods are excluded from endpoints.',
  },
  {
    id: 'fnd-q07',
    domainId: 'foundations',
    topicId: 'imperative-vs-declarative',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You regenerate a bare Deployment skeleton over an existing api.yaml that previously contained a readiness probe, then run `kubectl apply -f api.yaml`. What happens to the probe?',
    options: [
      { id: 'a', text: 'It is preserved, because apply only adds fields' },
      { id: 'b', text: 'It is removed, because apply performs a three-way merge' },
      { id: 'c', text: 'The apply is rejected as invalid' },
      { id: 'd', text: 'It is preserved until the next rollout' },
    ],
    correct: ['b'],
    explanation:
      '`kubectl apply` compares your file, the live object and the `last-applied-configuration` annotation. A field that was previously applied and is now absent is treated as a deliberate removal. `kubectl diff -f api.yaml` shows this in advance as a `-` line, and `kubectl rollout undo` recovers from it.',
  },
  {
    id: 'fnd-q08',
    domainId: 'foundations',
    topicId: 'kubectl-basics',
    category: 'command',
    kind: 'command',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'Write a command that prints, for every Pod in namespace shop, the Pod name and the node it is scheduled on, as a two-column table.',
    acceptedAnswers: [
      "kubectl get pods -n shop -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName'",
      'kubectl get pods -n shop -o custom-columns=POD:.metadata.name,NODE:.spec.nodeName',
      "kubectl get pods -n shop -o custom-columns='NAME:.metadata.name,NODE:.spec.nodeName'",
      'kubectl get pods -n shop -o custom-columns=NAME:.metadata.name,NODE:.spec.nodeName',
    ],
    answerHint: 'kubectl get pods -n shop -o custom-columns=...',
    explanation:
      '`-o custom-columns` builds exactly the table a task asks for. Unscheduled Pods show `<none>` in the NODE column, which makes Pending Pods obvious. `-o wide` also shows the node but adds columns you did not ask for.',
  },
]
