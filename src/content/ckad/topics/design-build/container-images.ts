import type { Topic } from '../../../types'

export const containerImages: Topic = {
  id: 'container-images',
  title: 'Define, build and modify container images',
  domainId: 'design-build',
  difficulty: 'beginner',
  estimatedMinutes: 25,
  order: 1,
  tags: ['docker', 'dockerfile', 'image', 'entrypoint', 'cmd', 'registry', 'tags', 'multi-stage'],
  oneLiner:
    'How to write a Dockerfile that behaves well in Kubernetes, how ENTRYPOINT and CMD map onto command and args, and how images are pulled.',
  explanation: [
    'A container image is a stack of read-only filesystem layers plus a small configuration blob that says which process to start, as which user, with which environment and working directory. Kubernetes never builds images - it only pulls and runs them.',
    'You describe an image in a **Dockerfile** and build it with `docker build`, `podman build`, `nerdctl build` or a builder such as Buildah or Kaniko. The result is tagged (`registry/namespace/name:tag`) and pushed to a registry the cluster can reach.',
    'The two Dockerfile instructions that matter most in Kubernetes are `ENTRYPOINT` (the executable) and `CMD` (its default arguments). Kubernetes can override each independently: the Pod field `command` replaces `ENTRYPOINT`, and `args` replaces `CMD`. Mixing these up is a classic exam trap.',
    'For the CKAD exam you will not build images inside the exam environment, but you are expected to read a Dockerfile, say what the resulting container will run, and know how to override it from a Pod spec.',
  ],
  whyItMatters: [
    'A container that runs as root, or that ignores SIGTERM, or whose entrypoint is a shell wrapper, causes problems that show up as Kubernetes failures - so the fix often lives in the Dockerfile, not the manifest.',
    'Image tags decide whether a rollout is reproducible. `:latest` combined with `imagePullPolicy: Always` means two Pods from the same Deployment can run different code.',
    'The `command`/`args` override is required for tasks like "make this Pod sleep for an hour" or "run the container with the flag --verbose", which appear regularly.',
  ],
  howItWorks: [
    'Layer model: every `RUN`, `COPY` and `ADD` creates a layer. Layers are cached and shared, so ordering instructions from least- to most-frequently-changed makes rebuilds fast.',
    'ENTRYPOINT/CMD combination rules. If both are set in *exec form*, the container runs `ENTRYPOINT + CMD` concatenated. If only `CMD` is set, it runs `CMD`. If `ENTRYPOINT` is in shell form, `CMD` is ignored.',
    'Kubernetes override rules: `spec.containers[].command` overrides ENTRYPOINT; `spec.containers[].args` overrides CMD. Setting only `command` discards CMD entirely. Setting only `args` keeps ENTRYPOINT and replaces its arguments.',
    'Image references: `nginx` means `docker.io/library/nginx:latest`. Always write the registry, repository and an explicit tag in production, and a specific tag on the exam if the task pins one.',
    '`imagePullPolicy` defaults to `IfNotPresent`, except when the tag is `latest` or omitted, where it defaults to `Always`. `Never` uses only images already on the node.',
    'Multi-stage builds compile in one stage and copy only the artefact into a tiny final stage (`FROM scratch`, `alpine`, or a distroless base). This is how you get a 15 MB image from a 900 MB build environment.',
    'Private registries need a `kubernetes.io/dockerconfigjson` Secret referenced by `spec.imagePullSecrets`, otherwise the kubelet fails with ImagePullBackOff and an "unauthorized" message.',
  ],
  keyObjects: [
    {
      kind: 'Pod',
      apiVersion: 'v1',
      purpose: 'Where image behaviour is selected and overridden at run time.',
      fields: [
        {
          path: 'spec.containers[].image',
          meaning: 'Full image reference; pin an explicit tag or digest.',
          required: true,
        },
        {
          path: 'spec.containers[].imagePullPolicy',
          meaning:
            'Always, IfNotPresent or Never. Defaults to Always for :latest, otherwise IfNotPresent.',
        },
        { path: 'spec.containers[].command[]', meaning: 'Overrides the image ENTRYPOINT.' },
        { path: 'spec.containers[].args[]', meaning: 'Overrides the image CMD.' },
        { path: 'spec.containers[].workingDir', meaning: 'Overrides the image WORKDIR.' },
        {
          path: 'spec.imagePullSecrets[]',
          meaning: 'Names Secrets of type kubernetes.io/dockerconfigjson for private registries.',
        },
      ],
    },
    {
      kind: 'Secret',
      apiVersion: 'v1',
      purpose: 'Holds registry credentials so the kubelet can pull from a private registry.',
      fields: [
        {
          path: 'type',
          meaning: 'Must be kubernetes.io/dockerconfigjson for pull secrets.',
          required: true,
        },
        {
          path: 'data[".dockerconfigjson"]',
          meaning: 'Base64-encoded Docker config containing the registry auth.',
        },
      ],
    },
  ],
  realWorldExample: {
    title: 'A 900 MB image that should have been 20 MB',
    story: [
      'A Go service is built with a single-stage Dockerfile based on `golang:1.23`. The final image is 900 MB, includes the compiler and the full source tree, and takes 40 seconds to pull on every new node.',
      'Rewritten as a multi-stage build, the compiler stays in the build stage and only the static binary is copied into `alpine:3.20`. The image drops to 20 MB and pulls in under two seconds, which visibly speeds up rollouts and scale-ups.',
      'The security benefit is bigger than the speed one: the shipped image contains no compiler, no package manager and no shell if you use a distroless base, so there is far less for an attacker to use.',
      'The Kubernetes-visible symptom of the original problem was Pods sitting in `ContainerCreating` for 40 seconds after every scale-up, which people wrongly blamed on the scheduler.',
    ],
    code: [
      {
        title: 'Single-stage versus multi-stage',
        language: 'dockerfile',
        code: `# BEFORE: one stage, ships the whole toolchain (~900 MB)
FROM golang:1.23
WORKDIR /src
COPY . .
RUN go build -o /app/server ./cmd/server
CMD ["/app/server"]

# AFTER: build stage discarded, only the binary ships (~20 MB)
FROM golang:1.23 AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download            # cached unless dependencies change
COPY . .
RUN CGO_ENABLED=0 go build -o /server ./cmd/server

FROM alpine:3.20
RUN adduser -D -u 10001 appuser
COPY --from=build /server /usr/local/bin/server
USER 10001                     # never run as root
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/server"]
CMD ["--port=8080"]            # default args, overridable from the Pod spec`,
        explanation:
          'Copying go.mod/go.sum before the source means the dependency layer is cached, so day-to-day rebuilds only re-run the compile step.',
      },
    ],
  },
  yamlExamples: [
    {
      title: 'How command and args override the image',
      language: 'yaml',
      code: `# Image defines: ENTRYPOINT ["/usr/local/bin/server"]  CMD ["--port=8080"]
apiVersion: v1
kind: Pod
metadata:
  name: override-demo
  namespace: shop
spec:
  containers:
    # 1. No overrides -> runs: /usr/local/bin/server --port=8080
    - name: default-behaviour
      image: registry.example.com/shop/server:1.4.2

    # 2. args only -> runs: /usr/local/bin/server --port=9090 --verbose
    - name: args-override
      image: registry.example.com/shop/server:1.4.2
      args: ["--port=9090", "--verbose"]

    # 3. command only -> runs: /bin/sh  (CMD is DISCARDED, not appended)
    - name: command-override
      image: registry.example.com/shop/server:1.4.2
      command: ["/bin/sh", "-c", "sleep 3600"]

    # 4. both -> runs: /bin/echo hello
    - name: both-override
      image: registry.example.com/shop/server:1.4.2
      command: ["/bin/echo"]
      args: ["hello"]`,
      explanation:
        'Container 3 is the one people get wrong: setting `command` throws away the image CMD completely, so the container gets no arguments at all unless you also set `args`.',
      placeholders: ['registry.example.com/shop/server:1.4.2', 'shop'],
    },
    {
      title: 'Pinned tag, explicit pull policy, and a pull secret',
      language: 'yaml',
      code: `apiVersion: v1
kind: Pod
metadata:
  name: private-image
  namespace: shop
spec:
  imagePullSecrets:
    - name: regcred # Secret of type kubernetes.io/dockerconfigjson
  containers:
    - name: app
      image: registry.example.com/shop/server:1.4.2 # explicit tag, never :latest
      imagePullPolicy: IfNotPresent # reuse the cached layer if present
      ports:
        - containerPort: 8080`,
      explanation:
        'A digest is even stronger than a tag: `server@sha256:abc123...` is immutable, so the same manifest can never resolve to different code.',
      placeholders: ['registry.example.com/shop/server:1.4.2', 'regcred', 'shop'],
    },
  ],
  imperative: [
    {
      command: 'docker build -t registry.example.com/shop/server:1.4.2 .',
      what: 'Builds an image from the Dockerfile in the current directory and tags it.',
      expected:
        'Layer-by-layer output ending in "naming to registry.example.com/shop/server:1.4.2".',
      placeholders: ['registry.example.com/shop/server:1.4.2'],
    },
    {
      command: 'docker push registry.example.com/shop/server:1.4.2',
      what: 'Uploads the image so the cluster nodes can pull it. A cluster cannot use an image that only exists on your laptop.',
      expected: 'Pushed digest lines.',
      placeholders: ['registry.example.com/shop/server:1.4.2'],
    },
    {
      command:
        'docker image inspect nginx:1.27-alpine --format "{{.Config.Entrypoint}} {{.Config.Cmd}}"',
      what: 'Shows the image ENTRYPOINT and CMD, so you know what `command`/`args` would override.',
      expected: '[/docker-entrypoint.sh] [nginx -g daemon off;]',
      placeholders: ['nginx:1.27-alpine'],
    },
    {
      command: 'kubectl run sleeper --image=busybox:1.36 --command -- sleep 3600',
      what: 'Creates a Pod overriding the entrypoint. Everything after `--` becomes `command`.',
      expected: 'pod/sleeper created',
      namespaceNote: 'Created in your current namespace unless you add -n.',
      placeholders: ['sleeper'],
    },
    {
      command: 'kubectl run echoer --image=busybox:1.36 -- echo hello',
      what: 'Without `--command`, the trailing arguments become `args`, leaving the image ENTRYPOINT in place.',
      expected: 'pod/echoer created, and the Pod completes immediately.',
      placeholders: ['echoer'],
    },
    {
      command:
        'kubectl create secret docker-registry regcred --docker-server=registry.example.com --docker-username=ci --docker-password=<token> -n shop',
      what: 'Creates the pull secret for a private registry.',
      expected: 'secret/regcred created',
      placeholders: ['registry.example.com', 'ci', '<token>', 'shop'],
    },
    {
      command:
        'kubectl set image deployment/api api=registry.example.com/shop/server:1.4.3 -n shop',
      what: 'Changes the image of a running Deployment and triggers a rolling update.',
      expected: 'deployment.apps/api image updated',
      placeholders: ['api', 'registry.example.com/shop/server:1.4.3', 'shop'],
    },
  ],
  declarative: {
    steps: [
      'Write the Dockerfile: pick a small base, order instructions from stable to volatile, create a non-root user, set ENTRYPOINT and CMD in exec form.',
      'Build and tag with an immutable version, never `latest`.',
      'Push to a registry the cluster can reach, and create an imagePullSecret if it is private.',
      'Reference the exact tag (or digest) in the Pod template, and override `command`/`args` only when the task requires it.',
    ],
    code: [
      {
        title: 'A production-shaped Dockerfile',
        language: 'dockerfile',
        code: `FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev          # cached until dependencies change

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A numeric UID works even when the image has no matching /etc/passwd entry,
# and it satisfies runAsNonRoot in a Kubernetes securityContext.
USER 10001
EXPOSE 3000
# Exec form: PID 1 is node itself, so it receives SIGTERM directly
# and Kubernetes can shut the Pod down gracefully.
ENTRYPOINT ["node", "server.js"]
CMD ["--port=3000"]`,
        explanation:
          'Shell form (`ENTRYPOINT node server.js`) wraps the process in /bin/sh, which does not forward SIGTERM. Pods then take the full 30-second grace period to die on every rollout.',
      },
    ],
  },
  verification: [
    {
      command:
        'kubectl get pod override-demo -n shop -o jsonpath=\'{range .spec.containers[*]}{.name}{": "}{.command}{" "}{.args}{"\\n"}{end}\'',
      what: 'Prints the effective command and args for each container so you can confirm an override landed.',
      expected: 'command-override: ["/bin/sh","-c","sleep 3600"]',
      placeholders: ['override-demo', 'shop'],
    },
    {
      command: 'kubectl get pod app -n shop -o jsonpath=\'{.spec.containers[0].image}{"\\n"}\'',
      what: 'Confirms which image tag the Pod is actually running.',
      expected: 'registry.example.com/shop/server:1.4.2',
      placeholders: ['app', 'shop'],
    },
    {
      command: 'kubectl exec app -n shop -- id',
      what: 'Confirms which user the container process runs as - the practical check that USER in the Dockerfile took effect.',
      expected: 'uid=10001 gid=10001',
      placeholders: ['app', 'shop'],
    },
  ],
  troubleshooting: [
    {
      command: 'kubectl describe pod app -n shop | grep -A5 Events',
      what: 'ImagePullBackOff details live here: the exact image reference tried and the registry error.',
      expected: 'Failed to pull image "...": rpc error: ... not found, or unauthorized.',
      placeholders: ['app', 'shop'],
    },
    {
      command:
        'kubectl get pod app -n shop -o jsonpath=\'{.status.containerStatuses[0].state}{"\\n"}\'',
      what: 'Shows the container state and reason without scrolling describe output.',
      expected: '{"waiting":{"message":"...","reason":"ImagePullBackOff"}}',
      placeholders: ['app', 'shop'],
    },
    {
      command: 'kubectl logs app -n shop',
      what: 'If the entrypoint is wrong you usually see the shell error here: "exec: \\"server\\": executable file not found in $PATH".',
      expected: 'The application output, or an exec error.',
      placeholders: ['app', 'shop'],
    },
    {
      command: 'kubectl get secret regcred -n shop -o jsonpath="{.type}" && echo',
      what: 'Confirms a pull secret has the right type. A generic Secret will not work as an imagePullSecret.',
      expected: 'kubernetes.io/dockerconfigjson',
      placeholders: ['regcred', 'shop'],
    },
  ],
  commonMistakes: [
    'Setting `command` when you meant `args`, which silently discards the image CMD.',
    'Using `:latest`, then being unable to explain why two Pods behave differently.',
    'Building an image locally and expecting a multi-node cluster to find it. It must be pushed to a registry, or side-loaded onto every node.',
    'Creating a generic Secret and using it as an `imagePullSecret`. It must be type `kubernetes.io/dockerconfigjson`.',
    'Using shell-form ENTRYPOINT, so PID 1 is `sh` and SIGTERM never reaches the app - every Pod deletion then waits the full grace period.',
    'Running as root because no `USER` was set, which then fails any Pod with `runAsNonRoot: true`.',
    'Assuming `imagePullPolicy: IfNotPresent` will pick up a rebuilt image with the same tag. It will not - the node already has that tag cached.',
  ],
  examTips: [
    'You will not build images in the exam, but you may be given a Dockerfile and asked what the container runs. Work through ENTRYPOINT + CMD carefully.',
    'Remember the `kubectl run` distinction: `-- sleep 3600` sets **args**; `--command -- sleep 3600` sets **command**.',
    'To make a container stay alive for a task, `command: ["sleep", "3600"]` or `command: ["sh","-c","sleep 3600"]` are both accepted.',
    'If a task mentions a private registry, the answer is almost always `kubectl create secret docker-registry` plus `imagePullSecrets`.',
    'ImagePullBackOff is an image or credential problem, never an application problem - do not waste time on logs.',
  ],
  summary: [
    'Images are layers plus config; Kubernetes pulls and runs them but never builds them.',
    '`command` overrides ENTRYPOINT, `args` overrides CMD, and setting `command` alone discards CMD.',
    'Pin explicit tags or digests; `:latest` defaults `imagePullPolicy` to Always and destroys reproducibility.',
    'Multi-stage builds plus a non-root `USER` give small, safer images that satisfy `runAsNonRoot`.',
    'Private registries need a `kubernetes.io/dockerconfigjson` Secret in `imagePullSecrets`.',
  ],
  practice: [
    {
      id: 'img-p1',
      level: 'beginner',
      prompt:
        'An image has `ENTRYPOINT ["/app/server"]` and `CMD ["--port=8080"]`. A Pod sets `args: ["--port=9090"]` and nothing else. What runs?',
      answer: '/app/server --port=9090',
      explanation:
        '`args` replaces CMD only. ENTRYPOINT is untouched, so the executable stays the same and only its arguments change. This is usually what you want.',
    },
    {
      id: 'img-p2',
      level: 'intermediate',
      prompt:
        'Write a Pod manifest fragment that runs `busybox:1.36` and keeps it alive for one hour doing nothing, so you can exec into it.',
      answer:
        'containers:\n  - name: debug\n    image: busybox:1.36\n    command: ["sleep", "3600"]\n\nOr equivalently: `kubectl run debug --image=busybox:1.36 --command -- sleep 3600`',
      explanation:
        "busybox's default command exits immediately, so the Pod would go straight to Completed and then CrashLoopBackOff under `restartPolicy: Always`. Overriding `command` with a long sleep is the standard trick for a scratch Pod.",
    },
    {
      id: 'img-p3',
      level: 'advanced',
      prompt:
        'A Pod is stuck in ImagePullBackOff with the message `unauthorized: authentication required`. List the checks in order and the command that fixes the most likely cause.',
      answer:
        "1. `kubectl describe pod <pod>` - confirm the exact image reference being pulled.\n2. `kubectl get pod <pod> -o jsonpath='{.spec.imagePullSecrets}'` - is a pull secret referenced at all?\n3. `kubectl get secret <name> -o jsonpath='{.type}'` - is it `kubernetes.io/dockerconfigjson`?\n\nFix: `kubectl create secret docker-registry regcred --docker-server=<registry> --docker-username=<user> --docker-password=<token> -n <ns>` then add `imagePullSecrets: [{name: regcred}]` to the Pod spec.",
      explanation:
        '"unauthorized" means the registry was reachable but rejected the credentials, so it is a Secret problem. "not found" or "manifest unknown" would instead mean a wrong repository or tag.',
    },
  ],
  lab: {
    title: 'Prove the command/args override rules',
    scenario:
      'Rather than trusting the table, you will run four containers that differ only in their overrides and read the actual process each one started.',
    prerequisites: ['A cluster with internet access to Docker Hub'],
    tasks: [
      { instruction: 'Create namespace `img-lab` and set it as default.' },
      {
        instruction:
          'Find the ENTRYPOINT and CMD of `nginx:1.27-alpine` using kubectl alone (hint: run it and inspect the resolved spec, or reason from the docs).',
      },
      {
        instruction:
          'Create a Pod `p-args` from `busybox:1.36` that passes `args` only, printing "from args".',
      },
      {
        instruction:
          'Create a Pod `p-command` from `busybox:1.36` that overrides `command` to sleep for an hour.',
      },
      { instruction: 'Create a Pod `p-both` that sets both `command` and `args` to echo "both".' },
      {
        instruction:
          'Read the logs of each completed Pod and confirm the output matches the rules.',
      },
      { instruction: 'Exec into `p-command` to prove it is alive, then delete the namespace.' },
    ],
    solution: [
      {
        title: 'Steps 1 and 3-5 - one manifest, three behaviours',
        language: 'yaml',
        code: `# overrides.yaml
apiVersion: v1
kind: Pod
metadata:
  name: p-args
  namespace: img-lab
spec:
  restartPolicy: Never # it prints once and exits; do not restart it
  containers:
    - name: c
      image: busybox:1.36
      # busybox ENTRYPOINT is empty and CMD is ["sh"], so args replaces "sh"
      args: ["echo", "from args"]
---
apiVersion: v1
kind: Pod
metadata:
  name: p-command
  namespace: img-lab
spec:
  containers:
    - name: c
      image: busybox:1.36
      command: ["sleep", "3600"] # replaces the image entrypoint/cmd entirely
---
apiVersion: v1
kind: Pod
metadata:
  name: p-both
  namespace: img-lab
spec:
  restartPolicy: Never
  containers:
    - name: c
      image: busybox:1.36
      command: ["/bin/echo"]
      args: ["both"]`,
      },
      {
        title: 'Apply and read the results',
        language: 'bash',
        code: `kubectl create namespace img-lab
kubectl config set-context --current --namespace=img-lab
kubectl apply -f overrides.yaml

kubectl wait --for=jsonpath='{.status.phase}'=Succeeded pod/p-args --timeout=60s
kubectl logs p-args
# from args

kubectl logs p-both
# both

kubectl get pod p-command
# NAME        READY   STATUS    RESTARTS   AGE
# p-command   1/1     Running   0          20s`,
      },
      {
        title: 'Step 2 - read the effective command from the API',
        language: 'bash',
        code: `kubectl run nginx-probe --image=nginx:1.27-alpine
kubectl get pod nginx-probe -o jsonpath='{.spec.containers[0].command}{" | "}{.spec.containers[0].args}{"\\n"}'
# " | "     <- both empty: the Pod spec sets neither, so the IMAGE defaults apply

# The image's own defaults are visible in the running process:
kubectl exec nginx-probe -- ps -o pid,args
# PID   COMMAND
#   1   nginx: master process nginx -g daemon off;`,
        explanation:
          'Empty `command` and `args` in the Pod spec is the normal case - it means "use whatever the image says". ps inside the container is how you see what that resolved to.',
      },
      {
        title: 'Steps 6-7 - exec and clean up',
        language: 'bash',
        code: `kubectl exec -it p-command -- sh -c 'echo alive; sleep 1'
# alive

kubectl config set-context --current --namespace=default
kubectl delete namespace img-lab`,
      },
    ],
    verification: [
      {
        command: 'kubectl logs p-args -n img-lab',
        what: 'Confirms args replaced the image CMD.',
        expected: 'from args',
      },
      {
        command:
          'kubectl get pod p-command -n img-lab -o jsonpath=\'{.spec.containers[0].command}{"\\n"}\'',
        what: 'Confirms the command override is recorded on the object.',
        expected: '["sleep","3600"]',
      },
    ],
    cleanup: [
      {
        command: 'kubectl delete namespace img-lab',
        what: 'Removes the lab namespace.',
        expected: 'namespace "img-lab" deleted',
      },
    ],
  },
  relatedTopicIds: ['commands-and-args', 'pods', 'securitycontext'],
  docs: [
    { title: 'Images', url: 'https://kubernetes.io/docs/concepts/containers/images/' },
    {
      title: 'Define a command and arguments for a container',
      url: 'https://kubernetes.io/docs/tasks/inject-data-application/define-command-argument-container/',
    },
  ],
}
