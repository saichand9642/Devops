import type { Question } from '../../types'

export const designBuildQuestions: Question[] = [
  {
    id: 'db-q01',
    domainId: 'design-build',
    topicId: 'container-images',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'An image declares `ENTRYPOINT ["/app/server"]` and `CMD ["--port=8080"]`. A Pod sets only `args: ["--port=9090"]`. What does the container run?',
    options: [
      { id: 'a', text: '/app/server --port=8080 --port=9090' },
      { id: 'b', text: '/app/server --port=9090' },
      { id: 'c', text: '--port=9090' },
      { id: 'd', text: '/app/server --port=8080' },
    ],
    correct: ['b'],
    explanation:
      '`args` replaces CMD and leaves ENTRYPOINT alone, so the executable stays `/app/server` with the new argument. Setting `command` instead would replace ENTRYPOINT *and* discard CMD entirely, which is the mistake people make.',
  },
  {
    id: 'db-q02',
    domainId: 'design-build',
    topicId: 'commands-and-args',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the kubectl command that creates a Pod named busy from busybox:1.36 which sleeps for 4800 seconds.',
    acceptedAnswers: [
      'kubectl run busy --image=busybox:1.36 --command -- sleep 4800',
      'kubectl run busy --image busybox:1.36 --command -- sleep 4800',
      'kubectl run busy --image=busybox:1.36 --command -- /bin/sleep 4800',
    ],
    answerHint: 'kubectl run busy ...',
    explanation:
      '`--command` makes everything after `--` the container `command` (overriding ENTRYPOINT). Without `--command`, those words become `args` instead. Both happen to work for busybox because its entrypoint is empty, but the distinction matters on images with a real ENTRYPOINT.',
  },
  {
    id: 'db-q03',
    domainId: 'design-build',
    topicId: 'multi-container-patterns',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A Job has a main container that finishes in 30 seconds and a metrics sidecar that runs forever. The Job stays at COMPLETIONS 0/1 indefinitely. What is the correct fix?',
    options: [
      { id: 'a', text: 'Set `backoffLimit: 0` on the Job' },
      { id: 'b', text: 'Move the sidecar into `initContainers` with `restartPolicy: Always`' },
      { id: 'c', text: 'Set `restartPolicy: Never` on the Pod template' },
      { id: 'd', text: 'Add `activeDeadlineSeconds` to the Job' },
    ],
    correct: ['b'],
    explanation:
      'A Pod only reaches Succeeded when every *regular* container has terminated, so a forever-running sidecar in `spec.containers` blocks Job completion. An init container with `restartPolicy: Always` is a native sidecar: it starts before the main containers, runs alongside them, is excluded from completion accounting, and is terminated after the main container exits.',
  },
  {
    id: 'db-q04',
    domainId: 'design-build',
    topicId: 'jobs',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt: 'This Job is rejected at apply time. Which field is invalid?',
    code: {
      title: 'job.yaml',
      language: 'yaml',
      code: `apiVersion: batch/v1
kind: Job
metadata:
  name: migrate
spec:
  backoffLimit: 2
  template:
    spec:
      restartPolicy: Always
      containers:
        - name: migrate
          image: busybox:1.36
          command: ["sh", "-c", "echo migrating"]`,
    },
    options: [
      { id: 'a', text: '`backoffLimit` is not a valid Job field' },
      { id: 'b', text: '`restartPolicy: Always` is invalid in a Job template' },
      { id: 'c', text: 'The apiVersion should be batch/v1beta1' },
      { id: 'd', text: 'A Job template requires `metadata.labels`' },
    ],
    correct: ['b'],
    explanation:
      'A Job template must use `restartPolicy: OnFailure` or `Never` - "run to completion" and "always restart" contradict each other, and the API server rejects it with "supported values: OnFailure, Never". `Never` is usually better for debugging because each attempt leaves its own Pod and log.',
  },
  {
    id: 'db-q05',
    domainId: 'design-build',
    topicId: 'cronjobs',
    category: 'command',
    kind: 'command',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'Write the command that creates a CronJob named beat in namespace shop, running busybox:1.36 every five minutes with the command `date`.',
    acceptedAnswers: [
      'kubectl create cronjob beat --image=busybox:1.36 --schedule="*/5 * * * *" -n shop -- date',
      "kubectl create cronjob beat --image=busybox:1.36 --schedule='*/5 * * * *' -n shop -- date",
      'kubectl create cronjob beat -n shop --image=busybox:1.36 --schedule="*/5 * * * *" -- date',
      'kubectl -n shop create cronjob beat --image=busybox:1.36 --schedule="*/5 * * * *" -- date',
    ],
    answerHint: 'kubectl create cronjob ...',
    explanation:
      'Quote the schedule so the shell does not glob-expand the asterisks. The generator produces the correct nesting (`spec.jobTemplate.spec.template.spec.containers`), which is the part that is easy to get wrong by hand.',
  },
  {
    id: 'db-q06',
    domainId: 'design-build',
    topicId: 'workload-resources',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You need a log-collecting agent running on every node, including nodes added next week. Which workload resource, and which field is not available on it?',
    options: [
      { id: 'a', text: 'Deployment; `spec.selector` is unavailable' },
      { id: 'b', text: 'DaemonSet; `spec.replicas` does not exist' },
      { id: 'c', text: 'StatefulSet; `spec.serviceName` is unavailable' },
      { id: 'd', text: 'ReplicaSet; `spec.template` is unavailable' },
    ],
    correct: ['b'],
    explanation:
      'A DaemonSet places one Pod per eligible node and has no `replicas` field - the node count determines the Pod count, and new nodes get a Pod automatically. Verify coverage with `status.desiredNumberScheduled`. Add tolerations if you also need Pods on tainted control-plane nodes.',
  },
  {
    id: 'db-q07',
    domainId: 'design-build',
    topicId: 'init-containers',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'A Pod shows STATUS `Init:1/3`. What does this mean?',
    options: [
      { id: 'a', text: 'One of three init containers failed' },
      { id: 'b', text: 'The first init container completed and the second is running or retrying' },
      { id: 'c', text: 'One of three regular containers is ready' },
      { id: 'd', text: 'The Pod has been restarted once out of a maximum of three' },
    ],
    correct: ['b'],
    explanation:
      '`Init:N/M` means N of M init containers have completed successfully. Nothing has failed - this is a normal state. Init containers run strictly in order, so inspect the second one: `kubectl logs <pod> -c <second-init-container>`. A stuck value usually means it is waiting on a dependency.',
  },
  {
    id: 'db-q08',
    domainId: 'design-build',
    topicId: 'volumes-and-ephemeral-storage',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'beginner',
    points: 1,
    prompt:
      'A container writes a file to an emptyDir volume, then crashes and is restarted by the kubelet. Is the file still there? And after the Pod is deleted and recreated?',
    options: [
      { id: 'a', text: 'Gone after the restart; gone after the Pod is recreated' },
      { id: 'b', text: 'Still there after the restart; gone after the Pod is recreated' },
      { id: 'c', text: 'Still there in both cases' },
      { id: 'd', text: 'Gone after the restart; still there after the Pod is recreated' },
    ],
    correct: ['b'],
    explanation:
      'An emptyDir belongs to the Pod, not the container, so it survives container restarts. It is created empty when the Pod is assigned to a node and deleted when the Pod is removed. Data that must outlive the Pod needs a PersistentVolumeClaim.',
  },
  {
    id: 'db-q09',
    domainId: 'design-build',
    topicId: 'volumes-and-ephemeral-storage',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'You mount a ConfigMap at `/etc/nginx/conf.d` and nginx stops working because the files the image shipped there have disappeared. What is the fix?',
    options: [
      { id: 'a', text: 'Add `readOnly: true` to the volumeMount' },
      { id: 'b', text: 'Use `subPath` to project the single file instead of the directory' },
      { id: 'c', text: 'Change the volume type to `secret`' },
      { id: 'd', text: 'Set `defaultMode: 0644` on the ConfigMap volume' },
    ],
    correct: ['b'],
    explanation:
      'Mounting over a directory hides everything the image put there. `subPath: default.conf` with `mountPath: /etc/nginx/conf.d/default.conf` projects one file and leaves the siblings intact. The trade-off is that subPath mounts do not receive ConfigMap updates, so a change needs `kubectl rollout restart`.',
  },
  {
    id: 'db-q10',
    domainId: 'design-build',
    topicId: 'persistent-volume-claims',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 3,
    prompt:
      'A Deployment with 3 replicas mounts one ReadWriteOnce PVC. One Pod runs; the other two stay in ContainerCreating with a "Multi-Attach error". What is the correct redesign?',
    options: [
      { id: 'a', text: 'Increase the PVC size' },
      { id: 'b', text: 'Add `readOnly: true` to the volumeMount' },
      {
        id: 'c',
        text: 'Use a StatefulSet with `volumeClaimTemplates`, giving each Pod its own PVC',
      },
      { id: 'd', text: 'Set `podManagementPolicy: Parallel`' },
    ],
    correct: ['c'],
    explanation:
      'ReadWriteOnce means the volume can be attached to one *node* at a time, so replicas scheduled elsewhere cannot mount it. If each replica needs its own storage, a StatefulSet with `volumeClaimTemplates` creates one PVC per Pod. If they genuinely need to share, you need a ReadWriteMany volume such as NFS.',
  },
  {
    id: 'db-q11',
    domainId: 'design-build',
    topicId: 'deployments-and-replicasets',
    category: 'concept',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt: 'A Deployment reports `READY 3/3` but `UP-TO-DATE 2`. What state is the system in?',
    options: [
      { id: 'a', text: 'Three Pods are ready but only two run the current Pod template' },
      { id: 'b', text: 'Two Pods are ready and one is still starting' },
      { id: 'c', text: 'The Deployment has failed and needs a rollback' },
      { id: 'd', text: 'Two of three replicas have passed their readiness probe' },
    ],
    correct: ['a'],
    explanation:
      'UP-TO-DATE counts Pods running the current template, ready or not. Three ready with two up-to-date means one Pod is still from the previous ReplicaSet - a rolling update in progress. `kubectl get rs` will show two ReplicaSets with non-zero replicas.',
  },
  {
    id: 'db-q12',
    domainId: 'design-build',
    topicId: 'pods',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A container completes its work successfully every time, yet the Pod eventually reports CrashLoopBackOff and the application log shows no errors. What is wrong?',
    options: [
      { id: 'a', text: 'The image is corrupt' },
      { id: 'b', text: '`restartPolicy` is `Always`, so a successful exit is restarted' },
      { id: 'c', text: 'The liveness probe is failing' },
      { id: 'd', text: 'The container has no resource limits' },
    ],
    correct: ['b'],
    explanation:
      "With the default `restartPolicy: Always`, a container that exits 0 is restarted, and the repeated cycling is reported as CrashLoopBackOff. Confirm with `kubectl get pod <name> -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}'` - exit code 0 with climbing restarts is the signature. Use `Never`/`OnFailure`, or a Job.",
  },
  {
    id: 'db-q13',
    domainId: 'design-build',
    topicId: 'jobs',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'A Job must process 10 items with at most 2 running at once, give up after 3 failures, and never run longer than 5 minutes. Which spec is correct?',
    options: [
      {
        id: 'a',
        text: 'completions: 2, parallelism: 10, backoffLimit: 3, activeDeadlineSeconds: 300',
      },
      {
        id: 'b',
        text: 'completions: 10, parallelism: 2, backoffLimit: 3, activeDeadlineSeconds: 300',
      },
      {
        id: 'c',
        text: 'completions: 10, parallelism: 2, backoffLimit: 300, activeDeadlineSeconds: 3',
      },
      {
        id: 'd',
        text: 'replicas: 10, parallelism: 2, backoffLimit: 3, ttlSecondsAfterFinished: 300',
      },
    ],
    correct: ['b'],
    explanation:
      '`completions` is how many Pods must succeed in total; `parallelism` caps concurrency. `activeDeadlineSeconds` is a wall-clock limit that overrides the retry budget - when it expires the Job is Failed with reason DeadlineExceeded regardless of progress. Jobs have no `replicas` field.',
  },
  {
    id: 'db-q14',
    domainId: 'design-build',
    topicId: 'container-images',
    category: 'troubleshoot',
    kind: 'mcq',
    difficulty: 'intermediate',
    points: 2,
    prompt:
      'Pods are stuck in ImagePullBackOff with the message `unauthorized: authentication required`. A Secret containing valid registry credentials is referenced in `imagePullSecrets`. What should you check first?',
    options: [
      { id: 'a', text: 'The Secret type - it must be kubernetes.io/dockerconfigjson' },
      { id: 'b', text: 'The container `imagePullPolicy`' },
      { id: 'c', text: 'The Pod ServiceAccount token' },
      { id: 'd', text: 'Whether the node has internet access' },
    ],
    correct: ['a'],
    explanation:
      "`imagePullSecrets` only reads Secrets of type `kubernetes.io/dockerconfigjson`. A Secret made with `kubectl create secret generic` is `Opaque` and is silently ignored. Check with `kubectl get secret regcred -o jsonpath='{.type}'` and recreate with `kubectl create secret docker-registry`.",
  },
  {
    id: 'db-q15',
    domainId: 'design-build',
    topicId: 'multi-container-patterns',
    category: 'lab',
    kind: 'task',
    difficulty: 'intermediate',
    points: 4,
    prompt:
      'In namespace shop, create a Pod named web-logger with two containers sharing an emptyDir volume. The container named writer (busybox:1.36) must append the date to /out/app.log every two seconds. A native sidecar named tailer (busybox:1.36) must tail that file so its output is visible with `kubectl logs web-logger -c tailer`.',
    context: 'A cluster on Kubernetes 1.29 or later, namespace shop already exists.',
    checkpoints: [
      { id: 'c1', text: 'Pod web-logger exists in namespace shop and reports READY 2/2' },
      { id: 'c2', text: 'An emptyDir volume is declared and mounted in both containers' },
      {
        id: 'c3',
        text: 'The tailer container is an initContainers entry with restartPolicy: Always',
      },
      {
        id: 'c4',
        text: '`kubectl logs web-logger -c tailer -n shop` shows date lines written by writer',
      },
    ],
    explanation:
      'The native sidecar (an `initContainers` entry with `restartPolicy: Always`) guarantees the tailer is running before the writer starts, and it counts towards the READY total - so the Pod reads 2/2. A regular sidecar in `spec.containers` would also work here but gives no ordering guarantee, and would prevent completion if this were a Job.',
    solution: [
      {
        title: 'web-logger.yaml',
        language: 'yaml',
        code: `apiVersion: v1
kind: Pod
metadata:
  name: web-logger
  namespace: shop
spec:
  volumes:
    - name: shared
      emptyDir: {}
  initContainers:
    - name: tailer
      image: busybox:1.36
      restartPolicy: Always # makes this a native sidecar
      command: ["sh", "-c", "touch /logs/app.log; tail -F /logs/app.log"]
      volumeMounts:
        - name: shared
          mountPath: /logs
  containers:
    - name: writer
      image: busybox:1.36
      command: ["sh", "-c", "while true; do date >> /out/app.log; sleep 2; done"]
      volumeMounts:
        - name: shared
          mountPath: /out`,
      },
      {
        title: 'Apply and verify',
        language: 'bash',
        code: `kubectl apply -f web-logger.yaml
kubectl wait --for=condition=Ready pod/web-logger -n shop --timeout=90s
kubectl get pod web-logger -n shop
# READY 2/2

sleep 8
kubectl logs web-logger -c tailer -n shop --tail=3
kubectl get pod web-logger -n shop -o jsonpath='{.spec.initContainers[0].restartPolicy}{"\\n"}'
# Always`,
      },
    ],
  },
  {
    id: 'db-q16',
    domainId: 'design-build',
    topicId: 'persistent-volume-claims',
    category: 'lab',
    kind: 'task',
    difficulty: 'beginner',
    points: 3,
    prompt:
      'In namespace shop, create a PersistentVolumeClaim named app-data requesting 1Gi of ReadWriteOnce storage from the default StorageClass, and a Pod named writer (busybox:1.36, sleeping) that mounts it at /data.',
    context: 'A cluster with a default StorageClass; namespace shop exists.',
    checkpoints: [
      {
        id: 'c1',
        text: 'PVC app-data exists in shop with accessMode ReadWriteOnce and 1Gi requested',
      },
      { id: 'c2', text: 'The PVC reaches STATUS Bound' },
      { id: 'c3', text: 'Pod writer is Running and references the claim by name' },
      { id: 'c4', text: '`kubectl exec writer -n shop -- touch /data/x` succeeds' },
    ],
    explanation:
      'Omit `storageClassName` entirely to use the default class - writing `storageClassName: ""` would instead disable dynamic provisioning. With a `WaitForFirstConsumer` class the PVC stays Pending until the Pod is scheduled, which is expected rather than an error.',
    solution: [
      {
        title: 'pvc-and-pod.yaml',
        language: 'yaml',
        code: `apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
  namespace: shop
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
---
apiVersion: v1
kind: Pod
metadata:
  name: writer
  namespace: shop
spec:
  volumes:
    - name: data
      persistentVolumeClaim:
        claimName: app-data
  containers:
    - name: app
      image: busybox:1.36
      command: ["sleep", "3600"]
      volumeMounts:
        - name: data
          mountPath: /data`,
      },
      {
        title: 'Verify',
        language: 'bash',
        code: `kubectl apply -f pvc-and-pod.yaml
kubectl wait --for=condition=Ready pod/writer -n shop --timeout=180s
kubectl get pvc app-data -n shop
# STATUS Bound
kubectl exec writer -n shop -- sh -c 'echo persisted > /data/x && cat /data/x'`,
      },
    ],
  },
  {
    id: 'db-q17',
    domainId: 'design-build',
    topicId: 'commands-and-args',
    category: 'yaml',
    kind: 'mcq',
    difficulty: 'advanced',
    points: 2,
    prompt:
      'A container has `env: [{name: MESSAGE, value: hi}]` and `command: ["echo", "$MESSAGE"]`. The log shows the literal text `$MESSAGE`. Which change is the better fix?',
    options: [
      { id: 'a', text: 'command: ["echo"] with args: ["$(MESSAGE)"]' },
      { id: 'b', text: 'command: ["echo", "${MESSAGE}"]' },
      { id: 'c', text: 'Add `shell: true` to the container spec' },
      { id: 'd', text: 'Move MESSAGE into a ConfigMap' },
    ],
    correct: ['a'],
    explanation:
      'There is no shell in exec form, so `$MESSAGE` is literal. Kubernetes performs its own `$(VAR)` substitution in `command` and `args` for variables declared in the same container - no shell required, so it works even on images without one. `sh -c "echo $MESSAGE"` also works but makes the shell PID 1 unless you prefix with `exec`. `${VAR}` is not Kubernetes syntax.',
  },
  {
    id: 'db-q18',
    domainId: 'design-build',
    topicId: 'workload-resources',
    category: 'concept',
    kind: 'multi',
    difficulty: 'advanced',
    points: 3,
    prompt: 'Which statements about StatefulSets are true? (Select all that apply.)',
    options: [
      { id: 'a', text: 'It requires `spec.serviceName` pointing at a headless Service' },
      { id: 'b', text: '`volumeClaimTemplates` creates one PVC per Pod' },
      { id: 'c', text: 'Deleting the StatefulSet deletes its volumeClaimTemplate PVCs' },
      { id: 'd', text: 'Pods get stable ordinal names such as db-0 and db-1' },
    ],
    correct: ['a', 'b', 'd'],
    explanation:
      'The PVCs created from `volumeClaimTemplates` are deliberately *retained* when the StatefulSet is deleted, so recreating it reattaches the same data. You must delete them explicitly to reclaim the storage. The headless Service is what provides `<pod>.<svc>.<ns>.svc.cluster.local` per-Pod DNS.',
  },
]
