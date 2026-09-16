import type { InterviewQuestion } from '../../../types'

/** Instrumentation, Kubernetes monitoring, logs, tracing and practical operations. */
export const promPracticeQuestions: InterviewQuestion[] = [
  {
    id: 'itv-prom-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you instrument an application from scratch? What would you measure first?',
    probing:
      'Practical instrumentation, and knowing where to start rather than measuring everything.',
    answer: [
      'I would start with the **RED metrics** for every request-handling path: **rate**, **errors** and **duration**. Three metrics - a counter for requests labelled by method, endpoint and status, and a histogram for duration - cover the overwhelming majority of what you need to know about whether a service is healthy.',
      'Then **dependencies**: the same three for every outbound call the service makes, labelled by which dependency. That is what lets you tell "we are slow" from "the database is slow", which is the first question during an incident.',
      'Then **saturation signals** specific to the service: connection pool usage against its size, queue depth, worker utilisation, in-flight requests. These are predictive - they tell you about a problem before users feel it.',
      'Then, and only then, **business metrics**: orders placed, payments processed, signups. These are often the most valuable of all, because a drop in orders detects failures that no infrastructure metric would - a bug that silently returns an empty result set, for instance.',
      'The discipline is to **keep labels bounded**. Method, endpoint template, status code and dependency name are fine. Anything unique per request or per user is not, and adding it will eventually take the Prometheus server down.',
    ],
    code: [
      {
        title: 'The instrumentation that covers most of it',
        language: 'python',
        code: `from prometheus_client import Counter, Histogram, Gauge

REQUESTS = Counter(
    "http_requests_total", "Total HTTP requests",
    ["method", "endpoint", "status"],        # bounded values only
)

DURATION = Histogram(
    "http_request_duration_seconds", "Request duration",
    ["method", "endpoint"],
    buckets=(0.005, 0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10),
)

IN_FLIGHT = Gauge("http_requests_in_flight", "Requests currently being served")

DEPENDENCY = Histogram(
    "dependency_request_duration_seconds", "Outbound call duration",
    ["dependency", "operation", "status"],
)

ORDERS = Counter("orders_placed_total", "Orders successfully placed", ["channel"])

@app.middleware("http")
async def observe(request, call_next):
    # endpoint is the ROUTE TEMPLATE, never the raw path with IDs in it
    endpoint = request.scope.get("route", {}).get("path", "unknown")
    IN_FLIGHT.inc()
    try:
        with DURATION.labels(request.method, endpoint).time():
            response = await call_next(request)
        REQUESTS.labels(request.method, endpoint, response.status_code).inc()
        return response
    finally:
        IN_FLIGHT.dec()`,
        explanation:
          'Using the route template rather than the raw path is what keeps cardinality bounded.',
      },
    ],
    traps: [
      'Labelling by raw URL path, which includes IDs and explodes cardinality.',
      'Instrumenting everything and alerting on nothing.',
      'No dependency metrics, so every incident starts with "is it us or them?" and no data.',
      'Skipping business metrics, which catch failures infrastructure metrics cannot see.',
    ],
    followUps: [
      'Why is a business metric sometimes better than an error rate?',
      'What would you label a request counter with, and what would you never label it with?',
    ],
    tags: ['instrumentation', 'red method', 'client libraries', 'cardinality'],
  },
  {
    id: 'itv-prom-32',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you monitor a Kubernetes cluster with Prometheus?',
    probing: 'The standard stack and which component provides what.',
    answer: [
      'There are four sources, and knowing which gives you what is the useful part.',
      '**kube-state-metrics** exposes the **state of Kubernetes objects** as metrics - how many replicas a Deployment wants versus has, whether a Pod is Ready, whether a Job succeeded, PVC status. It reports what the API server says, not resource usage.',
      '**cAdvisor**, built into the kubelet, exposes **actual container resource usage** - CPU, memory, network, filesystem per container. This is where you get "how much memory is this pod using".',
      '**node_exporter**, as a DaemonSet, exposes **machine-level** metrics - disk, CPU, network, filesystem for the node itself.',
      'And your **applications**, instrumented directly and discovered through Kubernetes service discovery.',
      'The pairing that matters most is kube-state-metrics **with** cAdvisor: the first tells you the desired and actual replica counts, the second tells you whether those replicas are near their limits. Together they answer "is this workload healthy and is it about to stop being so".',
      'In practice almost everyone deploys **kube-prometheus-stack**, a Helm chart bundling Prometheus, Alertmanager, Grafana, all of the above, and a large set of well-tested default rules. Writing this from scratch is rarely a good use of time.',
    ],
    code: [
      {
        title: 'The queries that answer the common questions',
        language: 'text',
        code: `# Pods not in the state they should be
kube_deployment_status_replicas_available
  / kube_deployment_spec_replicas < 1

# Containers restarting - the classic early warning
rate(kube_pod_container_status_restarts_total[15m]) * 3600 > 3

# Memory usage against the limit - who is about to be OOMKilled?
container_memory_working_set_bytes{container!=""}
  / on(pod, container) kube_pod_container_resource_limits{resource="memory"}
  > 0.9

# CPU throttling - a very common invisible latency cause
rate(container_cpu_cfs_throttled_seconds_total[5m]) > 0.1

# Node pressure
kube_node_status_condition{condition="MemoryPressure",status="true"} == 1`,
      },
    ],
    traps: [
      'Expecting kube-state-metrics to report resource usage. It reports object state.',
      'Monitoring only nodes and missing pod-level throttling and OOMKills.',
      'Default kube-prometheus-stack alerts left entirely untuned, which is a common source of alert fatigue.',
      'High cardinality from pod labels in a cluster that redeploys frequently.',
    ],
    followUps: [
      'Which component tells you a pod is using 90% of its memory limit?',
      'How would you detect CPU throttling and why does it matter?',
    ],
    tags: ['kubernetes', 'kube-state-metrics', 'cadvisor', 'monitoring'],
  },
  {
    id: 'itv-prom-33',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What does `sum(rate(http_requests_total[5m])) by (status)` return?',
    probing: 'Reading a PromQL expression correctly.',
    options: [
      {
        id: 'a',
        text: 'Requests per second over the last 5 minutes, one result per distinct status code',
      },
      { id: 'b', text: 'The total number of requests in the last 5 minutes, grouped by status' },
      { id: 'c', text: 'The sum of all status codes' },
      { id: 'd', text: 'One number: the overall request rate' },
    ],
    correct: ['a'],
    answer: [
      'Reading it inside out: `rate(...[5m])` gives the **per-second rate** for each individual time series over a five-minute window. `sum(...) by (status)` then adds those up, keeping only the `status` label - so all series with the same status are combined and every other label is discarded.',
      'The result is one value per distinct status code, each being requests per second.',
      'The distinction from option b matters: `rate()` gives a **per-second rate**, not a total. For a total over the window you would use `increase(http_requests_total[5m])`.',
      'Two syntax notes: `by (status)` keeps only that label, while `without (instance)` keeps everything **except** that one - often more convenient. And `sum by (status) (...)` and `sum(...) by (status)` are equivalent, though the first reads better in a long expression.',
    ],
    traps: [
      'Reading `rate` as a total rather than a per-second rate.',
      'Using `by` when `without` would be clearer and more robust as labels are added.',
      'Forgetting that `by` discards every label not listed, which can merge series you meant to keep separate.',
    ],
    followUps: ['How would you get the total count over the window instead of the rate?'],
    tags: ['promql', 'aggregation', 'syntax', 'fundamentals'],
  },
  {
    id: 'itv-prom-34',
    level: 'advanced',
    kind: 'open',
    prompt: 'How does Prometheus fit alongside logs and traces? When would you use each?',
    probing:
      'Signal selection. A good answer is about cost and question type, not tool preference.',
    answer: [
      'Each is good at something the others are bad at, and the differences are mostly about **cardinality and cost**.',
      '**Metrics** are cheap because they are aggregated - a counter costs a few bytes per scrape regardless of how many requests it counted. That makes them ideal for **alerting, trends and dashboards**, and useless for answering anything about a specific request. Prometheus is deliberately bad at high cardinality, and that limitation is what makes it cheap.',
      '**Logs** are the opposite: one record per event, full detail, arbitrary cardinality - and expensive at volume, both to store and to search. Right for "what exactly happened to this request" and for anything where you need the detail after the fact.',
      '**Traces** show a request’s path across services with timing for each span. They answer "where did the time go in this distributed call chain", which neither of the others can. They are usually **sampled**, because tracing every request is expensive.',
      'The workflow that works in practice: **an alert fires on a metric**, you **narrow it down with metrics** by breaking down across labels, then **drop into traces** to see which span is slow or which service is erroring, then **into logs** for the specific detail. Each step narrows the search space by orders of magnitude.',
      'The thing that makes this work is **correlation** - exemplars linking a metric bucket to a trace ID, and trace IDs in log lines. Collecting all three and being unable to move between them is a very common and expensive half-measure.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'From alert to root cause',
        caption:
          'Each step narrows the search space. Correlation IDs are what make the steps connect.',
        nodes: [
          { label: 'Alert fires on a metric', detail: 'Cheap, always on', tone: 'accent' },
          { label: 'Break down by labels', detail: 'Which service, endpoint, instance?' },
          {
            label: 'Jump to a trace',
            detail: 'Via an exemplar - which span is slow?',
            tone: 'warning',
          },
          { label: 'Read logs for that trace ID', detail: 'The specific detail' },
          { label: 'Root cause', tone: 'success' },
        ],
      },
    ],
    deeper: [
      '**Exemplars** attach a trace ID to a histogram bucket, so a slow-latency panel links directly to an example slow request. It is the single highest-value correlation feature and is underused.',
      'Log volume is usually the largest observability cost. Structured logs at sensible levels, with sampling on high-volume paths, is where the savings are.',
      'OpenTelemetry is converging the instrumentation for all three, which removes a lot of duplicated effort.',
    ],
    traps: [
      'Trying to use metrics for per-request questions, which is how cardinality explosions happen.',
      'Logging at debug level in production and paying for it in storage and latency.',
      'Three signals with no shared correlation ID, so moving between them is manual.',
    ],
    followUps: [
      'What is an exemplar and why is it useful?',
      'Which signal would you cut first if the observability bill had to halve?',
    ],
    tags: ['observability', 'logs', 'tracing', 'correlation', 'advanced'],
  },
  {
    id: 'itv-prom-35',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is `predict_linear` and what would you use it for?',
    probing: 'Predictive alerting - alerting before the failure rather than after.',
    answer: [
      '`predict_linear(metric[window], seconds)` fits a **linear regression** over the values in the window and extrapolates forward by the given number of seconds. It answers "based on the recent trend, what will this value be in four hours?"',
      'The classic use is **disk filling up**. Alerting when a disk is 90% full gives you whatever time remains, which might be minutes. Alerting when the trend says it will be full within four hours gives you time to act, and crucially it **does not fire** for a disk that has been sitting at 92% and stable for a year.',
      'That is the real advantage: it alerts on **trajectory rather than level**, which is much closer to what you actually care about.',
      'The caveats are important. It assumes the trend is **linear**, which is often wrong - a disk filling because of an unrotated log grows linearly, but one filling because of a runaway process does not. It is **sensitive to the window**: too short and normal variation makes it predict wildly, too long and it reacts slowly. And on a metric that goes up and down, the prediction is close to meaningless.',
      'It is worth pairing with an absolute threshold, so you catch both the gradual case and the sudden one.',
    ],
    code: [
      {
        title: 'Trajectory and level together',
        language: 'yaml',
        code: `# Will this disk be full within four hours, based on the last six?
- alert: DiskWillFill
  expr: |
    predict_linear(node_filesystem_avail_bytes{fstype!~"tmpfs|overlay"}[6h], 4*3600) < 0
      and
    node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.3
  for: 30m
  labels: { severity: warning }
  annotations:
    summary: "{{ $labels.instance }}:{{ $labels.mountpoint }} projected full within 4 hours"

# And an absolute backstop for the sudden case
- alert: DiskAlmostFull
  expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.05
  for: 5m
  labels: { severity: critical }`,
        explanation:
          'The `and` clause stops it firing for a disk that is nearly empty and creeping up harmlessly.',
      },
    ],
    traps: [
      '`predict_linear` on a metric that fluctuates, producing nonsense predictions.',
      'A window too short, so normal variation triggers alarming forecasts.',
      'No absolute threshold alongside it, so a sudden fill is missed.',
    ],
    followUps: [
      'Why is alerting on trajectory better than on 90% full?',
      'When would `predict_linear` give a misleading answer?',
    ],
    tags: ['predict_linear', 'alerting', 'capacity', 'promql'],
  },
  {
    id: 'itv-prom-36',
    level: 'basic',
    kind: 'open',
    prompt: 'What are labels, and what makes a good label?',
    probing: 'Data modelling, which is where most Prometheus problems originate.',
    answer: [
      'Labels are **key-value pairs that identify a time series**. `http_requests_total{method="GET", status="200", service="api"}` is a different series from the same metric with `status="500"`. Together, the metric name and the full set of labels are the identity of a series.',
      'A good label has **few possible values**, and that set **does not grow with traffic**. Method, status code, environment, service name, endpoint template, region - all bounded, all useful for grouping.',
      'A bad label is **unbounded**: user ID, request ID, session ID, email address, full URL path with IDs in it, timestamp. Each distinct value creates a new time series, and the series count is what determines whether your Prometheus server stays up.',
      'The test I would apply before adding a label: **how many distinct values can this take, at peak, over the lifetime of the series?** If the answer is "as many as we have users" or "one per request", it does not belong in a metric. That information belongs in a log line or a trace.',
      'A second test: **would you ever group or filter by this?** A label you never use in a query is pure cost.',
    ],
    code: [
      {
        title: 'Bounded and unbounded, side by side',
        language: 'text',
        code: `# GOOD - every label has a small, stable set of values
http_requests_total{
  method="GET",              # ~7 values
  endpoint="/users/:id",     # route template, ~50 values
  status="200",              # ~15 values
  service="api"              # ~20 values
}

# BAD - each of these is unbounded
http_requests_total{
  user_id="8f3c...",         # one per user
  request_id="a1b2...",      # one per REQUEST
  path="/users/12345"        # one per user, again
}`,
      },
    ],
    traps: [
      'Adding a label because it might be useful, without counting its possible values.',
      'Using the raw path instead of the route template.',
      'Labels that change on every deploy (a version label is usually fine; a build hash on a fast-deploying service is not).',
    ],
    followUps: ['Where should per-user detail go instead?', 'Is a `version` label a good idea?'],
    tags: ['labels', 'cardinality', 'data model', 'fundamentals'],
  },
  {
    id: 'itv-prom-37',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A team says "our dashboard shows everything is fine but customers are complaining". How do you investigate?',
    probing:
      'A monitoring gap rather than a system failure - a genuinely senior diagnostic question.',
    answer: [
      'This is a **monitoring problem before it is a system problem**, and I would treat it that way. The dashboard is measuring something other than what customers experience.',
      'The first question is **where the measurement is taken**. If latency and errors are measured **inside** the service, everything that fails before reaching it is invisible - a load balancer returning 502, TLS failures, DNS problems, a CDN issue, requests timing out in a queue before being handled. Measuring at the edge, or with a **synthetic probe from outside**, closes that gap immediately.',
      'The second is **what is being aggregated away**. An overall error rate of 0.4% looks fine and can be 100% for one endpoint, one region, or one customer. Breaking down by endpoint, by region and by client version very often reveals a problem that the average hid completely.',
      'The third is **averages hiding the tail**. A mean latency of 200 ms is compatible with a p99 of eight seconds. If the dashboard shows averages, the customers complaining are in the tail that the dashboard cannot show.',
      'The fourth is whether the **failure mode is even measured**. A service returning HTTP 200 with an empty result set, or wrong data, or a partially rendered page, is a success by every metric the service emits. This is where **business metrics** earn their place - a drop in completed orders detects it when nothing else does.',
      'And the last is **which customers**. If it is a specific client version, a specific region, or a specific integration, the signal exists but is not broken out.',
      'The action afterwards is not just to fix the incident but to **add the measurement that was missing**, because the same gap will hide the next one.',
    ],
    code: [
      {
        title: 'Look for what the aggregate is hiding',
        language: 'text',
        code: `# The dashboard number - looks fine
sum(rate(http_requests_total{status=~"5.."}[5m]))
  / sum(rate(http_requests_total[5m]))

# Break it down - is it 100% for one endpoint?
topk(10,
  sum by (endpoint) (rate(http_requests_total{status=~"5.."}[5m]))
    / sum by (endpoint) (rate(http_requests_total[5m]))
)

# The tail, not the average
histogram_quantile(0.999,
  sum by (le, endpoint) (rate(http_request_duration_seconds_bucket[5m])))

# Measured from OUTSIDE the service, by blackbox_exporter
probe_success{job="blackbox", instance=~"https://api.example.com.*"}
probe_duration_seconds{job="blackbox"}

# The business signal - catches "200 OK but wrong"
rate(orders_completed_total[10m])`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Why is the dashboard green?',
        caption: 'Each of these is a measurement gap, not a system that is secretly fine.',
        question: 'What is the dashboard not seeing?',
        branches: [
          {
            condition: 'Measured inside the service only',
            result: 'Add edge and synthetic measurement',
            detail: 'LB, TLS, DNS failures are invisible from inside',
            tone: 'danger',
          },
          {
            condition: 'Aggregated across everything',
            result: 'Break down by endpoint, region, client',
            detail: '0.4% overall can be 100% somewhere',
            tone: 'warning',
          },
          {
            condition: 'Showing averages',
            result: 'Show p95 and p99',
            detail: 'The complaining customers are in the tail',
            tone: 'warning',
          },
          {
            condition: 'Returns 200 with wrong or empty data',
            result: 'Business metrics',
            detail: 'No technical metric can see this',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Synthetic monitoring from outside your infrastructure is the only thing that measures what a customer actually experiences end to end.',
      'Real user monitoring in the browser catches front-end failures that no backend metric can see.',
      'If a specific customer is affected, per-tenant metrics are tempting and a cardinality risk - a small bounded set of large tenants is a reasonable compromise.',
      'Add the missing measurement as part of the incident follow-up, not as a backlog item.',
    ],
    traps: [
      'Assuming the customers are wrong because the dashboard is green.',
      'Only measuring inside the service.',
      'Averages on a latency dashboard.',
      'No business metrics, so silent-success failures are undetectable.',
    ],
    followUps: [
      'How would you detect a service returning 200 with an empty response?',
      'Where would you add measurement first?',
    ],
    tags: ['scenario', 'monitoring gaps', 'slo', 'troubleshooting', 'advanced'],
  },
  {
    id: 'itv-prom-38',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is the blackbox exporter and when is probing better than instrumentation?',
    probing: 'External versus internal measurement.',
    answer: [
      'The **blackbox exporter** probes endpoints from outside and reports whether they responded and how long they took. It supports HTTP, TCP, DNS, ICMP and gRPC, and Prometheus scrapes it with the target passed as a parameter.',
      'The value is that it measures **the whole path a user takes** - DNS resolution, TLS handshake, the load balancer, the network, and then the service. Instrumentation inside the service cannot see any of that. A service that is perfectly healthy behind a broken load balancer looks fine in its own metrics and completely broken to users.',
      'It is also the only practical way to monitor **things you do not control**: a third-party API you depend on, a partner endpoint, a DNS zone.',
      'And it gives you **certificate expiry** for free, which is a genuinely common cause of outages and is otherwise easy to forget until it happens.',
      'It complements rather than replaces instrumentation. A probe tells you the endpoint responded; it cannot tell you the error rate across millions of real requests or break anything down by endpoint. Use both: probes for the outside-in view, instrumentation for the detail.',
    ],
    code: [
      {
        title: 'Probing an endpoint from outside',
        language: 'yaml',
        code: `scrape_configs:
  - job_name: blackbox-http
    metrics_path: /probe
    params:
      module: [http_2xx]
    static_configs:
      - targets:
          - https://api.example.com/healthz
          - https://www.example.com
    relabel_configs:
      - source_labels: [__address__]
        target_label: __param_target
      - source_labels: [__param_target]
        target_label: instance
      - target_label: __address__
        replacement: blackbox-exporter:9115   # where the exporter lives`,
      },
      {
        title: 'The alerts this makes possible',
        language: 'yaml',
        code: `- alert: EndpointDown
  expr: probe_success == 0
  for: 2m
  labels: { severity: critical }

- alert: CertificateExpiringSoon
  expr: (probe_ssl_earliest_cert_expiry - time()) / 86400 < 21
  for: 1h
  labels: { severity: warning }
  annotations:
    summary: "{{ $labels.instance }} certificate expires in {{ $value | humanize }} days"`,
      },
    ],
    traps: [
      'Probing from inside the same network, which misses exactly the external failures you were trying to catch.',
      'Probing only the health endpoint, which can succeed while every real endpoint fails.',
      'A single probe location, so a regional problem looks like a total outage or vice versa.',
    ],
    followUps: [
      'Why probe from outside your own network?',
      'What does a probe tell you that instrumentation cannot?',
    ],
    tags: ['blackbox exporter', 'synthetic monitoring', 'certificates', 'alerting'],
  },
  {
    id: 'itv-prom-39',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'Your alert fired but the problem had already resolved by the time someone looked. What is the most likely cause?',
    probing: 'Alert tuning intuition.',
    options: [
      {
        id: 'a',
        text: 'The condition is too sensitive or the `for:` duration too short, so it fires on transient blips',
      },
      { id: 'b', text: 'Prometheus is scraping too frequently' },
      { id: 'c', text: 'Alertmanager delivered it late' },
      { id: 'd', text: 'The metric type is wrong' },
    ],
    correct: ['a'],
    answer: [
      'An alert that consistently fires and then self-resolves is describing a **transient condition** - a brief spike, one slow scrape, a momentary blip. The alert is technically correct and operationally useless, because nobody can act on something that has already ended.',
      'The fixes are to **lengthen the `for:` duration** so the condition must persist, and to **raise the threshold** so it reflects a level that genuinely matters rather than a round number.',
      'The judgement call is whether the transient condition is itself a problem. A five-second spike in error rate might affect real users and be worth knowing about - but as a **ticket or a trend on a dashboard**, not as a page. The test remains: would a human do something about this, right now?',
      'If the same alert self-resolves repeatedly, it is also worth investigating **why** the blips happen. Repeated transient spikes often indicate something real - a garbage collection pause, a connection pool refilling, a periodic job - that is worth understanding even if it does not warrant a page.',
    ],
    traps: [
      'Deleting the alert rather than tuning it, and losing a real signal.',
      'Lengthening `for:` so much that a genuine outage goes undetected for fifteen minutes.',
      'Ignoring the pattern behind repeated self-resolving alerts.',
    ],
    followUps: ['When is a self-resolving alert still worth keeping?'],
    tags: ['alerting', 'tuning', 'alert fatigue', 'for clause'],
  },
  {
    id: 'itv-prom-40',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you monitor a service you cannot modify - a third-party or legacy system?',
    probing: 'Practical monitoring where instrumentation is not an option.',
    answer: [
      'There are several layers available even with no ability to change the code, and I would use as many as apply.',
      '**Probe it from outside** with the blackbox exporter - is it responding, how fast, is the certificate valid. That works for anything with a network endpoint and requires no cooperation at all.',
      '**Use an existing exporter**. There is one for almost every common system - databases, message brokers, web servers, JVMs via JMX. These read the system’s own internal statistics and expose them, which is far richer than probing.',
      '**Parse its logs** into metrics. `mtail` or `grok_exporter` read a log file and emit counters and histograms from patterns in it. For a legacy system that logs every request, this recovers a genuine RED view without touching the application.',
      '**Measure it from the outside at the infrastructure layer**: load balancer metrics give you request rate, error rate and latency for anything behind it, with no involvement from the service at all. This is often the fastest route to a useful signal.',
      '**Measure it from its callers**. If your own services call it, instrument those calls. That also gives you the most relevant view - how the dependency behaves **for you**, which is what actually matters.',
      'And the **textfile collector** for anything you can only check with a script on a schedule - a licence expiry, a queue depth from a CLI, a file that should exist.',
    ],
    code: [
      {
        title: 'Turn log lines into metrics with mtail',
        language: 'text',
        code: `# Parse a legacy access log into proper Prometheus metrics
counter legacy_requests_total by method, status
histogram legacy_request_duration_seconds buckets 0.01, 0.05, 0.1, 0.5, 1, 5 by method

/^(?P<method>[A-Z]+) (?P<path>\\S+) (?P<status>\\d{3}) (?P<duration>\\d+)ms$/ {
  legacy_requests_total[$method][$status]++
  legacy_request_duration_seconds[$method] = $duration / 1000
}`,
      },
    ],
    deeper: [
      'Measuring from the caller is often the most valuable view - it captures the network and any middleware between you and the dependency, which the dependency’s own metrics do not.',
      'Load balancer metrics are the quickest win for anything behind one, and need no access to the service at all.',
      'For a third party with an SLA, tracking your own measurement of their availability gives you the evidence for any conversation about it.',
    ],
    traps: [
      'Concluding that nothing can be monitored because the code cannot be changed.',
      'Log parsing with fragile regexes that break silently on a format change.',
      'Relying solely on the third party’s own status page.',
    ],
    followUps: [
      'Which of these would you set up first, and why?',
      'How would you hold a third party to their SLA?',
    ],
    tags: ['legacy', 'exporters', 'mtail', 'blackbox', 'advanced'],
  },
  {
    id: 'itv-prom-41',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is remote write, and when would you use it?',
    probing: 'Getting data out of Prometheus, and the trade-offs.',
    answer: [
      '**Remote write** streams every sample Prometheus ingests to an external endpoint in near real time. It is how Prometheus feeds long-term stores like **Mimir**, **Cortex**, **Thanos Receive**, or a vendor platform.',
      'You would use it for **long-term retention** without operating storage yourself, for a **global view** across many Prometheus servers, or to send data to a managed observability platform while keeping local Prometheus for alerting.',
      'The alternative approach - Thanos **sidecar** - ships completed two-hour blocks to object storage instead. Remote write is **near real time and simpler to reason about**; block shipping is **cheaper and less coupled**, because a remote-write endpoint being down creates backpressure on Prometheus itself.',
      'The operational details that matter: remote write **buffers in memory** when the endpoint is slow or down, which means a remote-write outage can increase Prometheus memory usage significantly. Tune the queue configuration, and **filter what you send** with `write_relabel_configs` - sending every series to a paid platform when you only query a subset is a straightforward way to spend a lot of money.',
      'And keep alerting local where you can. Alerting that depends on a remote endpoint fails exactly when you most need it.',
    ],
    code: [
      {
        title: 'Remote write with filtering and queue tuning',
        language: 'yaml',
        code: `remote_write:
  - url: https://mimir.example.com/api/v1/push
    queue_config:
      capacity: 10000
      max_shards: 50
      min_shards: 1
      max_samples_per_send: 2000
      batch_send_deadline: 5s

    write_relabel_configs:
      # Only send what is actually queried remotely - this is a cost control
      - source_labels: [__name__]
        regex: '(http_requests_total|http_request_duration_seconds_.*|up|slo:.*)'
        action: keep

      # Never send debug-level metrics off-box
      - source_labels: [__name__]
        regex: 'go_.*|process_.*'
        action: drop`,
      },
    ],
    traps: [
      'Sending everything, then receiving a very large bill from a managed platform.',
      'A remote endpoint outage causing Prometheus memory growth from buffering.',
      'Moving alerting to the remote system, so it fails when connectivity does.',
    ],
    followUps: [
      'What happens to Prometheus when the remote write endpoint is down?',
      'When would block shipping be better than remote write?',
    ],
    tags: ['remote write', 'long-term storage', 'mimir', 'cost'],
  },
  {
    id: 'itv-prom-42',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the scrape interval and how do you choose it?',
    probing: 'A basic configuration decision with cost implications.',
    answer: [
      'The scrape interval is how often Prometheus fetches `/metrics` from each target. The common default is **15 seconds**, and 30 or 60 is reasonable for less critical targets.',
      'Shorter intervals give **faster detection** and finer resolution on graphs, at the cost of more samples stored and more load on both Prometheus and the targets. Longer intervals are cheaper and slower to react.',
      'The important constraint is the relationship with **rate windows**: a `rate()` window needs **at least four scrape intervals** of data to be reliable. With a 60-second interval, `rate(x[1m])` has one point and returns nothing useful; you need `[4m]` or more. That coupling often decides the interval more than anything else.',
      'The thing worth knowing is that **scrape interval is not the main cost driver - cardinality is**. Halving the interval doubles samples, which are 1-2 bytes each after compression. Adding a high-cardinality label multiplies the **series count**, which drives memory. People often reduce scrape frequency to save resources when the actual problem is labels.',
      'You can set it per job, which is the right approach: 15 seconds for the services that matter, 60 for infrastructure that changes slowly.',
    ],
    code: [
      {
        title: 'Per-job intervals',
        language: 'yaml',
        code: `global:
  scrape_interval: 30s          # the default for everything
  evaluation_interval: 30s      # how often alerting rules run

scrape_configs:
  - job_name: critical-api
    scrape_interval: 15s        # faster detection where it matters
    scrape_timeout: 10s         # must be < scrape_interval
    static_configs:
      - targets: ['api:8080']

  - job_name: node-exporter
    scrape_interval: 60s        # changes slowly, many targets
    static_configs:
      - targets: ['node1:9100', 'node2:9100']`,
      },
    ],
    traps: [
      '`scrape_timeout` greater than or equal to `scrape_interval`, which Prometheus rejects.',
      'A rate window shorter than four scrape intervals, silently returning nothing.',
      'Reducing scrape frequency to fix a memory problem caused by cardinality.',
    ],
    followUps: ['Why must a rate window be several times the scrape interval?'],
    tags: ['scrape interval', 'configuration', 'performance', 'fundamentals'],
  },
  {
    id: 'itv-prom-43',
    level: 'advanced',
    kind: 'multi',
    prompt: 'Which of these would you expect in a mature Prometheus setup? Select all that apply.',
    probing: 'Operational maturity across configuration, alerting and reliability.',
    options: [
      {
        id: 'a',
        text: 'Alerting rules and dashboards defined as code and reviewed in pull requests',
      },
      { id: 'b', text: 'A dead man’s switch proving the alerting pipeline is working end to end' },
      { id: 'c', text: 'Cardinality monitored, with alerts on series growth' },
      { id: 'd', text: 'Every available metric collected, in case it is needed later' },
      { id: 'e', text: 'SLO-based burn-rate alerting for user-facing services' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Collecting every available metric is the wrong one. Metrics are not free - they cost memory, storage and query time, and a server holding millions of unused series is slower and less reliable for the ones that matter. Collect what you use, and drop the rest at scrape time.',
      'The others are the marks of a setup someone has actually operated. **Rules and dashboards as code** means they are reviewed, versioned and reproducible rather than edited in a UI and lost on rebuild.',
      'A **dead man’s switch** is the only way to know the alerting pipeline itself works - an alert that always fires, with an external system paging if the notification stops arriving.',
      '**Cardinality monitoring** catches the most common failure mode before it causes an outage, rather than during one.',
      '**SLO burn-rate alerting** is what moves from "something looks odd" to "we are consuming our reliability budget too fast", which is both more actionable and much less noisy.',
      'I would add: alert rules tested with `promtool`, retention and remote write configured deliberately, and a regular review of what actually paged.',
    ],
    code: [
      {
        title: 'Test rules before shipping them',
        language: 'bash',
        code: `promtool check config prometheus.yml
promtool check rules rules/*.yml

# Unit-test alerting rules against synthetic series
promtool test rules tests/*.yml`,
      },
    ],
    traps: [
      'Scraping everything by default and discovering the cost during an incident.',
      'Rules edited directly on the server, lost on the next deployment.',
      'No monitoring of the monitoring.',
    ],
    followUps: ['How would you decide which metrics to stop collecting?'],
    tags: ['best practices', 'operations', 'maturity', 'advanced'],
  },
  {
    id: 'itv-prom-44',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you handle metrics from short-lived containers and frequently redeployed pods?',
    probing: 'Series churn, which is a subtler cardinality problem.',
    answer: [
      'The problem is **churn** rather than raw count. Every pod gets a unique name, so a `pod` label creates a **new time series on every deployment**. A service with 50 pods deploying ten times a day creates 500 new series a day from that one label, and the head block holds them until they age out.',
      'The symptom is memory growing steadily rather than jumping, and `prometheus_tsdb_head_series_created_total` rising continuously - which is the metric to watch for this specifically.',
      'The fixes: **drop the pod label** where you do not need per-pod granularity, keeping service and namespace. Aggregate away from instance-level labels in **recording rules** and query the aggregates rather than the raw series. And be deliberate about which labels genuinely need to distinguish individual replicas - usually only when debugging one bad instance, which is a short-lived need.',
      'For **truly short-lived** things - jobs that run for seconds - Prometheus may never scrape them at all, which is the Pushgateway case. But a job that runs frequently and pushes a unique label per run has the same churn problem in the Pushgateway, so the identifying labels there need to be bounded too.',
      'The general principle: labels that identify **instances** are useful for debugging and expensive for storage. Keep them where the debugging value justifies it, drop them where it does not.',
    ],
    code: [
      {
        title: 'Watch churn, then reduce it',
        language: 'text',
        code: `# Is churn the problem? This rising steadily is the signal.
rate(prometheus_tsdb_head_series_created_total[1h])

# Which metric has the most series?
topk(5, count by (__name__)({__name__=~".+"}))`,
      },
      {
        title: 'Drop instance-identifying labels at scrape time',
        language: 'yaml',
        code: `metric_relabel_configs:
  # Keep service and namespace; drop the per-pod identity
  - regex: 'pod|instance|container_id'
    action: labeldrop

  # Or keep the pod label only for the metrics where it matters
  - source_labels: [__name__]
    regex: 'container_memory_.*|container_cpu_.*'
    action: keep`,
      },
    ],
    traps: [
      'Assuming a stable series count means no problem - churn does not show up in a point-in-time count.',
      'Dropping the pod label entirely and then being unable to identify one bad replica.',
      'Unbounded job labels in the Pushgateway, which never expire.',
    ],
    followUps: [
      'How would you still debug a single misbehaving pod after dropping the label?',
      'What metric tells you churn is the problem?',
    ],
    tags: ['cardinality', 'churn', 'kubernetes', 'performance'],
  },
  {
    id: 'itv-prom-45',
    level: 'basic',
    kind: 'mcq',
    prompt: 'Which query gives the error rate as a percentage of all requests?',
    probing: 'A very common query pattern, written correctly.',
    options: [
      { id: 'a', text: '`sum(rate(requests{status=~"5.."}[5m])) / sum(rate(requests[5m]))`' },
      { id: 'b', text: '`sum(requests{status=~"5.."}) / sum(requests)`' },
      { id: 'c', text: '`rate(sum(requests{status=~"5.."})[5m]) / rate(sum(requests)[5m])`' },
      { id: 'd', text: '`sum(rate(requests{status=~"5.."}[5m]))`' },
    ],
    correct: ['a'],
    answer: [
      'Option **a** is correct: `rate()` applied to each series first, then summed on both sides, then divided. The result is a ratio between 0 and 1 - multiply by 100 for a percentage.',
      'Option **b** uses raw counter totals since process start, so it gives the error ratio over the entire lifetime of the processes, not the current rate. It will barely move during an incident.',
      'Option **c** applies `sum` before `rate`, which breaks on counter resets - when one instance restarts, the summed counter drops, and `rate` interprets that as a reset producing a phantom spike.',
      'Option **d** gives the absolute error rate in errors per second, not a ratio. That is useful, but it is a different question - and it is harder to alert on consistently, because what counts as "too many" depends on traffic volume.',
    ],
    code: [
      {
        title: 'The pattern, with a guard for no traffic',
        language: 'text',
        code: `# Error ratio, per service
sum by (service) (rate(http_requests_total{status=~"5.."}[5m]))
  /
sum by (service) (rate(http_requests_total[5m]))

# With a traffic floor, so a single error at 3am on a quiet service
# does not read as 100% and page someone
(
  sum by (service) (rate(http_requests_total{status=~"5.."}[5m]))
    / sum by (service) (rate(http_requests_total[5m]))
) > 0.05
and
sum by (service) (rate(http_requests_total[5m])) > 1`,
      },
    ],
    traps: [
      'No traffic floor, so one error out of two requests on a quiet service reads as 50%.',
      'Summing before taking the rate.',
      'Using raw counters, which barely move.',
    ],
    followUps: ['Why add a minimum traffic condition to an error-ratio alert?'],
    tags: ['promql', 'error rate', 'alerting', 'fundamentals'],
  },
  {
    id: 'itv-prom-46',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you monitor a message queue or an event-driven system?',
    probing: 'A workload shape where request-based metrics do not apply.',
    answer: [
      'The RED framing does not fit directly, because there are no synchronous requests. The signals that matter are different.',
      '**Queue depth** - how many messages are waiting. Useful, but on its own it is misleading: a depth of 10,000 is fine if you process 50,000 a second and catastrophic if you process ten.',
      '**Oldest message age** is the better signal, and the one I would alert on. It directly expresses "how far behind are we" in units anyone understands, and it is meaningful regardless of throughput. Consumer lag in Kafka terms is the same idea.',
      '**Processing rate and consumer count**, so you can tell whether the backlog is because consumers stopped or because the producer rate increased - a distinction that leads to completely different actions.',
      '**Error and retry rate**, and specifically the **dead-letter queue depth**, because a message failing repeatedly is invisible in throughput metrics while quietly never being processed.',
      '**Processing duration** as a histogram, because a gradual slowdown in per-message time is what turns into a backlog hours later.',
      'The alert I would consider most important is on **age**, not depth: "the oldest unprocessed message is more than fifteen minutes old" is actionable and stays correct as throughput changes.',
    ],
    code: [
      {
        title: 'The queries that matter for a queue',
        language: 'text',
        code: `# How far behind are we, in time? The most useful single signal.
max by (queue) (queue_oldest_message_age_seconds) > 900

# Backlog growing: arriving faster than we process
sum by (queue) (rate(queue_messages_received_total[5m]))
  > sum by (queue) (rate(queue_messages_processed_total[5m]))

# Consumers have stopped entirely - depth alone would not tell you this
sum by (queue) (queue_consumers_active) == 0

# Messages failing repeatedly and going nowhere
increase(queue_dead_letter_total[1h]) > 0

# Kafka: consumer lag, which is the same idea
sum by (consumergroup, topic) (kafka_consumergroup_lag) > 10000`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'The backlog is growing - why?',
        caption: 'Depth tells you there is a problem; the other signals tell you which problem.',
        question: 'What do the supporting metrics say?',
        branches: [
          {
            condition: 'Consumer count is zero',
            result: 'Consumers are down',
            detail: 'Restart or reschedule them',
            tone: 'danger',
          },
          {
            condition: 'Consumers running, processing duration up',
            result: 'A dependency is slow',
            detail: 'The queue is a symptom, not the cause',
            tone: 'warning',
          },
          {
            condition: 'Consumers fine, producer rate up',
            result: 'Genuine load increase',
            detail: 'Scale consumers out',
            tone: 'accent',
          },
          {
            condition: 'Dead-letter queue growing',
            result: 'Poison messages',
            detail: 'Throughput looks fine while nothing progresses',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Alerting on depth alone produces false alarms during normal bursts and misses slow degradation. Age is more robust.',
      'A dead-letter queue with no alert on it is a silent data-loss path - messages accumulate there indefinitely and nobody notices.',
      'For autoscaling consumers, queue depth per consumer is a far better scaling signal than CPU. KEDA does exactly this.',
    ],
    traps: [
      'Alerting on depth without context about throughput.',
      'No dead-letter queue monitoring.',
      'Missing the case where consumers are running but making no progress.',
    ],
    followUps: [
      'Why is message age a better alert than queue depth?',
      'How would you autoscale consumers?',
    ],
    tags: ['queues', 'kafka', 'event-driven', 'alerting', 'advanced'],
  },
  {
    id: 'itv-prom-47',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What is the difference between `absent()`, `absent_over_time()` and just checking a value?',
    probing: 'Detecting missing data, which is where alerting most often has gaps.',
    answer: [
      'The core problem is that **a comparison against a missing metric is not false - it produces no result at all**. `error_rate > 0.05` on a service that has died and stopped exposing metrics returns nothing, so the alert never fires. The most complete failure produces the quietest alerting.',
      '**`absent(metric)`** returns 1 if the expression has **no series right now**, and nothing otherwise. That lets you alert on "this metric should exist and does not".',
      '**`absent_over_time(metric[1h])`** returns 1 if the metric has had no samples **at any point in the window**. It is more robust for metrics that are naturally intermittent - a batch job’s metric that only appears when the job runs, for instance - where a point-in-time `absent()` would fire constantly.',
      'The practical pattern is to pair every important threshold alert with an existence check, or to rely on `up == 0` for target-level failure. For metrics that come from somewhere other than a scrape target - the Pushgateway, a remote write - `absent_over_time` is often the only thing that will catch it.',
      'One detail worth knowing: `absent()` returns the labels from the **selector**, not from any real series, so annotations can reference only labels you wrote in the query yourself.',
    ],
    code: [
      {
        title: 'Existence checks alongside threshold alerts',
        language: 'yaml',
        code: `# The threshold alert - silent if the metric disappears entirely
- alert: HighErrorRate
  expr: job:http_error_ratio:rate5m{job="api"} > 0.05
  for: 5m

# The companion that catches total failure
- alert: ApiMetricsMissing
  expr: absent(job:http_error_ratio:rate5m{job="api"})
  for: 10m
  labels: { severity: critical }
  annotations:
    summary: "No metrics at all from job api - it may be down or unscraped"

# For an intermittent metric, use the window form
- alert: NightlyJobMetricMissing
  expr: absent_over_time(job_last_success_timestamp_seconds{job="nightly"}[26h])
  labels: { severity: critical }`,
      },
    ],
    traps: [
      'Threshold alerts with no existence check, so a dead service is silent.',
      '`absent()` on a naturally intermittent metric, firing constantly.',
      'Expecting `absent()` to carry labels from series that do not exist.',
    ],
    followUps: [
      'Why does a comparison against a missing metric not fire?',
      'When would you use `absent_over_time` rather than `absent`?',
    ],
    tags: ['absent', 'alerting', 'promql', 'gaps'],
  },
  {
    id: 'itv-prom-48',
    level: 'basic',
    kind: 'open',
    prompt: 'What are the most useful PromQL operators and modifiers to know?',
    probing: 'Query fluency beyond the basics.',
    answer: [
      '**Aggregation**: `sum`, `avg`, `min`, `max`, `count`, `topk`, `bottomk`, `quantile` - each with `by` (keep only these labels) or `without` (keep everything except these). `topk(5, ...)` is invaluable for finding the worst offenders.',
      '**Range and offset**: `metric[5m]` selects a range for rate functions; `offset 1w` shifts the evaluation back in time, which is how you compare this week against last week on the same graph.',
      '**Comparison and set operators**: `>`, `<`, `==` filter series; `and`, `or`, `unless` combine them. `unless` is the underused one - `alert_condition unless on(instance) maintenance_mode` suppresses alerts for hosts in maintenance without touching the alert logic.',
      '**Vector matching**: `on(label)` and `ignoring(label)` control how two expressions are joined, and `group_left` / `group_right` handle many-to-one joins - which is how you attach metadata from one metric onto another, such as adding a `team` label from `kube_pod_labels` onto a resource metric.',
      '`group_left` is the one that takes practice and is worth knowing, because "I want to join this metric to that one" comes up constantly and the error message when you get it wrong is not obvious.',
    ],
    code: [
      {
        title: 'The ones worth practising',
        language: 'text',
        code: `# Worst offenders
topk(10, sum by (pod) (rate(container_cpu_usage_seconds_total[5m])))

# This week vs last week, on one graph
sum(rate(http_requests_total[5m]))
sum(rate(http_requests_total[5m] offset 1w))

# Suppress during maintenance, without changing the alert expression
(up == 0) unless on(instance) instance_maintenance_mode

# Join metadata onto a metric - group_left is the many-to-one modifier
sum by (pod) (rate(container_cpu_usage_seconds_total[5m]))
  * on(pod) group_left(team, app)
    kube_pod_labels{namespace="prod"}`,
      },
    ],
    traps: [
      '`group_left` on the wrong side, producing a "many-to-many matching not allowed" error that is hard to interpret.',
      'Comparison operators used without `bool` where a 0/1 result was wanted.',
      'Forgetting that `by` discards every label not listed, silently merging series.',
    ],
    followUps: ['What does `group_left` do, and when do you need it?'],
    tags: ['promql', 'operators', 'vector matching', 'fundamentals'],
  },
  {
    id: 'itv-prom-49',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you reduce the cost of an observability platform that has become expensive?',
    probing:
      'Cost engineering for observability, which is now a common and rarely-prepared-for question.',
    answer: [
      'First **find out where the money is**, because the intuition is usually wrong. In almost every platform I have seen, **logs dominate** - often by an order of magnitude over metrics and traces - and the effort goes into optimising metrics because that is what people think about.',
      'For **logs**: reduce volume at the source. Drop debug and info level in production for high-volume paths, sample repetitive log lines, stop logging full request and response bodies, and set **retention by value** - 7 days hot for most, 90 days cold in object storage for anything with a compliance requirement. Structured logging also helps, because it compresses better and needs less scanning.',
      'For **metrics**: cardinality is the cost. Find the top metrics by series count, drop labels nobody queries, and drop entire metrics that were collected by default and never used - `go_*` and `process_*` runtime metrics across thousands of targets are a common and pure waste. Recording rules plus shorter raw retention keeps the aggregates you actually query while expiring the detail.',
      'For **traces**: sample. Head-based sampling at 1% is cheap and simple; **tail-based** sampling keeps 100% of errors and slow requests and drops the boring successful ones, which is far better value for the same budget.',
      'And the structural question: **what is actually queried?** Most platforms store a great deal that nobody has ever looked at. Query logs, where available, tell you which metrics and indices are genuinely used, and that is the most defensible basis for deciding what to stop collecting.',
      'The thing to avoid is cutting blindly and losing the data you need during the next incident. Cut what is **not queried**, not what is merely large.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Reducing observability cost',
        caption: 'Logs are usually the largest line item and the last place people look.',
        nodes: [
          {
            label: 'Break the bill down by signal',
            detail: 'Logs usually dominate',
            tone: 'accent',
          },
          { label: 'Logs: level, sampling, retention tiers', detail: 'Biggest single win' },
          { label: 'Metrics: drop unused series and labels', detail: 'Cardinality is the cost' },
          { label: 'Traces: tail-based sampling', detail: 'Keep errors and slow, drop the rest' },
          {
            label: 'Check what is actually queried',
            detail: 'Stop collecting the unqueried',
            tone: 'warning',
          },
          { label: 'Set budgets and alert on growth', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Tail-based sampling is the highest-value trace optimisation: you keep exactly the traces you would have wanted and discard the ones you would never open.',
      'Retention tiering - hot for days, object storage for months - is usually cheaper than reducing what you collect, and loses nothing.',
      'Runtime metrics (`go_*`, `process_*`) across thousands of targets add up to a surprising share of series for almost no query value.',
      'Track cost per service and make it visible to the teams generating it. Central optimisation does not scale; visibility does.',
    ],
    traps: [
      'Optimising metrics while logs are 80% of the bill.',
      'Cutting retention on the data you need most during incidents.',
      'Uniform sampling that discards the errors you would have wanted.',
      'A one-off cleanup with no budget or alerting, so it grows straight back.',
    ],
    followUps: [
      'Why is tail-based sampling better value than head-based?',
      'How would you decide which metrics to stop collecting?',
    ],
    tags: ['cost', 'finops', 'logs', 'sampling', 'retention', 'advanced'],
  },
  {
    id: 'itv-prom-50',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you test and validate Prometheus configuration and alerting rules?',
    probing: 'Treating monitoring configuration as code that can be wrong.',
    answer: [
      'Monitoring configuration is code, and it can be wrong in ways that are invisible until an incident - which is the worst possible time to find out.',
      '**`promtool check config`** validates the main configuration, and **`promtool check rules`** validates rule syntax. Both should run in CI on every change; they catch typos and invalid expressions in seconds.',
      '**`promtool test rules`** is the one people do not know about and should. It runs alerting rules against **synthetic time series you define** and asserts which alerts fire and when. That lets you prove an alert fires for the condition you intended, does not fire for conditions you did not, and respects its `for:` duration.',
      'Beyond static checks, I would validate in a **staging Prometheus** with the same rules, and periodically **test the delivery path** end to end - fire a test alert and confirm it reaches the pager. A rule that evaluates correctly but routes to a receiver nobody monitors is still a broken alert.',
      'And the **dead man’s switch** covers the ongoing case: an alert that always fires, with an external system paging if the notification stops arriving. That is the only thing that detects the pipeline silently failing.',
    ],
    code: [
      {
        title: 'A rule unit test',
        language: 'yaml',
        code: `rule_files:
  - ../rules/api.yml

evaluation_interval: 1m

tests:
  - interval: 1m
    input_series:
      - series: 'http_requests_total{job="api",status="500"}'
        values: '0+10x20'          # 10 errors per minute, for 20 minutes
      - series: 'http_requests_total{job="api",status="200"}'
        values: '0+90x20'          # 90 successes per minute

    alert_rule_test:
      # 10% error rate, for: 5m -> should NOT be firing at 4 minutes
      - eval_time: 4m
        alertname: HighErrorRate
        exp_alerts: []

      # ...and SHOULD be firing at 10 minutes
      - eval_time: 10m
        alertname: HighErrorRate
        exp_alerts:
          - exp_labels:
              severity: critical
              job: api`,
      },
      {
        title: 'In CI',
        language: 'bash',
        code: `promtool check config prometheus.yml
promtool check rules rules/*.yml
promtool test rules tests/*.yml
amtool check-config alertmanager.yml`,
      },
    ],
    traps: [
      'Rules deployed without validation, failing to load and silently disabling a whole group.',
      'An alert that is syntactically valid and semantically wrong - fires on the wrong condition, or never.',
      'Testing the rule but never the delivery path.',
    ],
    followUps: [
      'How would you prove an alert fires when it should?',
      'What happens if one rule in a group fails to parse?',
    ],
    tags: ['testing', 'promtool', 'ci', 'validation'],
  },
]
