import type { InterviewQuestion } from '../../../types'

/**
 * How a log line gets from an application to a place you can search it.
 *
 * The single most common observability interview question, and the one people
 * answer least precisely: they say "Fluent Bit ships it to Elasticsearch" and
 * stop. The chain has six links and every one of them can lose data.
 */
export const grafanaLogsQuestions: InterviewQuestion[] = [
  {
    id: 'itv-graf-13',
    level: 'basic',
    kind: 'open',
    prompt:
      'Walk me through exactly how a log line written by an application in Kubernetes ends up searchable in Grafana.',
    probing:
      'The flagship logging question. They want the full chain, link by link, not "an agent ships it".',
    answer: [
      'Six links, and it is worth naming each because every one can drop data.',
      '**One: the application writes to stdout or stderr.** That is the whole contract in a container. The application does not write files, does not know about Loki, and does not ship anything itself. It writes a line and forgets about it.',
      '**Two: the container runtime captures it.** containerd or CRI-O reads the process stdout stream and writes each line to a file on the node, in CRI log format - a timestamp, the stream name, a partial or full flag, then the message. The path is `/var/log/pods/<namespace>_<pod>_<uid>/<container>/0.log`, with `/var/log/containers/` holding symlinks to them. This is also exactly what `kubectl logs` reads, which is why `kubectl logs` shows nothing once a node is gone.',
      '**Three: the runtime rotates those files.** Usually at 10Mi with 5 files kept, set by the kubelet. Anything that rotates away before the agent reads it is lost forever.',
      '**Four: a node agent tails the files.** Grafana Alloy, Promtail, Fluent Bit or Fluentd runs as a DaemonSet - one pod per node - mounting `/var/log` from the host. It follows the files, remembers its read position in a checkpoint so a restart does not re-send everything, and enriches each line with Kubernetes metadata by asking the API server which pod that file belongs to: namespace, pod, container, node and labels.',
      '**Five: the agent pushes to the store.** Loki, Elasticsearch or a cloud service, over HTTP, batched and compressed, with retries and a backoff when the store pushes back.',
      '**Six: Grafana queries the store** when you open a panel or type in Explore. Grafana is at the end of the chain and holds nothing.',
      'The thing to say last, because it is what separates a good answer: this pipeline is **best-effort, not guaranteed**. There is no acknowledgement back to the application. If the node dies with unshipped lines, or the file rotates under the agent, those lines are gone. Logs that must not be lost - audit and payment trails - should be written to a durable store by the application itself, not scraped off a node.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'The log path, end to end',
        caption: 'Six links, no acknowledgement. Every arrow is a place lines can be lost.',
        nodes: [
          {
            label: 'Application process',
            detail: 'writes a line to stdout - and that is all it does',
            tone: 'accent',
          },
          {
            label: 'Container runtime',
            detail: 'containerd writes /var/log/pods/.../0.log in CRI format',
            arrowLabel: 'captures stream',
          },
          {
            label: 'Node filesystem',
            detail: 'rotated at 10Mi, 5 files kept - the buffer you actually have',
            arrowLabel: 'writes file',
            branch: {
              label: 'Rotated before shipping',
              detail: 'lines lost, silently',
              tone: 'danger',
            },
          },
          {
            label: 'Node agent DaemonSet',
            detail: 'Alloy or Fluent Bit tails files, adds pod and namespace labels',
            arrowLabel: 'tails + enriches',
            tone: 'success',
          },
          {
            label: 'Log store',
            detail: 'Loki or Elasticsearch - indexes, compresses, retains',
            arrowLabel: 'HTTP push, batched',
          },
          {
            label: 'Grafana',
            detail: 'LogQL from Explore or a panel, on demand',
            arrowLabel: 'queries',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Seeing the chain on a real node',
        language: 'bash',
        explanation:
          'Every claim above is checkable. Walking this in an interview is very convincing.',
        code: `# What the runtime actually wrote - CRI format:
# <RFC3339 timestamp> <stream> <P|F partial/full> <message>
sudo tail -2 /var/log/pods/default_checkout-7d9f_*/checkout/0.log
2026-09-17T09:14:02.881Z stdout F {"level":"error","msg":"payment declined"}

# /var/log/containers holds symlinks - this is what agents usually glob
ls -l /var/log/containers/ | head -3

# The kubelet's rotation settings decide your buffer
ps aux | grep kubelet | tr ' ' '\\n' | grep container-log
# --container-log-max-size=10Mi --container-log-max-files=5

# kubectl logs reads those same files - nothing more
kubectl logs checkout-7d9f -c checkout --tail=5

# Which is why this fails once the pod object is gone:
kubectl logs checkout-7d9f --previous   # only the ONE previous container`,
      },
    ],
    deeper: [
      'The agent checkpoint (a positions file) is what makes restarts safe. Losing the checkpoint means either re-sending from the start, producing duplicates, or skipping to the end, producing a gap.',
      'Journald is an alternative source on some distributions, and the same agents can read it - worth mentioning when asked about system-level logs from the kubelet or containerd themselves.',
      'Sidecar shipping is the exception for applications that genuinely cannot write to stdout - a legacy process logging to a file. Mount an emptyDir shared between the app and a sidecar that tails it. It costs a container per pod, so it is a fallback, not a default.',
    ],
    traps: [
      'Saying the application "sends logs to Loki". It writes to stdout; something else does the rest.',
      'Forgetting the rotation step. It is where data loss actually happens.',
      'Claiming the pipeline is reliable. Nothing acknowledges the write back to the app.',
    ],
    followUps: [
      'What happens to logs if the node dies?',
      'DaemonSet or sidecar - which and why?',
      'How does the agent know which pod a file belongs to?',
    ],
    tags: ['logging', 'kubernetes', 'pipeline', 'observability'],
  },
  {
    id: 'itv-graf-14',
    level: 'basic',
    kind: 'mcq',
    prompt: 'In Kubernetes, where should a containerised application write its logs?',
    options: [
      { id: 'a', text: 'To stdout and stderr, and nowhere else' },
      { id: 'b', text: 'To a file on a PersistentVolume, so they survive restarts' },
      { id: 'c', text: 'Directly to Loki over HTTP from the application code' },
      { id: 'd', text: 'To syslog on the node, via a hostPath mount' },
    ],
    correct: ['a'],
    probing:
      'The twelve-factor principle applied to containers. A wrong answer here undermines everything after it.',
    answer: [
      'Write to **stdout and stderr**. The application treats logs as a stream of events and hands them to its environment; collecting, routing and storing them is somebody else’s job. This is the twelve-factor rule and it is exactly right for containers.',
      'Option B looks safe and is a trap. A PersistentVolume with ReadWriteOnce cannot be mounted by many pods, your logs are now spread across volumes nobody searches, and you have coupled a stateless workload to storage for no benefit.',
      'Option C - logging directly to Loki from application code - couples your service to your observability stack. When Loki is unavailable or slow, your request handler is now blocking on it, or silently dropping. It also breaks `kubectl logs` completely, which is the first thing anybody reaches for.',
      'Option D bypasses everything Kubernetes gives you: no pod labels, no namespace, no per-container separation, and a hostPath mount that is a security problem in its own right.',
      'The one legitimate exception is an application you cannot change that insists on writing files. Then you use a **sidecar** that tails the file and writes to its own stdout, or ships it directly - a workaround, deliberately chosen, not the default.',
    ],
    code: [
      {
        title: 'The sidecar fallback for a legacy file logger',
        language: 'yaml',
        explanation:
          'A shared emptyDir, and a sidecar that turns a file back into a stream. Use only when the app cannot be changed.',
        code: `apiVersion: v1
kind: Pod
metadata:
  name: legacy-app
spec:
  containers:
    - name: app
      image: legacy-app:2.1
      # insists on writing /var/log/app/app.log
      volumeMounts:
        - name: logs
          mountPath: /var/log/app

    - name: log-shipper
      image: busybox:1.36
      args: ['/bin/sh', '-c', 'tail -n+1 -F /var/log/app/app.log']
      volumeMounts:
        - name: logs
          mountPath: /var/log/app

  volumes:
    - name: logs
      emptyDir: {}     # shared, dies with the pod - that is fine, it is a relay`,
      },
    ],
    traps: [
      'Writing logs to a PersistentVolume "so they are not lost". It makes them harder to search and blocks scaling.',
      'Having the application push to the log store itself, which couples availability of your service to availability of your logging.',
    ],
    followUps: [
      'What if the application can only write to a file?',
      'Why does logging straight to Loki from code cause problems?',
    ],
    tags: ['logging', 'kubernetes', 'twelve-factor'],
  },
  {
    id: 'itv-graf-15',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How does Loki differ from Elasticsearch, and why would you pick it for a Kubernetes platform?',
    probing:
      'The central design trade-off in modern logging. They want you to know what Loki gives up.',
    answer: [
      'The one-sentence version: **Loki indexes labels, not log content.** Elasticsearch parses every log line, tokenises it and builds a full-text inverted index over every field. Loki builds a small index over a handful of labels - namespace, pod, container, app - and stores the log lines themselves as compressed chunks in object storage, untouched.',
      'The consequence is cost. Elasticsearch’s index is frequently as large as the data, needs fast disks and a lot of RAM. Loki’s index is tiny, the chunks live in S3 or GCS at object-storage prices, and running it is dramatically cheaper - often by an order of magnitude at the same volume.',
      'What you give up is arbitrary full-text search across everything. A Loki query must first select a **stream** by labels, and only then filter the content by brute force over that stream. `{namespace="prod"} |= "OutOfMemory"` is fast because it decompresses only prod chunks. Searching for that string across every namespace for 30 days is slow, because there is no index to help - Loki parallelises the brute force, but it is still brute force.',
      'For a Kubernetes platform that trade is usually excellent, because the label set Loki wants is exactly what Kubernetes already gives you, and real investigations are almost always scoped: you know the service and roughly when. Loki also uses the **same label model as Prometheus**, so `{namespace="prod", app="checkout"}` means the same thing in both, and correlating a metrics spike with logs becomes natural.',
      'I would still choose Elasticsearch when the workload is genuinely search-shaped - security analytics, full-text hunting across everything, complex aggregations over log fields, or a compliance requirement for structured long-term retention with rich queries.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Loki or Elasticsearch?',
        caption: 'Loki trades arbitrary search for a fraction of the cost.',
        question: 'What does your team actually do with logs?',
        branches: [
          {
            condition: 'Debug a known service around a known time',
            result: 'Loki',
            detail: 'label selector narrows first, cheap object storage, same labels as Prometheus',
            tone: 'success',
          },
          {
            condition: 'Hunt an unknown string across everything',
            result: 'Elasticsearch',
            detail: 'full-text index is what you are paying for',
            tone: 'accent',
          },
          {
            condition: 'Rich aggregation and reporting over log fields',
            result: 'Elasticsearch or a warehouse',
            detail: 'Loki metric queries are capable but not an analytics engine',
            tone: 'accent',
          },
          {
            condition: 'Cost is the binding constraint',
            result: 'Loki',
            detail: 'index size is the whole difference',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'The same investigation in both query languages',
        language: 'text',
        explanation:
          'Loki forces a label selector first. That constraint is the reason it is cheap.',
        code: `# LogQL - stream selector is MANDATORY, then filter the content
{namespace="prod", app="checkout"} |= "payment declined"

# Parse structured logs, then filter on a parsed field
{namespace="prod", app="checkout"}
  | json
  | level="error" and status_code >= 500

# Turn logs into a metric - this is how you alert on log content
sum by (pod) (
  rate({namespace="prod", app="checkout"} |= "OutOfMemory" [5m])
)

# Elasticsearch/Lucene - no selector needed, index carries the weight
kubernetes.namespace:"prod" AND message:"payment declined"

# ...which is also why this is fine in ES and expensive in Loki:
message:"OutOfMemory"`,
      },
    ],
    deeper: [
      'Loki queries are parallelised by splitting the time range and the chunks across queriers, so "brute force" is less alarming than it sounds - but it scales with data scanned, which is why the label selector matters so much.',
      'Since Loki 3.0 the TSDB index and bloom filters have made unstructured filters considerably faster, and structured metadata lets you attach high-cardinality fields such as a trace ID without making them stream labels.',
      'Both are only as good as the log format. Structured JSON logs make `| json | level="error"` trivial; unstructured text forces regex, which is slower and brittle.',
    ],
    traps: [
      'Saying Loki is "Elasticsearch but cheaper" with no mention of what it gives up.',
      'Assuming you can search all namespaces for an arbitrary string as cheaply as in Elasticsearch.',
    ],
    followUps: [
      'What is a stream in Loki, and why do labels define it?',
      'How would you alert when a specific error appears in logs?',
      'What happens if you add a high-cardinality label in Loki?',
    ],
    tags: ['loki', 'logging', 'elasticsearch', 'architecture'],
  },
  {
    id: 'itv-graf-16',
    level: 'advanced',
    kind: 'open',
    prompt:
      'Why is adding a high-cardinality label in Loki so damaging, and what do you do instead?',
    probing:
      'The number one way teams break Loki. A senior answer explains the mechanism, not just the rule.',
    answer: [
      'In Loki, a **stream** is one unique combination of labels, and each stream gets its own chunks. Add a label with many values - a request ID, a user ID, a pod IP, a trace ID - and you multiply the number of streams by that cardinality.',
      'The damage is concrete. Every active stream holds an in-memory chunk in the ingester until it is flushed, so memory grows with stream count and ingesters start being OOM-killed. Each stream flushes its own small chunk, so instead of a few large well-compressed objects you get millions of tiny ones, which destroys compression and makes object storage slow and expensive to list. The index grows too, and queries that touch many streams get slower because they must open far more chunks.',
      'The rule is: **labels are for things you select by, and they should have low, bounded cardinality.** Namespace, app, container, level, environment, cluster. Fifty values is fine; fifty thousand is not.',
      'What you do instead depends on why you wanted it. If it is something you filter on occasionally - a request ID - leave it **in the log line** and filter at query time with `|= "abc123"` or, better, parse it with `| json | request_id="abc123"`. Filtering is cheap once the stream selector has narrowed the data.',
      'If it is something you need often and it is genuinely high-cardinality - a trace ID for correlation - use **structured metadata**, added in Loki 3.0 exactly for this. It attaches key-value pairs to individual log lines without creating new streams, so you can jump from a log to a trace without paying the stream explosion. That is the modern answer and it is what an interviewer hoping for depth is listening for.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'What one bad label does',
        caption: 'Stream count is the number that decides whether Loki is healthy.',
        nodes: [
          {
            label: 'Agent adds pod_ip as a label',
            detail: 'looks harmless - it is one small string',
            tone: 'warning',
          },
          {
            label: 'Stream count multiplies',
            detail: 'every pod restart creates a brand new stream, forever',
            arrowLabel: 'per unique value',
            tone: 'danger',
          },
          {
            label: 'Ingester memory grows',
            detail: 'one open chunk held per active stream',
            arrowLabel: 'consequence',
            tone: 'danger',
          },
          {
            label: 'Tiny chunks flushed',
            detail: 'compression collapses, object count explodes',
            arrowLabel: 'consequence',
            tone: 'danger',
          },
          {
            label: 'Queries slow, ingesters OOM',
            detail: 'and the rate limiter starts rejecting pushes',
            arrowLabel: 'outcome',
            tone: 'danger',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Keeping the label set small in the agent',
        language: 'yaml',
        explanation:
          'Alloy and Promtail both let you choose which discovered metadata becomes a label. Choose very little.',
        code: `# Promtail / Alloy relabel rules: promote only bounded fields
relabel_configs:
  # Good - bounded, and what you actually select by
  - source_labels: [__meta_kubernetes_namespace]
    target_label: namespace
  - source_labels: [__meta_kubernetes_pod_label_app]
    target_label: app
  - source_labels: [__meta_kubernetes_pod_container_name]
    target_label: container

  # Deliberately NOT promoted to labels:
  #   pod IP, pod UID, request id, trace id, user id, full URL path
  # They stay inside the log line and are filtered at query time.

  # The pod name is borderline: bounded per deployment, but every
  # rollout creates new values. Acceptable, and commonly used -
  # just know it is the biggest contributor to your stream count.
  - source_labels: [__meta_kubernetes_pod_name]
    target_label: pod`,
      },
      {
        title: 'Finding the label that is hurting you',
        language: 'bash',
        explanation: 'Loki reports its own cardinality. Check it before it becomes an incident.',
        code: `# Which labels exist, and how many values does each have?
curl -s "http://loki:3100/loki/api/v1/labels" | jq -r '.data[]'
curl -s "http://loki:3100/loki/api/v1/label/pod/values" | jq '.data | length'

# Active streams per tenant - the number that predicts an OOM
sum(loki_ingester_memory_streams) by (tenant)

# Are pushes being rejected for too many streams?
sum(rate(loki_discarded_samples_total[5m])) by (reason)
# reason="per_stream_rate_limit" or "max_streams_per_user"

# Query-time alternative to a label - filter the line instead
# {namespace="prod"} | json | request_id="7f3a91"`,
      },
    ],
    deeper: [
      'Structured metadata (Loki 3.0+) is the sanctioned home for trace IDs and similar. It is stored with the line, not in the index, so it costs nothing in stream count while remaining queryable.',
      'The per-stream rate limit is deliberately low (a few MB/s). Teams hit it, raise the limit, and make the real problem worse - the correct response is almost always fewer streams, not a higher limit.',
      'The same reasoning applies to Prometheus labels for exactly the same reason. If you can explain one you can explain the other, and interviewers often ask you to.',
    ],
    traps: [
      'Adding a trace ID as a stream label to make correlation easy. It is the fastest way to take Loki down.',
      'Raising `max_streams_per_user` to make the errors stop. It converts a rejection into an OOM.',
    ],
    followUps: [
      'What is structured metadata and when would you use it?',
      'How does this compare to Prometheus cardinality?',
      'How would you detect the problem before the ingesters fall over?',
    ],
    tags: ['loki', 'cardinality', 'scaling', 'troubleshooting'],
  },
  {
    id: 'itv-graf-17',
    level: 'intermediate',
    kind: 'multi',
    prompt:
      'Logs from one namespace stopped appearing in Grafana an hour ago. Which of these are plausible causes? Select all that apply.',
    options: [
      { id: 'a', text: 'The log agent DaemonSet has no pod running on those nodes' },
      { id: 'b', text: 'Loki is rejecting pushes because a per-tenant rate limit was exceeded' },
      { id: 'c', text: 'The agent relabel rules were changed and now drop that namespace' },
      { id: 'd', text: 'Grafana was restarted, losing the buffered logs it had stored' },
      { id: 'e', text: 'The application switched to writing a file instead of stdout' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    probing: 'Whether you can reason along the pipeline and reject causes that are not on it.',
    answer: [
      'The right method is to walk the chain in order and ask at each link "did the line get this far?". Four of these are on the chain; one is not.',
      '**A** - no agent pod on the node means nothing is tailing the files. Common after a taint is added, a node pool is replaced, or the DaemonSet’s tolerations stop matching.',
      '**B** - Loki enforces per-tenant ingestion limits and returns HTTP 429. The agent retries, its buffer fills, and it starts dropping. The agent logs say so loudly, which is why reading the agent logs is step one.',
      '**C** - a relabel change that drops or fails to match the namespace is a silent killer: nothing errors, the lines are simply discarded at the agent.',
      '**E** - if the application now writes to a file inside the container, the runtime never sees the stream, so nothing is written to `/var/log/pods` and there is nothing to tail. `kubectl logs` would be empty too, which is the quickest way to confirm it.',
      '**D** is the distractor. Grafana buffers nothing - it queries Loki live. Restarting it cannot lose logs, and if Grafana were the problem every namespace would be affected, not one.',
    ],
    code: [
      {
        title: 'Walking the chain, link by link',
        language: 'bash',
        explanation: 'Each command answers "did the line reach this stage?". Stop at the first no.',
        code: `# 1. Is the app still writing to stdout at all?
kubectl logs -n prod deploy/checkout --tail=5
#    empty here => the problem is upstream of everything else

# 2. Does the runtime have the file on the node?
kubectl debug node/worker-3 -it --image=busybox -- \\
  ls -l /host/var/log/containers/ | grep checkout

# 3. Is an agent pod running on THAT node?
kubectl -n monitoring get pods -o wide -l app=alloy | grep worker-3

# 4. What does the agent say? Rate limits and auth failures appear here
kubectl -n monitoring logs -l app=alloy --tail=50 | grep -Ei 'error|429|refused'

# 5. Is Loki rejecting, and why?
sum(rate(loki_discarded_samples_total[5m])) by (reason, tenant)

# 6. Only now: does the data exist in Loki, ignoring Grafana?
curl -sG http://loki:3100/loki/api/v1/query_range \\
  --data-urlencode '{namespace="prod"}' | jq '.data.result | length'`,
      },
    ],
    deeper: [
      'Always check whether the gap is one namespace or everything. One namespace points at relabelling, a tenant limit or the app itself; everything points at the agent, the store or the network between them.',
      'The agent’s own metrics are the fastest diagnosis: `promtail_sent_entries_total` or the Alloy equivalent going flat while `promtail_dropped_entries_total` climbs tells you the answer immediately.',
      'Set an alert on "no logs received from a namespace that normally sends them" - absence of data is the one failure a log system cannot show you by looking at logs.',
    ],
    followUps: [
      'How would you alert on logs stopping?',
      'What does the agent do when Loki returns 429?',
      'Where would you look if only one node were affected?',
    ],
    tags: ['logging', 'troubleshooting', 'loki', 'kubernetes'],
  },
  {
    id: 'itv-graf-18',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is structured logging, and why does it matter so much for a log pipeline?',
    probing:
      'Instrumentation quality. The best pipeline in the world cannot rescue unparseable logs.',
    answer: [
      '**Structured logging** means emitting each event as machine-readable key-value data - almost always a single line of JSON - instead of a sentence. Rather than `User 4821 failed payment for order 99123 after 2.4s`, you emit fields: `event`, `user_id`, `order_id`, `duration_ms`, `level`.',
      'It matters because everything downstream becomes a field lookup instead of a regular expression. `| json | duration_ms > 2000` is exact, fast and survives someone rewording the message. The regex equivalent is brittle and breaks the day a developer changes the wording.',
      'It also makes logs aggregatable. You can compute an error rate by `error_code`, or a p99 of `duration_ms`, directly from logs - and in Loki that means turning a log stream into a metric you can alert on and graph beside your Prometheus data.',
      'Three practical rules I would insist on. Put a **trace ID** and a **request ID** in every line, because that is what lets you pivot from a log to a trace and reconstruct one request across services. Use a **consistent field vocabulary** across services - `level` everywhere, not `lvl` in one and `severity` in another - because a templated dashboard depends on it. And **never log secrets or personal data**; once a line is in the log store it has been replicated, backed up and retained, and removing it is genuinely hard.',
      'The one caveat worth saying: JSON is hostile to read by eye in a terminal. The usual compromise is human-readable output in local development and JSON in every deployed environment, chosen by an environment variable.',
    ],
    code: [
      {
        title: 'Unstructured versus structured, and what each costs to query',
        language: 'python',
        explanation:
          'The same event, logged two ways. The second is queryable, aggregatable and correlatable.',
        code: `import logging, json, time

# --- Unstructured: readable, and nearly useless downstream -----------
logging.error(f"User {user_id} failed payment for order {order_id} "
              f"after {elapsed:.1f}s")
# Querying this needs a regex, and it breaks when the wording changes.


# --- Structured: one JSON object per event --------------------------
import structlog
log = structlog.get_logger()

log.error(
    "payment_failed",              # a stable event name, not a sentence
    user_id=user_id,               # never log the card number or the email
    order_id=order_id,
    duration_ms=round(elapsed * 1000),
    error_code="CARD_DECLINED",
    trace_id=current_trace_id(),   # the link to the trace
    service="checkout",
)

# Emits:
# {"event":"payment_failed","user_id":4821,"order_id":99123,
#  "duration_ms":2410,"error_code":"CARD_DECLINED",
#  "trace_id":"4bf92f3577b34da6","service":"checkout",
#  "level":"error","timestamp":"2026-09-17T09:14:02.881Z"}`,
      },
      {
        title: 'What structure buys you in LogQL',
        language: 'text',
        explanation:
          'Parse once, then treat log fields like metric labels - including alerting on them.',
        code: `# Exact field filtering, no regex
{namespace="prod", app="checkout"}
  | json
  | error_code = "CARD_DECLINED"

# Numeric comparison on a parsed field
{namespace="prod", app="checkout"} | json | duration_ms > 2000

# Logs to metrics: declines per second, broken down by code
sum by (error_code) (
  rate({namespace="prod", app="checkout"} | json | level="error" [5m])
)

# p99 latency computed from logs - useful when the service
# has no histogram metric yet
quantile_over_time(0.99,
  {namespace="prod", app="checkout"} | json | unwrap duration_ms [5m]
) by (service)

# Find every log line belonging to one request, across services
{namespace="prod"} | json | trace_id = "4bf92f3577b34da6"`,
      },
    ],
    deeper: [
      'Agree the field vocabulary as a platform standard and ship it as a shared logging library. Otherwise every service invents its own and no cross-service dashboard is possible.',
      'OpenTelemetry defines semantic conventions for log and span attributes - `service.name`, `http.response.status_code` and so on. Adopting them means your data is portable between backends.',
      'Keep the message field stable and put the variable parts in fields. `event: "payment_failed"` with attributes groups cleanly; a formatted sentence with an ID in it makes every line unique.',
    ],
    traps: [
      'Logging secrets, tokens or personal data. Log stores are replicated and retained; that data is very hard to recall.',
      'Changing field names per service, which makes any shared dashboard or alert impossible.',
      'Logging a full stack trace on every request. Volume is cost, and the signal drowns.',
    ],
    followUps: [
      'How do you get a trace ID into every log line?',
      'How would you alert on a specific error code appearing in logs?',
      'What would you do about a service you cannot change that logs plain text?',
    ],
    tags: ['logging', 'instrumentation', 'logql', 'structured logging'],
  },
  {
    id: 'itv-graf-19',
    level: 'advanced',
    kind: 'open',
    prompt: 'Where can log lines be lost in this pipeline, and how would you reduce the loss?',
    probing: 'Senior reliability thinking. The expected answer accepts that some loss is inherent.',
    answer: [
      'There are five places, and it is worth being honest that you cannot eliminate all of them without changing the architecture.',
      '**At the application.** A process killed hard loses whatever is in its buffered writer. Unbuffered or line-buffered stderr for errors, and flushing on shutdown, closes most of this. It is also why a crash loop often has no logs explaining the crash.',
      '**At the node file.** The kubelet rotates container logs at 10Mi keeping 5 files. A service logging faster than the agent ships will have lines rotated away before they are read. Raising `--container-log-max-size` buys a bigger buffer; reducing log volume is the better fix.',
      '**At the agent.** If the agent pod is down - node pressure, an eviction, a bad rollout - nothing is tailing. It resumes from its checkpoint afterwards, so a short outage is recovered, but only if the files have not rotated in the meantime. That interaction is the one people miss.',
      '**Between agent and store.** The agent buffers in memory and retries with backoff. When the store is down longer than the buffer holds, it drops. A **persistent write-ahead log** on the agent - available in Alloy, Promtail and Fluent Bit - converts a memory buffer into a disk buffer and survives an agent restart as well as a longer outage. This is the single highest-value hardening step.',
      '**At the store.** Rate limits reject pushes with 429, retention deletes old data on schedule, and an ingester lost before flushing loses its in-memory chunks unless replication is configured.',
      'The conclusion I would offer: this pipeline is **best-effort by design**, and that is an acceptable trade for debugging telemetry. For anything where loss is unacceptable - audit trails, financial transactions, regulatory records - do not scrape it off a node. Have the application write to a durable, acknowledged destination such as a database or Kafka, and treat that as a separate system from observability logging.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Five places a line disappears',
        caption: 'No stage acknowledges back to the application. That is the design.',
        nodes: [
          {
            label: 'App buffer',
            detail: 'killed before flush - fix with line-buffered stderr',
            tone: 'warning',
          },
          {
            label: 'Node file rotation',
            detail: '10Mi x 5 by default - a fast logger outruns the agent',
            arrowLabel: 'loss point 2',
            tone: 'warning',
          },
          {
            label: 'Agent not running',
            detail: 'eviction or bad rollout - checkpoint recovers only unrotated files',
            arrowLabel: 'loss point 3',
            tone: 'warning',
          },
          {
            label: 'Agent to store',
            detail: 'memory buffer overflows - a disk WAL is the fix',
            arrowLabel: 'loss point 4',
            tone: 'danger',
          },
          {
            label: 'Store limits',
            detail: '429 rate limits, retention, unflushed ingester chunks',
            arrowLabel: 'loss point 5',
            tone: 'danger',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Hardening the two links that matter most',
        language: 'yaml',
        explanation:
          'A bigger node buffer, and a disk-backed write-ahead log in the agent. These two cover the common outages.',
        code: `# kubelet: a larger on-node buffer before rotation discards
# /var/lib/kubelet/config.yaml
containerLogMaxSize: 50Mi
containerLogMaxFiles: 5

---
# Alloy: persist the queue to disk so an agent restart or a
# long Loki outage does not drop what is in flight
loki.write "default" {
  endpoint {
    url = "http://loki-gateway.monitoring.svc/loki/api/v1/push"

    // keep retrying rather than giving up quickly
    retry_on_http_429 = true
    max_backoff_period = "5m"
  }

  // survives a pod restart - the single most valuable setting here
  wal {
    enabled          = true
    max_segment_age  = "1h"
  }
}`,
      },
      {
        title: 'Alerting on absence, which logs cannot tell you',
        language: 'text',
        explanation:
          'A namespace going quiet looks identical to a namespace behaving well. Only a metric catches it.',
        code: `# Agent is dropping rather than sending
sum(rate(promtail_dropped_entries_total[5m])) > 0

# A namespace that normally logs has gone silent for 10 minutes
sum by (namespace) (
  rate({namespace=~".+"}[5m])
) == 0
  and on(namespace)
sum by (namespace) (
  rate({namespace=~".+"}[1d] offset 1d)
) > 0

# Loki is rejecting pushes
sum by (reason) (rate(loki_discarded_samples_total[5m])) > 0

# An agent pod is missing from a node that has workloads
kube_node_info unless on(node) kube_pod_info{pod=~"alloy-.*"}`,
      },
    ],
    deeper: [
      'The agent checkpoint and file rotation interact badly: an agent down for longer than it takes the file to rotate resumes at a position that no longer exists. Agents handle this by restarting from the file head, which produces duplicates rather than a gap - know which your agent does.',
      'Loki ingesters hold recent data in memory before flushing. A replication factor of 3 in a distributed deployment is what stops a single ingester loss taking recent logs with it.',
      'If an auditor asks "can you prove no log was lost", the honest answer for this pipeline is no. Say so, and describe the separate durable path you would build for records that need that guarantee.',
    ],
    traps: [
      'Claiming the pipeline is reliable. Nothing acknowledges back to the application.',
      'Raising rate limits to stop 429s without addressing the volume that caused them.',
      'Using scraped container logs as an audit trail.',
    ],
    followUps: [
      'How would you build a genuinely lossless audit log?',
      'What does a write-ahead log in the agent buy you exactly?',
      'How do you detect a namespace that has silently stopped logging?',
    ],
    tags: ['logging', 'reliability', 'loki', 'data loss'],
  },
  {
    id: 'itv-graf-20',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'Why is a log-collection agent usually deployed as a DaemonSet rather than a Deployment?',
    options: [
      { id: 'a', text: 'Because logs live in files on each node, so one agent per node is needed' },
      { id: 'b', text: 'Because DaemonSets restart faster than Deployments' },
      { id: 'c', text: 'Because a Deployment cannot mount a hostPath volume' },
      { id: 'd', text: 'Because DaemonSets are scheduled before any other workload' },
    ],
    correct: ['a'],
    probing:
      'Whether you understand where the data physically is. It follows directly from the pipeline.',
    answer: [
      'Container logs are **files on the node** - under `/var/log/pods`, written by the container runtime. To tail them you must be on that node with `/var/log` mounted from the host, and you need exactly one agent per node: none means that node’s logs are never collected, and two means every line is shipped twice.',
      'That is precisely what a DaemonSet guarantees - one pod per matching node, and automatically a pod on any node that joins later, which matters a great deal with autoscaling node pools.',
      'A Deployment gives you a replica count, and the scheduler is free to place two replicas on one node and none on another. B, C and D are all false: a Deployment can mount a hostPath perfectly well, DaemonSets have no scheduling priority of their own, and restart speed is identical.',
      'The detail worth adding is **tolerations**. A DaemonSet only gets a pod onto a tainted node - control-plane nodes, GPU pools, spot pools - if it tolerates that taint. Missing tolerations is the single most common reason a cluster has a silent blind spot where one node group’s logs never arrive.',
    ],
    code: [
      {
        title: 'The parts of a log agent DaemonSet that matter',
        language: 'yaml',
        explanation:
          'Host mounts to read the files, tolerations to reach every node, and RBAC to enrich with pod metadata.',
        code: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: alloy
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: alloy
  template:
    spec:
      serviceAccountName: alloy      # needs RBAC to list/watch pods
      tolerations:
        - operator: Exists           # reach EVERY node, taints and all
      containers:
        - name: alloy
          image: grafana/alloy:v1.5.0
          volumeMounts:
            - name: varlog
              mountPath: /var/log
              readOnly: true
            - name: positions
              mountPath: /var/lib/alloy   # the read checkpoint
          resources:
            requests: { cpu: 100m, memory: 128Mi }
            limits: { memory: 512Mi }
      volumes:
        - name: varlog
          hostPath:
            path: /var/log             # where the runtime writes
        - name: positions
          hostPath:
            path: /var/lib/alloy       # survives a pod restart`,
      },
    ],
    deeper: [
      'The positions checkpoint must survive a pod restart, which is why it is a hostPath and not an emptyDir. An emptyDir here means re-reading or skipping every file after each restart.',
      'RBAC matters more than people expect: the agent lists and watches pods to map a log file to a namespace, pod and labels. Without it you get log lines with no Kubernetes context, which makes them nearly unusable.',
      'A memory limit on the agent is a genuine trade-off - too low and it is OOM-killed during a log burst, which is exactly when you most need it running.',
    ],
    traps: [
      'Omitting tolerations and quietly losing control-plane or GPU-node logs.',
      'Using an emptyDir for the positions file, causing duplicates or gaps on every restart.',
    ],
    followUps: [
      'What happens if the agent has no toleration for a tainted node?',
      'Why does the agent need RBAC on pods?',
      'When would a sidecar be the right choice instead?',
    ],
    tags: ['logging', 'kubernetes', 'daemonset', 'agents'],
  },
  {
    id: 'itv-graf-21',
    level: 'advanced',
    kind: 'open',
    prompt:
      'A team says their logging bill has tripled. How would you investigate and bring it down?',
    probing:
      'Cost is a real platform responsibility. They want a method, and a willingness to talk to the teams involved.',
    answer: [
      'I would find out **what changed** before changing anything, because the fix depends entirely on whether this is more services, more volume per service, or a configuration change.',
      'First, measure by dimension. Bytes ingested per namespace, per app and per container over time, from the agent or store metrics. This almost always points at one or two services - a debug level left on after an incident, a library logging every HTTP request at info, a retry loop logging each attempt, or a health-check endpoint logging 200s every second.',
      'Then apply the fixes in order of value. **Drop what nobody reads**: health-check and readiness-probe lines, framework startup banners, successful requests where a metric already tells you the rate. Dropping at the **agent** is best, because it costs nothing downstream. **Sample** high-volume repetitive lines - keep one in a hundred successful requests, keep every error. **Fix the level**: debug in production is almost always an accident, and a single environment variable often halves the bill.',
      'Next, **retention tiers**. Very few people query 90-day-old logs, but almost everyone asks for 90-day retention. Thirty days hot and a cheap object-storage archive for the rest is usually both cheaper and sufficient. In Loki that is straightforward because the chunks are already in object storage.',
      'And the structural point: **move what is really a metric out of logs**. Counting log lines to compute a request rate is the most expensive possible way to get that number. A counter in Prometheus costs a fraction of it. Teams frequently log to get numbers they should be instrumenting, and correcting that has a bigger effect than any retention change.',
      'Finally I would make cost visible - a dashboard of bytes per namespace, shown to the teams that generate them. Cost that nobody can see is cost nobody manages, and per-tenant limits give teams a reason to care before the platform team has to.',
    ],
    code: [
      {
        title: 'Finding where the bytes come from',
        language: 'text',
        explanation: 'Start broad, then narrow. The answer is usually one or two containers.',
        code: `# Bytes per namespace over the last day - the top-line view
topk(10,
  sum by (namespace) (
    rate({namespace=~".+"}[1d])
  )
)

# Narrow to containers inside the worst namespace
topk(10,
  sum by (container) (
    rate({namespace="prod"}[1h])
  )
)

# How much of it is just health checks?
sum(rate({namespace="prod"} |= "/healthz" [1h]))
  /
sum(rate({namespace="prod"}[1h]))

# Is it debug level left switched on?
sum by (app) (rate({namespace="prod"} | json | level="debug" [1h]))`,
      },
      {
        title: 'Dropping and sampling at the agent',
        language: 'yaml',
        explanation:
          'Dropped at the agent means no network, no ingest, no storage and no retention cost.',
        code: `pipeline_stages:
  # 1. Parse so later stages can see fields
  - json:
      expressions:
        level: level
        path: path

  # 2. Drop health checks entirely - nobody has ever read one
  - drop:
      expression: '.*/(healthz|readyz|metrics).*'
      drop_counter_reason: health_check

  # 3. Drop debug lines in production
  - drop:
      source: level
      value: debug
      drop_counter_reason: debug_in_prod

  # 4. Keep 1% of successful requests, all errors
  - match:
      selector: '{namespace="prod"} | json | status_code < 400'
      stages:
        - sampling:
            rate: 0.01

  # 5. Promote level to a label - low cardinality, useful to select on
  - labels:
      level:`,
      },
    ],
    deeper: [
      'Dropping at the agent is far better than retention tuning: retention reduces what you keep, dropping reduces what you transmit, ingest, index and keep.',
      'Be careful sampling anything you alert on. If an alert counts a log line, sampling changes the number it sees - sample successes, never errors.',
      'Per-tenant ingestion limits in Loki turn a shared cost problem into a team-level one, which is usually what finally gets it fixed.',
    ],
    traps: [
      'Cutting retention first. It is the least effective lever and the most visible to users.',
      'Sampling error logs to save money, then wondering why an alert under-counts.',
      'Solving it silently in the platform, so the teams generating the volume never learn.',
    ],
    followUps: [
      'What would you refuse to drop, whatever the cost?',
      'How would you show teams their own logging cost?',
      'Which of these logs should have been a metric?',
    ],
    tags: ['logging', 'cost', 'loki', 'platform'],
  },
  {
    id: 'itv-graf-22',
    level: 'basic',
    kind: 'open',
    prompt: 'Why can kubectl logs not replace a log aggregation system?',
    probing: 'A simple question that tests whether you know where the data physically lives.',
    answer: [
      '`kubectl logs` reads the files the container runtime wrote **on one node, for one container that still exists**. That single sentence contains all of its limits.',
      'It disappears when the pod does. Delete a pod, scale down, evict it, replace the node - the files go with it and the logs are unrecoverable. `--previous` gives you exactly one prior container instance, which is often not the crash you are investigating.',
      'It is bounded by rotation. The kubelet keeps roughly 10Mi across 5 files per container, so a busy service holds minutes of history, not days.',
      'It cannot search across anything. You cannot ask "which of my forty pods logged this error in the last hour", and you certainly cannot correlate across services. Every question becomes a loop over pods piped into grep.',
      'And it has no retention, no access control beyond Kubernetes RBAC, and nothing to alert on.',
      'An aggregation system fixes all five: the lines are shipped off the node before they rotate, kept for as long as you choose, indexed by namespace and app, searchable across the whole estate, and queryable in the same place as your metrics. `kubectl logs` remains the right tool for "what is this pod doing right now" - and it is genuinely the fastest tool for that.',
    ],
    traps: [
      'Treating `kubectl logs --previous` as a history. It is one container back, and it is gone with the pod.',
      'Assuming the node keeps logs for hours. On a busy service it can be minutes.',
    ],
    followUps: [
      'How long do logs stay on a node?',
      'What do you do when a pod crashed and its node was replaced?',
    ],
    tags: ['logging', 'kubernetes', 'fundamentals'],
  },
  {
    id: 'itv-graf-23',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'Compare the common log shipping agents - Fluentd, Fluent Bit, Promtail and Grafana Alloy. How would you choose?',
    probing:
      'Tooling breadth. A good answer is about fit and resource cost, not about a favourite.',
    answer: [
      '**Fluentd** is the veteran: Ruby, an enormous plugin ecosystem, and the most flexible routing and transformation of the four. That flexibility costs memory - tens to hundreds of megabytes per node - and a plugin set that has to be maintained. It is still the right answer when you need to fan out to several unusual destinations with real transformation in between.',
      '**Fluent Bit** is the same family rewritten in C: a few megabytes of memory, very fast, a smaller but sufficient plugin set. It has become the default node agent for most Kubernetes platforms, and it is vendor-neutral, which matters if you might change backend.',
      '**Promtail** was Loki’s own agent - simple, Prometheus-style service discovery and relabelling, and nothing else. Its virtue was that it did one job well. It is now deprecated in favour of Alloy, so I would not start a new deployment on it.',
      '**Grafana Alloy** is Grafana’s current collector and the successor to both Promtail and the Grafana Agent. It handles logs, metrics, traces and profiles in one process, is configured in a component-based language, and is a distribution of the **OpenTelemetry Collector**, so it speaks OTLP natively.',
      'How I would choose: on a Grafana stack - Loki, Mimir, Tempo - Alloy, because one agent covers all the signals and the configuration model matches. Wanting to stay backend-neutral, or running a very tight memory budget, Fluent Bit or the upstream OpenTelemetry Collector. Needing exotic routing or a plugin only it has, Fluentd. And on an existing Promtail deployment, plan the move to Alloy rather than expanding it.',
      'Honestly, for most teams this choice matters far less than what they ship. Getting the label set right and the volume under control affects the outcome much more than which of these four tails the file.',
    ],
    deeper: [
      'Alloy being an OpenTelemetry Collector distribution is the strategically important detail: it means the config you learn transfers, and you can send OTLP to non-Grafana backends.',
      'Memory footprint matters because this runs on every node. A 200Mi agent across 300 nodes is 60Gi of cluster memory spent on log shipping.',
      'Whatever you pick, it must support a persistent buffer and Kubernetes metadata enrichment. All four do; a rolled-in-house agent usually does not.',
    ],
    traps: [
      'Choosing Promtail for something new. It is deprecated in favour of Alloy.',
      'Picking Fluentd for a simple tail-and-ship job and paying for flexibility nobody uses.',
    ],
    followUps: [
      'What is the OpenTelemetry Collector and how does Alloy relate to it?',
      'How much memory should a node agent be allowed?',
      'How would you migrate from Promtail to Alloy?',
    ],
    tags: ['logging', 'agents', 'fluent bit', 'alloy'],
  },
  {
    id: 'itv-graf-24',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How do you handle multi-line logs, such as a Java stack trace, in a container log pipeline?',
    probing:
      'A specific, very common problem. It tests whether you have actually run one of these pipelines.',
    answer: [
      'The problem is that the container runtime captures logs **line by line**. A 40-line Java stack trace becomes 40 separate entries, each with its own timestamp, and the one line that names the exception is separated from the ten frames that give it meaning. Search for the exception and you find a line with no context.',
      'There are three fixes, and they are in increasing order of how much I like them.',
      '**Fix it in the agent** with a multiline parser: a regex identifies what a new entry looks like - typically a line starting with a timestamp - and every line that does not match is appended to the previous entry. This works, and every agent supports it, but it is fragile. You need a rule per log format, the buffer has a line limit and a timeout, and a slow writer can have its trace split anyway.',
      '**Fix it in the runtime layer**, partially. The CRI format already marks partial lines with a `P` flag for single messages that exceed the 16KB read buffer, and agents reassemble those. That handles very long single lines, but not genuinely multi-line events, so it is only half a solution.',
      '**Fix it at the source**, which is the real answer. Configure the logging framework to emit **one JSON object per event**, with the stack trace as a string field inside it. Logback, log4j2, Serilog, Python’s structlog and every modern framework can do this. The trace is then one log line, one entry, one searchable field, and the entire problem disappears - along with the per-format regexes you would otherwise maintain forever.',
      'So in practice: push hard for structured JSON logging as the standard, and keep multiline parsing in the agent as the compatibility layer for applications you cannot change.',
    ],
    code: [
      {
        title: 'The agent-side workaround',
        language: 'yaml',
        explanation:
          'Lines not matching firstline are appended to the previous entry. Note the limits - they are where it breaks.',
        code: `pipeline_stages:
  - multiline:
      # a new entry starts with an ISO timestamp at the start of the line
      firstline: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}'
      # flush what we have if nothing new arrives
      max_wait_time: 3s
      # and never buffer more than this many lines
      max_lines: 256

  - regex:
      expression: '^(?P<ts>\\S+)\\s+(?P<level>\\w+)\\s+(?P<msg>.*)'
  - labels:
      level:
  - timestamp:
      source: ts
      format: RFC3339Nano`,
      },
      {
        title: 'The fix that removes the problem',
        language: 'yaml',
        explanation:
          'One JSON object per event, stack trace as a field. No multiline rule needed anywhere downstream.',
        code: `# Logback with logstash-logback-encoder: one line per event
# src/main/resources/logback-spring.xml equivalent, as config
appender:
  name: STDOUT
  class: ch.qos.logback.core.ConsoleAppender
  encoder:
    class: net.logstash.logback.encoder.LogstashEncoder
    includeMdcKeyName:
      - trace_id          # so logs link to traces
      - span_id
    # the whole stack trace becomes ONE string field
    throwableConverter:
      class: net.logstash.logback.stacktrace.ShortenedThrowableConverter
      maxDepthPerThrowable: 30
      shortenedClassNameLength: 40

# Output - a single line, whatever the trace length:
# {"@timestamp":"2026-09-17T09:14:02.881Z","level":"ERROR",
#  "logger_name":"com.acme.CheckoutService",
#  "message":"payment failed",
#  "trace_id":"4bf92f3577b34da6",
#  "stack_trace":"java.lang.IllegalStateException: ...\\n\\tat com.acme..."}`,
      },
    ],
    deeper: [
      'Multiline buffering interacts badly with the agent restarting: whatever is in the buffer when it stops is usually lost or emitted as a fragment. Another argument for fixing it at the source.',
      'If you must use agent-side multiline, apply it per workload with a selector rather than globally. A single global regex across mixed log formats will mis-join unrelated lines, which is worse than splitting them.',
      'Watch the 16KB CRI read limit for very long single lines - a large JSON payload logged in full can be split by the runtime before any agent sees it, and the `P` flag is how the agent knows to rejoin it.',
    ],
    traps: [
      'Writing one global multiline regex for a cluster with many languages and log formats.',
      'Assuming a stack trace arrives as one entry by default. It never does.',
    ],
    followUps: [
      'What does the P flag in the CRI log format mean?',
      'How would you roll out structured logging across forty existing services?',
    ],
    tags: ['logging', 'multiline', 'agents', 'java'],
  },
]
