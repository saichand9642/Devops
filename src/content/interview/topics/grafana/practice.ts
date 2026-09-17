import type { InterviewQuestion } from '../../../types'

/**
 * "Production is doing this - walk me through it."
 *
 * The senior round. What is being assessed is method: narrow before you
 * change anything, say what you would check and what it would rule out.
 */
export const grafanaPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-graf-37',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'You migrate Grafana to a new cluster. Every dashboard now shows "Datasource not found". Walk me through it.',
    probing:
      'A very common migration failure with an unambiguous cause. They want to see you read the error literally.',
    answer: [
      'The error is telling me precisely what is wrong: dashboards reference a data source by **uid**, and the uid they reference does not exist in this Grafana. Nothing is wrong with Prometheus, and nothing is wrong with the network.',
      'The cause is almost always that the old data source was created through the UI, so Grafana generated a random uid for it. Every dashboard JSON embedded that random uid. The new instance created its own data source with a different random uid, and the references no longer resolve.',
      'To confirm, I would open a broken dashboard’s JSON and find `"datasource": {"uid": "PBFA97CFB590B2093"}`, then list the data sources through the API and see that no such uid exists here.',
      'There are two fixes. The quick one is to **recreate the data source with the old uid** - the API lets you set it explicitly, so one POST restores every dashboard at once. The proper one is to **provision data sources from YAML with a pinned, human-readable uid** such as `prometheus`, so the uid is deterministic in every environment and this class of failure cannot recur.',
      'Then I would prevent a repeat: add a `datasource` **variable** to the dashboards so they resolve at view time rather than hardcoding a uid, and when exporting always use "Export for sharing externally", which replaces the concrete uid with a template input.',
    ],
    code: [
      {
        title: 'Confirm, then fix',
        language: 'bash',
        explanation:
          'Recreating the uid is the one-minute fix. Provisioning it is the fix that lasts.',
        code: `# What uid does the dashboard actually ask for?
curl -s -H "Authorization: Bearer $TOKEN" \\
  https://grafana.internal/api/dashboards/uid/checkout-svc \\
  | jq -r '.. | .datasource? // empty | .uid? // empty' | sort -u

# What uids exist here?
curl -s -H "Authorization: Bearer $TOKEN" \\
  https://grafana.internal/api/datasources | jq -r '.[] | "\\(.uid)  \\(.name)"'

# Quick fix: recreate it with the uid the dashboards expect
curl -s -X POST -H "Authorization: Bearer $TOKEN" \\
  -H 'Content-Type: application/json' \\
  https://grafana.internal/api/datasources \\
  -d '{
        "name": "Prometheus",
        "type": "prometheus",
        "uid": "PBFA97CFB590B2093",
        "access": "proxy",
        "url": "http://prometheus-server.monitoring.svc"
      }'`,
      },
    ],
    deeper: [
      'Pinning the uid in provisioning is the real lesson, and it applies to every environment promotion - dev to staging to production - not just cluster migrations.',
      'A `datasource`-type dashboard variable is better still: the same JSON then works against any environment with no uid at all in the panels.',
      'If dashboards were only ever in the Grafana database, this migration also risked losing them entirely. It is a good moment to move them into Git.',
    ],
    traps: [
      'Debugging Prometheus connectivity. The error names the data source, not the query.',
      'Hand-editing 200 dashboards to fix the uid instead of recreating one data source.',
    ],
    followUps: [
      'How do you make this impossible in future?',
      'What does "Export for sharing externally" change?',
    ],
    tags: ['grafana', 'troubleshooting', 'migration', 'provisioning'],
  },
  {
    id: 'itv-graf-38',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'At 02:00 the Loki ingesters start being OOM-killed repeatedly and log ingestion stops. What do you do?',
    probing:
      'Incident handling under pressure, plus knowing the most likely cause before you look.',
    answer: [
      'First, **stabilise**. I would raise the ingester memory limit enough to get them staying up, and if that is not enough, temporarily lower retention of in-memory chunks by shortening `chunk_idle_period` so chunks flush sooner and free memory. The aim is to stop the crash loop, not to fix the cause at 2am.',
      'While that settles I would check the one metric that almost always explains it: **active streams per ingester**. Ingester memory is dominated by open chunks, and there is one per active stream, so a sudden jump in stream count is the usual cause.',
      'Then I would ask what changed at 02:00. In my experience the answer is one of three things. A deployment added a **new label** - a pod IP, a request ID, a trace ID - to the agent config, multiplying streams. A batch job started and is logging at enormous volume with a per-run label. Or a node pool scaled up and a misconfigured agent is now shipping something it was not before.',
      'The query that finds it is stream count grouped by label. Comparing now against an hour ago points at the label that changed almost immediately.',
      'The fix is at the **agent**, not at Loki: remove the offending label from the relabel config so it stays inside the log line, where it can still be filtered at query time for nothing. If the volume itself is the problem rather than the cardinality, drop or sample at the agent.',
      'Afterwards I would add the preventative controls: `max_streams_per_user` and the per-stream rate limit set deliberately so the next occurrence is a rejection with a clear reason rather than an OOM, alerts on stream count trending up, and a review step on agent relabel changes - because a one-line config change should not be able to take down the logging platform.',
    ],
    code: [
      {
        title: 'Find the label that changed',
        language: 'text',
        explanation:
          'Stream count is the number that predicts an ingester OOM. Compare against an hour ago.',
        code: `# Streams per ingester - this is what fills memory
sum by (pod) (loki_ingester_memory_streams)

# How fast is it growing?
sum(loki_ingester_memory_streams)
  -
sum(loki_ingester_memory_streams offset 1h)

# Which tenant or namespace is responsible?
topk(5, sum by (tenant) (loki_ingester_memory_streams))

# Is Loki already rejecting, and why?
sum by (reason) (rate(loki_discarded_samples_total[5m]))

# And on the agent side - is it being throttled?
sum(rate(promtail_dropped_entries_total[5m])) by (reason)`,
      },
      {
        title: 'Guard rails so it fails safely next time',
        language: 'yaml',
        explanation: 'A rejection with a named reason is a far better failure than an OOM loop.',
        code: `limits_config:
  # Cap streams per tenant - the direct defence against this incident
  max_streams_per_user: 10000
  max_global_streams_per_user: 25000

  # Rate limits, so one noisy app cannot starve the rest
  ingestion_rate_mb: 10
  ingestion_burst_size_mb: 20
  per_stream_rate_limit: 3MB
  per_stream_rate_limit_burst: 15MB

  # Reject absurd label sets outright
  max_label_names_per_series: 15
  max_line_size: 256KB

ingester:
  # Flush sooner under pressure - less memory held per stream
  chunk_idle_period: 30m
  chunk_target_size: 1536000
  max_chunk_age: 1h`,
      },
    ],
    deeper: [
      'Raising the limits to make the errors stop converts a clean rejection into an OOM. The limits exist to protect the ingesters; treat hitting them as the signal, not the problem.',
      'Ingesters hold unflushed chunks in memory, so an OOM loses recent logs unless the replication factor is 3 or the WAL is enabled. Worth checking during the incident so you know what you lost.',
      'A dashboard of streams per tenant, shown to the teams that own them, prevents far more of these than any limit does.',
    ],
    traps: [
      'Scaling ingesters horizontally without fixing cardinality. Streams are distributed by label hash, so more ingesters still means more total memory.',
      'Blaming log volume when the cause is stream count. They are different problems with different fixes.',
    ],
    followUps: [
      'Why does one extra label cause this?',
      'What would you have alerted on to catch it earlier?',
      'Did you lose data, and how would you know?',
    ],
    tags: ['loki', 'incident', 'cardinality', 'troubleshooting'],
  },
  {
    id: 'itv-graf-39',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'p99 latency has tripled but the error rate is unchanged and no deployment went out. How do you investigate?',
    probing:
      'The hardest and most realistic performance scenario. It rewards structured narrowing.',
    answer: [
      'No errors and no deploy tells me something is **slower, not broken**, and the change is probably not in my code. I would narrow along four axes before forming a theory.',
      '**Is it everywhere or somewhere?** Break the p99 down by route, by pod, by node and by availability zone. One pod means that instance - a noisy neighbour, a full disk, a throttled CPU. One zone means a network or dependency problem in that zone. Everything, evenly, means a shared dependency.',
      '**Is it real or is it the metric?** Check the request rate alongside it. A p99 that rises while traffic rises is saturation. A p99 that rises while traffic is flat is more interesting. And check that p50 has not moved - p99 alone moving means a subset of requests is affected, which points at a specific path, a cache miss class, or a particular tenant.',
      '**Where is the time going?** This is what traces are for. I would find a slow trace - an exemplar on the latency panel is the fastest route - and read the waterfall. The answer is usually immediate: a database span that grew, an external API that is slower, a lock, or a retry that now happens every time.',
      '**What changed underneath?** No deploy of mine does not mean no change. CPU throttling from a limit that was always marginal, a database whose data grew past an index threshold, a dependency that deployed, a node under memory pressure, a certificate rotation adding handshakes, or a cloud provider event.',
      'The specific causes I would check early, because they are common and cheap to rule out: **CPU throttling** (`container_cpu_cfs_throttled_seconds_total` rising is decisive), **connection pool exhaustion** - which looks exactly like this, latency up with no errors, as requests queue for a connection - **GC pressure** from a slow memory leak, and a **downstream dependency** that got slower without failing.',
      'And I would check whether p99 is the right thing to look at: if the traffic mix changed - a new client, a batch job now calling the API - then a slower p99 may be a different population of requests rather than a regression.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Narrowing a latency regression',
        caption: 'Each split halves the search space before any theory is formed.',
        question: 'How is the slowness distributed?',
        branches: [
          {
            condition: 'One pod only',
            result: 'That instance',
            detail: 'CPU throttling, noisy neighbour, full disk, a stuck connection pool',
            tone: 'accent',
          },
          {
            condition: 'One zone or one node pool',
            result: 'Infrastructure or topology',
            detail: 'cross-zone traffic, a degraded node group, a zonal dependency',
            tone: 'accent',
          },
          {
            condition: 'One route or one tenant',
            result: 'A specific code path',
            detail: 'a query whose data grew, a cache that stopped being hit',
            tone: 'warning',
          },
          {
            condition: 'Everything, evenly',
            result: 'A shared dependency',
            detail: 'database, cache, auth service, DNS, or the network between them',
            tone: 'danger',
          },
        ],
      },
    ],
    code: [
      {
        title: 'The narrowing queries, in order',
        language: 'text',
        explanation: 'Split by each dimension in turn. The one that separates is your lead.',
        code: `# Is it one pod, or all of them?
histogram_quantile(0.99,
  sum by (le, pod) (rate(http_request_duration_seconds_bucket{job="checkout"}[5m]))
)

# Did p50 move too, or only the tail?
histogram_quantile(0.50,
  sum by (le) (rate(http_request_duration_seconds_bucket{job="checkout"}[5m]))
)

# Has traffic changed? Saturation looks like this.
sum(rate(http_requests_total{job="checkout"}[5m]))

# CPU throttling - the most common silent cause
sum by (pod) (rate(container_cpu_cfs_throttled_seconds_total{pod=~"checkout-.*"}[5m]))

# Is the slowness downstream? Compare client-side spans to the dependency
histogram_quantile(0.99,
  sum by (le, upstream) (rate(upstream_request_duration_seconds_bucket[5m]))
)

# Connection pool saturation - latency up, errors flat, queue growing
db_connection_pool_waiting_total / db_connection_pool_size`,
      },
    ],
    deeper: [
      'CPU throttling is the cause people miss most. A container at its CFS quota is paused for the rest of each 100ms period, which adds latency with no error and no obvious CPU saturation on the node.',
      'Connection pool exhaustion has exactly this signature - flat errors, rising latency - because requests queue rather than fail. Always instrument pool wait time; it converts a two-hour investigation into a glance.',
      'If traces are sampled at a flat low rate you may have no slow trace to look at. Tail sampling that always keeps slow traces exists precisely for this moment.',
    ],
    traps: [
      'Restarting pods. It often "fixes" it temporarily by resetting a pool or clearing a leak, and destroys the evidence.',
      'Looking only at averages, which hide a tail problem completely.',
      'Assuming no deploy means no change. Dependencies, data volume and infrastructure all change on their own.',
    ],
    followUps: [
      'How would you confirm CPU throttling specifically?',
      'What would a connection pool problem look like in the metrics?',
      'How do you find a slow trace if sampling threw it away?',
    ],
    tags: ['troubleshooting', 'latency', 'performance', 'incident'],
  },
  {
    id: 'itv-graf-40',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'A single node fails and six different teams are paged within a minute. What went wrong with the alerting, and how would you fix it?',
    probing: 'Alert routing design. The incident is not the node - it is the six pages.',
    answer: [
      'One failure producing six pages is an **alerting design problem**, not an infrastructure problem. The node failure was handled correctly by Kubernetes; the humans were not.',
      'What happened is that every team had cause-based alerts on symptoms of the same event - pods not ready, scrape targets down, latency blips during rescheduling - and each fired independently with no relationship between them.',
      'There are three mechanisms that fix this, and they are complementary.',
      '**Grouping.** Alertmanager and Grafana both group alerts by label before notifying. Grouping by `alertname` and `cluster` turns twenty "target down" alerts into one notification listing twenty instances. This alone removes most of the noise.',
      '**Inhibition.** An inhibition rule says: when this alert is firing, suppress those. A `NodeDown` alert should inhibit every `PodNotReady` and `TargetDown` alert that carries the same `node` label, because they are consequences, not independent problems. This is the mechanism specifically designed for the scenario as described.',
      '**Alerting on symptoms rather than causes.** If the teams alerted on "my service’s error ratio for users" rather than on "a pod of mine is not ready", a node failure that Kubernetes absorbed would page nobody at all - which is the correct outcome, because no user noticed.',
      'I would also route by severity: user-visible impact pages, everything else opens a ticket. And I would add a single infrastructure alert owned by the platform team for the node itself, so the event is visible to the people who can act on it and invisible to those who cannot.',
    ],
    code: [
      {
        title: 'Grouping and inhibition in Alertmanager',
        language: 'yaml',
        explanation:
          'Inhibition is the rule that directly solves this: suppress consequences of a known cause.',
        code: `route:
  # One notification per alertname+cluster, not one per instance
  group_by: ['alertname', 'cluster', 'namespace']
  group_wait: 30s          # collect related alerts before notifying
  group_interval: 5m
  repeat_interval: 4h
  receiver: default

  routes:
    - matchers: [severity="page"]
      receiver: pagerduty
    - matchers: [severity="ticket"]
      receiver: jira

inhibit_rules:
  # A failed node explains every pod and target on it - stay quiet
  - source_matchers: [alertname="NodeNotReady"]
    target_matchers: [alertname=~"PodNotReady|TargetDown|KubeletDown"]
    equal: ['node']

  # A cluster-wide outage explains every service alert in it
  - source_matchers: [alertname="ClusterUnreachable"]
    target_matchers: [severity=~"page|ticket"]
    equal: ['cluster']

  # A page about a service makes the ticket about the same service redundant
  - source_matchers: [severity="page"]
    target_matchers: [severity="ticket"]
    equal: ['alertname', 'service']`,
      },
    ],
    deeper: [
      '`group_wait` is a deliberate delay - 30 seconds of patience so related alerts arrive together and are sent as one notification. Teams often set it to zero and then complain about the volume.',
      'Inhibition needs a shared label to match on, which is why a consistent label vocabulary across alerts matters. Without a `node` label on both alerts, the rule cannot work.',
      'The strongest version of this fix is cultural: agree that only user-visible impact pages. That conversation is harder than the YAML and worth more.',
    ],
    traps: [
      'Fixing it by silencing alerts during incidents. Silences expire and the next node failure repeats it.',
      'Grouping by `instance`, which defeats the purpose - you get one notification per instance again.',
    ],
    followUps: [
      'What is the difference between grouping, inhibition and silencing?',
      'What should page versus open a ticket?',
      'How would you measure whether alert quality improved?',
    ],
    tags: ['alerting', 'alertmanager', 'on-call', 'incident'],
  },
  {
    id: 'itv-graf-41',
    level: 'intermediate',
    kind: 'scenario',
    prompt: 'Customers report the site is slow, but every dashboard is green. Where do you look?',
    probing: 'Tests whether you understand that your metrics measure your view, not the user’s.',
    answer: [
      'Green dashboards and unhappy users almost always means **I am measuring the wrong thing, or measuring it in the wrong place**. I would treat the customer reports as the ground truth and the dashboards as the suspect.',
      'The most likely cause is that latency is measured **server-side**, from the moment the application receives a request to the moment it responds. That excludes DNS, TLS handshake, the network, the CDN, the load balancer, queuing before the application, and everything that happens in the browser afterwards. A perfectly fast backend sits behind a slow experience quite comfortably.',
      'So I would look outwards, in order. **Load balancer and ingress metrics**, which include queue time - an ingress with saturated workers shows latency the application never sees. **CDN metrics** and cache hit ratio. **Real user monitoring** in the browser, if it exists, which measures what the customer actually experienced including front-end rendering. And **synthetic probes** from outside the network, which catch DNS and TLS problems invisible from inside.',
      'The second possibility is that the aggregation is hiding it. A global p99 across all routes can look fine while one important route - checkout, search, login - is terrible. Same for one region, one tenant, or one client version. I would break the latency down by route, region and tenant before concluding anything.',
      'The third is that latency is not the problem at all: errors that the client retries away, a slow asset that blocks rendering, or a third-party script. "Slow" from a user is a symptom description, not a diagnosis.',
      'Then I would fix the measurement, because this will happen again otherwise: measure the SLI as close to the user as possible, alert on it, and keep the server-side metrics as the explanation rather than the definition of health.',
    ],
    code: [
      {
        title: 'Look outward and break the aggregate apart',
        language: 'text',
        explanation: 'Each query tests a layer the application metrics cannot see.',
        code: `# Ingress-level latency INCLUDES queue time the app never sees
histogram_quantile(0.99,
  sum by (le, ingress) (
    rate(nginx_ingress_controller_request_duration_seconds_bucket[5m])
  )
)

# Compare it with the application's own view - a gap is queueing
histogram_quantile(0.99,
  sum by (le) (rate(http_request_duration_seconds_bucket{job="checkout"}[5m]))
)

# Is the global p99 hiding one bad route?
topk(5,
  histogram_quantile(0.99,
    sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))
  )
)

# ...or one region, or one tenant?
histogram_quantile(0.99,
  sum by (le, region) (rate(http_request_duration_seconds_bucket[5m]))
)

# CDN cache hit ratio - a drop here moves load onto the origin
sum(rate(cdn_requests_total{cache_status="HIT"}[5m]))
  / sum(rate(cdn_requests_total[5m]))`,
      },
    ],
    deeper: [
      'The gap between ingress latency and application latency is one of the most diagnostic single numbers in a web stack. It is queue time, and it is invisible from inside the application.',
      'Synthetic checks from outside your network catch the failures internal monitoring structurally cannot see: DNS, certificate expiry, BGP and CDN problems.',
      'If a customer can tell you something your monitoring cannot, that is a monitoring defect and deserves a follow-up action in the incident review, not just a fix to the immediate problem.',
    ],
    traps: [
      'Trusting the dashboard over the customer. The customer is measuring the real thing.',
      'Measuring latency only server-side and calling it the user experience.',
      'Looking only at a global p99, which averages away a single broken route.',
    ],
    followUps: [
      'Where exactly should an SLI be measured?',
      'What would a synthetic probe catch that internal metrics cannot?',
      'How would you find whether one route is responsible?',
    ],
    tags: ['troubleshooting', 'sli', 'monitoring', 'incident'],
  },
  {
    id: 'itv-graf-42',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'Node disks are filling up and the culprit is container logs. How do you handle it now and prevent it later?',
    probing: 'An operational problem with an immediate and a structural answer. They want both.',
    answer: [
      'Immediately, I would confirm it really is container logs rather than an image cache or an emptyDir - `du` on `/var/log/pods` against `/var/lib/containerd` settles that in seconds - and find which pod is responsible, because it is nearly always one.',
      'The safe immediate action is **not** deleting log files by hand: the runtime holds open file handles, so removing the file frees nothing until the process closes it, and it breaks `kubectl logs`. Restarting the offending pod is the fast, safe relief - the runtime starts a fresh log file and the old ones are cleaned up.',
      'If the node is critically full, cordoning it and letting the workloads reschedule buys time without risking the kubelet, which behaves badly under disk pressure and will start evicting pods on its own anyway.',
      'The structural cause is almost always one of three: a **log level left at debug** after an incident, a **hot loop** logging on every iteration - a retry storm or a failing health check - or a service logging full request and response bodies. All three are application fixes, not infrastructure ones.',
      'For prevention I would do four things. Set the kubelet’s `containerLogMaxSize` and `containerLogMaxFiles` deliberately so the per-container ceiling is bounded and the node total is predictable. Alert on node disk usage with enough headroom to act - 80%, not 95%. Drop high-volume noise at the log agent so it never costs anything downstream. And give teams visibility of their own log volume, because the ones generating it are the only ones who can fix it properly.',
      'The last point worth making: node disk pressure causes **pod eviction**, so an unbounded logger does not just fill a disk - it takes unrelated workloads down with it. That is what makes the ceiling non-negotiable rather than a tuning preference.',
    ],
    code: [
      {
        title: 'Find it, relieve it, bound it',
        language: 'bash',
        explanation: 'Identify the pod first. Never delete open log files by hand.',
        code: `# Is it really container logs?
sudo du -sh /var/log/pods /var/lib/containerd /var/lib/kubelet 2>/dev/null

# Which pod is responsible?
sudo du -sh /var/log/pods/* | sort -rh | head -5

# Confirm the rate rather than the total - who is writing fastest?
sudo find /var/log/pods -name '*.log' -newermt '-5 minutes' \\
  -exec du -sh {} + | sort -rh | head

# Safe relief: restart the offender. The runtime rotates to a new file.
kubectl -n prod rollout restart deploy/chatty-service

# If the node is critical, stop new work and drain
kubectl cordon worker-3
kubectl drain worker-3 --ignore-daemonsets --delete-emptydir-data

# DO NOT do this - the handle stays open and kubectl logs breaks
# sudo rm /var/log/pods/*/*/*.log`,
      },
      {
        title: 'Bound it at the kubelet, and see it coming',
        language: 'yaml',
        explanation:
          'A hard per-container ceiling makes the worst case arithmetic rather than a surprise.',
        code: `# /var/lib/kubelet/config.yaml
containerLogMaxSize: 10Mi
containerLogMaxFiles: 5
# worst case per container = 50Mi. Multiply by max pods per node
# to get a bounded, predictable ceiling.

evictionHard:
  nodefs.available: '10%'
  imagefs.available: '15%'

---
# Alert with enough headroom to act, not to panic
groups:
  - name: node-disk
    rules:
      - alert: NodeDiskFillingWithLogs
        expr: |
          (1 - node_filesystem_avail_bytes{mountpoint="/"}
             / node_filesystem_size_bytes{mountpoint="/"}) > 0.80
        for: 10m
        labels: { severity: ticket }
        annotations:
          summary: 'Node {{ $labels.instance }} root filesystem is over 80% full'
          runbook_url: https://runbooks.internal/node-disk-logs

      - alert: NamespaceLogVolumeSpike
        expr: |
          sum by (namespace) (rate({namespace=~".+"}[30m]))
            > 3 * sum by (namespace) (rate({namespace=~".+"}[30m] offset 1d))
        for: 15m
        labels: { severity: ticket }`,
      },
    ],
    deeper: [
      'Deleting an open log file frees no space until the writer closes it, and it silently breaks `kubectl logs` for that container. This catches people out under pressure.',
      'The kubelet ceiling is what makes node capacity predictable: max pods multiplied by containers multiplied by `containerLogMaxSize` times `containerLogMaxFiles` is your worst case, and it should fit comfortably.',
      "Disk pressure triggers eviction, so one team's debug logging can evict another team's workload. That framing usually gets the fix prioritised.",
    ],
    traps: [
      'Deleting log files by hand to free space.',
      'Raising the disk size instead of fixing the service that is logging in a loop.',
      'Alerting at 95%, which leaves no time to act before the kubelet starts evicting.',
    ],
    followUps: [
      'Why does deleting the file not free the space?',
      'What is the worst-case log size per node?',
      'How would you find the service logging in a loop?',
    ],
    tags: ['logging', 'kubernetes', 'operations', 'incident'],
  },
  {
    id: 'itv-graf-43',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Traces show each service in isolation - every trace has one span and no parent. What is wrong?',
    probing:
      'A precise symptom with a precise cause. It tests whether you understand propagation properly.',
    answer: [
      'One span per trace with no parent means **the trace context is not surviving the hop between services**. Each service is starting a brand-new trace instead of continuing the one it was given, so instrumentation is working and propagation is not.',
      'I would work out where by looking at the headers directly. The quickest test is to make a request with a known `traceparent` and see whether the downstream service receives it - a debug endpoint that echoes headers, or a log line printing them, answers it immediately.',
      'The usual causes, roughly in order of likelihood. **The client library is not instrumented**: the service auto-instruments its inbound server but makes outbound calls with a plain HTTP client that the instrumentation does not wrap, so nothing injects the header. **A proxy or gateway strips unknown headers** - some ingress and API-gateway configurations whitelist headers, and `traceparent` is not on the list. **Mismatched propagation formats**: one service emits W3C `traceparent`, another expects B3 from an older Zipkin setup, so neither reads the other. **An asynchronous hop** - a queue, a scheduled job, a thread pool - where the context must be carried in the message payload and nobody wrote that code.',
      'There is also a subtler one worth mentioning: **context loss inside the process**. In async runtimes, if the context is not propagated across an await, a thread hand-off or a callback, the outgoing call genuinely has no current span to inherit from even though the inbound request was traced.',
      'The fixes follow directly: use the instrumented HTTP client, configure the propagator consistently - OTel can accept several formats at once during a migration - allow the header through every proxy, and for async hops inject and extract the context explicitly in the message.',
      'To prevent recurrence I would add a check to the platform: a synthetic request through the whole call chain, asserting the resulting trace has spans from every expected service. Broken propagation is otherwise invisible until an incident, because every individual service looks correctly instrumented.',
    ],
    code: [
      {
        title: 'Locate the break, then fix it',
        language: 'bash',
        explanation:
          'Send a known trace id in and see how far it travels. The first service that loses it is the culprit.',
        code: `# Send a request with a traceparent we control
TP="00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
curl -v -H "traceparent: $TP" https://api.internal/checkout/order

# Did the NEXT service receive it? Check its logs for the trace id
kubectl -n prod logs deploy/payments --tail=100 | grep 4bf92f3577b34da6
#   present  => propagation worked to here, look further downstream
#   absent   => the break is between checkout and payments

# Is a proxy stripping it? Ask an echo endpoint what arrived
kubectl -n prod exec deploy/payments -- \\
  curl -s localhost:8080/debug/headers | jq

# Which propagators is the SDK configured with?
kubectl -n prod exec deploy/checkout -- env | grep -i otel_propagators
# expect: OTEL_PROPAGATORS=tracecontext,baggage`,
      },
      {
        title: 'Accepting several formats during a migration',
        language: 'yaml',
        explanation:
          'Mixed estates need mixed propagators. Configure both rather than migrating everything at once.',
        code: `# Deployment env - accept W3C and B3 while services are migrated
env:
  - name: OTEL_PROPAGATORS
    value: 'tracecontext,baggage,b3multi'
  - name: OTEL_SERVICE_NAME
    value: checkout
  - name: OTEL_EXPORTER_OTLP_ENDPOINT
    value: http://alloy.monitoring.svc:4318

---
# Ingress must not strip the header
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  annotations:
    nginx.ingress.kubernetes.io/configuration-snippet: |
      proxy_set_header traceparent $http_traceparent;
      proxy_set_header tracestate  $http_tracestate;`,
      },
    ],
    deeper: [
      'Instrumenting the inbound server but not the outbound client is the single most common cause, and it produces exactly this symptom: every service traced, no service connected.',
      'Async context propagation is a language-level concern - Python contextvars, Java thread locals plus an agent, Go explicit context passing. Auto-instrumentation handles the common cases and not custom thread pools.',
      'A synthetic end-to-end trace assertion in CI or as a periodic check is the only reliable way to notice propagation breaking, because nothing errors when it does.',
    ],
    traps: [
      'Concluding tracing is broken. Each service is tracing correctly; only the join is missing.',
      'Assuming a service mesh will connect the traces for you. It cannot propagate context through your process.',
    ],
    followUps: [
      'How would you test propagation continuously?',
      'Why does a queue break the trace?',
      'What is the difference between W3C and B3 propagation?',
    ],
    tags: ['tracing', 'opentelemetry', 'troubleshooting', 'propagation'],
  },
  {
    id: 'itv-graf-44',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Prometheus starts OOM-killing itself an hour after a routine release. Nothing else changed. What happened and what do you do?',
    probing:
      'The classic cardinality incident. The timing - an hour after, not immediately - is the clue.',
    answer: [
      'The delay is the clue. Prometheus memory is dominated by the **head block**, which holds recent series in memory. A release that added a high-cardinality label does not blow memory at once - series accumulate as new label values appear, so memory climbs steadily and crosses the limit an hour or two later. Immediate failure would suggest a config or scrape problem instead.',
      'To confirm, I would look at `prometheus_tsdb_head_series` over the last few hours. A step change or a steady climb starting at the release time is conclusive, and the TSDB status endpoint ranks series by metric name so it names the culprit directly.',
      'To stabilise, in this order: give Prometheus more memory temporarily so it stays up and I can query it, then **drop the offending label at scrape time** with `metric_relabel_configs`. That takes effect on the next scrape and stops the growth. The series already in the head block will age out as blocks are compacted, so memory recovers over the following couple of hours rather than instantly.',
      'If it will not stay up long enough to query, reducing the retention or the scrape interval temporarily buys headroom, and in the worst case deleting the WAL and starting fresh loses recent data but restores service - a decision worth stating explicitly rather than doing quietly.',
      'The cause is nearly always one of a small set: a label carrying a **request ID, user ID, full URL path, pod IP or timestamp**. A URL path is the most common of all, because it looks bounded until somebody adds `/api/orders/{id}` and every order becomes a series.',
      'The prevention I would put in place afterwards is the real answer to the question. An **alert on series count growth**, so this is caught in ten minutes rather than at an OOM. A **`sample_limit`** on the scrape config, which fails the scrape rather than the server when a target suddenly exposes far more series. And a review habit around instrumentation changes - the rule being that a label must have a small, bounded set of values known in advance, and anything derived from user input needs a template rather than the raw value.',
    ],
    code: [
      {
        title: 'Confirm the diagnosis',
        language: 'bash',
        explanation: 'Series count over time names the moment; the TSDB status names the metric.',
        code: `# The number that predicts the OOM
curl -sG localhost:9090/api/v1/query \\
  --data-urlencode 'query=prometheus_tsdb_head_series' | jq '.data.result[0].value[1]'

# How much did it grow since before the release?
# prometheus_tsdb_head_series - prometheus_tsdb_head_series offset 3h

# Which metric is responsible?
curl -s localhost:9090/api/v1/status/tsdb \\
  | jq '.data.seriesCountByMetricName[:5]'

# Which label inside it is exploding?
# count(count by (path) (http_requests_total))
# count(count by (user_id) (http_requests_total))

# Which job is producing the most series?
# topk(5, count by (job) ({__name__=~".+"}))`,
      },
      {
        title: 'Stop the growth, then make it fail safely',
        language: 'yaml',
        explanation:
          'metric_relabel_configs drops before storage. sample_limit turns a future incident into a failed scrape.',
        code: `scrape_configs:
  - job_name: checkout
    # Fail the SCRAPE, not the server, if a target explodes again.
    # The scrape is marked failed and up=0 alerts you immediately.
    sample_limit: 50000
    label_limit: 30
    label_value_length_limit: 200

    metric_relabel_configs:
      # Immediate relief: drop the offending label entirely
      - regex: 'request_id|user_id|session_id'
        action: labeldrop

      # Better: template the path so it is bounded again
      - source_labels: [path]
        regex: '/api/orders/[0-9a-f-]+'
        target_label: path
        replacement: '/api/orders/:id'

---
# Catch it in ten minutes next time
- alert: PrometheusSeriesGrowingFast
  expr: |
    prometheus_tsdb_head_series
      > 1.25 * (prometheus_tsdb_head_series offset 1h)
  for: 10m
  labels: { severity: ticket }
  annotations:
    summary: 'Active series up 25% in an hour - check for a new label'`,
      },
    ],
    deeper: [
      'Memory does not drop the moment you fix the label. The head block holds those series until it is compacted, so expect recovery over a couple of hours, and say so rather than assuming the fix failed.',
      '`sample_limit` is underused and excellent: it converts "Prometheus fell over" into "one scrape target is failing", which is a far better failure mode and points straight at the responsible service.',
      'The same reasoning transfers directly to Loki stream labels. Being able to say that shows the principle is understood rather than memorised.',
    ],
    traps: [
      'Adding memory and calling it fixed. The growth continues and you will be back.',
      'Expecting memory to recover immediately after dropping the label.',
      'Blaming the release for its functional changes when the cause is one new label.',
    ],
    followUps: [
      'Why an hour, and not immediately?',
      'What does sample_limit do exactly?',
      'How would the same mistake affect Loki?',
    ],
    tags: ['prometheus', 'cardinality', 'incident', 'troubleshooting'],
  },
  {
    id: 'itv-graf-45',
    level: 'intermediate',
    kind: 'scenario',
    prompt: 'Logs are flowing from every node except one. What is your process?',
    probing: 'Narrow, systematic debugging. The fact that it is one node is most of the answer.',
    answer: [
      'One node rather than all of them immediately eliminates most of the pipeline. Loki is fine, the network to Loki is fine, the relabel config is fine, the applications are fine - if any of those were broken it would affect every node. The problem is on that node or in the agent instance on it.',
      'So I would check, in order.',
      '**Is there an agent pod on that node at all?** A DaemonSet is meant to guarantee one, but it cannot schedule onto a node whose taints it does not tolerate. A new node pool with a taint, or a taint added for GPU or spot workloads, is the single most common cause of exactly this symptom.',
      '**If the pod exists, is it healthy?** Pending, CrashLoopBackOff, or OOMKilled. An agent with a low memory limit on a node running chatty workloads gets OOM-killed repeatedly, and while it restarts it ships nothing.',
      '**What do its logs say?** Permission denied reading `/var/log`, a failed connection to Loki, a 429, or an authentication failure will all be stated plainly. This step usually ends the investigation.',
      '**Is the data even on the node?** If `/var/log/pods` is empty or the runtime is unhealthy, the problem is below the agent - a container runtime issue, or a disk that is full, which stops the runtime writing logs at all.',
      '**Is it the node, not the agent?** Disk pressure, clock skew - a badly skewed clock makes Loki reject entries as too far in the future or past, which is a genuinely confusing failure because everything looks healthy - or a network policy blocking egress from that node.',
      'The preventative fix afterwards is an alert on **agent coverage**: compare the number of ready nodes with the number of running agent pods, and alert when they differ for more than a few minutes. Without that, a missing agent is silent, and a silent blind spot in logging is the worst kind.',
    ],
    code: [
      {
        title: 'Working down the node',
        language: 'bash',
        explanation: 'Six checks, each ruling out a layer. Most stop at step two or three.',
        code: `NODE=worker-7

# 1. Is there an agent pod on that node?
kubectl -n monitoring get pods -l app=alloy -o wide | grep $NODE

# 2. If not, why did the DaemonSet not schedule one? Taints.
kubectl describe node $NODE | grep -A3 Taints
kubectl -n monitoring get ds alloy -o jsonpath='{.spec.template.spec.tolerations}' | jq

# 3. If it exists - healthy, or restarting?
kubectl -n monitoring get pod -l app=alloy --field-selector spec.nodeName=$NODE
kubectl -n monitoring describe pod <agent-pod> | grep -A5 'Last State'

# 4. What does it say?
kubectl -n monitoring logs <agent-pod> --tail=50

# 5. Is there anything on the node to read?
kubectl debug node/$NODE -it --image=busybox -- \\
  sh -c 'ls /host/var/log/pods | head; df -h /host/var'

# 6. Clock skew - a real and confusing cause of rejected entries
kubectl debug node/$NODE -it --image=busybox -- date -u`,
      },
      {
        title: 'Alert on the blind spot',
        language: 'yaml',
        explanation: 'A missing agent is silent. This is the only thing that makes it loud.',
        code: `- alert: LogAgentMissingFromNode
  expr: |
    count(kube_node_info)
      -
    count(kube_pod_info{pod=~"alloy-.*", created_by_kind="DaemonSet"})
      > 0
  for: 10m
  labels: { severity: ticket }
  annotations:
    summary: 'A node has no log agent - logs from it are being lost'
    runbook_url: https://runbooks.internal/log-agent-coverage

- alert: LogAgentNotShipping
  expr: |
    sum by (instance) (rate(promtail_sent_entries_total[10m])) == 0
      and on(instance)
    sum by (instance) (rate(promtail_sent_entries_total[1h] offset 1h)) > 0
  for: 15m
  labels: { severity: ticket }`,
      },
    ],
    deeper: [
      'Missing tolerations are the top cause. Control-plane, GPU and spot node pools all commonly carry taints, and a DaemonSet with default tolerations quietly skips them.',
      'Clock skew is worth remembering because it is so confusing: the agent reports success, Loki rejects entries as out of the accepted time window, and nothing obviously fails.',
      'Comparing node count with agent pod count is a two-line alert that catches an entire class of silent blind spots. It is one of the highest value-per-effort alerts on a platform.',
    ],
    traps: [
      'Investigating Loki when only one node is affected. The scope of the symptom rules it out.',
      'Assuming a DaemonSet always covers every node. Taints override that.',
    ],
    followUps: [
      'Why would a DaemonSet skip a node?',
      'How would you notice this without a user reporting it?',
      'What does clock skew do to log ingestion?',
    ],
    tags: ['logging', 'troubleshooting', 'kubernetes', 'daemonset'],
  },
  {
    id: 'itv-graf-46',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'An alert has fired every night for three weeks and the team silences it each time. How do you deal with that?',
    probing: 'Alert hygiene and judgement. A repeatedly silenced alert is a live reliability risk.',
    answer: [
      'A repeatedly silenced alert is worse than no alert. It trains the team to dismiss notifications without reading them, and the cost is eventually a real page that gets silenced by reflex. So I would treat it as an incident in its own right rather than a nuisance.',
      'The first question is: **is it detecting something real?** There are only three possible answers and each has a different fix.',
      '**It is real and worth acting on.** Then the problem is that nobody is acting. Find out why - usually no runbook, no clear owner, or a fix that needs prioritising against feature work. The fix is to make the underlying problem a ticket with an owner, not to keep alerting about it nightly.',
      '**It is real but not urgent.** A nightly batch job does briefly push latency up, and nothing is harmed. Then the alert is correctly detecting something and incorrectly classifying it. Fix the classification: downgrade it from page to ticket, add a **mute timing** for the known window, or raise the threshold to the level that actually matters.',
      '**It is not real at all.** A threshold set by guesswork, a `for` duration too short so a normal spike trips it, an alert on a cause rather than a symptom, or a metric that is simply noisy. Then fix the rule, or delete it. Deleting an alert is a legitimate and underused action.',
      'For the specific pattern of "every night", I would look hard at scheduled work: backups, batch jobs, cron, log rotation, certificate renewal. A mute timing for a known maintenance window is the right tool, and much better than a recurring manual silence.',
      'Finally I would make this measurable so it does not accumulate again. Track alerts by **fire count and action rate** - how often each alert fires and how often anybody did anything as a result. Any alert with a high fire count and a near-zero action rate goes on a list to be fixed or deleted. Reviewing that list monthly keeps the alert set honest, and it is the kind of process answer an interviewer is listening for.',
    ],
    code: [
      {
        title: 'Mute a known window rather than silencing by hand',
        language: 'yaml',
        explanation:
          'A declared maintenance window is reviewable and self-documenting. A manual silence is neither.',
        code: `# Alertmanager: a named time interval, applied on a route
time_intervals:
  - name: nightly-batch-window
    time_intervals:
      - times:
          - start_time: '02:00'
            end_time: '03:30'
        location: 'Europe/London'
        weekdays: ['monday:friday']

route:
  receiver: default
  routes:
    - matchers:
        - alertname="CheckoutLatencyHigh"
        - service="checkout"
      mute_time_intervals: [nightly-batch-window]
      receiver: pagerduty

---
# Better still: make the rule itself aware of the expected state,
# so a genuine problem during the window still pages.
- alert: CheckoutLatencyHigh
  expr: |
    histogram_quantile(0.99,
      sum by (le) (rate(http_request_duration_seconds_bucket{job="checkout"}[5m]))
    ) > 1.5
      unless on()
    batch_job_running{job="nightly-reconciliation"} == 1
  for: 10m
  labels: { severity: page }`,
      },
    ],
    deeper: [
      'A mute timing is declared in code and reviewed; a manual silence is invisible, expires unpredictably, and is frequently set wider than intended - people silence the whole service rather than the one alert.',
      'The `unless` form above is stronger than muting by time, because it suppresses only when the expected condition genuinely holds. A real outage during the batch window still pages.',
      'Measuring action rate per alert is the mechanism that keeps this from recurring. Alerts accumulate silently otherwise, and nobody owns deleting them.',
    ],
    traps: [
      'Deleting the alert without checking whether it was detecting something real.',
      'Silencing indefinitely, which is deleting it while pretending you have not.',
      'Only raising the threshold, when the real issue is that it should never have paged.',
    ],
    followUps: [
      'How would you decide between fixing and deleting it?',
      'What is the difference between a silence and a mute timing?',
      'How would you measure alert quality across the whole platform?',
    ],
    tags: ['alerting', 'on-call', 'sre', 'alert fatigue'],
  },
  {
    id: 'itv-graf-47',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Prometheus and Grafana both run in the cluster they monitor. The cluster has an outage. What happens, and how would you have designed it differently?',
    probing:
      'Meta-monitoring. A good answer accepts the circularity and proposes a proportionate fix.',
    answer: [
      'What happens is that the monitoring goes down with the thing it monitors, at exactly the moment you need it. Dashboards are unreachable, alerts are not evaluated, and the alert that should have told you the cluster is down cannot fire because the component that would fire it is inside the cluster. You find out from a customer.',
      'It is a genuine circular dependency and it is extremely common, because putting the monitoring stack in the cluster is the easy default.',
      'The principle is that **your monitoring must not depend on what it monitors**, and there are a few ways to satisfy it at different costs.',
      'The cheapest and most valuable is an **external dead-man’s switch**. A rule that always fires sends a continuous heartbeat to an external service - Dead Man’s Snitch, Healthchecks.io, or a probe in another account. When the heartbeat stops, the external service alerts. It costs almost nothing and it catches the total-outage case that nothing inside can.',
      'Next, **external synthetic probes**: a blackbox check from outside your network hitting your real endpoints. It tells you what a customer experiences, independent of everything inside.',
      'Then **a monitoring cluster or region that is separate** from production, running a Prometheus that scrapes the production Prometheus federation endpoint or receives remote write, plus the Alertmanager that actually pages. The critical part is that **Alertmanager lives outside**, because that is the component whose failure silences everything.',
      'For most teams I would propose the pragmatic middle: per-cluster Prometheus for local alerting and fast queries, remote write into a central store outside the cluster, Alertmanager and Grafana hosted outside, plus a dead-man’s switch and external synthetics. That gives resilience where it matters without running a second full platform.',
      'The honest framing to offer: you cannot eliminate the dependency entirely - something must be watched by something else - but you can make the monitoring strictly less likely to fail than the thing it watches, and you can guarantee that its silence is itself an alert.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Breaking the circular dependency',
        caption: 'The heartbeat is the cheapest half of this and catches the worst case.',
        nodes: [
          {
            label: 'Production cluster',
            detail: 'local Prometheus for fast queries and local alerting',
            tone: 'accent',
          },
          {
            label: 'Remote write out of the cluster',
            detail: 'metrics survive the cluster that produced them',
            arrowLabel: 'push',
          },
          {
            label: 'External store and Alertmanager',
            detail: 'different account or region - pages even when the cluster is gone',
            arrowLabel: 'evaluate and route',
            tone: 'success',
          },
          {
            label: 'Dead-man heartbeat',
            detail: 'an always-firing rule pinging an external service',
            arrowLabel: 'continuous',
            tone: 'success',
          },
          {
            label: 'External synthetic probes',
            detail: 'hit the real endpoints from outside - the customer view',
            arrowLabel: 'independent path',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'The dead-man’s switch',
        language: 'yaml',
        explanation:
          'An alert that always fires. Its absence is the signal - which is the only way to detect total silence.',
        code: `groups:
  - name: meta-monitoring
    rules:
      # Always true. It is SUPPOSED to fire, constantly.
      - alert: DeadMansSwitch
        expr: vector(1)
        labels:
          severity: none
        annotations:
          summary: >-
            This alert always fires. If it STOPS arriving, the monitoring
            stack is down and nothing else can tell you.

---
# Route it to an external heartbeat service that alerts on silence
route:
  routes:
    - matchers: [alertname="DeadMansSwitch"]
      receiver: deadmanssnitch
      group_wait: 0s
      group_interval: 5m
      repeat_interval: 5m      # keep pinging

receivers:
  - name: deadmanssnitch
    webhook_configs:
      - url: https://nosnch.in/REPLACE_WITH_SNITCH_ID
        send_resolved: false`,
      },
      {
        title: 'Monitoring the monitoring from inside, too',
        language: 'text',
        explanation:
          'These catch degradation before total failure. They are not a substitute for the external heartbeat.',
        code: `# Is Prometheus actually scraping what it should?
count(up == 0) > 0

# Is rule evaluation falling behind? Alerts are late if so.
prometheus_rule_group_last_duration_seconds
  > prometheus_rule_group_interval_seconds

# Is remote write keeping up, or silently dropping?
prometheus_remote_storage_samples_pending > 10000
rate(prometheus_remote_storage_samples_dropped_total[5m]) > 0

# Is Alertmanager able to deliver at all?
rate(alertmanager_notifications_failed_total[5m]) > 0

# Is Prometheus about to run out of disk or memory?
predict_linear(prometheus_tsdb_storage_blocks_bytes[6h], 24*3600)
  > node_filesystem_size_bytes{mountpoint="/prometheus"}`,
      },
    ],
    deeper: [
      'The dead-man’s switch is the single highest value-per-effort item on this list. It is one alert rule and one external webhook, and it is the only thing that detects total silence.',
      'Alertmanager placement matters more than Prometheus placement. A Prometheus that dies loses data; an Alertmanager that dies loses every page from every Prometheus.',
      'Test it deliberately - scale the monitoring namespace to zero in a non-production cluster and confirm you actually get alerted. Most teams have never verified this and discover it does not work during the outage.',
    ],
    traps: [
      'Alerting on "Prometheus is down" from the same Prometheus. It cannot fire.',
      'Putting Alertmanager inside the cluster it is meant to page about.',
      'Never testing the failure path, so the design is theoretical.',
    ],
    followUps: [
      'What exactly is a dead-man’s switch and why does it work?',
      'Where should Alertmanager run?',
      'How would you test that this works?',
    ],
    tags: ['monitoring', 'reliability', 'meta-monitoring', 'incident'],
  },
  {
    id: 'itv-graf-48',
    level: 'basic',
    kind: 'scenario',
    prompt:
      'A developer says "I cannot find my logs in Grafana" for a pod that is running fine. Where do you start?',
    probing:
      'Everyday support. The method is to establish where in the chain to start rather than guessing.',
    answer: [
      'I would ask two questions before touching anything, because they eliminate most of the possibilities. **Has this service ever had logs in Grafana?** and **does `kubectl logs` show anything?**',
      'If it has **never** worked, it is a setup problem rather than a failure: a namespace not covered by the agent config, a pod label that does not match what the relabel rules expect, or a new namespace nobody added to the collection scope.',
      'If it worked **yesterday and not today**, something changed - an agent config change, a new node pool with no agent, or a rate limit now being hit.',
      'If `kubectl logs` is **also empty**, the problem is upstream of everything else: the application is writing to a file rather than stdout, or it is not logging at all. This is the single most common cause of the report, and it is a ten-second check.',
      'Assuming `kubectl logs` works, the next step is almost always the search itself. Loki requires a label selector, and the labels are usually not what people expect - `app` may be the Helm release name rather than the container name, and `namespace` is easy to get wrong. I would look at what labels actually exist rather than guessing, which the label browser in Explore makes trivial.',
      'The last common cause is the **time range**. Grafana defaults to the last hour; if the pod logged during startup two hours ago, the query is correct and the window is wrong.',
      'And if none of that resolves it, I would go down a level and check whether the agent is running on that pod’s node and what its logs say - but in practice the first four checks resolve the great majority of these.',
    ],
    code: [
      {
        title: 'The four checks that resolve most of these',
        language: 'bash',
        explanation: 'In order of how often they are the answer.',
        code: `# 1. Is the app logging to stdout at all?
kubectl -n prod logs deploy/checkout --tail=20
#    empty => nothing downstream can possibly have logs

# 2. What labels does Loki actually have for it?
curl -sG http://loki:3100/loki/api/v1/label/app/values | jq -r '.data[]'
#    or in Grafana: Explore > Loki > the label browser

# 3. Query with the broadest possible selector, wide time range
#    {namespace="prod"} | json | container="checkout"
#    ...rather than guessing a specific app label

# 4. Is there an agent on that pod's node?
NODE=$(kubectl -n prod get pod -l app=checkout -o jsonpath='{.items[0].spec.nodeName}')
kubectl -n monitoring get pods -l app=alloy -o wide | grep "$NODE"`,
      },
    ],
    traps: [
      'Debugging Loki before checking `kubectl logs`. If the app is not writing to stdout, nothing downstream matters.',
      'Guessing at label names instead of listing them.',
      'Forgetting the default one-hour time range.',
    ],
    followUps: [
      'What if kubectl logs is empty too?',
      'How would a developer find which labels exist?',
      'What would you check if it worked yesterday?',
    ],
    tags: ['logging', 'troubleshooting', 'loki', 'support'],
  },
  {
    id: 'itv-graf-49',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'Your Loki bill doubled overnight with no new services deployed. How do you find out why?',
    probing:
      'Cost investigation with a clear starting point. Overnight and no deployment is a strong hint.',
    answer: [
      'Overnight, with no new services, means either an existing service started producing far more, or the pipeline started keeping more of what was already being produced. I would find which before proposing anything.',
      'The first query is bytes ingested **by namespace**, comparing today against the same time yesterday. That almost always isolates it to one namespace, and then one container, within a couple of minutes.',
      'The usual causes, in the order I would expect them. **A log level changed** - somebody set debug during an incident and did not revert it, which is by far the most common. **A retry or error loop** - a failing dependency causing a service to log an error on every attempt, so the log volume is a symptom of an outage rather than a cause in itself. **A library upgrade** that changed default logging - request logging switched on by default in a framework upgrade does this regularly. And **a chatty health check** newly logging every probe, at one per second per pod.',
      'It is worth checking whether the volume increase corresponds to something being **wrong**. A doubling of logs overnight is sometimes the clearest signal that a service has been failing all night in a way nothing else alerted on - in which case the bill is the symptom and the outage is the story.',
      'Once identified, the fixes are the ones I would apply anyway: revert the level, drop health-check and probe lines at the agent, sample high-volume success lines while keeping every error, and if the cause is an error loop, fix the error.',
      'For prevention I would add an alert on log volume growth per namespace - a sudden multiple of yesterday is worth a ticket - and a dashboard showing bytes per namespace, visible to the teams that own them. Cost that only the platform team can see is cost only the platform team tries to fix.',
    ],
    code: [
      {
        title: 'Find it by comparison, not by absolute volume',
        language: 'text',
        explanation:
          'Comparing against yesterday isolates the change. Absolute volume only tells you who is biggest.',
        code: `# Which namespace changed? Compare with the same window yesterday.
topk(5,
  sum by (namespace) (rate({namespace=~".+"}[1h]))
    -
  sum by (namespace) (rate({namespace=~".+"}[1h] offset 24h))
)

# Narrow to the container inside it
topk(5, sum by (container) (rate({namespace="prod"}[1h])))

# Is it a level change?
sum by (level) (rate({namespace="prod", app="checkout"} | json [1h]))

# Is it health checks?
sum(rate({namespace="prod"} |~ "/(healthz|readyz|livez)" [1h]))
  / sum(rate({namespace="prod"}[1h]))

# Is it an error loop - i.e. is this actually an outage?
sum(rate({namespace="prod"} | json | level="error" [1h]))
  / sum(rate({namespace="prod"} | json | level="error" [1h] offset 24h))`,
      },
      {
        title: 'Catch the next one automatically',
        language: 'yaml',
        explanation:
          'A volume alert per namespace turns a monthly bill surprise into a same-day ticket.',
        code: `- alert: LogVolumeSpike
  expr: |
    sum by (namespace) (rate({namespace=~".+"}[30m]))
      >
    3 * sum by (namespace) (rate({namespace=~".+"}[30m] offset 24h))
  for: 20m
  labels: { severity: ticket }
  annotations:
    summary: '{{ $labels.namespace }} log volume is 3x yesterday'
    description: >-
      Check for a debug level left enabled, a retry loop, or a
      dependency failure causing error logging. This is sometimes
      the first signal of an unnoticed outage.
    runbook_url: https://runbooks.internal/log-volume-spike`,
      },
    ],
    deeper: [
      'A log volume spike is a genuinely useful availability signal, not only a cost one. Services that fail loudly show up here before anything else notices.',
      'Drop at the agent rather than adjusting retention. Dropping removes network, ingest, index and storage cost together; retention only removes the last of those.',
      'Never sample error logs to save money. Sample successes and keep every error, or your alerting starts under-counting.',
    ],
    traps: [
      'Cutting retention as the first response. It is the least effective lever and the most visible.',
      'Treating it as purely a cost problem when it may be telling you a service is failing.',
    ],
    followUps: [
      'What would you drop, and what would you never drop?',
      'How would you show teams their own log cost?',
      'Could this spike be an outage signal?',
    ],
    tags: ['loki', 'cost', 'logging', 'troubleshooting'],
  },
  {
    id: 'itv-graf-50',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'You are taking over an unfamiliar platform on call tomorrow. How would you check the observability is actually trustworthy?',
    probing:
      'A broad synthesis question. It reveals what someone has learned from being paged by a system they did not build.',
    answer: [
      'I would be trying to answer one question: **if something breaks tonight, will I find out, and will I be able to diagnose it?** I would check that in five areas.',
      '**Will I be told?** Are alerts actually routed to me, and has anyone tested that path recently? Is there a dead-man’s switch, so total silence is itself an alert? I would send a test notification rather than assume, because a broken PagerDuty integration is silent by definition.',
      '**Are the alerts worth being told about?** I would look at what fired in the last month and how often each one was acted on. A handful of alerts that are always acted on is a healthy system; forty that are routinely silenced means I will be woken for nothing and may miss the real one. I would also check whether the alerts are on symptoms users feel or on causes like CPU.',
      '**Can I diagnose without the people who built it?** Does every alert carry a runbook link, and does the runbook say what to check first? Is there a dashboard per service that I can find without asking? This is the difference between a two-hour incident and a twenty-minute one, and it is the thing most often missing.',
      '**Is the data actually there?** Are logs flowing from every namespace and every node - including any tainted node pool? Is there tracing, and is propagation intact, or does it produce disconnected single-span traces? Is retention long enough to investigate something that started three days ago?',
      '**Is the monitoring itself healthy?** Any scrape targets down, rule evaluation falling behind, remote write dropping samples, or Prometheus close to its memory or disk limit. A monitoring stack running at its edge will fail at the worst possible moment.',
      'The single most valuable thing I would do, though, is **run a drill**: break something small in a non-production environment and walk the path from alert to root cause exactly as I would at 3am. That finds the gaps no checklist does - the dashboard that needs a variable nobody can guess, the runbook link that 404s, the alert routed to a channel nobody reads. An hour of that is worth a day of reading documentation.',
    ],
    code: [
      {
        title: 'The health check for the monitoring itself',
        language: 'text',
        explanation:
          'Run these before your first shift. Each one has woken somebody up at a bad time.',
        code: `# Anything not being scraped? A dead exporter is a blind spot.
count(up == 0) by (job)

# Rule evaluation falling behind - alerts will be late
prometheus_rule_group_last_duration_seconds
  > prometheus_rule_group_interval_seconds

# Remote write dropping data silently
rate(prometheus_remote_storage_samples_dropped_total[5m]) > 0

# Alertmanager failing to deliver - the worst silent failure
rate(alertmanager_notifications_failed_total[5m]) > 0

# Is Prometheus near its limits?
prometheus_tsdb_head_series
process_resident_memory_bytes{job="prometheus"}

# Which namespaces have logs, and which are silent?
sum by (namespace) (count_over_time({namespace=~".+"}[1h]))

# Does every node have a log agent?
count(kube_node_info) - count(kube_pod_info{pod=~"alloy-.*"})

# Are there alerts that fire constantly and change nothing?
topk(10, sum by (alertname) (count_over_time(ALERTS{alertstate="firing"}[30d])))`,
      },
    ],
    deeper: [
      'The alert-to-runbook ratio is the fastest proxy for how an on-call shift will feel. Alerts without runbooks mean every incident starts by finding somebody who knows.',
      'A drill in a non-production environment finds the gaps a checklist cannot - broken dashboard links, unguessable variables, alerts routed to dead channels. It is the highest-value hour you can spend before a first shift.',
      'Check retention against your actual investigation window. Seven-day metric retention makes "this started last Tuesday" unanswerable, and nobody notices until they need it.',
    ],
    traps: [
      'Assuming alerts reach you because they exist. Test the notification path.',
      'Judging the system by the number of dashboards rather than by whether alerts are actionable.',
      'Skipping the drill, which is where the real gaps show up.',
    ],
    followUps: [
      'What would you fix first if you found several gaps?',
      'How would you run that drill?',
      'What does a good runbook contain?',
    ],
    tags: ['observability', 'on-call', 'sre', 'platform'],
  },
]
