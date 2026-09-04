import type { Topic } from '../../../types'

export const contextsAndNamespaces: Topic = {
  id: 'contexts-and-namespaces',
  title: 'Contexts and namespaces',
  domainId: 'foundations',
  difficulty: 'beginner',
  estimatedMinutes: 15,
  order: 4,
  tags: ['context', 'kubeconfig', 'namespace', 'config use-context', 'current namespace'],
  oneLiner:
    'How kubectl decides which cluster and namespace to talk to, and the two commands that stop you doing correct work in the wrong place.',
  explanation: [
    'A kubeconfig file contains three lists: clusters (where the API server is), users (credentials), and contexts. A **context** ties one cluster to one user and, optionally, a default namespace.',
    'Exactly one context is active at a time - `current-context`. Every kubectl command uses it unless you override with `--context`, `--cluster` or `--user`.',
    'If the active context sets a namespace, that becomes your default and you can drop `-n` entirely. If it does not, kubectl falls back to `default`.',
    'The CKAD exam gives you several clusters in one kubeconfig, and each task tells you which context to use. Switching context is a graded prerequisite: perfect work in the wrong cluster scores zero.',
  ],
  whyItMatters: [
    'It is the cheapest possible mark to lose. The task says "on cluster k8s-c2", you stay on the previous context, and everything you built is invisible to the grader.',
    'Setting the namespace once per task removes `-n` from every subsequent command, which saves both keystrokes and the risk of forgetting it on the one command that matters.',
    'When something "does not exist" but you know you created it, the first two hypotheses are always wrong context and wrong namespace - in that order.',
  ],
  howItWorks: [
    'kubectl resolves configuration in this order: explicit flags (`--context`, `--namespace`) → the `$KUBECONFIG` files → `~/.kube/config`. Later files in `$KUBECONFIG` do not override earlier ones; the first definition of a name wins.',
    '`kubectl config use-context <name>` rewrites `current-context` in the file. `kubectl config set-context --current --namespace=<ns>` rewrites only the namespace of the active context.',
    '`kubectl config view --minify` prints just the active context resolved, which is the fastest way to answer "where am I?".',
    'A namespace set on the context is a client-side default only. Objects whose manifest carries `metadata.namespace` always go where the manifest says, and `-n` on the command line overrides the context default.',
    "If a manifest's `metadata.namespace` conflicts with `-n`, kubectl refuses the apply rather than guessing.",
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'What a kubeconfig context actually points at',
      caption:
        'A context is just a saved triple. Switching context changes all three at once, which is why one wrong switch can send a command to the wrong cluster.',
      root: {
        label: 'kubeconfig',
        detail: 'Usually ~/.kube/config',
        children: [
          {
            label: 'current-context',
            detail: 'The name of the context in use right now',
            tone: 'accent',
          },
          {
            label: 'context: dev',
            detail: 'A named triple',
            children: [
              { label: 'cluster', detail: 'Which API server URL' },
              { label: 'user', detail: 'Which credentials' },
              { label: 'namespace', detail: 'Default when you omit -n' },
            ],
          },
          { label: 'context: prod', detail: 'Another triple, same shape', tone: 'muted' },
        ],
      },
    },
    {
      kind: 'flow',
      title: 'Which namespace does a command hit?',
      caption:
        'Most "the object is missing" moments in the exam are really "I looked in the wrong namespace".',
      nodes: [
        { label: 'You run a kubectl command' },
        {
          label: 'Did you pass -n or --namespace?',
          detail: 'An explicit flag always wins',
          tone: 'accent',
        },
        {
          label: 'Does the manifest set metadata.namespace?',
          detail: 'For apply, the file beats the flag-free default',
          arrowLabel: 'if no flag',
        },
        {
          label: 'Falls back to the context namespace',
          detail: 'kubectl config view --minify shows it',
          arrowLabel: 'if neither',
        },
        {
          label: 'Otherwise: default',
          detail: 'The literal namespace called "default"',
          tone: 'warning',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Context (kubeconfig)',
      apiVersion: 'v1',
      purpose: 'A named (cluster, user, namespace) triple that kubectl can switch between.',
      fields: [
        { path: 'contexts[].name', meaning: 'The name you pass to use-context.', required: true },
        {
          path: 'contexts[].context.cluster',
          meaning: 'Which cluster entry to connect to.',
          required: true,
        },
        {
          path: 'contexts[].context.user',
          meaning: 'Which credentials to present.',
          required: true,
        },
        {
          path: 'contexts[].context.namespace',
          meaning: 'Default namespace for commands run in this context.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'The five-second habit that saves a task',
    story: [
      'An engineer maintains three clusters: `dev-eu`, `staging-eu` and `prod-eu`, all in one kubeconfig. Their shell prompt shows the current context, and every change session starts with two commands: switch context, set namespace.',
      'One afternoon they scale a Deployment to zero to test a failover. Because the prompt read `prod-eu/payments`, they noticed before pressing Enter and switched to `staging-eu` first.',
      'On the exam the same habit applies: task says "use context k8s-c1-a and namespace ckad-ns", so you run the two commands, then never think about it again for that task.',
    ],
    code: [
      {
        title: 'The two-command opening move',
        language: 'bash',
        code: `kubectl config use-context k8s-c1-a
kubectl config set-context --current --namespace=ckad-ns

# Confirm both in one line before you start working
kubectl config view --minify -o jsonpath='{.contexts[0].name}{" / "}{..namespace}{"\\n"}'
# k8s-c1-a / ckad-ns`,
        placeholders: ['k8s-c1-a', 'ckad-ns'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'What a kubeconfig looks like (read-only understanding)',
      language: 'yaml',
      code: `apiVersion: v1
kind: Config
current-context: k8s-c1-a
clusters:
  - name: k8s-c1
    cluster:
      server: https://10.0.0.10:6443
      certificate-authority-data: <base64 CA cert>
users:
  - name: admin-c1
    user:
      client-certificate-data: <base64 cert>
      client-key-data: <base64 key>
contexts:
  - name: k8s-c1-a
    context:
      cluster: k8s-c1
      user: admin-c1
      namespace: ckad-ns # the default namespace for this context`,
      explanation:
        'You will never write this file on CKAD, but you must be able to read it well enough to spot which context points at which cluster and namespace.',
      placeholders: ['<base64 CA cert>', '<base64 cert>', '<base64 key>'],
    },
    {
      title: 'A manifest that pins its own namespace',
      language: 'yaml',
      code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: payments # wins over the context default
data:
  LOG_LEVEL: info`,
      explanation:
        'Pinning the namespace makes a manifest unambiguous but also unreusable across environments. Pin it when a task names a namespace; leave it out for reusable manifests and pass -n instead.',
      placeholders: ['payments'],
    },
  ],
  imperative: [
    {
      command: 'kubectl config get-contexts',
      what: 'Lists every context with its cluster, user and namespace. The `*` marks the active one.',
      expected: 'A table with a CURRENT column containing exactly one asterisk.',
    },
    {
      command: 'kubectl config current-context',
      what: 'Prints just the active context name.',
      expected: 'A single line such as k8s-c1-a.',
    },
    {
      command: 'kubectl config use-context k8s-c2',
      what: 'Switches the active context.',
      expected: 'Switched to context "k8s-c2".',
      placeholders: ['k8s-c2'],
    },
    {
      command: 'kubectl config set-context --current --namespace=payments',
      what: 'Sets the default namespace for the active context so you can stop typing -n.',
      expected: 'Context "k8s-c1-a" modified.',
      placeholders: ['payments'],
    },
    {
      command: 'kubectl config view --minify -o jsonpath=\'{..namespace}{"\\n"}\'',
      what: 'Prints the namespace the active context is using. Empty output means you are on `default`.',
      expected: 'payments',
    },
    {
      command: 'kubectl get pods --context=k8s-c2 -n payments',
      what: 'Runs one command against a different context without switching, useful for a quick comparison.',
      expected: 'Pods from the other cluster.',
      placeholders: ['k8s-c2', 'payments'],
    },
  ],
  declarative: {
    steps: [
      'Treat context and namespace as environment, not as content: never bake a cluster name into a manifest.',
      'Pin `metadata.namespace` only when the task explicitly names the namespace, so the object cannot land anywhere else.',
      "For reusable manifests, leave the namespace out and let `-n` or Kustomize's `namespace:` field decide.",
    ],
    code: [
      {
        title: 'Namespace supplied at apply time',
        language: 'bash',
        code: `# One manifest, three environments
kubectl apply -f app.yaml -n dev
kubectl apply -f app.yaml -n staging

# If app.yaml pinned a different namespace, kubectl refuses rather than guessing:
# error: the namespace from the provided object "payments" does not match
# the namespace "dev". You must pass '--namespace=payments' to perform this operation.`,
      },
    ],
  },
  verification: [
    {
      command: 'kubectl config get-contexts',
      what: 'Confirms which context is active before you begin a task.',
      expected: 'An asterisk next to the context the task named.',
    },
    {
      command: 'kubectl get ns',
      what: 'Confirms the namespace a task refers to actually exists in this cluster.',
      expected: 'The namespace listed with STATUS Active.',
    },
    {
      command: 'kubectl get pods',
      what: 'With a context namespace set, this lists Pods in that namespace with no flags at all.',
      expected: 'Only Pods from the namespace you set.',
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl config view --minify',
      what: 'Shows the cluster URL, user and namespace actually in use. Run this whenever results look impossible.',
      expected: 'A short block; check the server URL matches the cluster the task named.',
    },
    {
      command: 'kubectl get pods -A | grep myapp',
      what: 'Finds an object across every namespace when you suspect it went to the wrong one.',
      expected: 'The namespace in the first column.',
      placeholders: ['myapp'],
    },
    {
      command: 'echo $KUBECONFIG',
      what: 'Reveals a non-default kubeconfig path, a common cause of "my context disappeared".',
      expected: 'Empty (using ~/.kube/config) or a colon-separated list of paths.',
    },
    {
      command: 'kubectl cluster-info',
      what: 'Confirms you can actually reach the API server of the current context.',
      expected: 'The control-plane URL, or a connection-refused error if the context is wrong.',
    },
  ],
  commonMistakes: [
    'Starting a task without switching context. Always run the context command the task gives you, even if you think you are already there.',
    'Setting the namespace with `kubectl config set-context --current --namespace=x` and then still passing a stale `-n` from a copied command.',
    'Assuming `kubectl config set-context` creates a namespace. It does not - create the Namespace object separately if it does not exist.',
    'Copying a manifest that pins `metadata.namespace` and being surprised when `-n` is refused.',
    'Editing `~/.kube/config` by hand under time pressure instead of using `kubectl config` subcommands.',
  ],
  examTips: [
    'Every task on the exam begins with a context line. Make running it a reflex before you read the rest of the task.',
    'Set the namespace once per task; it removes an entire class of mistake for the rest of that task.',
    'If a command returns "No resources found", check namespace before you check your work.',
    '`kubectl config get-contexts` costs two seconds and answers the most expensive question in the exam.',
  ],
  summary: [
    'A context = cluster + user + optional default namespace; exactly one is current.',
    '`kubectl config use-context <name>` switches cluster; `kubectl config set-context --current --namespace=<ns>` switches namespace.',
    'Manifest namespace beats context default; `-n` beats context default; manifest and `-n` conflicting is an error.',
    '"No resources found" usually means wrong namespace, and sometimes wrong cluster.',
  ],
  practice: [
    {
      id: 'ctx-p1',
      level: 'beginner',
      prompt: 'Which single command tells you both the active context and its default namespace?',
      answer: 'kubectl config get-contexts',
      explanation:
        'It prints CURRENT, NAME, CLUSTER, AUTHINFO and NAMESPACE columns. `kubectl config current-context` gives only the name, without the namespace.',
    },
    {
      id: 'ctx-p2',
      level: 'intermediate',
      prompt:
        'You must work in namespace `ckad-8s` for the next ten commands. Write the command that makes that the default, and the command that verifies it.',
      answer:
        'kubectl config set-context --current --namespace=ckad-8s\nkubectl config view --minify -o jsonpath=\'{..namespace}{"\\n"}\'',
      explanation:
        'The second command prints `ckad-8s`. If it prints nothing, the namespace was not set and you are still on `default`.',
    },
    {
      id: 'ctx-p3',
      level: 'advanced',
      prompt:
        'A manifest contains `metadata.namespace: payments`. You run `kubectl apply -f app.yaml -n dev`. What happens, and what are your two options?',
      answer:
        'kubectl refuses with an error saying the object namespace does not match the requested namespace. Either drop `metadata.namespace` from the file and keep `-n dev`, or drop `-n` and let the file place the object in `payments`.',
      explanation:
        'This is deliberate: silently overriding one or the other would make it impossible to reason about where objects go. For reusable manifests, leaving the namespace out of the file is the better habit.',
    },
  ],
  lab: {
    title: 'Never work in the wrong place again',
    scenario:
      'You will inspect your kubeconfig, create a namespace, make it your default, prove commands honour it, and then deliberately trigger the namespace-conflict error so you recognise it instantly.',
    prerequisites: ['A cluster and a writable kubeconfig'],
    tasks: [
      { instruction: 'List all contexts and note which is current.' },
      { instruction: 'Create a namespace `ctx-lab`.' },
      { instruction: 'Make `ctx-lab` the default namespace of your current context.' },
      {
        instruction:
          'Create a Pod `probe` with image `busybox:1.36` running `sleep 3600`, passing no `-n` flag, and prove it landed in `ctx-lab`.',
      },
      {
        instruction:
          'Write a manifest that pins `metadata.namespace: ctx-lab` and try to apply it with `-n default` to see the error.',
      },
      { instruction: 'Reset your default namespace to `default` and delete `ctx-lab`.' },
    ],
    solution: [
      {
        title: 'Steps 1-3',
        language: 'bash',
        code: `kubectl config get-contexts
kubectl config current-context

kubectl create namespace ctx-lab
kubectl config set-context --current --namespace=ctx-lab
# Context "..." modified.

kubectl config view --minify -o jsonpath='{..namespace}{"\\n"}'
# ctx-lab`,
      },
      {
        title: 'Step 4 - no -n needed',
        language: 'bash',
        code: `kubectl run probe --image=busybox:1.36 --command -- sleep 3600
kubectl get pod probe -o jsonpath='{.metadata.namespace}{"\\n"}'
# ctx-lab

# And it is genuinely not in default:
kubectl get pod probe -n default
# Error from server (NotFound): pods "probe" not found`,
      },
      {
        title: 'Step 5 - the conflict error',
        language: 'yaml',
        code: `# pinned.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pinned
  namespace: ctx-lab
data:
  KEY: value`,
      },
      {
        title: 'Step 5b - trigger it',
        language: 'bash',
        code: `kubectl apply -f pinned.yaml -n default
# error: the namespace from the provided object "ctx-lab" does not match the
# namespace "default". You must pass '--namespace=ctx-lab' to perform this operation.

# Works, because the file and the flag agree:
kubectl apply -f pinned.yaml -n ctx-lab
# configmap/pinned created`,
      },
      {
        title: 'Step 6 - reset and clean up',
        language: 'bash',
        code: `kubectl config set-context --current --namespace=default
kubectl delete namespace ctx-lab
kubectl config view --minify -o jsonpath='{..namespace}{"\\n"}'
# default`,
      },
    ],
    verification: [
      {
        command: 'kubectl config view --minify -o jsonpath=\'{..namespace}{"\\n"}\'',
        what: 'Confirms the context default namespace at any point in the lab.',
        expected: 'ctx-lab during the lab, default after cleanup.',
      },
      {
        command: 'kubectl get pod probe -n ctx-lab',
        what: 'Confirms the Pod was created in the namespace set on the context, without an -n flag at creation time.',
        expected: 'probe 1/1 Running',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace ctx-lab',
        what: 'Removes the lab namespace and its objects.',
        expected: 'namespace "ctx-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['kubectl-basics', 'core-objects', 'efficient-kubectl'],
  docs: [
    {
      title: 'Configure access to multiple clusters',
      url: 'https://kubernetes.io/docs/tasks/access-application-cluster/configure-access-multiple-clusters/',
    },
  ],
}
