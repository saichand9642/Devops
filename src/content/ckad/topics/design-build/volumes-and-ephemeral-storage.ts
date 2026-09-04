import type { Topic } from '../../../types'

export const volumesAndEphemeralStorage: Topic = {
  id: 'volumes-and-ephemeral-storage',
  title: 'Volumes and ephemeral storage',
  domainId: 'design-build',
  difficulty: 'beginner',
  estimatedMinutes: 20,
  order: 10,
  tags: [
    'volume',
    'emptyDir',
    'hostPath',
    'volumeMounts',
    'subPath',
    'ephemeral',
    'medium: Memory',
  ],
  oneLiner:
    'How a container gets a filesystem beyond its image layer: emptyDir, projected config volumes, hostPath, and the lifetime rules for each.',
  explanation: [
    "A container's own filesystem is the image plus a thin writable layer that is destroyed when the container is removed. Anything you need to survive a container restart, or to share between containers, must be a **volume**.",
    'Volumes are declared once per Pod in `spec.volumes` and then mounted into each container that needs them via `volumeMounts`. The same volume can be mounted at different paths in different containers, and the same volume can be mounted read-only in one and writable in another.',
    'The **ephemeral** types you need for CKAD: `emptyDir` (a scratch directory created empty when the Pod starts, deleted when the Pod is removed - shared by all containers in the Pod), `configMap` and `secret` (read-only files generated from those objects), `downwardAPI` (Pod metadata as files), and `projected` (several of these combined into one directory tree).',
    "`hostPath` mounts a path from the node. It is powerful and dangerous: it breaks the isolation model, ties the Pod to a specific node's contents, and is usually blocked by policy. Legitimate uses are node agents in DaemonSets (reading `/var/log`, for example).",
    'For data that must outlive the Pod, you need a **PersistentVolumeClaim** - covered in its own lesson. The key division to hold in your head is: `emptyDir` dies with the Pod, a PVC does not.',
  ],
  whyItMatters: [
    'The official curriculum lists "utilize persistent and ephemeral volumes" as a competency, and ephemeral volumes are the half people neglect.',
    'Every sidecar and init container pattern depends on a shared `emptyDir`. If you cannot write one from memory, those tasks become slow.',
    'Knowing that `emptyDir` survives a *container* restart but not a *Pod* deletion is the fact that explains most "where did my file go?" confusion.',
    '`readOnlyRootFilesystem: true` in a securityContext is a common hardening requirement, and it only works if you mount an `emptyDir` over every path the app writes to - a direct link between this topic and the security domain.',
  ],
  howItWorks: [
    "`emptyDir` is backed by the node's disk by default. `emptyDir: {medium: Memory}` makes it a tmpfs (RAM-backed), which is fast, is wiped on node reboot, and counts against the container's memory limit.",
    '`emptyDir.sizeLimit` caps how much a Pod may write there; exceeding it gets the Pod evicted with reason `Evicted` rather than filling the node.',
    'Lifetime: an `emptyDir` is created when the Pod is assigned to a node and deleted when the Pod is removed from the node. A container crashing and restarting does *not* clear it.',
    '`mountPath` is where the volume appears in the container. Mounting over a directory that already has content in the image *hides* that content - a common surprise when mounting a ConfigMap over `/etc/nginx`.',
    '`subPath` mounts a single file or subdirectory from the volume instead of the whole thing, which is how you add one config file to a directory without hiding the rest. Note that `subPath` mounts do **not** receive ConfigMap updates automatically.',
    '`readOnly: true` on a `volumeMount` makes that mount read-only for that container regardless of the volume type.',
    'Ephemeral storage is a schedulable resource: `resources.requests["ephemeral-storage"]` and the matching limit control how much local disk a container may use, including its writable layer and its `emptyDir`s.',
  ],
  diagrams: [
    {
      kind: 'nested',
      title: 'A volume is declared once and mounted many times',
      caption:
        'spec.volumes says what storage exists. volumeMounts says where each container sees it. Two containers can mount the same volume at different paths.',
      root: {
        label: 'Pod spec',
        children: [
          {
            label: 'volumes:',
            detail: 'Declared once, at Pod level',
            tone: 'accent',
            children: [
              { label: '- name: cache  emptyDir: {}', detail: 'Deleted with the Pod' },
              {
                label: '- name: conf  configMap: {name: app}',
                detail: 'Read-only projection of keys as files',
              },
            ],
          },
          {
            label: 'containers[0]: app',
            children: [
              { label: 'volumeMounts: cache at /data', tone: 'success' },
              { label: 'volumeMounts: conf at /etc/app', tone: 'success' },
            ],
          },
          {
            label: 'containers[1]: sidecar',
            children: [
              {
                label: 'volumeMounts: cache at /shared',
                detail: 'Same volume, different path',
                tone: 'success',
              },
            ],
          },
        ],
      },
    },
    {
      kind: 'decision',
      title: 'Which volume type?',
      caption: 'Ask how long the data must live: this request, this Pod, or longer than the Pod.',
      question: 'How long must the data survive?',
      branches: [
        {
          condition: 'only while this Pod exists',
          result: 'emptyDir',
          detail: 'Scratch space and sharing between containers',
        },
        {
          condition: 'longer than the Pod',
          result: 'persistentVolumeClaim',
          detail: 'Survives Pod deletion and rescheduling',
          tone: 'accent',
        },
        {
          condition: 'it is configuration, not data',
          result: 'configMap or secret',
          detail: 'Mounted read-only; updates propagate to the files',
        },
        {
          condition: 'the Pod needs facts about itself',
          result: 'downwardAPI',
          detail: 'Exposes labels, annotations, limits as files',
        },
      ],
    },
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Declares volumes and mounts them into containers.',
      fields: [
        {
          path: 'spec.volumes[].name',
          meaning: 'Volume name, referenced by volumeMounts.',
          required: true,
        },
        {
          path: 'spec.volumes[].emptyDir',
          meaning: "Scratch space for the Pod's lifetime. `{}` for disk-backed.",
        },
        {
          path: 'spec.volumes[].emptyDir.medium',
          meaning: 'Empty for node disk, or "Memory" for tmpfs.',
        },
        {
          path: 'spec.volumes[].emptyDir.sizeLimit',
          meaning: 'Maximum size; exceeding it evicts the Pod.',
        },
        {
          path: 'spec.volumes[].configMap',
          meaning: 'Projects ConfigMap keys as read-only files.',
        },
        {
          path: 'spec.volumes[].secret',
          meaning: 'Projects Secret keys as read-only files (tmpfs-backed).',
        },
        {
          path: 'spec.volumes[].hostPath.path',
          meaning: 'Node filesystem path. Use sparingly; usually policy-restricted.',
        },
        {
          path: 'spec.containers[].volumeMounts[].mountPath',
          meaning: 'Where the volume appears inside the container.',
          required: true,
        },
        {
          path: 'spec.containers[].volumeMounts[].subPath',
          meaning: 'Mount only this file/dir from the volume.',
        },
        {
          path: 'spec.containers[].volumeMounts[].readOnly',
          meaning: 'Make this mount read-only for this container.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'Hardening an app that insists on writing to disk',
    story: [
      'A security review requires `readOnlyRootFilesystem: true` on every container. The API container immediately crashes: it writes session files to `/tmp` and a PID file to `/var/run`.',
      "The team's first attempt was to set the flag back to false and note an exception. The better answer is two `emptyDir` volumes, mounted at `/tmp` and `/var/run`.",
      'The root filesystem stays read-only, so an attacker cannot modify binaries or drop a payload into the image, while the two paths the application genuinely needs remain writable - and are wiped when the Pod goes away.',
      "A `sizeLimit` on the `/tmp` volume was added afterwards, because an unbounded scratch directory is how one Pod fills a node's disk and evicts its neighbours.",
    ],
    code: [
      {
        title: 'Read-only root plus writable scratch paths',
        language: 'yaml',
        code: `spec:
  volumes:
    - name: tmp
      emptyDir:
        sizeLimit: 256Mi
    - name: run
      emptyDir:
        medium: Memory # small, fast, never touches disk
        sizeLimit: 16Mi
  containers:
    - name: api
      image: registry.example.com/shop/api:1.4.2
      securityContext:
        readOnlyRootFilesystem: true
        runAsNonRoot: true
        runAsUser: 10001
      volumeMounts:
        - name: tmp
          mountPath: /tmp
        - name: run
          mountPath: /var/run`,
        explanation:
          'This combination is extremely common in production and in hardening-flavoured exam tasks: the flag alone breaks the app, and the emptyDir mounts are what make it viable.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'emptyDir shared between two containers',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: shared-scratch
  namespace: shop
spec:
  volumes:
    - name: scratch
      emptyDir: {} # created empty, deleted with the Pod
  containers:
    - name: producer
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /data/feed.txt; sleep 5; done"]
      volumeMounts:
        - name: scratch
          mountPath: /data # writable here
    - name: consumer
      image: busybox:1.36
      command: ["sh", "-c", "tail -F /input/feed.txt"]
      volumeMounts:
        - name: scratch
          mountPath: /input # same volume, different path
          readOnly: true # and read-only for this container`,
      explanation:
        'One volume, two mount paths, two access modes. This is the mechanism behind every sidecar log-shipping example.',
      placeholders: ['shared-scratch', 'shop'],
    },
    {
      title: 'Memory-backed emptyDir, and why the size limit matters',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: fast-cache
  namespace: shop
spec:
  volumes:
    - name: cache
      emptyDir:
        medium: Memory # tmpfs: RAM speed, wiped on node reboot
        sizeLimit: 128Mi
  containers:
    - name: app
      image: nginx:1.27-alpine
      volumeMounts:
        - name: cache
          mountPath: /var/cache/nginx
      resources:
        requests:
          memory: 256Mi
        limits:
          # A Memory-medium emptyDir counts against the container memory limit,
          # so the limit must cover the app AND the 128Mi of tmpfs.
          memory: 512Mi`,
      explanation:
        'Forgetting that tmpfs counts against the memory limit is a real cause of OOMKilled: the app looks well within its limit while the cache quietly consumes the rest.',
      placeholders: ['fast-cache', 'shop'],
    },
    {
      title: 'subPath: add one file without hiding a directory',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: nginx-tuned
  namespace: shop
spec:
  volumes:
    - name: config
      configMap:
        name: nginx-config # contains key: default.conf
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        # WITHOUT subPath this would replace the whole directory and delete
        # every other file nginx ships there.
        - name: config
          mountPath: /etc/nginx/conf.d/default.conf
          subPath: default.conf
          readOnly: true`,
      explanation:
        'The trade-off: a subPath mount does not pick up ConfigMap changes automatically. If you need live updates, mount the whole directory and have the app watch it, or trigger a rollout after changing the ConfigMap.',
      placeholders: ['nginx-tuned', 'shop', 'nginx-config'],
    },
    {
      title: 'hostPath in the one place it belongs',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-reader
  namespace: shop
spec:
  selector:
    matchLabels:
      app: log-reader
  template:
    metadata:
      labels:
        app: log-reader
    spec:
      containers:
        - name: reader
          image: busybox:1.36
          command: ["sh", "-c", "ls /host-logs; sleep 3600"]
          volumeMounts:
            - name: varlog
              mountPath: /host-logs
              readOnly: true # read-only is the minimum precaution
      volumes:
        - name: varlog
          hostPath:
            path: /var/log
            type: Directory # fail fast if it is not a directory`,
      explanation:
        'A node agent in a DaemonSet is the legitimate hostPath use case. In an application Deployment, hostPath is nearly always the wrong answer and will be flagged by policy.',
      placeholders: ['log-reader', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl exec shared-scratch -c consumer -n shop -- ls -l /input',
      what: 'Confirms the shared volume is visible from the second container.',
      expected: 'feed.txt listed with a growing size.',
      placeholders: ['shared-scratch', 'consumer', 'shop'],
    },
    {
      command: 'kubectl exec fast-cache -n shop -- df -h /var/cache/nginx',
      what: 'Shows the mount and its backing type - `tmpfs` for a Memory-medium emptyDir.',
      expected: 'Filesystem tmpfs with the size you set.',
      placeholders: ['fast-cache', 'shop'],
    },
    {
      command:
        'kubectl get pod shared-scratch -n shop -o jsonpath=\'{range .spec.volumes[*]}{.name}{"\\n"}{end}\'',
      what: "Lists the Pod's declared volume names.",
      expected: 'scratch',
      placeholders: ['shared-scratch', 'shop'],
    },
    {
      command:
        'kubectl get pod shared-scratch -n shop -o jsonpath=\'{range .spec.containers[*]}{.name}{": "}{range .volumeMounts[*]}{.mountPath}{" "}{end}{"\\n"}{end}\'',
      what: 'Shows which container mounts what, where - the fastest way to spot a missing mount.',
      expected: 'producer: /data ... consumer: /input ...',
      placeholders: ['shared-scratch', 'shop'],
    },
    {
      command: 'kubectl exec nginx-tuned -n shop -- ls /etc/nginx/conf.d/',
      what: 'Proves a subPath mount left the other files in the directory intact.',
      expected: 'default.conf plus whatever else the image ships.',
      placeholders: ['nginx-tuned', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Declare the volume once in `spec.volumes` with a name and a type.',
      'Mount it in each container that needs it, choosing `mountPath`, and `readOnly` where appropriate.',
      'Use `subPath` when you must place a single file inside an existing directory.',
      'Add `sizeLimit` to any `emptyDir` an application writes to freely.',
      'If the data must survive the Pod, stop and use a PersistentVolumeClaim instead.',
    ],
    code: [
      {
        title: 'Add an emptyDir to a generated Pod',
        language: 'bash',
        code: `kubectl run scratch --image=busybox:1.36 --dry-run=client -o yaml \\
  --command -- sleep 3600 > pod.yaml

# Add to pod.yaml:
#   spec.volumes:
#     - name: tmp
#       emptyDir:
#         sizeLimit: 64Mi
#   spec.containers[0].volumeMounts:
#     - name: tmp
#       mountPath: /tmp

kubectl apply -f pod.yaml
kubectl exec scratch -- sh -c 'echo hello > /tmp/x && cat /tmp/x'
# hello`,
        placeholders: ['scratch'],
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl exec shared-scratch -c producer -n shop -- sh -c "echo test > /data/check && cat /data/check"',
      what: 'Confirms the mount is writable from the container that should be able to write.',
      expected: 'test',
      placeholders: ['shared-scratch', 'producer', 'shop'],
    },
    {
      command: 'kubectl exec shared-scratch -c consumer -n shop -- sh -c "echo x > /input/x" ',
      what: 'Confirms a readOnly mount really is read-only.',
      expected: "sh: can't create /input/x: Read-only file system",
      placeholders: ['shared-scratch', 'consumer', 'shop'],
    },
    {
      command: 'kubectl exec fast-cache -n shop -- mount | grep /var/cache/nginx',
      what: 'Shows the filesystem type backing the mount.',
      expected: 'tmpfs on /var/cache/nginx type tmpfs (rw,relatime,size=131072k)',
      placeholders: ['fast-cache', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod myapp -n shop | grep -A5 Volumes',
      what: 'Shows resolved volumes and where each is mounted; a typo in a volume name appears here as a failure to create the Pod.',
      expected: 'A Volumes section listing each name and type.',
      placeholders: ['myapp', 'shop'],
    },
    {
      command: 'kubectl get events -n shop --field-selector reason=Evicted',
      what: 'An emptyDir that exceeded its sizeLimit, or a node running out of disk, shows up as an eviction.',
      expected: 'Pod ephemeral local storage usage exceeds the total limit of containers.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl exec myapp -n shop -- ls -la /etc/nginx/conf.d/',
      what: "When mounting a ConfigMap over a directory hides the image's files, this is how you see it.",
      expected: 'Only the ConfigMap keys, and none of the original files - which is the bug.',
      placeholders: ['myapp', 'shop'],
    },
    {
      command: 'kubectl describe pod myapp -n shop | grep -i "mountpath\\|failed"',
      what: 'A mount referring to a volume that does not exist produces a clear FailedMount event.',
      expected: 'MountVolume.SetUp failed for volume "typo" : volume not found.',
      placeholders: ['myapp', 'shop'],
    },
  ],
  commonMistakes: [
    'Expecting `emptyDir` data to survive Pod deletion. It does not - only a container restart.',
    "Mounting a ConfigMap over a directory such as `/etc/nginx/conf.d` and wiping the image's own files. Use `subPath` for a single file.",
    'Forgetting that a `subPath` mount does not receive ConfigMap or Secret updates.',
    'Using `medium: Memory` without raising the container memory limit, causing surprise OOMKills.',
    'Declaring a volume and forgetting the `volumeMounts` entry, so the container never sees it.',
    'Referring to a volume name in `volumeMounts` that does not exist in `spec.volumes` - the Pod fails with FailedMount.',
    'Reaching for `hostPath` in an application Deployment when an `emptyDir` or PVC is what is needed.',
  ],
  examTips: [
    '`emptyDir: {}` is four characters of YAML and the answer to every "share a directory between containers" task.',
    'When a task requires `readOnlyRootFilesystem: true`, expect to add `emptyDir` mounts for `/tmp` and any other writable path.',
    'For "mount only this one config file", the answer is `subPath`.',
    'Remember the lifetime hierarchy: container restart < Pod deletion < node reboot. `emptyDir` survives the first only.',
    '`kubectl explain pod.spec.volumes` lists every available volume type on the cluster if you forget a field name.',
  ],
  summary: [
    'Volumes are declared per Pod and mounted per container; one volume can appear at different paths with different access modes.',
    '`emptyDir` is Pod-lifetime scratch space and the basis of every sidecar hand-off; `medium: Memory` makes it tmpfs and charges it to the memory limit.',
    'Mounting over a directory hides the image content; `subPath` mounts a single file instead (but forgoes live updates).',
    '`hostPath` belongs in node agents, not applications.',
    'Data that must outlive the Pod needs a PersistentVolumeClaim.',
  ],
  practice: [
    {
      id: 'vol-p1',
      level: 'beginner',
      prompt:
        'A container writes to an emptyDir and then crashes and restarts. Is the data still there? What if the Pod is deleted and recreated?',
      answer:
        'After a container restart the data is still there - the volume belongs to the Pod, not the container. After the Pod is deleted the data is gone: an emptyDir is created empty and destroyed with the Pod.',
      explanation:
        'This is the single most important lifetime fact about emptyDir. If the answer must be "data survives", you need a PersistentVolumeClaim.',
    },
    {
      id: 'vol-p2',
      level: 'intermediate',
      prompt:
        'You mount a ConfigMap at `/etc/nginx/conf.d` and nginx stops working because its default configuration disappeared. What is the fix, and what do you lose by using it?',
      answer:
        'Mount the single file with `subPath`:\n\nvolumeMounts:\n  - name: config\n    mountPath: /etc/nginx/conf.d/default.conf\n    subPath: default.conf\n\nWhat you lose: `subPath` mounts do not receive ConfigMap updates, so changing the ConfigMap no longer updates the file - you must restart the Pods (`kubectl rollout restart`).',
      explanation:
        'A directory mount replaces everything at that path. subPath projects one entry instead, leaving siblings intact, at the cost of live reloading.',
    },
    {
      id: 'vol-p3',
      level: 'advanced',
      prompt:
        'Write the Pod fragment for a container with `readOnlyRootFilesystem: true` that still needs to write to `/tmp` (up to 100Mi) and `/var/run` (RAM-backed, 8Mi).',
      answer:
        'spec:\n  volumes:\n    - name: tmp\n      emptyDir:\n        sizeLimit: 100Mi\n    - name: run\n      emptyDir:\n        medium: Memory\n        sizeLimit: 8Mi\n  containers:\n    - name: app\n      image: registry.example.com/shop/api:1.4.2\n      securityContext:\n        readOnlyRootFilesystem: true\n      volumeMounts:\n        - name: tmp\n          mountPath: /tmp\n        - name: run\n          mountPath: /var/run',
      explanation:
        'Remember to raise the container memory limit to cover the 8Mi tmpfs, since a Memory-medium emptyDir counts against `resources.limits.memory`.',
    },
  ],
  lab: {
    title: 'Prove volume lifetimes and mount semantics',
    scenario:
      'You will share an emptyDir between containers, prove data survives a container crash but not Pod deletion, see a directory mount hide image files, and fix it with subPath.',
    prerequisites: ['A cluster with kubectl'],
    tasks: [
      { instruction: 'Create namespace `vol-lab` and set it as default.' },
      {
        instruction:
          'Create a Pod `share` with a producer writing to an emptyDir and a consumer reading it read-only.',
      },
      { instruction: 'Prove the consumer cannot write to its read-only mount.' },
      {
        instruction:
          'Kill the producer process to force a container restart and confirm the file survives.',
      },
      { instruction: 'Delete and recreate the Pod, and confirm the file is gone.' },
      {
        instruction:
          'Create a ConfigMap with an nginx config, mount it over `/etc/nginx/conf.d`, and observe what happened to the directory.',
      },
      { instruction: 'Switch to a subPath mount and confirm both files now exist.' },
      { instruction: 'Delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1-3',
        language: 'yaml',
        code: `# share.yaml
apiVersion: v1
kind: Pod
metadata:
  name: share
  namespace: vol-lab
spec:
  volumes:
    - name: scratch
      emptyDir:
        sizeLimit: 64Mi
  containers:
    - name: producer
      image: busybox:1.36
      command: ["sh", "-c", "echo 'created at '$(date) > /data/marker.txt; sleep 3600"]
      volumeMounts:
        - name: scratch
          mountPath: /data
    - name: consumer
      image: busybox:1.36
      command: ["sleep", "3600"]
      volumeMounts:
        - name: scratch
          mountPath: /input
          readOnly: true`,
      },
      {
        title: 'Verify sharing and read-only enforcement',
        language: 'bash',
        code: `kubectl create namespace vol-lab
kubectl config set-context --current --namespace=vol-lab
kubectl apply -f share.yaml
kubectl wait --for=condition=Ready pod/share --timeout=90s

kubectl exec share -c consumer -- cat /input/marker.txt
# created at Wed Sep  3 12:50:00 UTC 2026

kubectl exec share -c consumer -- sh -c 'echo nope > /input/x' || true
# sh: can't create /input/x: Read-only file system`,
      },
      {
        title: 'Steps 4-5 - the lifetime experiment',
        language: 'bash',
        code: `# Force the producer container to restart (kill PID 1)
kubectl exec share -c producer -- kill 1 || true
sleep 6
kubectl get pod share
# RESTARTS is now 1

# The emptyDir belongs to the Pod, so the file is still there:
kubectl exec share -c consumer -- cat /input/marker.txt
# created at ... (the ORIGINAL timestamp)

# Now delete the Pod entirely
kubectl delete pod share
kubectl apply -f share.yaml
kubectl wait --for=condition=Ready pod/share --timeout=90s
kubectl exec share -c consumer -- cat /input/marker.txt
# created at ... (a NEW timestamp - the old volume is gone)`,
      },
      {
        title: 'Step 6 - the directory-mount trap',
        language: 'bash',
        code: `kubectl create configmap nginx-config \\
  --from-literal=default.conf='server { listen 8080; location / { return 200 "ok\\n"; } }'

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: hidden
  namespace: vol-lab
spec:
  volumes:
    - name: config
      configMap:
        name: nginx-config
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        - name: config
          mountPath: /etc/nginx/conf.d      # replaces the whole directory
YAML

kubectl wait --for=condition=Ready pod/hidden --timeout=90s
kubectl exec hidden -- ls /etc/nginx/conf.d/
# default.conf        <- only the ConfigMap key; nginx's own file is hidden`,
      },
      {
        title: 'Step 7 - subPath keeps siblings, then cleanup',
        language: 'bash',
        code: `kubectl delete pod hidden
cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: Pod
metadata:
  name: subpathed
  namespace: vol-lab
spec:
  volumes:
    - name: config
      configMap:
        name: nginx-config
  containers:
    - name: web
      image: nginx:1.27-alpine
      volumeMounts:
        - name: config
          mountPath: /etc/nginx/conf.d/custom.conf
          subPath: default.conf
          readOnly: true
YAML

kubectl wait --for=condition=Ready pod/subpathed --timeout=90s
kubectl exec subpathed -- ls /etc/nginx/conf.d/
# custom.conf   default.conf     <- the image's own file survived

kubectl config set-context --current --namespace=default
kubectl delete namespace vol-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec subpathed -n vol-lab -- ls /etc/nginx/conf.d/',
        what: 'The whole point of subPath: both the projected file and the image file are present.',
        expected: 'custom.conf and default.conf',
      },
      {
        command: 'kubectl exec share -n vol-lab -c consumer -- cat /input/marker.txt',
        what: 'Confirms the shared emptyDir is readable from the second container.',
        expected: 'A "created at ..." line.',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace vol-lab',
        what: 'Removes all lab objects.',
        expected: 'namespace "vol-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['persistent-volume-claims', 'multi-container-patterns', 'configmaps'],
  docs: [
    { title: 'Volumes', url: 'https://kubernetes.io/docs/concepts/storage/volumes/' },
    {
      title: 'Ephemeral volumes',
      url: 'https://kubernetes.io/docs/concepts/storage/ephemeral-volumes/',
    },
  ],
}
