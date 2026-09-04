import type { Topic } from '../../../types'

export const securitycontext: Topic = {
  id: 'securitycontext',
  title: 'SecurityContext and Linux capabilities',
  domainId: 'environment-security',
  difficulty: 'intermediate',
  estimatedMinutes: 26,
  order: 7,
  tags: [
    'securityContext',
    'runAsUser',
    'runAsNonRoot',
    'readOnlyRootFilesystem',
    'capabilities',
    'privileged',
    'fsGroup',
    'seccomp',
  ],
  oneLiner:
    'Which user a container runs as, what it may write, and which kernel privileges it holds - plus the Pod-level and container-level split that decides where each field goes.',
  explanation: [
    'A **securityContext** constrains what a container can do. It exists at two levels: on the **Pod** (applies to every container, and only some fields are available) and on each **container** (applies to that container, and overrides the Pod-level value).',
    'Pod-level only: `fsGroup` (group ownership of mounted volumes), `fsGroupChangePolicy`, `supplementalGroups`, `sysctls`. Container-level only: `readOnlyRootFilesystem`, `capabilities`, `privileged`, `allowPrivilegeEscalation`. Available at both: `runAsUser`, `runAsGroup`, `runAsNonRoot`, `seccompProfile`, `seLinuxOptions`.',
    "The three fields you will use most: `runAsNonRoot: true` (refuse to start if the image would run as UID 0), `runAsUser: <uid>` (run as that UID regardless of the image's USER), and `readOnlyRootFilesystem: true` (make the container filesystem immutable, so an attacker cannot modify binaries or drop files).",
    '**Linux capabilities** split root\'s power into ~40 discrete privileges. Containers start with a reduced default set; `capabilities.drop: ["ALL"]` removes them all, and `capabilities.add: ["NET_BIND_SERVICE"]` adds back only what is needed. Note the names are written without the `CAP_` prefix.',
    "`privileged: true` is the opposite of all of this: it disables essentially every isolation mechanism, giving the container the host's device access and full capabilities. It is almost never correct for an application, and it is the single field a security review will object to.",
  ],
  whyItMatters: [
    '"Understand Application Security (SecurityContexts, Capabilities, etc.)" is a named curriculum competency, and it produces very concrete tasks: "run this container as user 1000", "make the root filesystem read-only", "add only the NET_BIND_SERVICE capability".',
    'The Pod-versus-container field split is directly tested, because putting `readOnlyRootFilesystem` at Pod level is a validation error and putting `fsGroup` at container level is too.',
    '`readOnlyRootFilesystem: true` almost always breaks an application until you add `emptyDir` mounts for its writable paths - the connection between this topic and volumes is a favourite exam combination.',
  ],
  howItWorks: [
    'Precedence: container-level settings override Pod-level ones for the fields that exist at both levels. A Pod-level `runAsUser: 1000` with a container-level `runAsUser: 2000` gives that container UID 2000.',
    '`runAsNonRoot: true` is a *check*, not a change. If the effective UID would be 0 (from the image `USER` or from `runAsUser: 0`), the kubelet refuses to start the container with `CreateContainerConfigError: container has runAsNonRoot and image will run as root`. Pair it with `runAsUser` or a numeric `USER` in the image.',
    '`allowPrivilegeEscalation: false` sets the `no_new_privs` process flag, so a child process cannot gain privileges through setuid binaries or file capabilities. It defaults to true, and is implicitly true when `privileged: true`.',
    "`fsGroup` sets the group ownership of volume contents and adds that GID to the container's supplementary groups, which is how a non-root user gets write access to a PersistentVolume. `fsGroupChangePolicy: OnRootMismatch` skips the recursive chown when ownership already looks right, which matters for large volumes.",
    'Capability names drop the `CAP_` prefix: use `NET_BIND_SERVICE`, `NET_ADMIN`, `SYS_TIME`, `CHOWN`, `SETUID`. The idiomatic hardening pattern is `drop: ["ALL"]` followed by an `add` list of exactly what is required.',
    '`NET_BIND_SERVICE` is the common one: it allows binding to ports below 1024. Without it a non-root process cannot listen on port 80 - which is why hardened images listen on 8080 instead.',
    "`seccompProfile.type: RuntimeDefault` applies the container runtime's default syscall filter, blocking dozens of rarely-needed syscalls. It is a one-line, low-risk hardening step and is required by the `restricted` Pod Security Standard.",
    'Pod Security Admission enforces these settings at the namespace level via labels (`pod-security.kubernetes.io/enforce: restricted`), rejecting Pods that do not comply. That is the modern replacement for PodSecurityPolicy.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'Pod-level versus container-level securityContext',
      caption:
        'The container setting always wins. fsGroup is the exception - it only exists at Pod level.',
      root: {
        label: 'Pod spec',
        children: [
          {
            label: 'spec.securityContext',
            detail: 'Defaults for every container in the Pod',
            tone: 'accent',
            children: [
              { label: 'runAsUser: 1000', detail: 'Inherited unless overridden' },
              { label: 'runAsNonRoot: true', detail: 'Refuses to start as uid 0' },
              {
                label: 'fsGroup: 2000',
                detail: 'Pod level ONLY - sets group on mounted volumes',
                tone: 'success',
              },
            ],
          },
          {
            label: 'containers[0].securityContext',
            detail: 'Overrides the Pod values for this container',
            children: [
              {
                label: 'runAsUser: 2000',
                detail: 'Wins over the Pod value of 1000',
                tone: 'warning',
              },
              {
                label: 'allowPrivilegeEscalation: false',
                detail: 'Container level ONLY',
              },
              {
                label: 'readOnlyRootFilesystem: true',
                detail: 'Container level ONLY - add an emptyDir for temp files',
              },
              { label: 'capabilities: add / drop', detail: 'Container level ONLY' },
            ],
          },
        ],
      },
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Pod-level security context, applied to every container.',
      fields: [
        { path: 'spec.securityContext.runAsUser', meaning: 'Default UID for all containers.' },
        {
          path: 'spec.securityContext.runAsGroup',
          meaning: 'Default primary GID for all containers.',
        },
        {
          path: 'spec.securityContext.runAsNonRoot',
          meaning: 'true refuses to start any container that would run as UID 0.',
        },
        {
          path: 'spec.securityContext.fsGroup',
          meaning: 'POD LEVEL ONLY. Group ownership applied to mounted volumes.',
        },
        {
          path: 'spec.securityContext.fsGroupChangePolicy',
          meaning: 'Always (default) or OnRootMismatch, which skips redundant recursive chowns.',
        },
        {
          path: 'spec.securityContext.supplementalGroups',
          meaning: 'POD LEVEL ONLY. Extra GIDs added to every container.',
        },
        {
          path: 'spec.securityContext.seccompProfile.type',
          meaning: 'RuntimeDefault, Localhost or Unconfined.',
        },
        {
          path: 'spec.securityContext.sysctls[]',
          meaning: 'POD LEVEL ONLY. Namespaced kernel parameters.',
        },
      ],
    },
    {
      kind: 'Container',
      apiVersion: 'v1',
      purpose: 'Container-level security context; overrides Pod-level fields and adds its own.',
      fields: [
        {
          path: 'spec.containers[].securityContext.readOnlyRootFilesystem',
          meaning: 'CONTAINER LEVEL ONLY. Mounts the root filesystem read-only.',
        },
        {
          path: 'spec.containers[].securityContext.capabilities.drop[]',
          meaning: 'CONTAINER LEVEL ONLY. Use ["ALL"] then add back what is needed.',
        },
        {
          path: 'spec.containers[].securityContext.capabilities.add[]',
          meaning: 'CONTAINER LEVEL ONLY. Names without the CAP_ prefix.',
        },
        {
          path: 'spec.containers[].securityContext.privileged',
          meaning: 'CONTAINER LEVEL ONLY. true disables isolation. Avoid.',
        },
        {
          path: 'spec.containers[].securityContext.allowPrivilegeEscalation',
          meaning: 'CONTAINER LEVEL ONLY. false sets no_new_privs.',
        },
        {
          path: 'spec.containers[].securityContext.runAsUser',
          meaning: 'Overrides the Pod-level UID for this container.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Hardening one Deployment, and the three things that broke',
    story: [
      'A security review required every container to satisfy the `restricted` Pod Security Standard: non-root, no privilege escalation, all capabilities dropped, read-only root filesystem, and the runtime default seccomp profile.',
      'The first attempt failed immediately: `container has runAsNonRoot and image will run as root`. The nginx image runs as root by default, so `runAsUser: 101` (the nginx user in that image) was needed alongside `runAsNonRoot`.',
      'The second attempt started and then crashed: nginx could not write its PID file or its cache. Three `emptyDir` volumes at `/var/cache/nginx`, `/var/run` and `/tmp` fixed that, leaving the rest of the filesystem read-only.',
      'The third attempt started but bound nothing: as a non-root user it could not listen on port 80. They changed the config to listen on 8080 and pointed the Service `targetPort` at it, rather than granting `NET_BIND_SERVICE` - fewer privileges is better than more.',
      'The final spec is longer, but nothing in it is optional: each field exists because removing it either breaks the app or fails the standard. This is what a hardening task looks like in practice, and the exam version is a smaller variant of it.',
    ],
    code: [
      {
        title: 'The three failures, in order',
        language: 'bash',
        code: `# 1. runAsNonRoot with a root image
kubectl describe pod web-xxxxx -n shop | grep -i runasnonroot
# Error: container has runAsNonRoot and image will run as root
#   -> add runAsUser: 101

# 2. read-only root filesystem
kubectl logs web-xxxxx -n shop --previous
# nginx: [emerg] open() "/var/run/nginx.pid" failed (30: Read-only file system)
#   -> add emptyDir mounts at /var/run, /var/cache/nginx, /tmp

# 3. non-root cannot bind a privileged port
kubectl logs web-xxxxx -n shop --previous
# nginx: [emerg] bind() to 0.0.0.0:80 failed (13: Permission denied)
#   -> listen on 8080 (preferred), or add capability NET_BIND_SERVICE`,
        explanation:
          'Each error names the exact obstacle. Hardening is iterative: apply, read the failure, add the minimum that fixes it.',
        placeholders: ['web-xxxxx', 'shop'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A fully hardened Deployment',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: shop
spec:
  replicas: 2
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      # ---- POD LEVEL: applies to every container ----
      securityContext:
        runAsNonRoot: true # refuse to start as UID 0
        runAsUser: 101 # the nginx user in nginx:alpine
        runAsGroup: 101
        fsGroup: 101 # POD LEVEL ONLY - volume group ownership
        fsGroupChangePolicy: OnRootMismatch
        seccompProfile:
          type: RuntimeDefault # required by the restricted standard
      volumes:
        # Every path the application writes to needs a writable volume,
        # because the root filesystem is read-only below.
        - name: cache
          emptyDir:
            sizeLimit: 128Mi
        - name: run
          emptyDir:
            medium: Memory
            sizeLimit: 8Mi
        - name: tmp
          emptyDir:
            sizeLimit: 64Mi
        - name: conf
          configMap:
            name: nginx-8080
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - name: http
              containerPort: 8080 # NOT 80 - a non-root process cannot bind <1024
          # ---- CONTAINER LEVEL ----
          securityContext:
            readOnlyRootFilesystem: true # CONTAINER LEVEL ONLY
            allowPrivilegeEscalation: false # CONTAINER LEVEL ONLY
            privileged: false
            capabilities: # CONTAINER LEVEL ONLY
              drop: ["ALL"] # start from nothing
              # add: ["NET_BIND_SERVICE"]   # only if you must bind <1024
          volumeMounts:
            - name: cache
              mountPath: /var/cache/nginx
            - name: run
              mountPath: /var/run
            - name: tmp
              mountPath: /tmp
            - name: conf
              mountPath: /etc/nginx/conf.d
              readOnly: true
          resources:
            requests:
              cpu: 50m
              memory: 64Mi
            limits:
              cpu: 500m
              memory: 256Mi`,
      explanation:
        'This satisfies the `restricted` Pod Security Standard. The four emptyDir volumes are not optional decoration - without them the read-only root filesystem stops nginx from starting.',
      placeholders: ['web', 'shop', 'nginx-8080'],
    },
    {
      title: 'Pod-level versus container-level precedence',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: precedence-demo
  namespace: shop
spec:
  securityContext:
    runAsUser: 1000 # Pod default
    runAsNonRoot: true
    fsGroup: 2000 # only valid here, not on a container
  containers:
    - name: uses-pod-default
      image: busybox:1.36
      command: ["sh", "-c", "id; sleep 3600"]
      # no container securityContext -> runs as UID 1000

    - name: overrides-it
      image: busybox:1.36
      command: ["sh", "-c", "id; sleep 3600"]
      securityContext:
        runAsUser: 3000 # CONTAINER wins -> runs as UID 3000
        readOnlyRootFilesystem: true # only valid here, not at Pod level
        capabilities:
          drop: ["ALL"]`,
      explanation:
        'Two containers in one Pod running as different users. `kubectl exec <pod> -c <container> -- id` proves it.',
      placeholders: ['precedence-demo', 'shop'],
    },
    {
      title: 'Capabilities: dropping all, adding one back',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: caps-demo
  namespace: shop
spec:
  containers:
    # Needs to bind port 80 as a non-root user
    - name: privileged-port
      image: nginx:1.27-alpine
      securityContext:
        runAsUser: 101
        runAsNonRoot: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"] # remove the default set
          add: ["NET_BIND_SERVICE"] # note: NO "CAP_" prefix
      ports:
        - containerPort: 80

    # Needs nothing at all - the target state for most applications
    - name: nothing-special
      image: busybox:1.36
      command: ["sleep", "3600"]
      securityContext:
        runAsUser: 10001
        runAsNonRoot: true
        readOnlyRootFilesystem: true
        allowPrivilegeEscalation: false
        capabilities:
          drop: ["ALL"]`,
      explanation:
        'Capability names are written without `CAP_`. Writing `CAP_NET_BIND_SERVICE` is accepted by the API but does not match the real capability, so it silently does nothing.',
      placeholders: ['caps-demo', 'shop'],
    },
    {
      title: 'fsGroup: how a non-root user writes to a volume',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: volume-writer
  namespace: shop
spec:
  securityContext:
    runAsUser: 10001
    runAsGroup: 10001
    runAsNonRoot: true
    # Volume contents are chowned to this GID and it is added as a
    # supplementary group, so the non-root process can write.
    fsGroup: 10001
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: app-data
  containers:
    - name: app
      image: busybox:1.36
      command: ["sh", "-c", "touch /data/proof && ls -ln /data && sleep 3600"]
      volumeMounts:
        - name: data
          mountPath: /data`,
      explanation:
        'Without `fsGroup`, a freshly provisioned volume is usually owned by root and a non-root container gets "Permission denied" on its first write. This is the single most common cause of that error.',
      placeholders: ['volume-writer', 'shop', 'app-data'],
    },
    {
      title: 'Pod Security Admission at the namespace level',
      language: 'yaml',
      code: `apiVersion: v1
kind: Namespace
metadata:
  name: shop
  labels:
    # enforce: reject non-compliant Pods
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    # audit/warn: allow but record or warn, useful while migrating
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted`,
      explanation:
        'The three levels are `privileged` (no restrictions), `baseline` (blocks known privilege escalations) and `restricted` (requires non-root, dropped capabilities, no privilege escalation and a seccomp profile). This replaced PodSecurityPolicy, which was removed.',
      placeholders: ['shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl exec caps-demo -n shop -c nothing-special -- id',
      what: 'The definitive check on which user a container is running as.',
      expected: 'uid=10001 gid=10001',
      placeholders: ['caps-demo', 'shop'],
    },
    {
      command: 'kubectl get pod caps-demo -n shop -o jsonpath=\'{.spec.securityContext}{"\\n"}\'',
      what: 'Reads the Pod-level security context as stored.',
      expected: '{"fsGroup":2000,"runAsNonRoot":true,"runAsUser":1000}',
      placeholders: ['caps-demo', 'shop'],
    },
    {
      command:
        'kubectl get pod caps-demo -n shop -o jsonpath=\'{range .spec.containers[*]}{.name}{": "}{.securityContext}{"\\n"}{end}\'',
      what: 'Container-level contexts, one per line - the fastest audit of a multi-container Pod.',
      expected: 'One line per container with its settings.',
      placeholders: ['caps-demo', 'shop'],
    },
    {
      command: 'kubectl exec caps-demo -n shop -- sh -c "touch /test-write" ',
      what: 'Proves `readOnlyRootFilesystem` is in effect.',
      expected: 'touch: /test-write: Read-only file system',
      placeholders: ['caps-demo', 'shop'],
    },
    {
      command: 'kubectl exec caps-demo -n shop -- grep Cap /proc/1/status',
      what: 'The actual capability bitmasks of PID 1 - the ground truth for capability settings.',
      expected: 'CapPrm and CapEff of 0000000000000000 after drop: ["ALL"].',
      placeholders: ['caps-demo', 'shop'],
    },
    {
      command: 'kubectl label namespace shop pod-security.kubernetes.io/enforce=restricted',
      what: 'Turns on Pod Security Admission enforcement for a namespace.',
      expected: 'namespace/shop labeled',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl label namespace shop pod-security.kubernetes.io/warn=restricted',
      what: 'Warn-only mode, which reports violations without blocking - the safe way to migrate.',
      expected: 'namespace/shop labeled',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl exec volume-writer -n shop -- ls -ln /data',
      what: 'Shows numeric owner and group of volume contents, confirming `fsGroup` took effect.',
      expected: 'Files owned by group 10001.',
      placeholders: ['volume-writer', 'shop'],
    },
    {
      command: 'kubectl explain pod.spec.securityContext --recursive',
      what: 'The authoritative list of Pod-level fields - use it to check whether a field belongs here or on the container.',
      expected:
        'fsGroup, fsGroupChangePolicy, runAsGroup, runAsNonRoot, runAsUser, seLinuxOptions, seccompProfile, supplementalGroups, sysctls.',
    },
    {
      command: 'kubectl explain pod.spec.containers.securityContext --recursive',
      what: 'The container-level field list, which includes capabilities, privileged and readOnlyRootFilesystem.',
      expected:
        'allowPrivilegeEscalation, capabilities, privileged, procMount, readOnlyRootFilesystem, runAsGroup, runAsNonRoot, runAsUser, ...',
    },
  ],
  declarative: {
    steps: [
      'Start from the hardened baseline: `runAsNonRoot: true`, an explicit `runAsUser`, `allowPrivilegeEscalation: false`, `capabilities.drop: ["ALL"]`, `readOnlyRootFilesystem: true`, `seccompProfile.type: RuntimeDefault`.',
      'Apply it, read the failure, and add back the minimum needed: an `emptyDir` for each writable path, a capability only if unavoidable.',
      'Prefer changing the application (listen on 8080) over granting a capability (NET_BIND_SERVICE).',
      'Add `fsGroup` whenever a non-root container must write to a mounted volume.',
      'Put `fsGroup`/`supplementalGroups`/`sysctls` at Pod level and `readOnlyRootFilesystem`/`capabilities`/`privileged` at container level - the other way round is a validation error.',
      'Verify with `kubectl exec -- id`, a write attempt, and `grep Cap /proc/1/status`.',
    ],
    code: [
      {
        title: 'Harden an existing Deployment iteratively',
        language: 'bash',
        code: `kubectl get deploy web -n shop -o yaml > web.yaml    # back it up first

# Add the hardened securityContext blocks to web.yaml, then:
kubectl apply -f web.yaml
kubectl rollout status deploy/web -n shop --timeout=120s || {
  # Read the failure and add the missing piece
  kubectl describe pod -l app=web -n shop | grep -iA3 "error\\|runasnonroot"
  kubectl logs -l app=web -n shop --previous --tail=20
}

# Verify once it is Running
POD=$(kubectl get pods -n shop -l app=web -o jsonpath='{.items[0].metadata.name}')
kubectl exec "$POD" -n shop -- id
kubectl exec "$POD" -n shop -- sh -c 'touch /nope' || echo "root fs is read-only"
kubectl exec "$POD" -n shop -- grep CapEff /proc/1/status`,
        placeholders: ['web', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl exec web-xxxxx -n shop -- id',
      what: 'Confirms the effective UID and GID.',
      expected: 'uid=101 gid=101 groups=101',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command: 'kubectl exec web-xxxxx -n shop -- sh -c "touch /root-test 2>&1 || true"',
      what: 'Confirms the root filesystem is read-only.',
      expected: 'Read-only file system',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command: 'kubectl exec web-xxxxx -n shop -- sh -c "touch /tmp/ok && echo writable"',
      what: 'Confirms the emptyDir mounts are still writable, which is the point of adding them.',
      expected: 'writable',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command: 'kubectl exec web-xxxxx -n shop -- grep -E "CapPrm|CapEff" /proc/1/status',
      what: 'All-zero bitmasks confirm every capability was dropped.',
      expected: 'CapPrm: 0000000000000000 and CapEff: 0000000000000000.',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command:
        'kubectl get pod web-xxxxx -n shop -o jsonpath=\'{.spec.containers[0].securityContext.readOnlyRootFilesystem}{"\\n"}\'',
      what: 'Reads the setting back from the object.',
      expected: 'true',
      placeholders: ['web-xxxxx', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod web-xxxxx -n shop | grep -i runasnonroot',
      what: 'The `runAsNonRoot` rejection - the image would run as root and no `runAsUser` was given.',
      expected: 'Error: container has runAsNonRoot and image will run as root',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command: 'kubectl logs web-xxxxx -n shop --previous | grep -i "read-only"',
      what: 'A read-only root filesystem breaking the application; the message names the path that needs an emptyDir.',
      expected: 'open() "/var/run/nginx.pid" failed (30: Read-only file system)',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command: 'kubectl logs web-xxxxx -n shop --previous | grep -i "permission denied"',
      what: 'Either a missing capability (binding a low port) or a volume ownership problem (missing fsGroup).',
      expected: 'bind() to 0.0.0.0:80 failed (13: Permission denied)',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command: 'kubectl exec web-xxxxx -n shop -- ls -ln /data',
      what: 'Volume contents owned by root while the process runs as 10001 means `fsGroup` is missing.',
      expected: 'Group ownership matching your fsGroup.',
      placeholders: ['web-xxxxx', 'shop'],
    },
    {
      command: 'kubectl apply -f pod.yaml',
      what: 'A misplaced field fails validation here, naming the level it does not belong to.',
      expected: 'unknown field "spec.securityContext.readOnlyRootFilesystem"',
      placeholders: ['pod.yaml'],
    },
    {
      command: 'kubectl apply -f pod.yaml 2>&1 | grep -i "violate"',
      what: 'Pod Security Admission rejection, which lists every rule the Pod breaks.',
      expected:
        'violates PodSecurity "restricted:latest": allowPrivilegeEscalation != false, unrestricted capabilities, runAsNonRoot != true, seccompProfile',
      placeholders: ['pod.yaml'],
    },
  ],
  commonMistakes: [
    'Putting `readOnlyRootFilesystem`, `capabilities` or `privileged` at Pod level. They are container-level only.',
    'Putting `fsGroup`, `supplementalGroups` or `sysctls` at container level. They are Pod-level only.',
    'Setting `runAsNonRoot: true` without `runAsUser`, on an image whose USER is root - the container never starts.',
    'Setting `readOnlyRootFilesystem: true` without emptyDir mounts for the paths the application writes to.',
    'Writing capability names with the `CAP_` prefix. Use `NET_BIND_SERVICE`, not `CAP_NET_BIND_SERVICE`.',
    'Adding capabilities without dropping ALL first, so the container keeps the whole default set plus your addition.',
    'Using `privileged: true` to make something work instead of finding which specific capability is needed.',
    'Forgetting `fsGroup` and then debugging "permission denied" on a volume as though it were an application bug.',
    'Expecting `runAsUser` to create a matching entry in `/etc/passwd`. It does not - some applications complain about an unknown UID.',
  ],
  examTips: [
    'Memorise the level split: `fsGroup` is Pod-only; `readOnlyRootFilesystem`, `capabilities` and `privileged` are container-only; `runAsUser`/`runAsNonRoot` work at both.',
    '`kubectl explain pod.spec.securityContext` and `kubectl explain pod.spec.containers.securityContext` settle any doubt in seconds.',
    '"Run as user 1000" → `runAsUser: 1000`. "Must not run as root" → `runAsNonRoot: true` plus a `runAsUser`.',
    '"Add capability X" → `capabilities: {add: ["X"]}` with no CAP_ prefix. Best practice is `drop: ["ALL"]` first.',
    '"Read-only root filesystem" → expect to add `emptyDir` mounts; the task usually implies it even when it does not say so.',
    'Verify with `kubectl exec <pod> -- id` and a write attempt. Those are the checks a grader effectively performs.',
  ],
  summary: [
    'Two levels: Pod (all containers) and container (overrides Pod), with different available fields.',
    'Pod-only: fsGroup, supplementalGroups, sysctls. Container-only: readOnlyRootFilesystem, capabilities, privileged, allowPrivilegeEscalation.',
    '`runAsNonRoot: true` is a check that refuses to start a root container - pair it with `runAsUser`.',
    'Capabilities: `drop: ["ALL"]` then add back the minimum, with no CAP_ prefix.',
    '`readOnlyRootFilesystem: true` needs emptyDir mounts for every writable path; `fsGroup` is what lets a non-root user write to a volume.',
    'Pod Security Admission enforces all of this per namespace via labels.',
  ],
  practice: [
    {
      id: 'sc-p1',
      level: 'beginner',
      prompt:
        'Which of `fsGroup` and `readOnlyRootFilesystem` goes at Pod level, and which at container level?',
      answer:
        '`fsGroup` is Pod level only (`spec.securityContext.fsGroup`). `readOnlyRootFilesystem` is container level only (`spec.containers[].securityContext.readOnlyRootFilesystem`). Swapping them produces an "unknown field" validation error.',
      explanation:
        "The logic: `fsGroup` affects volumes, which belong to the Pod; `readOnlyRootFilesystem` affects a container's own filesystem. `kubectl explain` confirms either in two seconds.",
    },
    {
      id: 'sc-p2',
      level: 'intermediate',
      prompt:
        'A container fails with `container has runAsNonRoot and image will run as root`. Give two ways to fix it and say which is better.',
      answer:
        '1. Add `runAsUser: <non-zero UID>` to the securityContext, overriding the image.\n2. Rebuild the image with a numeric `USER 10001` instruction.\n\nOption 2 is better long term - the image is then safe by default wherever it runs - but option 1 is the correct answer under exam conditions and requires no rebuild.',
      explanation:
        'Use a numeric UID rather than a username in the Dockerfile, because `runAsNonRoot` is evaluated against the numeric UID and a name that does not resolve is treated as root.',
    },
    {
      id: 'sc-p3',
      level: 'advanced',
      prompt:
        'Write the container securityContext for a process that must bind port 80, run as UID 101, hold no other privileges, and have an immutable filesystem.',
      answer:
        'securityContext:\n  runAsUser: 101\n  runAsNonRoot: true\n  allowPrivilegeEscalation: false\n  readOnlyRootFilesystem: true\n  capabilities:\n    drop: ["ALL"]\n    add: ["NET_BIND_SERVICE"]\n\nPlus emptyDir volumes for every path the process writes to, and `fsGroup` at Pod level if it writes to a mounted volume.',
      explanation:
        '`NET_BIND_SERVICE` is the only capability that allows binding below port 1024. The better design is to listen on 8080 and drop the capability entirely - the Service `targetPort` hides the difference from callers.',
    },
  ],
  lab: {
    title: 'Harden a Deployment until it passes the restricted standard',
    scenario:
      'You will start from an unhardened nginx Deployment and add security settings one at a time, reading each failure, until it satisfies `restricted` Pod Security Admission and still serves traffic.',
    prerequisites: ['A cluster on Kubernetes 1.25 or later (Pod Security Admission is stable)'],
    tasks: [
      {
        instruction:
          'Create namespace `sc-lab` with `pod-security.kubernetes.io/warn=restricted` and set it as default.',
      },
      {
        instruction:
          'Create a plain nginx Deployment and note the PodSecurity warning listing every violation.',
      },
      {
        instruction: 'Add `runAsNonRoot: true` only, and observe the container refusing to start.',
      },
      { instruction: 'Add `runAsUser: 101` and confirm it starts; verify with `id`.' },
      { instruction: 'Add `readOnlyRootFilesystem: true` and read the write failure in the logs.' },
      {
        instruction:
          'Add emptyDir mounts for /var/cache/nginx, /var/run and /tmp, plus a ConfigMap listening on 8080; confirm it serves.',
      },
      {
        instruction:
          'Add `capabilities.drop: ["ALL"]`, `allowPrivilegeEscalation: false` and `seccompProfile: RuntimeDefault`; confirm no capabilities remain.',
      },
      {
        instruction:
          'Switch the namespace label to `enforce=restricted` and confirm the hardened Deployment is still accepted while a plain Pod is rejected.',
      },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-2 - see the violations',
        language: 'bash',
        code: `kubectl create namespace sc-lab
kubectl label namespace sc-lab pod-security.kubernetes.io/warn=restricted
kubectl config set-context --current --namespace=sc-lab

kubectl create deployment web --image=nginx:1.27-alpine
# Warning: would violate PodSecurity "restricted:latest":
#   allowPrivilegeEscalation != false (container "nginx" must set
#   securityContext.allowPrivilegeEscalation=false),
#   unrestricted capabilities (must set capabilities.drop=["ALL"]),
#   runAsNonRoot != true, seccompProfile (must set RuntimeDefault or Localhost)
kubectl rollout status deploy/web --timeout=120s

kubectl exec deploy/web -- id
# uid=0(root) gid=0(root)      <- running as root`,
      },
      {
        title: 'Steps 3-4 - non-root, the hard way then the right way',
        language: 'bash',
        code: `# runAsNonRoot alone: the image would run as root, so it refuses to start
kubectl patch deploy web -p '{"spec":{"template":{"spec":{"securityContext":{"runAsNonRoot":true}}}}}'
sleep 15
kubectl get pods -l app=web
# web-...   0/1   CreateContainerConfigError   0   15s
kubectl describe pod -l app=web | grep -i runasnonroot
# Error: container has runAsNonRoot and image will run as root

# Add the UID so there is a non-root user to run as
kubectl patch deploy web -p '{"spec":{"template":{"spec":{"securityContext":{"runAsNonRoot":true,"runAsUser":101,"runAsGroup":101,"fsGroup":101}}}}}'
kubectl rollout status deploy/web --timeout=120s
kubectl exec deploy/web -- id
# uid=101(nginx) gid=101(nginx) groups=101(nginx)`,
      },
      {
        title: 'Step 5 - read-only root filesystem breaks it',
        language: 'bash',
        code: `kubectl patch deploy web --type=json -p='[{"op":"add",
  "path":"/spec/template/spec/containers/0/securityContext",
  "value":{"readOnlyRootFilesystem":true}}]'
sleep 20

kubectl get pods -l app=web
# web-...   0/1   CrashLoopBackOff   2   20s

kubectl logs -l app=web --previous --tail=5
# nginx: [emerg] mkdir() "/var/cache/nginx/client_temp" failed
#        (30: Read-only file system)`,
      },
      {
        title: 'Step 6 - the full hardened manifest',
        language: 'yaml',
        code: `# web-hardened.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-8080
  namespace: sc-lab
data:
  default.conf: |
    server {
      listen 8080;
      location / { return 200 'hardened\\n'; add_header Content-Type text/plain; }
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web
  namespace: sc-lab
spec:
  replicas: 1
  selector:
    matchLabels:
      app: web
  template:
    metadata:
      labels:
        app: web
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 101
        runAsGroup: 101
        fsGroup: 101
        seccompProfile:
          type: RuntimeDefault
      volumes:
        - name: cache
          emptyDir: {sizeLimit: 64Mi}
        - name: run
          emptyDir: {medium: Memory, sizeLimit: 8Mi}
        - name: tmp
          emptyDir: {sizeLimit: 32Mi}
        - name: conf
          configMap: {name: nginx-8080}
      containers:
        - name: nginx
          image: nginx:1.27-alpine
          ports:
            - containerPort: 8080
          securityContext:
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
          volumeMounts:
            - {name: cache, mountPath: /var/cache/nginx}
            - {name: run, mountPath: /var/run}
            - {name: tmp, mountPath: /tmp}
            - {name: conf, mountPath: /etc/nginx/conf.d, readOnly: true}
          resources:
            requests: {cpu: 50m, memory: 64Mi}
            limits: {cpu: 200m, memory: 128Mi}`,
      },
      {
        title: 'Steps 6b-7 - apply and verify every setting',
        language: 'bash',
        code: `kubectl apply -f web-hardened.yaml
kubectl rollout status deploy/web --timeout=120s
# No PodSecurity warning this time.

POD=$(kubectl get pods -l app=web -o jsonpath='{.items[0].metadata.name}')

kubectl exec "$POD" -- id
# uid=101(nginx) gid=101(nginx) groups=101(nginx)

kubectl exec "$POD" -- sh -c 'touch /nope 2>&1 || true'
# touch: /nope: Read-only file system

kubectl exec "$POD" -- sh -c 'touch /tmp/ok && echo "tmp writable"'
# tmp writable

kubectl exec "$POD" -- grep -E 'CapPrm|CapEff' /proc/1/status
# CapPrm: 0000000000000000
# CapEff: 0000000000000000       <- every capability dropped

kubectl exec "$POD" -- wget -qO- http://127.0.0.1:8080/
# hardened`,
      },
      {
        title: 'Steps 8-9 - enforce, then clean up',
        language: 'bash',
        code: `kubectl label namespace sc-lab pod-security.kubernetes.io/enforce=restricted --overwrite

# The hardened Deployment survives a restart under enforcement
kubectl rollout restart deploy/web
kubectl rollout status deploy/web --timeout=120s
# still fine

# A plain Pod is now rejected outright
kubectl run plain --image=nginx:1.27-alpine
# Error from server (Forbidden): pods "plain" is forbidden: violates
# PodSecurity "restricted:latest": allowPrivilegeEscalation != false,
# unrestricted capabilities, runAsNonRoot != true, seccompProfile

kubectl config set-context --current --namespace=default
kubectl delete namespace sc-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec deploy/web -n sc-lab -- grep CapEff /proc/1/status',
        what: 'An all-zero effective capability mask is the proof that drop: ["ALL"] worked.',
        expected: 'CapEff: 0000000000000000',
      },
      {
        command: 'kubectl run plain --image=nginx:1.27-alpine -n sc-lab',
        what: 'Under enforce=restricted an unhardened Pod must be refused.',
        expected: 'Error from server (Forbidden): violates PodSecurity "restricted:latest"',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace sc-lab',
        what: 'Removes the Deployment, ConfigMap and namespace labels.',
        expected: 'namespace "sc-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['volumes-and-ephemeral-storage', 'container-images', 'authn-authz-admission'],
  docs: [
    {
      title: 'Configure a security context for a Pod or container',
      url: 'https://kubernetes.io/docs/tasks/configure-pod-container/security-context/',
    },
    {
      title: 'Pod Security Standards',
      url: 'https://kubernetes.io/docs/concepts/security/pod-security-standards/',
    },
    {
      title: 'Pod Security Admission',
      url: 'https://kubernetes.io/docs/concepts/security/pod-security-admission/',
    },
  ],
}
