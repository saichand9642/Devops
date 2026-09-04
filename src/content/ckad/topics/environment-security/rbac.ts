import type { Topic } from '../../../types'

export const rbac: Topic = {
  id: 'rbac',
  title: 'RBAC: Roles, ClusterRoles and bindings',
  domainId: 'environment-security',
  difficulty: 'intermediate',
  estimatedMinutes: 26,
  order: 8,
  tags: [
    'rbac',
    'role',
    'clusterrole',
    'rolebinding',
    'clusterrolebinding',
    'can-i',
    'verbs',
    'apiGroups',
  ],
  oneLiner:
    'Four objects, one decision table: which of Role/ClusterRole and RoleBinding/ClusterRoleBinding you need, and how to verify it without guessing.',
  explanation: [
    "RBAC has exactly four object types, and the whole subject is a two-by-two grid. A **Role** grants permissions inside one namespace. A **ClusterRole** grants permissions cluster-wide *or* on cluster-scoped resources. A **RoleBinding** grants a role's permissions to subjects in one namespace. A **ClusterRoleBinding** grants them across the whole cluster.",
    'The combination that surprises people: a **RoleBinding can reference a ClusterRole**. That means "use this reusable permission set, but only in my namespace" - and it is the most common real-world pattern, because it lets you define `pod-reader` once and bind it per namespace.',
    'The combination that is invalid: a ClusterRoleBinding cannot reference a Role. Namespaced permissions cannot be granted cluster-wide.',
    'A rule has three parts: `apiGroups` (`""` for the core group, `apps`, `batch`, `networking.k8s.io`, ...), `resources` (plural, lowercase: `pods`, `deployments`, `pods/log`), and `verbs` (`get`, `list`, `watch`, `create`, `update`, `patch`, `delete`, `deletecollection`). All three must match for a request to be allowed.',
    'RBAC is purely additive: there are no deny rules. A subject can do something if *any* binding allows it, so removing a permission means removing or narrowing the binding that grants it.',
  ],
  whyItMatters: [
    'RBAC pairs with ServiceAccounts in almost every exam task involving workload identity: create a ServiceAccount, create a Role, bind them, verify.',
    '`kubectl auth can-i` turns RBAC from guesswork into a testable assertion, and it is the fastest way to confirm a task is complete.',
    'The Role-versus-ClusterRole choice is the one people get wrong. Nodes, PersistentVolumes and namespaces themselves are cluster-scoped, so no Role can ever grant access to them.',
  ],
  howItWorks: [
    "Authorisation happens after authentication. The API server asks each authoriser in turn; RBAC checks whether any rule bound to the requesting identity matches the request's (apiGroup, resource, verb, and for namespaced resources the namespace).",
    'Subjects are `User`, `Group` or `ServiceAccount`. A ServiceAccount subject needs `kind: ServiceAccount`, `name`, and `namespace`; the identity string it matches is `system:serviceaccount:<ns>:<name>`.',
    '`apiGroups: [""]` is the core group and covers pods, services, configmaps, secrets, serviceaccounts, persistentvolumeclaims, events, namespaces and nodes. `apps` covers deployments, replicasets, statefulsets and daemonsets. `batch` covers jobs and cronjobs.',
    'Subresources are named with a slash: `pods/log`, `pods/exec`, `pods/portforward`, `deployments/scale`. Granting `get` on `pods` does *not* grant `kubectl logs` - that needs `pods/log`.',
    '`resourceNames` restricts a rule to specific object names, but only for verbs that address a single object (`get`, `update`, `patch`, `delete`). It cannot restrict `list` or `create`, because those do not name an object in the request path.',
    'Built-in ClusterRoles worth knowing: `view` (read-only, excludes Secrets), `edit` (read/write, excludes RBAC), `admin` (edit plus RBAC within a namespace), `cluster-admin` (everything). Binding `cluster-admin` is the answer to almost nothing.',
    "`kubectl auth can-i <verb> <resource>` tests your own permissions; adding `--as=<user>` or `--as=system:serviceaccount:<ns>:<sa>` tests someone else's (impersonation, which itself requires permission).",
  ],
  keyObjects: [
    {
      kind: 'Role',
      apiVersion: 'rbac.authorization.k8s.io/v1',
      purpose: 'Namespaced permission set.',
      fields: [
        {
          path: 'rules[].apiGroups[]',
          meaning: '"" for core, or apps / batch / networking.k8s.io / rbac.authorization.k8s.io.',
          required: true,
        },
        {
          path: 'rules[].resources[]',
          meaning: 'Plural lowercase names, plus subresources like pods/log.',
          required: true,
        },
        {
          path: 'rules[].verbs[]',
          meaning: 'get, list, watch, create, update, patch, delete, deletecollection.',
          required: true,
        },
        {
          path: 'rules[].resourceNames[]',
          meaning: 'Restrict to named objects; only affects single-object verbs.',
        },
      ],
    },
    {
      kind: 'ClusterRole',
      apiVersion: 'rbac.authorization.k8s.io/v1',
      purpose: 'Cluster-wide permission set, or a reusable set to bind per namespace.',
      fields: [
        { path: 'rules[]', meaning: 'Same shape as a Role.' },
        {
          path: 'aggregationRule.clusterRoleSelectors[]',
          meaning:
            'Aggregates rules from other ClusterRoles by label - how `view` and `edit` are extended.',
        },
      ],
    },
    {
      kind: 'RoleBinding',
      apiVersion: 'rbac.authorization.k8s.io/v1',
      purpose: 'Grants a Role or ClusterRole to subjects, scoped to one namespace.',
      fields: [
        {
          path: 'roleRef.kind',
          meaning: 'Role or ClusterRole. Immutable after creation.',
          required: true,
        },
        { path: 'roleRef.name', meaning: 'Name of the role being granted.', required: true },
        { path: 'subjects[].kind', meaning: 'User, Group or ServiceAccount.', required: true },
        { path: 'subjects[].name', meaning: 'The subject name.', required: true },
        { path: 'subjects[].namespace', meaning: 'Required for ServiceAccount subjects.' },
      ],
    },
    {
      kind: 'ClusterRoleBinding',
      apiVersion: 'rbac.authorization.k8s.io/v1',
      purpose: 'Grants a ClusterRole cluster-wide. Cannot reference a Role.',
      fields: [
        { path: 'roleRef.kind', meaning: 'Must be ClusterRole.', required: true },
        { path: 'subjects[]', meaning: 'Same shape as a RoleBinding.', required: true },
      ],
    },
  ],
  realWorldExample: {
    title: 'A dashboard that needed pod logs and got a 403',
    story: [
      'An internal dashboard lists Pods and shows their logs. Its ServiceAccount was bound to a Role granting `get`, `list` and `watch` on `pods`. Listing worked; clicking a Pod to see its log returned 403.',
      '`kubectl logs` is not a Pod read - it is a read of the `pods/log` **subresource**. Granting `get` on `pods` does not grant it.',
      'Adding a second rule with `resources: ["pods/log"]` and `verbs: ["get"]` fixed it immediately. `kubectl auth can-i get pods/log --as=system:serviceaccount:tools:dashboard -n shop` returned `yes`, which was the confirmation before redeploying.',
      'A month later the dashboard needed to restart Deployments. The temptation was to bind `edit`. Instead they added `patch` on `deployments` - the minimum that makes `kubectl rollout restart` work - and left everything else alone.',
      'The generalisable lesson: `exec`, `logs` and `port-forward` are all subresources (`pods/exec`, `pods/log`, `pods/portforward`) and each needs its own rule. This is the most common RBAC surprise.',
    ],
    code: [
      {
        title: 'Diagnose with can-i, fix with one rule',
        language: 'bash',
        code: `SA=system:serviceaccount:tools:dashboard

kubectl auth can-i list pods --as=$SA -n shop
# yes
kubectl auth can-i get pods/log --as=$SA -n shop
# no        <- the actual problem

kubectl create role pod-log-reader -n shop \\
  --verb=get --resource=pods/log

kubectl create rolebinding dashboard-logs -n shop \\
  --role=pod-log-reader --serviceaccount=tools:dashboard

kubectl auth can-i get pods/log --as=$SA -n shop
# yes`,
        explanation:
          '`kubectl auth can-i` accepts subresources directly, which makes it the fastest way to test this class of problem.',
        placeholders: ['tools', 'dashboard', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'The decision table, as YAML',
      language: 'yaml',
      code: `# 1. Role + RoleBinding: namespaced permissions on namespaced resources.
#    The most common case.
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: pod-reader
  namespace: shop
rules:
  - apiGroups: [""] # "" is the core group
    resources: ["pods", "pods/log"] # note the subresource
    verbs: ["get", "list", "watch"]
  - apiGroups: ["apps"]
    resources: ["deployments"]
    verbs: ["get", "list", "watch", "patch"] # patch enables rollout restart
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-sa-pod-reader
  namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: Role
  name: pod-reader
subjects:
  - kind: ServiceAccount
    name: api-sa
    namespace: shop # required for ServiceAccount subjects
---
# 2. ClusterRole + RoleBinding: a REUSABLE permission set, applied to ONE
#    namespace. Define once, bind many times.
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: configmap-reader # no namespace: ClusterRoles are cluster-scoped
rules:
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: api-sa-configmaps
  namespace: shop # the binding scopes it to shop only
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole # referencing a ClusterRole from a RoleBinding
  name: configmap-reader
subjects:
  - kind: ServiceAccount
    name: api-sa
    namespace: shop
---
# 3. ClusterRole + ClusterRoleBinding: cluster-scoped resources, or
#    permissions that must apply in every namespace.
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: node-reader
rules:
  - apiGroups: [""]
    resources: ["nodes"] # cluster-scoped: a Role could NEVER grant this
    verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: monitoring-node-reader
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole # must be ClusterRole - a Role here is invalid
  name: node-reader
subjects:
  - kind: ServiceAccount
    name: monitoring-sa
    namespace: monitoring`,
      explanation:
        'The three valid combinations, in order of how often you need them. The fourth combination - ClusterRoleBinding referencing a Role - does not exist.',
      placeholders: ['shop', 'api-sa', 'monitoring', 'monitoring-sa'],
    },
    {
      title: 'resourceNames, and its limitation',
      language: 'yaml',
      code: `apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: specific-configmap-editor
  namespace: shop
rules:
  # Restricted to two named ConfigMaps
  - apiGroups: [""]
    resources: ["configmaps"]
    resourceNames: ["app-config", "feature-flags"]
    verbs: ["get", "update", "patch"] # single-object verbs only
  # resourceNames CANNOT restrict list or create, because those requests
  # do not name an object. To allow listing at all you need a separate,
  # unrestricted rule - and it will list every ConfigMap.
  - apiGroups: [""]
    resources: ["configmaps"]
    verbs: ["list"]`,
      explanation:
        'This is a genuine limitation, not an oversight: the authorisation decision happens before the request reaches the store, and a `list` request has no object name to match against.',
      placeholders: ['shop'],
    },
    {
      title: 'The built-in ClusterRoles, and when each is right',
      language: 'yaml',
      code: `# view  - read-only across most resources, EXCLUDES Secrets
# edit  - read/write on most resources, EXCLUDES RBAC objects
# admin - edit plus RBAC management, WITHIN one namespace
# cluster-admin - everything, everywhere

# Give a team read-only access to their own namespace:
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: devs-view
  namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: view # built in; do not redefine it
subjects:
  - kind: Group
    name: developers
    apiGroup: rbac.authorization.k8s.io
---
# Give a team full control of their own namespace, but nothing outside it:
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: devs-admin
  namespace: shop
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: admin
subjects:
  - kind: Group
    name: shop-owners
    apiGroup: rbac.authorization.k8s.io`,
      explanation:
        '`admin` bound with a RoleBinding is the right answer to "give this team ownership of their namespace". `cluster-admin` with a ClusterRoleBinding is almost never the right answer to anything.',
      placeholders: ['shop', 'developers', 'shop-owners'],
    },
  ],
  imperative: [
    {
      command: 'kubectl create role pod-reader -n shop --verb=get,list,watch --resource=pods',
      what: 'Creates a namespaced Role.',
      expected: 'role.rbac.authorization.k8s.io/pod-reader created',
      placeholders: ['pod-reader', 'shop'],
    },
    {
      command: 'kubectl create role pod-reader -n shop --verb=get --resource=pods/log',
      what: 'Subresources work in the imperative form too - this is what `kubectl logs` needs.',
      expected: 'A Role granting get on pods/log.',
      placeholders: ['pod-reader', 'shop'],
    },
    {
      command:
        'kubectl create role deploy-manager -n shop --verb=get,list,watch,create,update,patch,delete --resource=deployments.apps',
      what: 'Use `<resource>.<group>` to disambiguate; `deployments.apps` targets the apps group.',
      expected: 'A Role with the apps API group.',
      placeholders: ['deploy-manager', 'shop'],
    },
    {
      command:
        'kubectl create role cm-editor -n shop --verb=get,update,patch --resource=configmaps --resource-name=app-config',
      what: 'Restricts a Role to a named object with `--resource-name`.',
      expected: 'A Role with resourceNames set.',
      placeholders: ['cm-editor', 'shop'],
    },
    {
      command:
        'kubectl create rolebinding api-sa-pod-reader -n shop --role=pod-reader --serviceaccount=shop:api-sa',
      what: 'Binds a Role to a ServiceAccount. Note the `<namespace>:<name>` syntax.',
      expected: 'rolebinding.rbac.authorization.k8s.io/api-sa-pod-reader created',
      placeholders: ['api-sa-pod-reader', 'pod-reader', 'shop', 'api-sa'],
    },
    {
      command: 'kubectl create rolebinding devs-view -n shop --clusterrole=view --group=developers',
      what: 'A RoleBinding referencing a ClusterRole - the reusable-permissions pattern.',
      expected: 'A RoleBinding whose roleRef kind is ClusterRole.',
      placeholders: ['devs-view', 'shop', 'developers'],
    },
    {
      command: 'kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes',
      what: 'Cluster-scoped resources require a ClusterRole.',
      expected: 'clusterrole.rbac.authorization.k8s.io/node-reader created',
      placeholders: ['node-reader'],
    },
    {
      command:
        'kubectl create clusterrolebinding monitoring-nodes --clusterrole=node-reader --serviceaccount=monitoring:monitoring-sa',
      what: 'Grants a ClusterRole cluster-wide.',
      expected: 'clusterrolebinding.rbac.authorization.k8s.io/monitoring-nodes created',
      placeholders: ['monitoring-nodes', 'node-reader', 'monitoring', 'monitoring-sa'],
    },
    {
      command: 'kubectl auth can-i list pods -n shop',
      what: 'Tests your own permissions.',
      expected: 'yes or no.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl auth can-i get pods/log --as=system:serviceaccount:shop:api-sa -n shop',
      what: "Tests another identity's permissions, including subresources. The key verification command.",
      expected: 'yes',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command: 'kubectl auth can-i --list --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'The complete permission set of an identity in a namespace.',
      expected: 'A table of resources, non-resource URLs and verbs.',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command: 'kubectl describe role pod-reader -n shop',
      what: 'Human-readable rule listing.',
      expected: 'PolicyRule table with Resources, Non-Resource URLs, Resource Names and Verbs.',
      placeholders: ['pod-reader', 'shop'],
    },
    {
      command: 'kubectl get rolebindings,clusterrolebindings -A -o wide | grep api-sa',
      what: 'Finds every binding that grants something to a subject - the audit query.',
      expected: 'Bindings naming that ServiceAccount.',
      placeholders: ['api-sa'],
    },
    {
      command: 'kubectl api-resources --namespaced=false -o name | head -20',
      what: 'Lists cluster-scoped resources - the ones only a ClusterRole can grant.',
      expected: 'nodes, namespaces, persistentvolumes, clusterroles, ...',
    },
  ],
  declarative: {
    steps: [
      'Decide scope first: is the resource namespaced or cluster-scoped, and should the permission apply in one namespace or everywhere?',
      'Namespaced resource, one namespace → Role + RoleBinding. Reusable set, one namespace → ClusterRole + RoleBinding. Cluster-scoped or everywhere → ClusterRole + ClusterRoleBinding.',
      'Write the minimum verbs. Start with `get,list,watch` and add only what the workload demonstrably needs.',
      'Remember subresources: `pods/log` for logs, `pods/exec` for exec, `pods/portforward` for port-forward, `deployments/scale` for scaling.',
      'Verify with `kubectl auth can-i --as=...` for both an allowed and a forbidden action, before you deploy anything.',
    ],
    code: [
      {
        title: 'The four-command pattern for a workload identity',
        language: 'bash',
        code: `NS=shop; SA=api-sa

kubectl create serviceaccount $SA -n $NS

kubectl create role $SA-role -n $NS \\
  --verb=get,list,watch --resource=pods,pods/log,configmaps

kubectl create rolebinding $SA-binding -n $NS \\
  --role=$SA-role --serviceaccount=$NS:$SA

# Verify BOTH directions - what is allowed and what is not
kubectl auth can-i get pods/log --as=system:serviceaccount:$NS:$SA -n $NS   # yes
kubectl auth can-i delete pods  --as=system:serviceaccount:$NS:$SA -n $NS   # no
kubectl auth can-i list nodes   --as=system:serviceaccount:$NS:$SA          # no

kubectl set serviceaccount deploy/api $SA -n $NS`,
        placeholders: ['shop', 'api-sa', 'api'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl auth can-i --list --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'The definitive statement of what an identity can do in a namespace.',
      expected: 'A table listing exactly the resources and verbs you granted.',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command: 'kubectl describe rolebinding api-sa-pod-reader -n shop',
      what: 'Confirms the roleRef and the subject list.',
      expected: 'Role: Role/pod-reader and a ServiceAccount subject with its namespace.',
      placeholders: ['api-sa-pod-reader', 'shop'],
    },
    {
      command: 'kubectl get role pod-reader -n shop -o yaml',
      what: 'The rules as stored, including apiGroups and subresources.',
      expected: 'The rules block you intended.',
      placeholders: ['pod-reader', 'shop'],
    },
    {
      command:
        'kubectl auth can-i list pods --as=system:serviceaccount:shop:api-sa -n other-namespace',
      what: 'Confirms a RoleBinding really is namespace-scoped by testing a different namespace.',
      expected: 'no',
      placeholders: ['shop', 'api-sa', 'other-namespace'],
    },
  ],
  troubleshooting: [
    {
      command:
        'kubectl auth can-i <verb> <resource> --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'Start here for every 403. It answers the question directly.',
      expected: 'no, which confirms RBAC is the cause.',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command:
        'kubectl get rolebindings,clusterrolebindings -A -o json | grep -B10 "api-sa" | grep -E "name|kind" | head',
      what: 'Finds which bindings mention a subject, when permissions appear from nowhere or are missing.',
      expected: 'The bindings involved.',
      placeholders: ['api-sa'],
    },
    {
      command: 'kubectl describe clusterrole view | head -20',
      what: 'Shows what a built-in role actually grants - `view` notably excludes Secrets.',
      expected: 'A long PolicyRule table.',
    },
    {
      command: 'kubectl auth can-i get pods/log --as=system:serviceaccount:shop:api-sa -n shop',
      what: 'The subresource check. `kubectl logs` failing while `kubectl get pods` works is always this.',
      expected: 'no until a pods/log rule exists.',
      placeholders: ['shop', 'api-sa'],
    },
    {
      command:
        'kubectl get rolebinding api-sa-pod-reader -n shop -o jsonpath=\'{.subjects}{"\\n"}\'',
      what: 'A ServiceAccount subject missing its `namespace` field silently matches nothing.',
      expected: '[{"kind":"ServiceAccount","name":"api-sa","namespace":"shop"}]',
      placeholders: ['api-sa-pod-reader', 'shop'],
    },
    {
      command: 'kubectl apply -f binding.yaml',
      what: '`roleRef` is immutable, so changing it requires deleting and recreating the binding.',
      expected: 'cannot change roleRef',
      placeholders: ['binding.yaml'],
    },
  ],
  commonMistakes: [
    'Using a Role for a cluster-scoped resource such as nodes or persistentvolumes. Only a ClusterRole can grant those.',
    'Trying to reference a Role from a ClusterRoleBinding. Invalid - a ClusterRoleBinding must reference a ClusterRole.',
    'Granting `get` on `pods` and expecting `kubectl logs` to work. Logs need `pods/log`; exec needs `pods/exec`.',
    'Omitting `namespace` on a ServiceAccount subject, so the binding matches nothing and there is no error to tell you.',
    'Forgetting `apiGroups: ["apps"]` for Deployments; `apiGroups: [""]` does not include them.',
    'Using singular resource names. They must be plural and lowercase: `pods`, not `Pod`.',
    'Expecting `resourceNames` to restrict `list` or `create`. It cannot.',
    'Trying to edit `roleRef` on an existing binding. It is immutable; delete and recreate.',
    'Reaching for `cluster-admin` because a narrower role is more work. Bind `admin` with a RoleBinding instead.',
    'Assuming a deny rule exists. RBAC is additive only; narrow or remove the binding that grants the permission.',
  ],
  examTips: [
    'The four imperative commands cover nearly every RBAC task: `kubectl create role`, `create clusterrole`, `create rolebinding`, `create clusterrolebinding`.',
    'RoleBinding to a ServiceAccount uses `--serviceaccount=<namespace>:<name>`; to a user `--user=`; to a group `--group=`.',
    "Finish every RBAC task with `kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<ns>:<sa> -n <ns>` - it is the grader's check too.",
    'If a task mentions logs, exec or port-forward, add the matching `pods/...` subresource.',
    'For a resource in a non-core group, write `--resource=deployments.apps` so the group is unambiguous.',
    '"Give this team full control of their namespace" → `kubectl create rolebinding x --clusterrole=admin --group=y -n ns`.',
    'Cluster-scoped resources you should recognise instantly: nodes, namespaces, persistentvolumes, storageclasses, clusterroles, clusterrolebindings, ingressclasses, customresourcedefinitions.',
  ],
  summary: [
    'Role/ClusterRole define permissions; RoleBinding/ClusterRoleBinding grant them to subjects.',
    'RoleBinding + ClusterRole = reusable permissions scoped to one namespace (the common pattern). ClusterRoleBinding + Role is invalid.',
    'A rule is apiGroups + resources + verbs; all three must match. `""` is the core group.',
    'Subresources (`pods/log`, `pods/exec`, `deployments/scale`) need their own entries.',
    'RBAC is additive with no deny rules; `kubectl auth can-i --as=...` is the way to verify.',
  ],
  practice: [
    {
      id: 'rbac-p1',
      level: 'beginner',
      prompt:
        'Write the two commands that let ServiceAccount `api-sa` in namespace `shop` list Pods in `shop` only.',
      answer:
        'kubectl create role pod-reader -n shop --verb=get,list,watch --resource=pods\nkubectl create rolebinding api-sa-pod-reader -n shop --role=pod-reader --serviceaccount=shop:api-sa',
      explanation:
        'Verify with `kubectl auth can-i list pods --as=system:serviceaccount:shop:api-sa -n shop` (yes) and the same command against another namespace (no).',
    },
    {
      id: 'rbac-p2',
      level: 'intermediate',
      prompt:
        'A ServiceAccount can run `kubectl get pods` but `kubectl logs <pod>` returns 403. What is missing and what is the exact fix?',
      answer:
        "`kubectl logs` reads the `pods/log` subresource, which `get pods` does not cover.\n\nFix:\nkubectl create role pod-log-reader -n <ns> --verb=get --resource=pods/log\nkubectl create rolebinding pod-log-reader-binding -n <ns> --role=pod-log-reader --serviceaccount=<ns>:<sa>\n\nOr add `pods/log` to the existing Role's resources.",
      explanation:
        'The same applies to `pods/exec` (kubectl exec), `pods/portforward` (kubectl port-forward) and `deployments/scale` (kubectl scale). Test with `kubectl auth can-i get pods/log --as=...`.',
    },
    {
      id: 'rbac-p3',
      level: 'advanced',
      prompt:
        'A monitoring agent runs in namespace `monitoring` and must list Pods in every namespace and read Nodes. Which two RBAC objects, and why not a Role?',
      answer:
        'A ClusterRole granting `get,list,watch` on `pods` (core group) and `nodes` (core group), plus a ClusterRoleBinding to `system:serviceaccount:monitoring:monitoring-sa`.\n\nA Role cannot work for two reasons: Nodes are cluster-scoped, so no namespaced Role can grant access to them at all; and listing Pods in *every* namespace would need one RoleBinding per namespace, forever, including namespaces created later.',
      explanation:
        'kubectl create clusterrole monitor --verb=get,list,watch --resource=pods,nodes\nkubectl create clusterrolebinding monitor --clusterrole=monitor --serviceaccount=monitoring:monitoring-sa\n\nVerify with `kubectl auth can-i list pods --as=system:serviceaccount:monitoring:monitoring-sa -A`.',
    },
  ],
  lab: {
    title: 'Build up permissions one rule at a time',
    scenario:
      'You will create a ServiceAccount with no permissions, then add exactly the rules needed for listing Pods, reading logs, restarting a Deployment and reading Nodes - verifying each step with `kubectl auth can-i` and a real API call.',
    prerequisites: [
      'A cluster where you can create RBAC objects (kind, minikube, or a lab cluster with admin access)',
    ],
    tasks: [
      { instruction: 'Create namespace `rbac-lab` and set it as default.' },
      { instruction: 'Create ServiceAccount `agent` and confirm it can do nothing.' },
      { instruction: 'Grant it get/list/watch on pods with a Role and RoleBinding, and verify.' },
      { instruction: 'Prove that `pods/log` is still denied, then grant it and re-verify.' },
      {
        instruction:
          'Grant patch on deployments.apps so `kubectl rollout restart` would work, and verify.',
      },
      {
        instruction:
          'Prove that listing nodes is denied, then grant it with a ClusterRole and ClusterRoleBinding.',
      },
      { instruction: 'Prove the namespaced permissions do NOT apply in another namespace.' },
      { instruction: 'Run a Pod as the ServiceAccount and make a real API call with its token.' },
      { instruction: 'Print the full permission set and delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3 - from nothing to listing Pods',
        language: 'bash',
        code: `kubectl create namespace rbac-lab
kubectl config set-context --current --namespace=rbac-lab
SA=system:serviceaccount:rbac-lab:agent

kubectl create serviceaccount agent

kubectl auth can-i list pods --as=$SA
# no
kubectl auth can-i --list --as=$SA | head -4
# only selfsubjectreviews and non-resource URLs

kubectl create role pod-reader --verb=get,list,watch --resource=pods
kubectl create rolebinding agent-pod-reader --role=pod-reader --serviceaccount=rbac-lab:agent

kubectl auth can-i list pods --as=$SA
# yes
kubectl auth can-i delete pods --as=$SA
# no        <- only the verbs we granted`,
      },
      {
        title: 'Step 4 - the subresource surprise',
        language: 'bash',
        code: `kubectl auth can-i get pods/log --as=$SA
# no        <- get on pods does NOT include logs

kubectl create role pod-log-reader --verb=get --resource=pods/log
kubectl create rolebinding agent-logs --role=pod-log-reader --serviceaccount=rbac-lab:agent

kubectl auth can-i get pods/log --as=$SA
# yes

kubectl auth can-i create pods/exec --as=$SA
# no        <- exec is a separate subresource again`,
      },
      {
        title: 'Step 5 - what rollout restart needs',
        language: 'bash',
        code: `kubectl create deployment web --image=nginx:1.27-alpine
kubectl rollout status deploy/web --timeout=120s

kubectl auth can-i patch deployments.apps --as=$SA
# no

kubectl create role deploy-restarter --verb=get,list,patch --resource=deployments.apps
kubectl create rolebinding agent-deploy --role=deploy-restarter --serviceaccount=rbac-lab:agent

kubectl auth can-i patch deployments.apps --as=$SA
# yes

# Note the group matters: the core group has no deployments
kubectl auth can-i patch deployments --as=$SA
# yes   (kubectl resolves the preferred group, which is apps)`,
      },
      {
        title: 'Steps 6-7 - cluster scope and namespace isolation',
        language: 'bash',
        code: `kubectl auth can-i list nodes --as=$SA
# no        <- nodes are cluster-scoped; a Role can never grant this

kubectl create clusterrole node-reader --verb=get,list,watch --resource=nodes
kubectl create clusterrolebinding agent-nodes --clusterrole=node-reader --serviceaccount=rbac-lab:agent

kubectl auth can-i list nodes --as=$SA
# yes

# The namespaced grants are genuinely scoped
kubectl create namespace rbac-other
kubectl auth can-i list pods --as=$SA -n rbac-other
# no
kubectl auth can-i list nodes --as=$SA -n rbac-other
# yes       <- cluster-scoped, so the namespace is irrelevant`,
      },
      {
        title: 'Step 8 - a real API call with the token',
        language: 'bash',
        code: `kubectl run agent-pod --image=curlimages/curl:8.10.1 \\
  --overrides='{"spec":{"serviceAccountName":"agent"}}' --command -- sleep 3600
kubectl wait --for=condition=Ready pod/agent-pod --timeout=90s

# Allowed: list pods in this namespace
kubectl exec agent-pod -- sh -c '
  T=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  curl -s -o /dev/null -w "list pods: %{http_code}\\n" \\
    --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \\
    -H "Authorization: Bearer $T" \\
    https://kubernetes.default.svc/api/v1/namespaces/rbac-lab/pods'
# list pods: 200

# Denied: delete a pod
kubectl exec agent-pod -- sh -c '
  T=$(cat /var/run/secrets/kubernetes.io/serviceaccount/token)
  curl -s -o /dev/null -w "delete pod: %{http_code}\\n" -X DELETE \\
    --cacert /var/run/secrets/kubernetes.io/serviceaccount/ca.crt \\
    -H "Authorization: Bearer $T" \\
    https://kubernetes.default.svc/api/v1/namespaces/rbac-lab/pods/web-xyz'
# delete pod: 403`,
      },
      {
        title: 'Step 9 - the full picture, then cleanup',
        language: 'bash',
        code: `kubectl auth can-i --list --as=$SA -n rbac-lab
# Resources          Non-Resource URLs   Resource Names   Verbs
# pods               []                  []               [get list watch]
# pods/log           []                  []               [get]
# deployments.apps   []                  []               [get list patch]
# nodes              []                  []               [get list watch]
# ...

kubectl get rolebindings,clusterrolebindings -A -o wide | grep agent

kubectl delete clusterrolebinding agent-nodes
kubectl delete clusterrole node-reader
kubectl config set-context --current --namespace=default
kubectl delete namespace rbac-lab rbac-other`,
      },
    ],
    verification: [
      {
        command: 'kubectl auth can-i --list --as=system:serviceaccount:rbac-lab:agent -n rbac-lab',
        what: 'Should list exactly the four grants and nothing more.',
        expected: 'pods, pods/log, deployments.apps and nodes with their granted verbs.',
      },
      {
        command:
          'kubectl auth can-i list pods --as=system:serviceaccount:rbac-lab:agent -n rbac-other',
        what: 'Confirms RoleBindings do not leak into other namespaces.',
        expected: 'no',
      },
    ],
    cleanup: [
      {
        command:
          'kubectl delete clusterrolebinding agent-nodes && kubectl delete clusterrole node-reader',
        what: 'Cluster-scoped objects are not removed by deleting a namespace.',
        expected: 'Two "deleted" lines.',
      },
      {
        command: 'kubectl delete namespace rbac-lab rbac-other',
        what: 'Removes the namespaced objects.',
        expected: 'Two "deleted" lines.',
      },
    ],
  },
  relatedTopicIds: ['serviceaccounts', 'authn-authz-admission'],
  docs: [
    {
      title: 'Using RBAC authorization',
      url: 'https://kubernetes.io/docs/reference/access-authn-authz/rbac/',
    },
    {
      title: 'Authorization overview',
      url: 'https://kubernetes.io/docs/reference/access-authn-authz/authorization/',
    },
  ],
}
