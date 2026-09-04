import type { Topic } from '../../../types'

export const persistentVolumeClaims: Topic = {
  id: 'persistent-volume-claims',
  title: 'PersistentVolumeClaims from an application',
  domainId: 'design-build',
  difficulty: 'intermediate',
  estimatedMinutes: 24,
  order: 11,
  tags: ['pvc', 'persistentvolume', 'storageclass', 'accessModes', 'Bound', 'Pending', 'RWO'],
  oneLiner:
    'How an application asks for durable storage: PVC, StorageClass, access modes, binding, and the two failure modes that keep Pods Pending.',
  explanation: [
    'A **PersistentVolume (PV)** is a piece of storage in the cluster - a cloud disk, an NFS export, a local directory. It is cluster-scoped and usually created by a provisioner, not by you.',
    'A **PersistentVolumeClaim (PVC)** is a namespaced request for storage: "I need 5Gi, ReadWriteOnce, from this StorageClass". Kubernetes matches the claim to a PV, or asks a provisioner to create one, and then the claim is **Bound**.',
    'A Pod never references a PV. It references a PVC by name in `spec.volumes[].persistentVolumeClaim.claimName`, and mounts it like any other volume. That indirection is what makes manifests portable between clusters with different storage.',
    'A **StorageClass** describes a kind of storage and its provisioner. A PVC with no `storageClassName` uses the cluster\'s default class; a PVC with `storageClassName: ""` explicitly asks for a pre-created (static) PV and no dynamic provisioning.',
    'Access modes describe how many nodes may mount the volume: `ReadWriteOnce` (RWO - one node, the common case for block storage), `ReadOnlyMany` (ROX), `ReadWriteMany` (RWX - many nodes, needs a shared filesystem such as NFS), and `ReadWriteOncePod` (exactly one Pod).',
  ],
  whyItMatters: [
    'The curriculum requires "utilize persistent and ephemeral volumes", and PVC tasks are the persistent half. They appear as "create a PVC and mount it into this Pod at /data".',
    'PVC problems are one of the two classic causes of a permanently Pending Pod (the other being resources). Recognising `pod has unbound immediate PersistentVolumeClaims` saves you from debugging the wrong thing.',
    'The RWO restriction explains why three replicas of a Deployment sharing one PVC do not work, and why StatefulSets exist.',
  ],
  howItWorks: [
    'Dynamic provisioning (the normal path): you create a PVC → the provisioner for its StorageClass creates a PV → the PVC binds to it → the Pod can mount it. `kubectl get pvc` shows STATUS Bound and the PV name.',
    'Static provisioning: an administrator creates PVs in advance; your PVC binds to any PV that satisfies size, access mode and class. If nothing matches, the PVC stays Pending forever with no error other than "no persistent volumes available".',
    "A StorageClass's `volumeBindingMode` matters. `Immediate` binds as soon as the PVC is created. `WaitForFirstConsumer` delays binding until a Pod using the PVC is scheduled, so the volume is created in the right zone - with this mode a Pending PVC with no Pod is completely normal.",
    'Binding is exclusive and one-to-one: a PVC binds to exactly one PV, and that PV serves only that PVC. Two PVCs cannot share a PV.',
    'The `persistentVolumeReclaimPolicy` on the PV decides what happens when the PVC is deleted: `Delete` (destroy the underlying storage - the default for dynamic provisioning) or `Retain` (keep the data, PV becomes Released and needs manual handling).',
    'Resizing: if the StorageClass has `allowVolumeExpansion: true`, you can increase `spec.resources.requests.storage` on the PVC. You can never decrease it.',
    'A PVC in use by a Pod cannot be deleted immediately - it gets a `kubernetes.io/pvc-protection` finalizer and stays Terminating until the Pod goes away.',
  ],
  keyObjects: [
    {
      kind: 'PersistentVolumeClaim',
      apiVersion: 'v1',
      purpose: 'A namespaced request for durable storage that a Pod can mount.',
      fields: [
        {
          path: 'spec.accessModes[]',
          meaning: 'ReadWriteOnce / ReadOnlyMany / ReadWriteMany / ReadWriteOncePod.',
          required: true,
        },
        {
          path: 'spec.resources.requests.storage',
          meaning: 'Minimum size requested, e.g. 5Gi.',
          required: true,
        },
        {
          path: 'spec.storageClassName',
          meaning: 'Which class to provision from. Omit for the default; "" for static only.',
        },
        { path: 'spec.volumeMode', meaning: 'Filesystem (default) or Block.' },
        { path: 'spec.selector', meaning: 'Label selector to pick a specific pre-created PV.' },
        { path: 'status.phase', meaning: 'Pending or Bound.' },
        {
          path: 'status.capacity.storage',
          meaning: 'What was actually provisioned - may exceed your request.',
        },
      ],
    },
    {
      kind: 'PersistentVolume',
      apiVersion: 'v1',
      purpose:
        'Cluster-scoped storage resource. You read these far more often than you create them.',
      fields: [
        { path: 'spec.capacity.storage', meaning: 'Size of the volume.' },
        { path: 'spec.accessModes[]', meaning: 'Modes this volume supports.' },
        {
          path: 'spec.persistentVolumeReclaimPolicy',
          meaning: 'Delete, Retain or (deprecated) Recycle.',
        },
        { path: 'spec.claimRef', meaning: 'Which PVC is bound to it.' },
        { path: 'status.phase', meaning: 'Available, Bound, Released or Failed.' },
      ],
    },
    {
      kind: 'StorageClass',
      apiVersion: 'storage.k8s.io/v1',
      purpose: 'Names a provisioner and its parameters; also decides binding mode and expansion.',
      fields: [
        { path: 'provisioner', meaning: 'The CSI driver that creates volumes.', required: true },
        { path: 'volumeBindingMode', meaning: 'Immediate or WaitForFirstConsumer.' },
        { path: 'allowVolumeExpansion', meaning: 'true permits growing a bound PVC.' },
        { path: 'reclaimPolicy', meaning: 'Reclaim policy given to PVs it creates.' },
      ],
    },
  ],
  realWorldExample: {
    title: 'Three replicas, one disk, two Pods stuck forever',
    story: [
      'A team gives their `uploads` Deployment 3 replicas and a single 20Gi `ReadWriteOnce` PVC mounted at `/data`. One Pod runs fine. The other two sit in `ContainerCreating`.',
      '`kubectl describe pod` on a stuck Pod shows: `Multi-Attach error for volume "pvc-...": Volume is already used by pod(s) uploads-...`. The cloud disk can only be attached to one node at a time - that is what ReadWriteOnce means.',
      'Two valid fixes, depending on intent. If every replica needs its *own* storage, use a StatefulSet with `volumeClaimTemplates`, which creates one PVC per Pod. If they genuinely need *shared* storage, you need a ReadWriteMany volume, which means a shared filesystem such as NFS or a cloud file service - not a block disk.',
      'They chose the StatefulSet, because uploads were sharded by replica anyway. Storage stopped being the bottleneck and each Pod reattached to its own volume across restarts.',
    ],
    code: [
      {
        title: 'The Multi-Attach signature',
        language: 'bash',
        code: `kubectl get pods -n shop -l app=uploads
# NAME                       READY   STATUS              RESTARTS   AGE
# uploads-6d4b8f9c7-2xk4l    1/1     Running             0          5m
# uploads-6d4b8f9c7-8n7pq    0/1     ContainerCreating   0          5m
# uploads-6d4b8f9c7-hj4rt    0/1     ContainerCreating   0          5m

kubectl describe pod uploads-6d4b8f9c7-8n7pq -n shop | grep -i multi-attach
# Warning  FailedAttachVolume  Multi-Attach error for volume "pvc-8f2a..."
#                              Volume is already used by pod(s) uploads-6d4b8f9c7-2xk4l`,
        explanation:
          '"Multi-Attach error" always means an RWO volume is wanted by Pods on more than one node. It is a design problem, not a storage fault.',
        placeholders: ['shop', 'uploads-6d4b8f9c7-8n7pq'],
      },
    ],
  },
  yamlExamples: [
    {
      title: 'A PVC and a Pod that mounts it',
      language: 'yaml',
      code: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: uploads-data
  namespace: shop
spec:
  accessModes:
    - ReadWriteOnce # one node at a time
  resources:
    requests:
      storage: 5Gi
  # storageClassName omitted -> the cluster's default StorageClass is used
---
apiVersion: v1
kind: Pod
metadata:
  name: uploads
  namespace: shop
spec:
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: uploads-data # Pods reference the CLAIM, never the PV
  containers:
    - name: app
      image: nginx:1.27-alpine
      volumeMounts:
        - name: data
          mountPath: /usr/share/nginx/html`,
      explanation:
        'This is the whole pattern: a claim describing what you need, and a Pod mounting it by name. Nothing here mentions a cloud provider or a disk type, which is why it works unchanged on kind, minikube or a managed cluster.',
      placeholders: ['uploads-data', 'shop', 'uploads'],
    },
    {
      title: 'A pre-created PV plus a claim that binds to it (static provisioning)',
      language: 'yaml',
      code: `apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-pv-1
  labels:
    tier: cheap
spec:
  capacity:
    storage: 2Gi
  accessModes:
    - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain # keep the data if the PVC is deleted
  storageClassName: manual # a name, not a real provisioner
  hostPath:
    path: /mnt/data # single-node clusters only
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: manual-claim
  namespace: shop
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi # <= the PV's 2Gi, so it can bind
  storageClassName: manual # must match the PV
  selector:
    matchLabels:
      tier: cheap # optionally pin to a specific PV`,
      explanation:
        'For a claim to bind to an existing PV, the class name must match, the access mode must be supported, and the PV must be at least as large as the request. Any mismatch leaves the PVC Pending with no obvious error.',
      placeholders: ['local-pv-1', 'manual-claim', 'shop'],
    },
    {
      title: 'Per-replica storage with a StatefulSet',
      language: 'yaml',
      code: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: uploads
  namespace: shop
spec:
  serviceName: uploads
  replicas: 3
  selector:
    matchLabels:
      app: uploads
  template:
    metadata:
      labels:
        app: uploads
    spec:
      containers:
        - name: app
          image: nginx:1.27-alpine
          volumeMounts:
            - name: data
              mountPath: /data
  volumeClaimTemplates: # creates data-uploads-0, -1, -2
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 5Gi`,
      explanation:
        'Three Pods, three independent RWO volumes, no Multi-Attach problem. Note these PVCs are *not* deleted when the StatefulSet is deleted - that is deliberate data protection.',
      placeholders: ['uploads', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'kubectl get storageclass',
      what: 'Lists available classes and marks the default with "(default)". Run this first - it tells you what the cluster can provision.',
      expected: 'standard (default) rancher.io/local-path Delete WaitForFirstConsumer',
    },
    {
      command: 'kubectl get pvc -n shop',
      what: 'Claim status, bound volume, capacity, access mode and class.',
      expected: 'STATUS Bound with a pvc-<uuid> volume name.',
      placeholders: ['shop'],
    },
    {
      command: 'kubectl get pv',
      what: 'Cluster-wide volumes with their reclaim policy, status and which claim owns each.',
      expected: 'STATUS Bound and a CLAIM column reading shop/uploads-data.',
    },
    {
      command: 'kubectl describe pvc uploads-data -n shop',
      what: 'Events explaining why a claim is Pending: no matching PV, no provisioner, or waiting for a consumer.',
      expected: 'A "Successfully provisioned volume" event when healthy.',
      placeholders: ['uploads-data', 'shop'],
    },
    {
      command:
        'kubectl get pvc uploads-data -n shop -o jsonpath=\'{.status.phase}{" "}{.status.capacity.storage}{"\\n"}\'',
      what: 'A one-line answer to "is my storage ready and how big is it?".',
      expected: 'Bound 5Gi',
      placeholders: ['uploads-data', 'shop'],
    },
    {
      command:
        'kubectl patch pvc uploads-data -n shop -p \'{"spec":{"resources":{"requests":{"storage":"10Gi"}}}}\'',
      what: 'Expands a claim, if its StorageClass allows expansion. Shrinking is never permitted.',
      expected: 'persistentvolumeclaim/uploads-data patched',
      placeholders: ['uploads-data', 'shop'],
    },
    {
      command: 'kubectl exec uploads -n shop -- df -h /usr/share/nginx/html',
      what: 'Proves the volume is actually mounted at the expected size.',
      expected: 'A filesystem line showing roughly the requested capacity.',
      placeholders: ['uploads', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Check what the cluster offers: `kubectl get storageclass`.',
      'Write the PVC: access mode, size, and `storageClassName` only if the task names one.',
      'Reference the PVC from the Pod via `persistentVolumeClaim.claimName` and mount it.',
      'Verify the PVC is Bound *and* the Pod is Running - a Bound claim with a Pending Pod means something else is wrong.',
      'For per-replica storage use a StatefulSet `volumeClaimTemplate` instead of a shared PVC.',
    ],
    code: [
      {
        title: 'Create and verify in one pass',
        language: 'bash',
        code: `kubectl get storageclass
# standard (default)  ...  WaitForFirstConsumer

kubectl apply -f pvc-and-pod.yaml

# With WaitForFirstConsumer, the PVC is Pending until the Pod is scheduled -
# that is expected, not an error.
kubectl get pvc uploads-data -n shop
# NAME           STATUS    VOLUME   CAPACITY   ACCESS MODES   STORAGECLASS
# uploads-data   Pending                                       standard

kubectl wait --for=condition=Ready pod/uploads -n shop --timeout=180s
kubectl get pvc uploads-data -n shop
# uploads-data   Bound     pvc-8f2a...   5Gi   RWO   standard`,
        placeholders: ['uploads-data', 'shop'],
      },
    ],
  },
  verification: [
    {
      command: 'kubectl get pvc,pv -n shop',
      what: 'Claim and volume side by side; the CLAIM column on the PV should name your PVC.',
      expected: 'Both Bound, matching capacities.',
      placeholders: ['shop'],
    },
    {
      command:
        'kubectl exec uploads -n shop -- sh -c "echo persisted > /usr/share/nginx/html/test.txt && cat /usr/share/nginx/html/test.txt"',
      what: 'Writes and reads back through the mount.',
      expected: 'persisted',
      placeholders: ['uploads', 'shop'],
    },
    {
      command:
        'kubectl get pod uploads -n shop -o jsonpath=\'{.spec.volumes[0].persistentVolumeClaim.claimName}{"\\n"}\'',
      what: 'Confirms the Pod references the claim you intended.',
      expected: 'uploads-data',
      placeholders: ['uploads', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command:
        'kubectl describe pod uploads -n shop | grep -iA3 "unbound\\|FailedAttach\\|FailedMount"',
      what: 'The three storage-related reasons a Pod will not start, in one grep.',
      expected: 'pod has unbound immediate PersistentVolumeClaims, or a Multi-Attach error.',
      placeholders: ['uploads', 'shop'],
    },
    {
      command: 'kubectl describe pvc uploads-data -n shop | grep -A5 Events',
      what: 'Explains a Pending claim: "no persistent volumes available for this claim and no storage class is set" or "waiting for first consumer".',
      expected: 'A ProvisioningSucceeded event when healthy.',
      placeholders: ['uploads-data', 'shop'],
    },
    {
      command: 'kubectl get storageclass',
      what: 'A PVC with no storageClassName in a cluster with no default class can never bind. This is the check.',
      expected: 'At least one class marked (default), or the task must specify one.',
    },
    {
      command: 'kubectl get pv --sort-by=.spec.capacity.storage',
      what: 'For static provisioning, shows whether an Available PV of sufficient size and matching mode exists at all.',
      expected: 'At least one PV with STATUS Available and enough capacity.',
    },
    {
      command: 'kubectl get pvc uploads-data -n shop -o jsonpath=\'{.metadata.finalizers}{"\\n"}\'',
      what: 'Explains a PVC stuck Terminating: the pvc-protection finalizer holds it while a Pod still uses it.',
      expected: '["kubernetes.io/pvc-protection"] - delete the Pod first.',
      placeholders: ['uploads-data', 'shop'],
    },
  ],
  commonMistakes: [
    'Referencing a PV from a Pod. Pods reference PVCs; the PVC references the PV.',
    'Sharing one ReadWriteOnce PVC across several Deployment replicas, producing Multi-Attach errors.',
    'Requesting `ReadWriteMany` on a cluster whose only provisioner is block storage - the PVC stays Pending forever.',
    'Panicking about a Pending PVC when the StorageClass uses `WaitForFirstConsumer`, where Pending without a Pod is correct.',
    'Setting `storageClassName: ""` (which disables dynamic provisioning) when you meant to omit the field entirely.',
    'Expecting `kubectl delete sts` to remove `volumeClaimTemplate` PVCs. It does not; delete them explicitly.',
    'Trying to shrink a PVC. Expansion only, and only if `allowVolumeExpansion: true`.',
    'Forgetting that with reclaim policy `Delete`, deleting the PVC destroys the data.',
  ],
  examTips: [
    'Run `kubectl get storageclass` before writing any PVC - it tells you the default class name and the binding mode.',
    'There is no useful `kubectl create pvc` generator; write the six lines of YAML. Memorise the shape: accessModes, resources.requests.storage.',
    '"pod has unbound immediate PersistentVolumeClaims" → look at the PVC, not the Pod.',
    'If a task says "each replica needs its own volume", the answer is a StatefulSet with `volumeClaimTemplates`.',
    'Verify with `kubectl get pvc` (Bound) *and* an `exec ... df -h` on the mount path. Both, not one.',
  ],
  summary: [
    'PV = storage in the cluster; PVC = a namespaced request; Pods mount PVCs by name.',
    'StorageClass drives dynamic provisioning; `WaitForFirstConsumer` makes a Pending PVC normal until a Pod is scheduled.',
    'Access modes limit node attachment: RWO is one node, RWX needs a shared filesystem.',
    'Reclaim policy Delete destroys data with the PVC; Retain keeps it.',
    'Per-replica storage means StatefulSet `volumeClaimTemplates`, whose PVCs survive deletion.',
  ],
  practice: [
    {
      id: 'pvc-p1',
      level: 'beginner',
      prompt:
        'Write a PVC named `app-data` in namespace `shop` requesting 2Gi of ReadWriteOnce storage from the default StorageClass.',
      answer:
        'apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: app-data\n  namespace: shop\nspec:\n  accessModes:\n    - ReadWriteOnce\n  resources:\n    requests:\n      storage: 2Gi',
      explanation:
        'Omitting `storageClassName` entirely selects the default class. Writing `storageClassName: ""` would instead disable dynamic provisioning and require a pre-created PV.',
    },
    {
      id: 'pvc-p2',
      level: 'intermediate',
      prompt:
        'A Pod is Pending with the message `pod has unbound immediate PersistentVolumeClaims`. Give the three checks, in order.',
      answer:
        '1. `kubectl get pvc -n <ns>` - is it Pending or Bound?\n2. `kubectl describe pvc <name> -n <ns>` - the events say why (no matching PV / no provisioner / waiting for consumer).\n3. `kubectl get storageclass` - is there a default class, and does one exist with the name the PVC asks for?',
      explanation:
        'The message is about the claim, so never start with the Pod. If the class uses WaitForFirstConsumer the wording is different ("waiting for first consumer to be created"), and that state resolves itself once scheduling proceeds.',
    },
    {
      id: 'pvc-p3',
      level: 'advanced',
      prompt:
        'You must run 3 replicas, each with its own 10Gi volume, in namespace `shop`. Explain why a Deployment plus one PVC fails, and give the correct object plus the resulting PVC names.',
      answer:
        'A Deployment with one RWO PVC fails because the volume can only attach to one node, so replicas scheduled elsewhere get a Multi-Attach error and stay ContainerCreating. The correct object is a StatefulSet with a `volumeClaimTemplates` entry named `data`, producing PVCs `data-<sts-name>-0`, `data-<sts-name>-1` and `data-<sts-name>-2`.',
      explanation:
        'Those PVCs are retained when the StatefulSet is deleted, so recreating the StatefulSet reattaches each Pod to its original volume. To reclaim the storage you must delete the PVCs explicitly.',
    },
  ],
  lab: {
    title: 'Bind a claim, prove persistence, and reproduce Multi-Attach',
    scenario:
      'You will create a PVC, write data through a Pod, delete and recreate the Pod to prove the data survived, and then deliberately trigger the Multi-Attach failure that RWO causes.',
    prerequisites: [
      'A cluster with a default StorageClass (kind and minikube both provide one)',
      'For the Multi-Attach step, a cluster with more than one node (skip that step on single-node clusters)',
    ],
    tasks: [
      { instruction: 'Create namespace `pvc-lab` and set it as default.' },
      { instruction: 'List the StorageClasses and note the default name and binding mode.' },
      { instruction: 'Create a PVC `data` requesting 1Gi ReadWriteOnce.' },
      {
        instruction:
          'Create a Pod `writer` mounting it at /data and write a file with a timestamp.',
      },
      { instruction: 'Confirm the PVC is Bound and note the PV name.' },
      {
        instruction:
          'Delete the Pod, recreate it, and confirm the file is still there - the key difference from emptyDir.',
      },
      {
        instruction:
          'Create a Deployment with 2 replicas sharing the same PVC and observe what happens.',
      },
      {
        instruction:
          'Clean up: delete the namespace, then check whether the PV was deleted or retained.',
      },
    ],
    solution: [
      {
        title: 'Steps 1-3',
        language: 'bash',
        code: `kubectl create namespace pvc-lab
kubectl config set-context --current --namespace=pvc-lab

kubectl get storageclass
# NAME                 PROVISIONER             RECLAIMPOLICY   VOLUMEBINDINGMODE
# standard (default)   rancher.io/local-path   Delete          WaitForFirstConsumer

cat <<'YAML' | kubectl apply -f -
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: data
  namespace: pvc-lab
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
YAML

kubectl get pvc data
# STATUS Pending - normal with WaitForFirstConsumer, no Pod exists yet`,
      },
      {
        title: 'Steps 4-5 - write data, confirm binding',
        language: 'yaml',
        code: `# writer.yaml
apiVersion: v1
kind: Pod
metadata:
  name: writer
  namespace: pvc-lab
spec:
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: data
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      volumeMounts:
        - name: data
          mountPath: /data`,
      },
      {
        title: 'Steps 4b-5b - the write and the binding',
        language: 'bash',
        code: `kubectl apply -f writer.yaml
kubectl wait --for=condition=Ready pod/writer --timeout=180s

kubectl exec writer -- sh -c 'echo "written at $(date)" > /data/marker.txt'
kubectl exec writer -- cat /data/marker.txt
# written at Wed Sep  3 13:00:00 UTC 2026

kubectl get pvc data
# NAME   STATUS   VOLUME        CAPACITY   ACCESS MODES   STORAGECLASS
# data   Bound    pvc-3f9c...   1Gi        RWO            standard

PV=$(kubectl get pvc data -o jsonpath='{.spec.volumeName}')
echo "bound to $PV"
kubectl get pv "$PV" -o custom-columns='PV:.metadata.name,RECLAIM:.spec.persistentVolumeReclaimPolicy,CLAIM:.spec.claimRef.name'`,
      },
      {
        title: 'Step 6 - the persistence proof',
        language: 'bash',
        code: `kubectl delete pod writer
kubectl apply -f writer.yaml
kubectl wait --for=condition=Ready pod/writer --timeout=180s

kubectl exec writer -- cat /data/marker.txt
# written at Wed Sep  3 13:00:00 UTC 2026     <- the ORIGINAL timestamp
#
# Compare with emptyDir, where this file would be gone.`,
      },
      {
        title: 'Step 7 - Multi-Attach (multi-node clusters)',
        language: 'bash',
        code: `cat <<'YAML' | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sharers
  namespace: pvc-lab
spec:
  replicas: 2
  selector:
    matchLabels:
      app: sharers
  template:
    metadata:
      labels:
        app: sharers
    spec:
      volumes:
        - name: data
          persistentVolumeClaim:
            claimName: data
      containers:
        - name: app
          image: busybox:1.36
          command: ["sleep", "3600"]
          volumeMounts:
            - name: data
              mountPath: /data
YAML

sleep 30
kubectl get pods -l app=sharers
# On a multi-node cluster one Pod runs and the other is stuck:
# sharers-...   0/1   ContainerCreating

kubectl describe pod -l app=sharers | grep -i 'multi-attach' || \\
  echo "Both Pods landed on the same node - no Multi-Attach on a single-node cluster"`,
      },
      {
        title: 'Step 8 - cleanup and reclaim behaviour',
        language: 'bash',
        code: `PV=$(kubectl get pvc data -o jsonpath='{.spec.volumeName}')

kubectl config set-context --current --namespace=default
kubectl delete namespace pvc-lab

# With reclaimPolicy: Delete (the dynamic-provisioning default) the PV and the
# underlying storage go away with the PVC:
kubectl get pv "$PV" || echo "PV deleted along with the claim - data is gone"`,
      },
    ],
    verification: [
      {
        command: 'kubectl exec writer -n pvc-lab -- cat /data/marker.txt',
        what: 'After deleting and recreating the Pod, the original timestamp proves the volume is persistent.',
        expected: 'The timestamp written before the Pod was deleted.',
      },
      {
        command:
          'kubectl get pvc data -n pvc-lab -o jsonpath=\'{.status.phase}{" "}{.spec.volumeName}{"\\n"}\'',
        what: 'Confirms the claim bound and names the PV it bound to.',
        expected: 'Bound pvc-<uuid>',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace pvc-lab',
        what: 'Deletes the Pods and the PVC; with reclaimPolicy Delete this also removes the PV and its data.',
        expected: 'namespace "pvc-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['volumes-and-ephemeral-storage', 'workload-resources'],
  docs: [
    {
      title: 'Persistent Volumes',
      url: 'https://kubernetes.io/docs/concepts/storage/persistent-volumes/',
    },
    {
      title: 'Storage Classes',
      url: 'https://kubernetes.io/docs/concepts/storage/storage-classes/',
    },
  ],
}
