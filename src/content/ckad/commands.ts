import type { CommandGroup } from '../types'

/**
 * Searchable command reference.
 *
 * Every entry is a command you would realistically type during CKAD practice
 * or the exam itself. Placeholders are written as <angle-brackets> so the UI
 * can highlight what the learner must replace.
 */
export const ckadCommandGroups: CommandGroup[] = [
  {
    id: 'setup',
    title: 'Shell setup and aliases',
    description:
      'Run these in the first 60 seconds. They pay for themselves within two tasks and remove a whole class of YAML indentation error.',
    entries: [
      {
        id: 'setup-alias-k',
        command: 'alias k=kubectl',
        description:
          'The single highest-value line of the exam - seven fewer characters on every command.',
        tags: ['alias', 'setup', 'speed'],
      },
      {
        id: 'setup-completion',
        command: 'source <(kubectl completion bash) && complete -o default -F __start_kubectl k',
        description: 'Enables tab completion for kubectl and for the k alias.',
        tags: ['completion', 'setup', 'bash'],
      },
      {
        id: 'setup-do',
        command: 'export do="--dry-run=client -o yaml"',
        description: 'Append $do to any generator to produce a manifest instead of an object.',
        example: 'k create deploy api --image=nginx:1.27-alpine $do > api.yaml',
        tags: ['dry-run', 'setup', 'generate'],
      },
      {
        id: 'setup-now',
        command: 'export now="--force --grace-period=0"',
        description:
          'Immediate deletion, for when a task needs a Pod gone at once rather than in 30 seconds.',
        example: 'k delete pod web $now',
        notes: 'Use sparingly - it can leave a container running on the node.',
        tags: ['delete', 'force', 'setup'],
      },
      {
        id: 'setup-vim',
        command:
          "printf 'set expandtab\\nset tabstop=2\\nset shiftwidth=2\\nset autoindent\\nset number\\n' >> ~/.vimrc",
        description:
          'Two-space YAML indentation and no literal tabs. A tab is a hard YAML parse error, and expandtab makes it impossible to insert one.',
        tags: ['vim', 'yaml', 'setup', 'indentation'],
      },
      {
        id: 'setup-vim-paste',
        command: ':set paste',
        description:
          'Run inside vim BEFORE pasting YAML from the browser, then :set nopaste. Without it, autoindent cascades the indentation and the YAML becomes invalid.',
        tags: ['vim', 'paste', 'yaml', 'docs'],
      },
      {
        id: 'setup-heredoc',
        command: "cat > manifest.yaml <<'YAML'",
        description:
          'The safest way to get pasted YAML into a file: paste after this line, then a line containing only YAML, then Ctrl+D if needed.',
        placeholders: ['manifest.yaml'],
        tags: ['heredoc', 'paste', 'yaml'],
      },
    ],
  },
  {
    id: 'context',
    title: 'Contexts and namespaces',
    description:
      'Wrong cluster and wrong namespace are the two most expensive mistakes available. Both are stated in every task.',
    entries: [
      {
        id: 'ctx-get',
        command: 'kubectl config get-contexts',
        description:
          'Lists every context with its cluster, user and default namespace. The asterisk marks the active one.',
        tags: ['context', 'kubeconfig'],
      },
      {
        id: 'ctx-use',
        command: 'kubectl config use-context <context>',
        description: 'Switches the active context. Run this first for every task that names one.',
        placeholders: ['<context>'],
        tags: ['context', 'switch'],
      },
      {
        id: 'ctx-current',
        command: 'kubectl config current-context',
        description: 'Prints just the active context name.',
        tags: ['context'],
      },
      {
        id: 'ctx-namespace',
        command: 'kubectl config set-context --current --namespace=<namespace>',
        description:
          'Sets the default namespace so you can stop typing -n for the rest of the task.',
        placeholders: ['<namespace>'],
        tags: ['namespace', 'context'],
      },
      {
        id: 'ctx-check',
        command:
          'kubectl config view --minify -o jsonpath=\'{.contexts[0].name}{" / "}{..namespace}{"\\n"}\'',
        description: 'Context and namespace in one line. The pre-flight check for every task.',
        tags: ['namespace', 'context', 'verify'],
      },
      {
        id: 'ctx-ns-create',
        command: 'kubectl create namespace <namespace>',
        description: 'Creates a namespace. Setting a context namespace does not create it.',
        placeholders: ['<namespace>'],
        tags: ['namespace', 'create'],
      },
      {
        id: 'ctx-ns-delete',
        command: 'kubectl delete namespace <namespace>',
        description:
          'Deletes a namespace and every namespaced object inside it - the fastest cleanup between practice runs.',
        placeholders: ['<namespace>'],
        notes:
          'Destructive and irreversible. Never run this against a namespace you did not create.',
        tags: ['namespace', 'delete', 'cleanup'],
      },
      {
        id: 'ctx-whoami',
        command: 'kubectl auth whoami',
        description:
          'Shows the identity the API server authenticated you as - the authentication stage result.',
        tags: ['auth', 'identity'],
      },
    ],
  },
  {
    id: 'generators',
    title: 'Imperative generators',
    description:
      'One line each, and the boilerplate is correct by construction. Append --dry-run=client -o yaml to generate a manifest instead.',
    entries: [
      {
        id: 'gen-run-pod',
        command: 'kubectl run <name> --image=<image>',
        description: 'Creates a single Pod. Note: kubectl run creates Pods, never Deployments.',
        placeholders: ['<name>', '<image>'],
        tags: ['pod', 'run', 'generator'],
      },
      {
        id: 'gen-run-command',
        command: 'kubectl run <name> --image=busybox:1.36 --command -- sleep 3600',
        description: 'Pod with an overridden command. --command sets spec.containers[].command.',
        placeholders: ['<name>'],
        notes: 'Without --command, the trailing words become args instead of command.',
        tags: ['pod', 'command', 'sleep'],
      },
      {
        id: 'gen-run-tmp',
        command: 'kubectl run tmp --rm -it --restart=Never --image=busybox:1.36 -- sh',
        description:
          'A throwaway interactive debug Pod that deletes itself on exit. The most useful command in the networking domain.',
        tags: ['debug', 'busybox', 'temporary', 'shell'],
      },
      {
        id: 'gen-deployment',
        command: 'kubectl create deployment <name> --image=<image> --replicas=<n>',
        description: 'Creates a Deployment with a matching selector and Pod template labels.',
        placeholders: ['<name>', '<image>', '<n>'],
        tags: ['deployment', 'generator'],
      },
      {
        id: 'gen-job',
        command: "kubectl create job <name> --image=<image> -- sh -c '<command>'",
        description: 'Creates a Job with restartPolicy Never and backoffLimit 6.',
        placeholders: ['<name>', '<image>', '<command>'],
        tags: ['job', 'batch', 'generator'],
      },
      {
        id: 'gen-job-from-cronjob',
        command: 'kubectl create job <name> --from=cronjob/<cronjob>',
        description:
          'Runs a CronJob immediately by copying its jobTemplate. No declarative equivalent.',
        placeholders: ['<name>', '<cronjob>'],
        tags: ['job', 'cronjob', 'trigger'],
      },
      {
        id: 'gen-cronjob',
        command:
          'kubectl create cronjob <name> --image=<image> --schedule="*/5 * * * *" -- <command>',
        description:
          'Creates a CronJob with the correct nesting. Quote the schedule so the shell does not expand the asterisks.',
        placeholders: ['<name>', '<image>', '<command>'],
        tags: ['cronjob', 'schedule', 'generator'],
      },
      {
        id: 'gen-configmap',
        command: 'kubectl create configmap <name> --from-literal=<KEY>=<value>',
        description:
          'ConfigMap from key/value pairs. Avoids the unquoted-number validation error entirely.',
        placeholders: ['<name>', '<KEY>', '<value>'],
        tags: ['configmap', 'generator', 'literal'],
      },
      {
        id: 'gen-configmap-file',
        command: 'kubectl create configmap <name> --from-file=<path>',
        description:
          'ConfigMap where the filename becomes the key. Use --from-file=<key>=<path> to choose the key.',
        placeholders: ['<name>', '<path>'],
        tags: ['configmap', 'file'],
      },
      {
        id: 'gen-configmap-env',
        command: 'kubectl create configmap <name> --from-env-file=<path>',
        description: 'One key per KEY=value line of a dotenv file.',
        placeholders: ['<name>', '<path>'],
        tags: ['configmap', 'env-file'],
      },
      {
        id: 'gen-secret-generic',
        command: 'kubectl create secret generic <name> --from-literal=<KEY>=<value>',
        description: 'Opaque Secret from literals. kubectl base64-encodes the values.',
        placeholders: ['<name>', '<KEY>', '<value>'],
        tags: ['secret', 'generator'],
      },
      {
        id: 'gen-secret-registry',
        command:
          'kubectl create secret docker-registry <name> --docker-server=<server> --docker-username=<user> --docker-password=<password>',
        description:
          'The ONLY correct way to create a pull secret - it sets type kubernetes.io/dockerconfigjson, which imagePullSecrets requires.',
        placeholders: ['<name>', '<server>', '<user>', '<password>'],
        tags: ['secret', 'registry', 'imagepullsecret'],
      },
      {
        id: 'gen-secret-tls',
        command: 'kubectl create secret tls <name> --cert=<cert-file> --key=<key-file>',
        description:
          'TLS Secret with the required tls.crt and tls.key keys and type kubernetes.io/tls.',
        placeholders: ['<name>', '<cert-file>', '<key-file>'],
        tags: ['secret', 'tls', 'ingress'],
      },
      {
        id: 'gen-sa',
        command: 'kubectl create serviceaccount <name>',
        description:
          'Creates a ServiceAccount. It grants identity only - permissions come from RBAC.',
        placeholders: ['<name>'],
        tags: ['serviceaccount', 'generator'],
      },
      {
        id: 'gen-quota',
        command:
          'kubectl create quota <name> --hard=requests.cpu=1,requests.memory=1Gi,count/pods=10',
        description: 'ResourceQuota capping namespace totals and object counts.',
        placeholders: ['<name>'],
        tags: ['quota', 'resourcequota', 'generator'],
      },
      {
        id: 'gen-ingress',
        command:
          'kubectl create ingress <name> --class=nginx --rule="<host>/<path>*=<service>:<port>"',
        description:
          'Creates an Ingress. A trailing * on the path produces pathType Prefix; without it, Exact.',
        placeholders: ['<name>', '<host>', '<path>', '<service>', '<port>'],
        tags: ['ingress', 'generator', 'pathtype'],
      },
      {
        id: 'gen-no-generator',
        command:
          '# No generator: StatefulSet, DaemonSet, NetworkPolicy, PVC, probes, volumes, securityContext',
        description:
          'For these, generate a Deployment skeleton and edit kind and fields, or write the YAML. Knowing this saves you hunting for a flag that does not exist.',
        tags: ['generator', 'yaml', 'limitations'],
      },
    ],
  },
  {
    id: 'workloads',
    title: 'Workloads: inspect, scale, update',
    description: 'Day-to-day operations on Deployments, Jobs and Pods.',
    entries: [
      {
        id: 'wl-get-all',
        command: 'kubectl get all -n <namespace>',
        description:
          'A quick survey of the common workload and service objects. Omits ConfigMaps, Secrets, Ingresses and PVCs.',
        placeholders: ['<namespace>'],
        tags: ['get', 'survey'],
      },
      {
        id: 'wl-scale',
        command: 'kubectl scale deployment <name> --replicas=<n>',
        description: 'Changes the replica count immediately. Creates no new revision.',
        placeholders: ['<name>', '<n>'],
        tags: ['scale', 'replicas'],
      },
      {
        id: 'wl-scale-conditional',
        command: 'kubectl scale deployment <name> --current-replicas=<c> --replicas=<n>',
        description:
          'Conditional scale: refused unless the current count matches, protecting against stale assumptions.',
        placeholders: ['<name>', '<c>', '<n>'],
        tags: ['scale', 'conditional'],
      },
      {
        id: 'wl-set-image',
        command: 'kubectl set image deployment/<name> <container>=<image>',
        description:
          'Updates one container image and triggers a rolling update. The name before = is the CONTAINER name.',
        placeholders: ['<name>', '<container>', '<image>'],
        notes:
          "Get the container name with: kubectl get deploy <name> -o jsonpath='{.spec.template.spec.containers[*].name}'",
        tags: ['image', 'update', 'rollout'],
      },
      {
        id: 'wl-set-env',
        command: 'kubectl set env deployment/<name> <KEY>=<value>',
        description: 'Adds or changes literal environment variables and triggers a rollout.',
        placeholders: ['<name>', '<KEY>', '<value>'],
        tags: ['env', 'update'],
      },
      {
        id: 'wl-set-env-from',
        command: 'kubectl set env deployment/<name> --from=configmap/<configmap>',
        description:
          'Imports every key of a ConfigMap (or secret/<name>) as environment variables. Add --prefix= to avoid collisions.',
        placeholders: ['<name>', '<configmap>'],
        tags: ['env', 'configmap', 'envfrom'],
      },
      {
        id: 'wl-set-env-remove',
        command: 'kubectl set env deployment/<name> <KEY>-',
        description: 'Removes an environment variable. The trailing hyphen is the delete syntax.',
        placeholders: ['<name>', '<KEY>'],
        tags: ['env', 'remove'],
      },
      {
        id: 'wl-set-resources',
        command:
          'kubectl set resources deployment/<name> -c=<container> --requests=cpu=100m,memory=128Mi --limits=cpu=500m,memory=512Mi',
        description: 'Sets requests and limits on an existing container and triggers a rollout.',
        placeholders: ['<name>', '<container>'],
        tags: ['resources', 'requests', 'limits'],
      },
      {
        id: 'wl-set-sa',
        command: 'kubectl set serviceaccount deployment/<name> <serviceaccount>',
        description:
          'Changes the ServiceAccount on a Deployment. The field is immutable on an existing Pod.',
        placeholders: ['<name>', '<serviceaccount>'],
        tags: ['serviceaccount', 'update'],
      },
      {
        id: 'wl-autoscale',
        command: 'kubectl autoscale deployment <name> --min=<min> --max=<max> --cpu-percent=<pct>',
        description:
          'Creates an HPA without writing YAML. Requires CPU requests on the containers, or TARGETS shows <unknown>.',
        placeholders: ['<name>', '<min>', '<max>', '<pct>'],
        tags: ['hpa', 'autoscale', 'scaling'],
      },
      {
        id: 'wl-rollout-status',
        command: 'kubectl rollout status deployment/<name> --timeout=60s',
        description:
          'Blocks until the rollout completes; exits non-zero on timeout. The verification step for every update.',
        placeholders: ['<name>'],
        tags: ['rollout', 'verify', 'status'],
      },
      {
        id: 'wl-rollout-history',
        command: 'kubectl rollout history deployment/<name>',
        description:
          'Lists revisions with their change causes. Add --revision=N to see one revision in full.',
        placeholders: ['<name>'],
        tags: ['rollout', 'history', 'revision'],
      },
      {
        id: 'wl-rollout-undo',
        command: 'kubectl rollout undo deployment/<name>',
        description: 'Rolls back to the previous revision. Add --to-revision=N for a specific one.',
        placeholders: ['<name>'],
        tags: ['rollout', 'undo', 'rollback'],
      },
      {
        id: 'wl-rollout-restart',
        command: 'kubectl rollout restart deployment/<name>',
        description:
          'Recreates every Pod with an unchanged template - the correct way to pick up a changed ConfigMap or Secret consumed as env vars.',
        placeholders: ['<name>'],
        tags: ['rollout', 'restart', 'configmap'],
      },
      {
        id: 'wl-rollout-pause',
        command: 'kubectl rollout pause deployment/<name>',
        description:
          'Suspends rollouts so several template edits become one update. Resume with kubectl rollout resume.',
        placeholders: ['<name>'],
        tags: ['rollout', 'pause'],
      },
      {
        id: 'wl-annotate-cause',
        command:
          'kubectl annotate deployment/<name> kubernetes.io/change-cause="<reason>" --overwrite',
        description:
          'Populates the CHANGE-CAUSE column of rollout history. The --record flag no longer exists.',
        placeholders: ['<name>', '<reason>'],
        tags: ['annotate', 'change-cause', 'rollout'],
      },
      {
        id: 'wl-wait-ready',
        command: 'kubectl wait --for=condition=Ready pod/<name> --timeout=90s',
        description: 'Blocks until a Pod is Ready. Far better than guessing a sleep duration.',
        placeholders: ['<name>'],
        tags: ['wait', 'ready', 'verify'],
      },
      {
        id: 'wl-wait-job',
        command: 'kubectl wait --for=condition=complete job/<name> --timeout=300s',
        description: 'Blocks until a Job completes - the correct way to gate a follow-up step.',
        placeholders: ['<name>'],
        tags: ['wait', 'job', 'complete'],
      },
      {
        id: 'wl-label',
        command: 'kubectl label <kind> <name> <key>=<value> --overwrite',
        description:
          'Adds or changes a label. Without --overwrite, kubectl refuses to replace an existing one.',
        placeholders: ['<kind>', '<name>', '<key>', '<value>'],
        notes: 'Remove a label with a trailing hyphen: kubectl label pod web tier-',
        tags: ['label', 'selector'],
      },
    ],
  },
  {
    id: 'apply',
    title: 'Apply, diff, edit and replace',
    description: 'Declarative management, safe editing, and the escape hatch for immutable fields.',
    entries: [
      {
        id: 'ap-apply',
        command: 'kubectl apply -f <file-or-dir>',
        description: 'Creates or updates objects to match the file. Idempotent and safe to re-run.',
        placeholders: ['<file-or-dir>'],
        tags: ['apply', 'declarative'],
      },
      {
        id: 'ap-diff',
        command: 'kubectl diff -f <file>',
        description:
          'Shows exactly what an apply would change. Lines beginning with - are fields apply will DELETE.',
        placeholders: ['<file>'],
        tags: ['diff', 'preview', 'apply'],
      },
      {
        id: 'ap-dry-server',
        command: 'kubectl apply -f <file> --dry-run=server',
        description:
          'Full server-side validation and admission without persisting. Catches unknown fields, wrong apiVersions and policy rejections.',
        placeholders: ['<file>'],
        tags: ['dry-run', 'validate', 'admission'],
      },
      {
        id: 'ap-backup',
        command: 'kubectl get <kind> <name> -o yaml > /tmp/backup.yaml',
        description:
          'Three seconds of insurance before any edit. Restore with kubectl replace --force -f.',
        placeholders: ['<kind>', '<name>'],
        tags: ['backup', 'edit', 'safety'],
      },
      {
        id: 'ap-edit',
        command: 'kubectl edit <kind> <name>',
        description:
          'Opens the live object in $EDITOR; saving applies immediately. Fails on immutable fields.',
        placeholders: ['<kind>', '<name>'],
        tags: ['edit', 'interactive'],
      },
      {
        id: 'ap-replace-force',
        command: 'kubectl replace --force -f <file>',
        description:
          'Deletes and recreates the object. THE answer to any "field is immutable" error - Deployment selectors, Job templates, most Pod fields.',
        placeholders: ['<file>'],
        notes: 'Pods are recreated, so expect a brief interruption.',
        tags: ['replace', 'force', 'immutable'],
      },
      {
        id: 'ap-patch-merge',
        command: 'kubectl patch <kind> <name> -p \'{"spec":{"replicas":3}}\'',
        description:
          'A strategic-merge patch for a small change. Patching a list replaces the whole list.',
        placeholders: ['<kind>', '<name>'],
        tags: ['patch', 'merge'],
      },
      {
        id: 'ap-patch-json',
        command:
          'kubectl patch <kind> <name> --type=json -p=\'[{"op":"replace","path":"/spec/replicas","value":3}]\'',
        description:
          'A JSON 6902 patch. The only form that can remove a field or address a list element by index.',
        placeholders: ['<kind>', '<name>'],
        tags: ['patch', 'json', 'remove'],
      },
      {
        id: 'ap-delete-file',
        command: 'kubectl delete -f <file>',
        description: 'Deletes exactly the objects described in the file.',
        placeholders: ['<file>'],
        tags: ['delete', 'declarative'],
      },
      {
        id: 'ap-delete-selector',
        command: 'kubectl delete pods -l <key>=<value>',
        description: 'Bulk delete by label selector rather than by name.',
        placeholders: ['<key>', '<value>'],
        tags: ['delete', 'selector', 'bulk'],
      },
      {
        id: 'ap-cascade-orphan',
        command: 'kubectl delete deployment <name> --cascade=orphan',
        description: 'Deletes the Deployment but leaves its ReplicaSets and Pods running.',
        placeholders: ['<name>'],
        tags: ['delete', 'cascade', 'orphan'],
      },
    ],
  },
  {
    id: 'discovery',
    title: 'API discovery and kubectl explain',
    description:
      'The fastest documentation available, and it needs no browser. Always correct for the cluster version you are on.',
    entries: [
      {
        id: 'dis-explain',
        command: 'kubectl explain <kind>.<field>',
        description: 'Field documentation from the live cluster schema.',
        placeholders: ['<kind>', '<field>'],
        example: 'kubectl explain pod.spec.containers.readinessProbe',
        tags: ['explain', 'docs', 'fields'],
      },
      {
        id: 'dis-explain-recursive',
        command: 'kubectl explain <kind>.<field> --recursive',
        description: 'The whole field tree at once - ideal when you need exact nesting.',
        placeholders: ['<kind>', '<field>'],
        example:
          'kubectl explain deployment.spec.template.spec.containers.livenessProbe --recursive',
        tags: ['explain', 'recursive', 'nesting'],
      },
      {
        id: 'dis-explain-version',
        command: 'kubectl explain <kind> --api-version=<group>/<version>',
        description:
          'Field set for a specific version - how you see what changed between two API versions.',
        placeholders: ['<kind>', '<group>', '<version>'],
        example: 'kubectl explain ingress.spec --api-version=networking.k8s.io/v1',
        tags: ['explain', 'apiversion', 'deprecation'],
      },
      {
        id: 'dis-api-resources',
        command: 'kubectl api-resources',
        description:
          'Every resource type with its short name, API group and whether it is namespaced.',
        tags: ['api-resources', 'discovery', 'apiversion'],
      },
      {
        id: 'dis-api-resources-grep',
        command: 'kubectl api-resources | grep -i <word>',
        description: 'The fastest way to find the correct apiVersion for a kind.',
        placeholders: ['<word>'],
        example: 'kubectl api-resources | grep -i ingress',
        tags: ['api-resources', 'apiversion', 'search'],
      },
      {
        id: 'dis-api-resources-cluster',
        command: 'kubectl api-resources --namespaced=false',
        description:
          'Cluster-scoped resources - the ones -n cannot affect and a Role can never grant.',
        tags: ['api-resources', 'scope', 'cluster-scoped'],
      },
      {
        id: 'dis-api-versions',
        command: 'kubectl api-versions',
        description:
          'Every group/version the cluster serves. If a version is missing here, no manifest can use it.',
        tags: ['api-versions', 'deprecation'],
      },
      {
        id: 'dis-version',
        command: 'kubectl version',
        description:
          'Client and server versions. The server version determines which deprecations apply.',
        tags: ['version'],
      },
      {
        id: 'dis-crd',
        command: 'kubectl get crd',
        description:
          'Lists installed CustomResourceDefinitions - the first step in exploring an unfamiliar cluster.',
        tags: ['crd', 'discovery', 'custom-resource'],
      },
      {
        id: 'dis-crd-group',
        command: 'kubectl api-resources --api-group=<group>',
        description:
          'Short names, versions, scope and kinds for one API group, including custom resources.',
        placeholders: ['<group>'],
        example: 'kubectl api-resources --api-group=cert-manager.io',
        tags: ['crd', 'api-group', 'discovery'],
      },
    ],
  },
  {
    id: 'debug',
    title: 'Logs, exec, debug and port-forward',
    description: 'The escalation ladder: describe, logs, port-forward, exec, debug, copy.',
    entries: [
      {
        id: 'dbg-describe',
        command: 'kubectl describe pod <name>',
        description:
          'The highest-value single debugging command: resolved spec, container states, conditions and events together.',
        placeholders: ['<name>'],
        notes: 'Pipe to `tail -20` to land straight on the events.',
        tags: ['describe', 'debug', 'events'],
      },
      {
        id: 'dbg-logs',
        command: 'kubectl logs <pod>',
        description:
          'Reads the current container instance. Only stdout and stderr are collected - never log files.',
        placeholders: ['<pod>'],
        tags: ['logs', 'debug'],
      },
      {
        id: 'dbg-logs-previous',
        command: 'kubectl logs <pod> --previous',
        description:
          'The instance before the last restart. THE command for CrashLoopBackOff, where the current log is empty.',
        placeholders: ['<pod>'],
        tags: ['logs', 'previous', 'crashloopbackoff'],
      },
      {
        id: 'dbg-logs-container',
        command: 'kubectl logs <pod> -c <container>',
        description:
          'Required in multi-container Pods. Without it kubectl errors and lists the container names.',
        placeholders: ['<pod>', '<container>'],
        tags: ['logs', 'container', 'sidecar'],
      },
      {
        id: 'dbg-logs-selector',
        command: 'kubectl logs -l <key>=<value> --prefix --tail=50',
        description:
          'Reads from every matching Pod. A selector read defaults to only 10 lines, so --tail is needed.',
        placeholders: ['<key>', '<value>'],
        tags: ['logs', 'selector', 'deployment'],
      },
      {
        id: 'dbg-logs-follow',
        command: 'kubectl logs -f --tail=20 <pod>',
        description: 'Streams new lines after showing the last 20.',
        placeholders: ['<pod>'],
        tags: ['logs', 'follow', 'stream'],
      },
      {
        id: 'dbg-logs-since',
        command: 'kubectl logs <pod> --since=10m --timestamps',
        description: 'Limits output by time and adds collection timestamps.',
        placeholders: ['<pod>'],
        tags: ['logs', 'since', 'timestamps'],
      },
      {
        id: 'dbg-exec',
        command: 'kubectl exec -it <pod> -- sh',
        description:
          'Interactive shell in an existing container. Requires the binary to be present in the image.',
        placeholders: ['<pod>'],
        tags: ['exec', 'shell', 'debug'],
      },
      {
        id: 'dbg-exec-cmd',
        command: 'kubectl exec <pod> -- <command>',
        description: 'Runs one command with no TTY - ideal for printenv, cat and ls checks.',
        placeholders: ['<pod>', '<command>'],
        example: 'kubectl exec api -- printenv LOG_LEVEL',
        tags: ['exec', 'verify'],
      },
      {
        id: 'dbg-debug-ephemeral',
        command: 'kubectl debug -it <pod> --image=busybox:1.36 --target=<container>',
        description:
          'Attaches an ephemeral debug container to a running Pod, sharing its network namespace. Works on distroless images with no shell.',
        placeholders: ['<pod>', '<container>'],
        notes: 'Ephemeral containers cannot be removed - they live until the Pod does.',
        tags: ['debug', 'ephemeral', 'distroless'],
      },
      {
        id: 'dbg-debug-copy',
        command: 'kubectl debug <pod> --copy-to=<new-name> --container=<container> -- sleep 3600',
        description:
          'Creates a copy of a Pod with a replaced command - the way to inspect a CrashLoopBackOff Pod that will not stay up.',
        placeholders: ['<pod>', '<new-name>', '<container>'],
        tags: ['debug', 'copy', 'crashloopbackoff'],
      },
      {
        id: 'dbg-port-forward',
        command: 'kubectl port-forward pod/<pod> <local>:<remote>',
        description:
          'Tunnels through the API server, bypassing DNS, Services, kube-proxy and NetworkPolicies. A working port-forward proves the application is healthy.',
        placeholders: ['<pod>', '<local>', '<remote>'],
        tags: ['port-forward', 'debug', 'isolate'],
      },
      {
        id: 'dbg-port-forward-svc',
        command: 'kubectl port-forward svc/<service> <local>:<port>',
        description: 'Forwards to a Service, which selects one of its Ready endpoint Pods.',
        placeholders: ['<service>', '<local>', '<port>'],
        tags: ['port-forward', 'service'],
      },
      {
        id: 'dbg-cp-out',
        command: 'kubectl cp <namespace>/<pod>:<remote-path> <local-path>',
        description: 'Copies a file out of a container. Requires tar in the image.',
        placeholders: ['<namespace>', '<pod>', '<remote-path>', '<local-path>'],
        tags: ['cp', 'copy', 'files'],
      },
      {
        id: 'dbg-events',
        command: 'kubectl get events --sort-by=.lastTimestamp',
        description:
          'Recent events, oldest first. The default order is NOT chronological, so always sort.',
        tags: ['events', 'debug', 'sort'],
      },
      {
        id: 'dbg-events-warning',
        command: 'kubectl get events --field-selector type=Warning --sort-by=.lastTimestamp',
        description: 'Only the problems. The fastest namespace-wide triage.',
        tags: ['events', 'warning', 'triage'],
      },
      {
        id: 'dbg-events-object',
        command: 'kubectl get events --field-selector involvedObject.name=<name>',
        description: 'Events for one object, without the noise of the whole namespace.',
        placeholders: ['<name>'],
        tags: ['events', 'field-selector'],
      },
      {
        id: 'dbg-rs-failedcreate',
        command: 'kubectl describe rs -n <namespace> | grep -A5 FailedCreate',
        description:
          'Where a quota or admission rejection hides when a Deployment has NO Pods at all - there is no Pending Pod to describe.',
        placeholders: ['<namespace>'],
        tags: ['replicaset', 'quota', 'admission', 'failedcreate'],
      },
      {
        id: 'dbg-top-pods',
        command: 'kubectl top pods --containers --sort-by=cpu',
        description: 'Actual usage per container, highest first. Requires metrics-server.',
        tags: ['top', 'metrics', 'cpu', 'memory'],
      },
      {
        id: 'dbg-top-nodes',
        command: 'kubectl top nodes',
        description:
          'Actual node usage. Compare with kubectl describe node, which shows requests instead.',
        tags: ['top', 'nodes', 'metrics'],
      },
      {
        id: 'dbg-node-allocated',
        command: 'kubectl describe node <node> | grep -A8 "Allocated resources"',
        description: 'Requested and limited totals on a node - what "full" means to the scheduler.',
        placeholders: ['<node>'],
        tags: ['node', 'requests', 'scheduling'],
      },
    ],
  },
  {
    id: 'networking',
    title: 'Services, DNS and connectivity',
    description:
      'The six-layer diagnosis: application, DNS, endpoints, ports, policy, external path.',
    entries: [
      {
        id: 'net-expose',
        command: 'kubectl expose deployment <name> --port=<port> --target-port=<target>',
        description:
          'Creates a Service whose selector is copied from the Deployment - which removes the most common cause of Service failure.',
        placeholders: ['<name>', '<port>', '<target>'],
        tags: ['expose', 'service', 'generator'],
      },
      {
        id: 'net-expose-nodeport',
        command:
          'kubectl expose deployment <name> --type=NodePort --port=<port> --target-port=<target>',
        description: 'NodePort Service with an auto-allocated node port in 30000-32767.',
        placeholders: ['<name>', '<port>', '<target>'],
        tags: ['nodeport', 'service', 'expose'],
      },
      {
        id: 'net-service-externalname',
        command: 'kubectl create service externalname <name> --external-name=<hostname>',
        description:
          'A DNS CNAME to an external host. No cluster IP, no proxying, no port mapping.',
        placeholders: ['<name>', '<hostname>'],
        tags: ['externalname', 'service', 'dns'],
      },
      {
        id: 'net-endpoints',
        command: 'kubectl get endpoints <service>',
        description:
          'THE Service check. <none> means the selector matched no Ready Pods; a populated list also shows the resolved target port.',
        placeholders: ['<service>'],
        tags: ['endpoints', 'service', 'verify', 'troubleshoot'],
      },
      {
        id: 'net-endpointslice',
        command: 'kubectl get endpointslice -l kubernetes.io/service-name=<service> -o yaml',
        description:
          'Per-address conditions (ready, serving, terminating) - the detail the legacy Endpoints object hides.',
        placeholders: ['<service>'],
        tags: ['endpointslice', 'service', 'readiness'],
      },
      {
        id: 'net-svc-selector',
        command: 'kubectl get svc <service> -o jsonpath=\'{.spec.selector}{"\\n"}\'',
        description: 'The Service selector, to compare character by character with Pod labels.',
        placeholders: ['<service>'],
        tags: ['service', 'selector', 'troubleshoot'],
      },
      {
        id: 'net-show-labels',
        command: 'kubectl get pods --show-labels',
        description: 'Adds a LABELS column - the other half of a selector comparison.',
        tags: ['labels', 'selector', 'troubleshoot'],
      },
      {
        id: 'net-nslookup',
        command: 'kubectl run tmp --rm -i --restart=Never --image=busybox:1.36 -- nslookup <name>',
        description: 'In-cluster DNS test from a throwaway Pod.',
        placeholders: ['<name>'],
        tags: ['dns', 'nslookup', 'debug'],
      },
      {
        id: 'net-nslookup-control',
        command:
          'kubectl run tmp --rm -i --restart=Never --image=busybox:1.36 -- nslookup kubernetes.default',
        description:
          'The control test: this Service exists in every cluster, so failure means DNS is broken cluster-wide and your Service name is irrelevant.',
        tags: ['dns', 'control-test', 'coredns'],
      },
      {
        id: 'net-resolv',
        command:
          'kubectl run tmp --rm -i --restart=Never --image=busybox:1.36 -- cat /etc/resolv.conf',
        description:
          'The nameserver, search domains and ndots - the explanation for any short-name behaviour.',
        tags: ['dns', 'resolv.conf', 'search-domains'],
      },
      {
        id: 'net-nc',
        command:
          'kubectl run tmp --rm -i --restart=Never --image=busybox:1.36 -- nc -zv -w 3 <host> <port>',
        description:
          'TCP reachability with a bounded timeout. Reports open, refused or timed out - use this, not ping, since a ClusterIP does not answer ICMP.',
        placeholders: ['<host>', '<port>'],
        tags: ['nc', 'connectivity', 'debug', 'tcp'],
      },
      {
        id: 'net-nc-labelled',
        command:
          'kubectl run tmp --rm -i --restart=Never --image=busybox:1.36 --labels="app=web" -- nc -zv -w 3 <host> <port>',
        description:
          'A labelled test Pod - essential once NetworkPolicies exist, because an unlabelled Pod is denied by a podSelector rule.',
        placeholders: ['<host>', '<port>'],
        tags: ['networkpolicy', 'labels', 'test'],
      },
      {
        id: 'net-wget',
        command:
          'kubectl run tmp --rm -i --restart=Never --image=busybox:1.36 -- wget -qO- --timeout=3 http://<service>',
        description: 'Full HTTP test: DNS plus connection plus response.',
        placeholders: ['<service>'],
        tags: ['wget', 'http', 'verify'],
      },
      {
        id: 'net-netpol-list',
        command: 'kubectl get networkpolicies -A',
        description:
          'Every policy in the cluster. Check this when connections TIME OUT rather than being refused - and remember either end can block.',
        tags: ['networkpolicy', 'troubleshoot'],
      },
      {
        id: 'net-netpol-describe',
        command: 'kubectl describe networkpolicy <name>',
        description:
          'Rendered selectors and rules, including "Allowing ingress traffic: <none>" for a default deny.',
        placeholders: ['<name>'],
        tags: ['networkpolicy', 'describe'],
      },
      {
        id: 'net-ingress-describe',
        command: 'kubectl describe ingress <name> | grep -A6 Rules',
        description:
          'Backends with their endpoint lists in parentheses. `(<none>)` explains a 503; an empty ADDRESS means no controller.',
        placeholders: ['<name>'],
        tags: ['ingress', 'troubleshoot', '503'],
      },
      {
        id: 'net-ingress-class',
        command: 'kubectl get ingressclass',
        description:
          'Which Ingress controllers exist. Nothing here means an Ingress will never be routed.',
        tags: ['ingress', 'ingressclass', 'controller'],
      },
      {
        id: 'net-curl-host',
        command:
          'curl -sS -H "Host: <host>" http://<address>/<path> -o /dev/null -w "%{http_code}\\n"',
        description:
          'Tests host-based Ingress routing without DNS. 503 = no backend, 404 = no matching rule.',
        placeholders: ['<host>', '<address>', '<path>'],
        tags: ['curl', 'ingress', 'host-header'],
      },
      {
        id: 'net-coredns',
        command: 'kubectl get svc,endpoints -n kube-system kube-dns',
        description:
          'Cluster DNS health. Empty endpoints here means every lookup in the cluster fails.',
        tags: ['dns', 'coredns', 'kube-system'],
      },
    ],
  },
  {
    id: 'rbac',
    title: 'RBAC and ServiceAccounts',
    description: 'Four object types, and one command that verifies the result.',
    entries: [
      {
        id: 'rb-role',
        command: 'kubectl create role <name> --verb=get,list,watch --resource=pods',
        description: 'A namespaced Role. Resources are plural and lowercase.',
        placeholders: ['<name>'],
        tags: ['role', 'rbac', 'generator'],
      },
      {
        id: 'rb-role-subresource',
        command: 'kubectl create role <name> --verb=get --resource=pods/log',
        description:
          'Subresources need their own rule. kubectl logs needs pods/log; exec needs pods/exec.',
        placeholders: ['<name>'],
        tags: ['role', 'subresource', 'logs'],
      },
      {
        id: 'rb-role-group',
        command: 'kubectl create role <name> --verb=get,list,patch --resource=deployments.apps',
        description:
          'Use <resource>.<group> to disambiguate. Deployments are in the apps group, not the core group.',
        placeholders: ['<name>'],
        tags: ['role', 'apigroup', 'deployments'],
      },
      {
        id: 'rb-rolebinding-sa',
        command:
          'kubectl create rolebinding <name> --role=<role> --serviceaccount=<namespace>:<serviceaccount>',
        description: 'Binds a Role to a ServiceAccount. Note the <namespace>:<name> syntax.',
        placeholders: ['<name>', '<role>', '<namespace>', '<serviceaccount>'],
        tags: ['rolebinding', 'serviceaccount', 'rbac'],
      },
      {
        id: 'rb-rolebinding-clusterrole',
        command: 'kubectl create rolebinding <name> --clusterrole=<clusterrole> --group=<group>',
        description:
          'A RoleBinding referencing a ClusterRole: reusable permissions scoped to one namespace. The most common real-world pattern.',
        placeholders: ['<name>', '<clusterrole>', '<group>'],
        example: 'kubectl create rolebinding devs --clusterrole=admin --group=developers -n shop',
        tags: ['rolebinding', 'clusterrole', 'rbac'],
      },
      {
        id: 'rb-clusterrole',
        command: 'kubectl create clusterrole <name> --verb=get,list,watch --resource=nodes',
        description:
          'Cluster-scoped resources such as nodes require a ClusterRole - no Role can grant them.',
        placeholders: ['<name>'],
        tags: ['clusterrole', 'rbac', 'nodes'],
      },
      {
        id: 'rb-clusterrolebinding',
        command:
          'kubectl create clusterrolebinding <name> --clusterrole=<clusterrole> --serviceaccount=<namespace>:<serviceaccount>',
        description: 'Grants a ClusterRole cluster-wide. It cannot reference a Role.',
        placeholders: ['<name>', '<clusterrole>', '<namespace>', '<serviceaccount>'],
        tags: ['clusterrolebinding', 'rbac'],
      },
      {
        id: 'rb-can-i',
        command: 'kubectl auth can-i <verb> <resource>',
        description:
          'Tests your own permissions. Tests the authorization stage only, not admission.',
        placeholders: ['<verb>', '<resource>'],
        tags: ['auth', 'can-i', 'verify'],
      },
      {
        id: 'rb-can-i-as',
        command:
          'kubectl auth can-i <verb> <resource> --as=system:serviceaccount:<namespace>:<serviceaccount>',
        description:
          'THE RBAC verification command. The impersonation string is always system:serviceaccount:<ns>:<name>.',
        placeholders: ['<verb>', '<resource>', '<namespace>', '<serviceaccount>'],
        tags: ['auth', 'can-i', 'impersonate', 'verify'],
      },
      {
        id: 'rb-can-i-list',
        command:
          'kubectl auth can-i --list --as=system:serviceaccount:<namespace>:<serviceaccount>',
        description:
          'The complete permission set of an identity - the definitive answer to "what can this Pod do?".',
        placeholders: ['<namespace>', '<serviceaccount>'],
        tags: ['auth', 'can-i', 'audit'],
      },
      {
        id: 'rb-token',
        command: 'kubectl create token <serviceaccount> --duration=10m',
        description: 'Mints a short-lived token for testing, without creating a Secret.',
        placeholders: ['<serviceaccount>'],
        tags: ['token', 'serviceaccount'],
      },
      {
        id: 'rb-sa-audit',
        command:
          "kubectl get pods -A -o custom-columns='NS:.metadata.namespace,POD:.metadata.name,SA:.spec.serviceAccountName'",
        description:
          'The identity audit. Workloads still on the default ServiceAccount are the pattern to fix.',
        tags: ['serviceaccount', 'audit', 'security'],
      },
      {
        id: 'rb-token-path',
        command: 'kubectl exec <pod> -- ls /var/run/secrets/kubernetes.io/serviceaccount/',
        description:
          'The projected token, CA certificate and namespace. Absent when automountServiceAccountToken is false.',
        placeholders: ['<pod>'],
        tags: ['token', 'serviceaccount', 'verify'],
      },
    ],
  },
  {
    id: 'output',
    title: 'Output formats, JSONPath and verification',
    description:
      'These turn kubectl from a listing tool into a query tool. Most "write X to a file" tasks are one of these plus a redirect.',
    entries: [
      {
        id: 'out-wide',
        command: 'kubectl get pods -o wide',
        description: 'Adds IP, node, nominated node and readiness-gate columns.',
        tags: ['output', 'wide'],
      },
      {
        id: 'out-yaml',
        command: 'kubectl get <kind> <name> -o yaml',
        description:
          'The full stored object, including defaults Kubernetes filled in. Also the best template available.',
        placeholders: ['<kind>', '<name>'],
        tags: ['output', 'yaml', 'template'],
      },
      {
        id: 'out-jsonpath',
        command: 'kubectl get <kind> <name> -o jsonpath=\'{.spec.<field>}{"\\n"}\'',
        description:
          'Extracts one value. The trailing {"\\n"} adds the newline jsonpath otherwise omits.',
        placeholders: ['<kind>', '<name>', '<field>'],
        tags: ['jsonpath', 'output', 'extract'],
      },
      {
        id: 'out-jsonpath-range',
        command:
          'kubectl get pods -o jsonpath=\'{range .items[*]}{.metadata.name}{"\\t"}{.status.phase}{"\\n"}{end}\'',
        description: 'Iterates a list. {range}...{end} is the loop construct.',
        tags: ['jsonpath', 'range', 'loop'],
      },
      {
        id: 'out-jsonpath-filter',
        command:
          'kubectl get pod <name> -o jsonpath=\'{.status.conditions[?(@.type=="Ready")].status}{"\\n"}\'',
        description: 'Filter expression: selects the list element whose field matches.',
        placeholders: ['<name>'],
        tags: ['jsonpath', 'filter', 'conditions'],
      },
      {
        id: 'out-jsonpath-escape',
        command:
          'kubectl get pod <name> -o jsonpath=\'{.metadata.annotations.kubernetes\\.io/limit-ranger}{"\\n"}\'',
        description: 'Escape dots inside a key name with a backslash.',
        placeholders: ['<name>'],
        tags: ['jsonpath', 'annotations', 'escape'],
      },
      {
        id: 'out-custom-columns',
        command:
          "kubectl get pods -o custom-columns='POD:.metadata.name,NODE:.spec.nodeName,PHASE:.status.phase'",
        description:
          'Builds exactly the table a task asks for. Usually faster to write than a jsonpath range.',
        tags: ['custom-columns', 'output', 'table'],
      },
      {
        id: 'out-sort-by',
        command: 'kubectl get pods --sort-by=.metadata.creationTimestamp',
        description:
          'Sorts by any field path, ascending. For kubectl top use --sort-by=cpu or memory.',
        tags: ['sort-by', 'output'],
      },
      {
        id: 'out-field-selector',
        command: 'kubectl get pods --field-selector status.phase=Running',
        description:
          'Server-side filtering on a small set of indexed fields: status.phase, spec.nodeName, metadata.name, and event fields.',
        tags: ['field-selector', 'filter'],
      },
      {
        id: 'out-label-selector',
        command: 'kubectl get pods -l <key>=<value>',
        description:
          "Label selector. A comma means AND; use -l 'k in (a,b)' for OR, and -l '!k' for key-absent.",
        placeholders: ['<key>', '<value>'],
        tags: ['selector', 'labels', 'filter'],
      },
      {
        id: 'out-label-column',
        command: 'kubectl get pods -L <label>',
        description:
          'Adds one label as its own column - useful for canary track or version labels.',
        placeholders: ['<label>'],
        tags: ['labels', 'output'],
      },
      {
        id: 'out-watch',
        command: 'kubectl get pods -w',
        description:
          'Streams status changes live. Far better than re-running get during a rollout.',
        tags: ['watch', 'monitor'],
      },
      {
        id: 'out-to-file',
        command:
          "kubectl top pods --no-headers --sort-by=cpu | head -1 | awk '{print $1}' > /opt/answer.txt",
        description:
          'The shape of most "write the name of X to a file" tasks. Always cat the file afterwards to check.',
        tags: ['output', 'file', 'exam-task'],
      },
      {
        id: 'out-qos',
        command: 'kubectl get pod <name> -o jsonpath=\'{.status.qosClass}{"\\n"}\'',
        description:
          'Guaranteed requires requests == limits for CPU and memory on every container.',
        placeholders: ['<name>'],
        tags: ['qos', 'resources', 'verify'],
      },
      {
        id: 'out-exit-code',
        command:
          'kubectl get pod <name> -o jsonpath=\'{.status.containerStatuses[0].lastState.terminated.reason}{" "}{.status.containerStatuses[0].lastState.terminated.exitCode}{"\\n"}\'',
        description:
          'Separates an application failure (Error, 1) from an OOM kill (OOMKilled, 137). CrashLoopBackOff alone is not a diagnosis.',
        placeholders: ['<name>'],
        tags: ['exit-code', 'oomkilled', 'troubleshoot'],
      },
      {
        id: 'out-sweep',
        command: 'kubectl get pods -A | grep -vE "Running|Completed"',
        description: 'The one-line health sweep. Anything listed is worth thirty more seconds.',
        tags: ['verify', 'sweep', 'exam'],
      },
      {
        id: 'out-sweep-endpoints',
        command: 'kubectl get endpoints -A | grep "<none>"',
        description:
          'Every Service that routes nowhere. The check that most often finds a silent failure.',
        tags: ['verify', 'sweep', 'endpoints'],
      },
    ],
  },
  {
    id: 'helm-kustomize',
    title: 'Helm and Kustomize',
    description: 'The two named packaging tools in the curriculum.',
    entries: [
      {
        id: 'hk-repo-add',
        command: 'helm repo add <name> <url>',
        description: 'Registers a chart repository locally.',
        placeholders: ['<name>', '<url>'],
        tags: ['helm', 'repo'],
      },
      {
        id: 'hk-repo-update',
        command: 'helm repo update',
        description: 'Refreshes the local index. Run it before searching or installing.',
        tags: ['helm', 'repo'],
      },
      {
        id: 'hk-search',
        command: 'helm search repo <term> --versions',
        description: 'Lists matching charts and their available chart versions.',
        placeholders: ['<term>'],
        tags: ['helm', 'search'],
      },
      {
        id: 'hk-show-values',
        command: 'helm show values <chart> > values.yaml',
        description:
          'The chart defaults. Always read these before overriding - key names differ between chart versions.',
        placeholders: ['<chart>'],
        tags: ['helm', 'values'],
      },
      {
        id: 'hk-install',
        command: 'helm install <release> <chart> -n <namespace> --create-namespace',
        description: 'Installs a chart as a named release. Argument order is release then chart.',
        placeholders: ['<release>', '<chart>', '<namespace>'],
        tags: ['helm', 'install'],
      },
      {
        id: 'hk-upgrade-install',
        command: 'helm upgrade --install <release> <chart> -n <namespace> -f values.yaml',
        description: 'Installs if absent, upgrades if present - the idempotent form.',
        placeholders: ['<release>', '<chart>', '<namespace>'],
        tags: ['helm', 'upgrade', 'idempotent'],
      },
      {
        id: 'hk-set',
        command: 'helm install <release> <chart> --set <key>=<value>',
        description: 'Overrides one value. --set has higher precedence than any -f values file.',
        placeholders: ['<release>', '<chart>', '<key>', '<value>'],
        tags: ['helm', 'set', 'values'],
      },
      {
        id: 'hk-atomic',
        command: 'helm upgrade <release> <chart> -n <namespace> --atomic --timeout 5m',
        description:
          'Rolls the release back automatically if the upgrade fails. The single most valuable upgrade flag.',
        placeholders: ['<release>', '<chart>', '<namespace>'],
        tags: ['helm', 'atomic', 'upgrade'],
      },
      {
        id: 'hk-list',
        command: 'helm ls -A',
        description:
          'Every release in the cluster. The first thing to check on an unfamiliar cluster.',
        tags: ['helm', 'list'],
      },
      {
        id: 'hk-history',
        command: 'helm history <release> -n <namespace>',
        description: 'Every revision with its status - deployed, superseded or failed.',
        placeholders: ['<release>', '<namespace>'],
        tags: ['helm', 'history', 'revision'],
      },
      {
        id: 'hk-rollback',
        command: 'helm rollback <release> <revision> -n <namespace>',
        description:
          'Restores the whole release - every object at once, unlike kubectl rollout undo.',
        placeholders: ['<release>', '<revision>', '<namespace>'],
        tags: ['helm', 'rollback'],
      },
      {
        id: 'hk-get-values',
        command: 'helm get values <release> -n <namespace>',
        description:
          'The user-supplied values of the current revision. Add --all to include chart defaults.',
        placeholders: ['<release>', '<namespace>'],
        tags: ['helm', 'values', 'verify'],
      },
      {
        id: 'hk-get-manifest',
        command: 'helm get manifest <release> -n <namespace>',
        description: 'The rendered objects the release actually created.',
        placeholders: ['<release>', '<namespace>'],
        tags: ['helm', 'manifest', 'debug'],
      },
      {
        id: 'hk-template',
        command: 'helm template <release> <chart> -f values.yaml',
        description:
          'Renders locally without contacting the cluster - the Helm equivalent of a client dry run.',
        placeholders: ['<release>', '<chart>'],
        tags: ['helm', 'template', 'dry-run'],
      },
      {
        id: 'hk-uninstall',
        command: 'helm uninstall <release> -n <namespace>',
        description:
          'Removes the release and its objects. CRDs installed from crds/ are deliberately left behind.',
        placeholders: ['<release>', '<namespace>'],
        tags: ['helm', 'uninstall'],
      },
      {
        id: 'hk-kustomize-build',
        command: 'kubectl kustomize <dir>',
        description: 'Renders a Kustomize overlay to stdout. Always do this before applying.',
        placeholders: ['<dir>'],
        tags: ['kustomize', 'render'],
      },
      {
        id: 'hk-kustomize-apply',
        command: 'kubectl apply -k <dir>',
        description: 'Builds and applies in one step. Note it is -k, not -f.',
        placeholders: ['<dir>'],
        tags: ['kustomize', 'apply'],
      },
      {
        id: 'hk-kustomize-diff',
        command: 'kubectl diff -k <dir>',
        description: 'Shows what applying an overlay would change against the live cluster.',
        placeholders: ['<dir>'],
        tags: ['kustomize', 'diff'],
      },
      {
        id: 'hk-kustomize-delete',
        command: 'kubectl delete -k <dir>',
        description: 'Deletes exactly the objects the overlay describes.',
        placeholders: ['<dir>'],
        tags: ['kustomize', 'delete'],
      },
      {
        id: 'hk-kustomize-check',
        command: 'kubectl kustomize <dir> | grep -E "image:|replicas:|namespace:"',
        description:
          'A quick check that the images, replicas and namespace transformers did what you expected.',
        placeholders: ['<dir>'],
        tags: ['kustomize', 'verify', 'transformers'],
      },
    ],
  },
  {
    id: 'templates',
    title: 'YAML templates worth memorising',
    description:
      'The blocks that have no generator flag. Being able to type these from memory is the difference between three minutes and nine.',
    entries: [
      {
        id: 'tpl-probes',
        command: `readinessProbe:
  httpGet:
    path: /readyz
    port: 8080
  initialDelaySeconds: 3
  periodSeconds: 5
  timeoutSeconds: 2
  failureThreshold: 2
livenessProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 15
  timeoutSeconds: 3
  failureThreshold: 3
startupProbe:
  httpGet:
    path: /healthz
    port: 8080
  periodSeconds: 10
  failureThreshold: 30`,
        description:
          'All three probes. timeoutSeconds defaults to 1, which is usually too short. Startup budget = periodSeconds x failureThreshold.',
        tags: ['probes', 'template', 'yaml', 'readiness', 'liveness'],
      },
      {
        id: 'tpl-resources',
        command: `resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi`,
        description:
          'Requests are a scheduling reservation; limits are enforced. Memory always needs a Mi/Gi suffix.',
        tags: ['resources', 'template', 'yaml', 'requests', 'limits'],
      },
      {
        id: 'tpl-emptydir',
        command: `volumes:
  - name: scratch
    emptyDir:
      sizeLimit: 128Mi
containers:
  - name: app
    volumeMounts:
      - name: scratch
        mountPath: /tmp`,
        description: 'Pod-lifetime scratch space, and the basis of every sidecar hand-off.',
        tags: ['emptydir', 'volume', 'template', 'yaml'],
      },
      {
        id: 'tpl-configmap-volume',
        command: `volumes:
  - name: config
    configMap:
      name: app-config
containers:
  - name: app
    volumeMounts:
      - name: config
        mountPath: /etc/nginx/conf.d/default.conf
        subPath: nginx.conf
        readOnly: true`,
        description:
          'subPath projects a single file without hiding the rest of the directory. Trade-off: subPath mounts do not receive ConfigMap updates.',
        tags: ['configmap', 'volume', 'subpath', 'template'],
      },
      {
        id: 'tpl-secret-volume',
        command: `volumes:
  - name: creds
    secret:
      secretName: db-credentials
      defaultMode: 0400
      items:
        - key: password
          path: db-password
containers:
  - name: app
    volumeMounts:
      - name: creds
        mountPath: /etc/secrets
        readOnly: true`,
        description:
          'Secret volumes are tmpfs-backed. 0400 keeps a credential file owner-read-only.',
        tags: ['secret', 'volume', 'template', 'mode'],
      },
      {
        id: 'tpl-pvc',
        command: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 5Gi`,
        description:
          'There is no useful PVC generator - memorise these six lines. Omit storageClassName for the default class.',
        tags: ['pvc', 'storage', 'template', 'yaml'],
      },
      {
        id: 'tpl-securitycontext',
        command: `# POD level
securityContext:
  runAsNonRoot: true
  runAsUser: 10001
  runAsGroup: 10001
  fsGroup: 10001
  seccompProfile:
    type: RuntimeDefault
# CONTAINER level
containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true
      allowPrivilegeEscalation: false
      capabilities:
        drop: ["ALL"]`,
        description:
          'fsGroup/supplementalGroups/sysctls are Pod-level only; readOnlyRootFilesystem/capabilities/privileged are container-level only.',
        tags: ['securitycontext', 'template', 'hardening', 'capabilities'],
      },
      {
        id: 'tpl-env-refs',
        command: `env:
  - name: LOG_LEVEL
    valueFrom:
      configMapKeyRef:
        name: app-config
        key: LOG_LEVEL
  - name: DB_PASSWORD
    valueFrom:
      secretKeyRef:
        name: db-credentials
        key: password
  - name: POD_NAME
    valueFrom:
      fieldRef:
        fieldPath: metadata.name
  - name: MEM_LIMIT_MB
    valueFrom:
      resourceFieldRef:
        containerName: app
        resource: limits.memory
        divisor: 1Mi
envFrom:
  - configMapRef:
      name: app-config
    prefix: CFG_`,
        description:
          'The four valueFrom variants plus a prefixed bulk import. env overrides envFrom; only volume mounts update live.',
        tags: ['env', 'configmap', 'secret', 'downward-api', 'template'],
      },
      {
        id: 'tpl-init-sidecar',
        command: `initContainers:
  # A regular init container: runs to completion first
  - name: wait-for-db
    image: busybox:1.36
    command: ["sh", "-c", "until nc -z postgres 5432; do sleep 2; done"]
  # A NATIVE SIDECAR: starts first, runs alongside, stops last
  - name: log-shipper
    image: busybox:1.36
    restartPolicy: Always
    command: ["sh", "-c", "tail -F /logs/app.log"]
    volumeMounts:
      - name: logs
        mountPath: /logs`,
        description:
          'restartPolicy: Always on an initContainers entry makes it a native sidecar - required for a sidecar inside a Job.',
        tags: ['initcontainer', 'sidecar', 'template', 'native-sidecar'],
      },
      {
        id: 'tpl-netpol-deny',
        command: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress`,
        description: 'Namespace-wide default deny. Six lines, and worth memorising verbatim.',
        tags: ['networkpolicy', 'default-deny', 'template'],
      },
      {
        id: 'tpl-netpol-dns',
        command: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-dns
spec:
  podSelector: {}
  policyTypes:
    - Egress
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: kube-system
      ports:
        - protocol: UDP
          port: 53
        - protocol: TCP
          port: 53`,
        description:
          'Apply this WITH any default-deny egress policy, or every name lookup fails and applications report "host not found".',
        tags: ['networkpolicy', 'dns', 'egress', 'template'],
      },
      {
        id: 'tpl-netpol-allow',
        command: `spec:
  podSelector:
    matchLabels:
      app: api
  policyTypes: [Ingress]
  ingress:
    - from:
        # ONE list item, TWO selectors = AND
        - namespaceSelector:
            matchLabels:
              tier: frontend
          podSelector:
            matchLabels:
              app: web
      ports:
        - protocol: TCP
          port: 8080`,
        description:
          'One list item with two selectors is AND; two list items are OR. A single hyphen changes the meaning.',
        tags: ['networkpolicy', 'and-or', 'selector', 'template'],
      },
      {
        id: 'tpl-ingress',
        command: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: shop
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - shop.example.com
      secretName: shop-tls
  rules:
    - host: shop.example.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api
                port:
                  number: 80`,
        description:
          'pathType is required, the backend is nested, and ingressClassName replaces the old annotation. The TLS Secret must be type kubernetes.io/tls in the same namespace.',
        tags: ['ingress', 'template', 'pathtype', 'tls'],
      },
      {
        id: 'tpl-headless',
        command: `apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
    - port: 5432`,
        description:
          'Headless is clusterIP: None, not a type. DNS returns Pod IPs, and StatefulSets need it for per-Pod names.',
        tags: ['service', 'headless', 'statefulset', 'template'],
      },
      {
        id: 'tpl-apiversions',
        command: `v1                            Pod Service ConfigMap Secret PVC ServiceAccount
                              Namespace ResourceQuota LimitRange Endpoints
apps/v1                       Deployment ReplicaSet StatefulSet DaemonSet
batch/v1                      Job CronJob
networking.k8s.io/v1          Ingress IngressClass NetworkPolicy
rbac.authorization.k8s.io/v1  Role ClusterRole RoleBinding ClusterRoleBinding
autoscaling/v2                HorizontalPodAutoscaler
policy/v1                     PodDisruptionBudget
discovery.k8s.io/v1           EndpointSlice
apiextensions.k8s.io/v1       CustomResourceDefinition
storage.k8s.io/v1             StorageClass`,
        description: 'The apiVersion map. When in doubt: kubectl api-resources | grep -i <kind>.',
        tags: ['apiversion', 'reference', 'template'],
      },
    ],
  },
]
