import type { InterviewQuestion } from '../../../types'

/** Alertmanager, alert design, SLOs and what monitoring is actually for. */
export const promAlertingQuestions: InterviewQuestion[] = [
  {
    id: 'itv-prom-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does Alertmanager work, and what problem does it solve that Prometheus does not?',
    probing: 'The separation of concerns between evaluating and delivering alerts.',
    answer: [
      'Prometheus **evaluates** alerting rules and decides which alerts are firing. It then hands them to **Alertmanager**, which decides **what to do about them** - who to notify, through which channel, and how to avoid drowning them in duplicates.',
      'Alertmanager does four things Prometheus deliberately does not. **Grouping**: fifty alerts from one incident become one notification rather than fifty pages. **Inhibition**: when a cluster-down alert is firing, suppress the hundred service-down alerts it obviously causes. **Silencing**: mute alerts during known maintenance. And **routing**: send database alerts to the database team and critical ones to the pager while warnings go to a chat channel.',
      'Grouping is the feature that matters most in practice. Without it, a node failure sends a separate notification for every pod on it, and the signal is lost in the noise at exactly the moment someone needs to see it clearly.',
      'The separation also means alert **delivery** is highly available independently of Prometheus: you run Alertmanager as a cluster of instances that gossip, so notifications are deduplicated even when several Prometheus servers send the same alert.',
    ],
    code: [
      {
        title: 'Routing, grouping and inhibition',
        language: 'yaml',
        code: `route:
  receiver: chat-warnings
  group_by: [alertname, cluster, service]
  group_wait: 30s          # wait, in case related alerts arrive together
  group_interval: 5m       # how often to send updates for an existing group
  repeat_interval: 4h      # re-notify about something still firing

  routes:
    - matchers: [ severity="critical" ]
      receiver: pagerduty
      continue: false
    - matchers: [ team="database" ]
      receiver: database-team

inhibit_rules:
  # If the whole cluster is down, do not also page about every service on it
  - source_matchers: [ alertname="ClusterDown" ]
    target_matchers: [ severity=~"warning|critical" ]
    equal: [cluster]

receivers:
  - name: pagerduty
    pagerduty_configs:
      - service_key_file: /etc/alertmanager/pd-key
  - name: chat-warnings
    slack_configs:
      - channel: '#alerts'
  - name: database-team
    slack_configs:
      - channel: '#db-alerts'`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'From rule to notification',
        caption:
          'Grouping is what turns fifty alerts from one incident into one useful notification.',
        nodes: [
          {
            label: 'Prometheus evaluates rules',
            detail: 'Every evaluation_interval',
            tone: 'accent',
          },
          { label: 'Alert fires after for: duration', detail: 'Pending -> Firing' },
          { label: 'Sent to Alertmanager', detail: 'Repeatedly, while it fires' },
          { label: 'Grouped by labels', detail: 'One notification per group', tone: 'warning' },
          { label: 'Inhibited or silenced?', detail: 'Suppress the obvious consequences' },
          { label: 'Routed to a receiver', detail: 'Pager, chat, ticket', tone: 'success' },
        ],
      },
    ],
    traps: [
      '`group_by: [...]` with too many labels, which defeats grouping - every alert becomes its own group.',
      'No inhibition rules, so one node failure produces a hundred pages.',
      '`repeat_interval` too short, so an ongoing incident re-pages every few minutes.',
    ],
    followUps: [
      'A node failed and you received 80 pages. What would you configure?',
      'Why run Alertmanager as a cluster?',
    ],
    tags: ['alertmanager', 'alerting', 'routing', 'grouping'],
  },
  {
    id: 'itv-prom-21',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What makes a good alert? How do you avoid alert fatigue?',
    probing: 'The most important monitoring question there is, and mostly not about tooling.',
    answer: [
      'The test I would apply is: **would a human need to do something about this, right now?** If the answer is no, it should not page. That single rule eliminates most bad alerts.',
      'Good alerts are on **symptoms users experience**, not causes. High CPU is not a problem if requests are being served; a 5% error rate is a problem regardless of what the CPU is doing. Alerting on causes produces pages for things that do not matter and misses the ones that do, because you cannot enumerate every possible cause.',
      'They are **actionable**: the person receiving it can do something, and the alert says what. An annotation with a runbook link and the specific affected service is the difference between a useful page and a puzzle at 3am.',
      'They have a **`for:` clause** so a transient blip does not page. And they are **tuned**: the threshold reflects when it actually matters, not a round number someone picked.',
      'On alert fatigue specifically: the failure mode is that a team receiving thirty alerts a night stops reading them, and the one that mattered is lost. The fix is ruthless - **every alert that fires and requires no action should be deleted or downgraded**. Reviewing what paged last week and asking "did anyone act on this?" is the single most effective monitoring practice I know, and it is almost never done.',
    ],
    code: [
      {
        title: 'A well-formed alert',
        language: 'yaml',
        code: `- alert: HighErrorRate
  expr: |
    sum by (service) (rate(http_requests_total{status=~"5.."}[5m]))
      /
    sum by (service) (rate(http_requests_total[5m]))
      > 0.05
  for: 5m                       # not a transient blip
  labels:
    severity: critical
    team: platform
  annotations:
    summary: "{{ $labels.service }}: {{ $value | humanizePercentage }} of requests are failing"
    description: >
      Error rate has been above 5% for 5 minutes.
      Check recent deploys first, then downstream dependencies.
    runbook_url: "https://runbooks.example.com/high-error-rate"
    dashboard_url: "https://grafana.example.com/d/abc/service?var-service={{ $labels.service }}"`,
      },
    ],
    deeper: [
      'The **four golden signals** - latency, traffic, errors, saturation - are a good checklist for what to alert on for any service.',
      'Separate **paging** alerts from **ticketing** ones. "Disk will be full in three days" is a ticket; "disk is full" is a page.',
      'Track alert volume per team as a metric. A rising trend is a problem before anyone complains about it.',
      'An alert that has never fired is not necessarily good - it may be broken. Test alerting rules.',
    ],
    traps: [
      'Alerting on every metric that has a threshold available.',
      'No `for:` clause, so a single scrape failure pages someone.',
      'Alerts with no runbook, so the recipient has to work out what to do from scratch.',
      'Keeping a noisy alert because "it might be useful one day".',
    ],
    followUps: [
      'Your team gets 40 alerts a night. Where do you start?',
      'What are the four golden signals?',
    ],
    tags: ['alerting', 'alert fatigue', 'oncall', 'culture', 'production'],
  },
  {
    id: 'itv-prom-22',
    level: 'advanced',
    kind: 'open',
    prompt: 'What are SLIs, SLOs and error budgets, and how do you alert on them?',
    probing: 'SRE practice. Multi-window multi-burn-rate alerting is the senior-level detail.',
    answer: [
      'An **SLI** is a measurement of service quality - the proportion of requests that succeed, or that complete under 300 ms. An **SLO** is a target for it: 99.9% of requests succeed over 30 days. An **error budget** is what the SLO permits you to fail: 99.9% over 30 days is about 43 minutes of downtime, and that budget is a resource you can deliberately spend on risk.',
      'The error budget is the useful part, because it turns reliability into a shared, quantified decision rather than an argument. Budget remaining means you can ship faster; budget exhausted means reliability work takes priority. It replaces "is this safe enough?" with a number both engineering and product can see.',
      'For alerting, the naive approach - page when the SLO is breached - is too late, because by then you have already used the budget. Instead you alert on **burn rate**: how fast you are consuming the budget relative to the rate that would exhaust it exactly at the end of the window.',
      'The technique that works is **multi-window, multi-burn-rate**. A **fast burn** - 14.4x the sustainable rate, which would exhaust a 30-day budget in about two days - pages immediately, because something is badly wrong now. A **slow burn** - 6x, over a longer window - raises a ticket, because there is a real problem but it can be handled in hours.',
      'Each condition uses **two windows** - a long one and a short one - and requires both to be burning. The long window prevents alerting on a brief spike; the short window means the alert **resolves quickly** once the problem stops, rather than staying firing for hours because the long window still contains the bad period.',
    ],
    code: [
      {
        title: 'Multi-window multi-burn-rate alerting',
        language: 'yaml',
        code: `groups:
  - name: slo
    rules:
      # The SLI: proportion of requests that FAIL, at several windows
      - record: job:slo_errors:ratio_rate5m
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[5m]))
            / sum(rate(http_requests_total[5m]))
      - record: job:slo_errors:ratio_rate1h
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[1h]))
            / sum(rate(http_requests_total[1h]))
      - record: job:slo_errors:ratio_rate6h
        expr: |
          sum(rate(http_requests_total{status=~"5.."}[6h]))
            / sum(rate(http_requests_total[6h]))

      # FAST BURN: 14.4x - exhausts a 30-day budget in ~2 days. Page now.
      - alert: ErrorBudgetBurnFast
        expr: |
          job:slo_errors:ratio_rate1h  > (14.4 * 0.001)
            and
          job:slo_errors:ratio_rate5m  > (14.4 * 0.001)
        for: 2m
        labels: { severity: critical }
        annotations:
          summary: "Burning the error budget 14x too fast - budget gone in ~2 days"

      # SLOW BURN: 6x - real, but it can wait for working hours. Ticket.
      - alert: ErrorBudgetBurnSlow
        expr: |
          job:slo_errors:ratio_rate6h  > (6 * 0.001)
            and
          job:slo_errors:ratio_rate1h  > (6 * 0.001)
        for: 15m
        labels: { severity: warning }`,
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'How fast is the budget burning?',
        caption: 'The short window in each condition is what makes the alert resolve promptly.',
        question: 'Error rate relative to the sustainable rate',
        branches: [
          {
            condition: '14.4x, confirmed on 1h and 5m windows',
            result: 'Page immediately',
            detail: 'Budget exhausted in ~2 days',
            tone: 'danger',
          },
          {
            condition: '6x, confirmed on 6h and 1h windows',
            result: 'Raise a ticket',
            detail: 'Real, but not tonight',
            tone: 'warning',
          },
          {
            condition: 'Below the sustainable rate',
            result: 'No alert',
            detail: 'The budget exists to be used',
            tone: 'success',
          },
          {
            condition: 'Budget exhausted',
            result: 'Reliability work takes priority',
            detail: 'A policy decision, not an alert',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'Set the SLO from what **users actually need**, not from what is currently achieved. An SLO that is never at risk is not doing any work.',
      'Measure the SLI as close to the user as possible - at the load balancer or from a synthetic probe, not deep inside the service where you cannot see failures that never reached it.',
      '100% is never the right SLO. It removes the budget, which removes the ability to make deliberate trade-offs, and it is unachievable anyway.',
      'The error budget policy - what actually happens when it is exhausted - has to be agreed in advance with product, or it is just a number on a dashboard.',
    ],
    traps: [
      'Alerting on SLO breach rather than burn rate, which is always too late.',
      'A single-window burn alert, which either fires on spikes or stays firing long after recovery.',
      'An SLO set at whatever the service currently achieves, which measures nothing.',
      'No agreed policy for an exhausted budget.',
    ],
    followUps: [
      'Why two windows per burn-rate condition?',
      'What happens when the error budget is exhausted?',
    ],
    tags: ['slo', 'sli', 'error budget', 'burn rate', 'sre', 'advanced'],
  },
  {
    id: 'itv-prom-23',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does the `for:` clause in an alerting rule do?',
    probing: 'Alert state machine basics.',
    options: [
      {
        id: 'a',
        text: 'The condition must be continuously true for that duration before the alert fires',
      },
      { id: 'b', text: 'The alert stops firing after that duration' },
      { id: 'c', text: 'It sets how often the rule is evaluated' },
      { id: 'd', text: 'It delays the notification but the alert fires immediately' },
    ],
    correct: ['a'],
    answer: [
      'The alert enters the **Pending** state as soon as the expression is true, and only becomes **Firing** - and is sent to Alertmanager - once it has stayed true for the whole `for:` duration. If the condition becomes false at any point, it returns to Inactive and the timer resets.',
      'It exists to suppress transient conditions. Without it, a single slow scrape or a momentary spike pages someone, and those are exactly the events that resolve themselves before anyone can look.',
      'Choosing the duration is a trade-off between **noise and detection time**. Five minutes is a common default for error-rate alerts. For something genuinely urgent - a complete outage - a shorter duration is appropriate; for a gradually developing problem, longer.',
      'The related detail worth knowing is that `for:` requires the condition to be **continuously** true. A condition that flaps around the threshold never fires at all, even though something is clearly wrong - which is an argument for a threshold set where the signal is unambiguous.',
    ],
    code: [
      {
        title: 'Durations matched to urgency',
        language: 'yaml',
        code: `# Complete outage - short, because it is unambiguous and urgent
- alert: ServiceDown
  expr: up{job="api"} == 0
  for: 1m

# Error rate - longer, because brief spikes are normal
- alert: HighErrorRate
  expr: error_ratio > 0.05
  for: 5m

# Capacity - hours, because it is a ticket not a page
- alert: DiskFillingUp
  expr: predict_linear(node_filesystem_avail_bytes[6h], 4*24*3600) < 0
  for: 30m`,
      },
    ],
    traps: [
      'No `for:` clause on a noisy metric.',
      'A `for:` so long that a real outage goes unnoticed for fifteen minutes.',
      'A condition that flaps around the threshold and therefore never fires.',
    ],
    followUps: ['What happens if the condition flaps during the `for:` window?'],
    tags: ['alerting', 'for clause', 'rules', 'fundamentals'],
  },
  {
    id: 'itv-prom-24',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do you make Prometheus highly available and store metrics long-term?',
    probing: 'Scaling architecture. The naive HA answer has a specific problem worth naming.',
    answer: [
      'Prometheus itself has **no clustering**. The standard HA approach is to run **two identical servers** scraping the same targets. Both have all the data, and losing one loses nothing.',
      'The problem that creates is **query inconsistency**: the two servers scrape at slightly different moments, so their data differs marginally, and a dashboard pointed at one will show slightly different numbers from the other. Naive load balancing between them makes graphs jump as queries land on different servers.',
      'That is what **Thanos**, **Mimir** and **Cortex** solve. They provide a **query layer that deduplicates** across replicas, giving one coherent view, and they take the data into **object storage** for long-term retention - so local Prometheus keeps a few days and S3 keeps years, cheaply.',
      'Thanos works by running a **sidecar** next to each Prometheus that ships completed blocks to object storage, with a **Querier** that fans out across sidecars and the object store. Mimir and Cortex instead use **remote write**, with Prometheus streaming samples to a horizontally scalable cluster.',
      'For **scale** beyond HA, the answer is **sharding** - splitting targets across several Prometheus servers by hash or by function - with the global query layer stitching them back together. A single Prometheus scales a long way vertically, and sharding is what you reach for after that.',
      'Alertmanager is separate: it clusters natively by gossip, so run three instances and they deduplicate notifications between themselves.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'HA Prometheus with a global query layer',
        caption:
          'Deduplication at the query layer is what makes two replicas usable rather than confusing.',
        root: {
          label: 'Observability platform',
          children: [
            {
              label: 'Prometheus replica A + sidecar',
              detail: 'Scrapes everything, short retention',
              tone: 'accent',
            },
            {
              label: 'Prometheus replica B + sidecar',
              detail: 'Identical config, same targets',
              tone: 'accent',
            },
            {
              label: 'Object storage (S3/GCS)',
              detail: 'Blocks shipped here - years of retention',
              tone: 'success',
            },
            {
              label: 'Thanos Querier',
              detail: 'Deduplicates replicas, one coherent view',
              tone: 'warning',
            },
            {
              label: 'Alertmanager cluster (3x)',
              detail: 'Gossips, deduplicates notifications',
              tone: 'muted',
            },
          ],
        },
      },
    ],
    deeper: [
      'Both replicas send the same alerts; Alertmanager’s deduplication is what stops you being paged twice.',
      'Remote write (Mimir/Cortex) is simpler operationally than Thanos sidecars but puts the ingestion cluster in the critical path of every scrape.',
      'Object storage makes long retention genuinely cheap - the usual reason teams keep only 15 days is that they never set this up.',
      'Recording rules become more important with a global query layer, because queries span far more data.',
    ],
    traps: [
      'Load balancing between two Prometheus replicas without deduplication, producing jumping graphs.',
      'Treating Thanos as a replacement for Prometheus rather than a layer on top.',
      'Running one Alertmanager, so alert delivery is a single point of failure.',
    ],
    followUps: [
      'Why does naive load balancing between two replicas cause problems?',
      'When would you shard rather than scale vertically?',
    ],
    tags: ['high availability', 'thanos', 'mimir', 'scaling', 'architecture', 'advanced'],
  },
  {
    id: 'itv-prom-25',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do Prometheus and Grafana fit together, and what makes a good dashboard?',
    probing: 'Visualisation practice - the dashboard design half is what distinguishes the answer.',
    answer: [
      'Prometheus **collects and stores**; Grafana **visualises**. Grafana queries Prometheus with PromQL and renders the results. They are separate concerns and Grafana can query many other sources alongside.',
      'What makes a dashboard good is mostly about **who is looking at it and why**. A dashboard someone opens during an incident needs to answer "is it broken, and where?" within about ten seconds. A dashboard for capacity planning is a different artefact entirely, and mixing the two produces something that serves neither.',
      'The practices that work: **the four golden signals at the top** - latency, traffic, errors, saturation - so the summary is visible without scrolling. **Detail below**, for when the summary says something is wrong. **Consistent layout across services**, so someone who knows one dashboard knows them all. **Template variables** for service and environment rather than fifty near-identical dashboards. And **units and thresholds set**, so a number is interpretable without knowing the service.',
      'The most common failure is a dashboard with forty panels showing every metric that exists. During an incident, that is worse than nothing - nobody can find the signal. Fewer panels, chosen deliberately, is almost always better.',
      'And dashboards are not alerts. A dashboard nobody is looking at detects nothing; anything that needs a response needs an alert.',
    ],
    code: [
      {
        title: 'The golden-signal queries a service dashboard needs',
        language: 'text',
        code: `# Traffic
sum by (service) (rate(http_requests_total{service=~"$service"}[5m]))

# Errors - as a ratio, which is what actually matters
sum by (service) (rate(http_requests_total{service=~"$service",status=~"5.."}[5m]))
  / sum by (service) (rate(http_requests_total{service=~"$service"}[5m]))

# Latency - p50, p95, p99 on one panel to show the shape of the distribution
histogram_quantile(0.99,
  sum by (le, service) (rate(http_request_duration_seconds_bucket{service=~"$service"}[5m])))

# Saturation - how close to a limit are we?
sum by (pod) (rate(container_cpu_usage_seconds_total{pod=~"$service.*"}[5m]))
  / sum by (pod) (kube_pod_container_resource_limits{resource="cpu",pod=~"$service.*"})`,
      },
    ],
    deeper: [
      'Provision dashboards as code (JSON in git, applied by Grafana provisioning or the operator) so they are reviewed and reproducible rather than edited by hand and lost.',
      'A template variable driven by a label query keeps one dashboard serving every service automatically as services are added.',
      'Link dashboards to runbooks and to each other - during an incident, navigation matters more than any individual panel.',
    ],
    traps: [
      'Forty panels showing everything, so nothing stands out.',
      'Dashboards edited in the UI and never exported, lost when the instance is rebuilt.',
      'Treating a dashboard as monitoring. Nobody is watching it at 3am.',
      'Graphs without units, where a value could be seconds or milliseconds.',
    ],
    followUps: [
      'What would you put on a dashboard someone opens during an incident?',
      'How do you keep dashboards from being lost?',
    ],
    tags: ['grafana', 'dashboards', 'visualisation', 'golden signals'],
  },
  {
    id: 'itv-prom-26',
    level: 'advanced',
    kind: 'scenario',
    prompt: 'You are paged at 3am: "HighLatency, service=checkout". Walk me through what you do.',
    probing:
      'Using monitoring under pressure. The method and the order are what is being assessed.',
    answer: [
      'First, **establish the scope and the impact**, because that decides urgency. Is it all requests or one endpoint? All instances or one? Is the error rate also up, or is it slow-but-working? Slow and working is very different from slow and failing.',
      'Second, **check for a recent change**. Deploys are the most common cause by a wide margin. A deployment annotation on the latency graph answers this in seconds - if latency stepped up at the moment of a deploy, the investigation is nearly over and the action is to roll back.',
      'Third, **narrow it down with the labels you already have**. Break the latency down by endpoint, by instance, by upstream dependency. If it is one endpoint, look at what that endpoint does. If it is one instance, that instance is the problem - check whether it is being throttled or is on a bad node. If it is uniform across everything, look at a shared dependency: the database, the cache, a downstream service.',
      'Fourth, **check saturation** on the obvious resources: CPU throttling, memory pressure, connection pool exhaustion, database connections, queue depth. A service that is at its connection limit shows exactly this symptom.',
      'Fifth, if the cause is not obvious and users are affected, **mitigate anyway** - roll back the recent deploy, scale out, shed load, fail over. Restoring service comes before understanding it.',
      'And throughout, **record the timeline** as I go. Reconstructing it afterwards from memory is unreliable, and the postmortem depends on it.',
    ],
    code: [
      {
        title: 'The queries, in the order I would run them',
        language: 'text',
        code: `# 1. Scope: is it everything, or one endpoint?
histogram_quantile(0.99,
  sum by (le, endpoint) (rate(http_request_duration_seconds_bucket{service="checkout"}[5m])))

# 2. Is it also failing, or just slow?
sum(rate(http_requests_total{service="checkout",status=~"5.."}[5m]))
  / sum(rate(http_requests_total{service="checkout"}[5m]))

# 3. One instance or all of them?
histogram_quantile(0.99,
  sum by (le, instance) (rate(http_request_duration_seconds_bucket{service="checkout"}[5m])))

# 4. Is a dependency slow?
histogram_quantile(0.99,
  sum by (le, upstream) (rate(upstream_request_duration_seconds_bucket{service="checkout"}[5m])))

# 5. Saturation - CPU throttling and connection pools
rate(container_cpu_cfs_throttled_seconds_total{pod=~"checkout.*"}[5m])
db_connection_pool_in_use / db_connection_pool_size`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Triage order',
        caption:
          'Checking for a recent deploy first resolves a large share of these in under a minute.',
        nodes: [
          { label: 'Scope and impact', detail: 'All endpoints? Also erroring?', tone: 'accent' },
          { label: 'Recent deploy?', detail: 'The most common cause by far', tone: 'warning' },
          { label: 'Break down by label', detail: 'Endpoint, instance, upstream' },
          { label: 'Check saturation', detail: 'Throttling, pools, queues' },
          {
            label: 'Mitigate even without root cause',
            detail: 'Rollback, scale, shed load',
            tone: 'danger',
          },
          { label: 'Record the timeline', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Deployment annotations on dashboards are one of the highest-value things you can add - they answer the most common question instantly.',
      'If latency is up but errors are not, suspect a dependency, a lock, or saturation rather than a code bug.',
      'One slow instance out of many usually means a bad node, CPU throttling, or an instance that has been up longer and has a leak.',
      'Distributed tracing answers "which span got slow" far faster than metrics when the cause is a dependency chain.',
    ],
    traps: [
      'Diving into logs before establishing the scope.',
      'Not checking for a deploy, and spending an hour on something a rollback would have fixed.',
      'Investigating to completion while users are affected instead of mitigating.',
      'Reconstructing the timeline afterwards from memory.',
    ],
    followUps: [
      'The latency is high on exactly one instance. What does that suggest?',
      'What would you add to make this faster to diagnose next time?',
    ],
    tags: ['scenario', 'incident response', 'troubleshooting', 'oncall', 'advanced'],
  },
  {
    id: 'itv-prom-27',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are the four golden signals and the USE and RED methods?',
    probing: 'Monitoring frameworks - useful vocabulary for structuring an answer.',
    answer: [
      'The **four golden signals**, from the Google SRE book: **latency** (how long requests take, split by success and failure because a fast error is not good news), **traffic** (demand - requests per second), **errors** (failed request rate), and **saturation** (how full the system is, and how close to a limit).',
      'The **RED method** is a variant for **request-driven services**: **Rate**, **Errors**, **Duration**. It is essentially the golden signals without saturation, and it is the right frame for an HTTP service or an RPC endpoint.',
      'The **USE method** is for **resources** rather than services: **Utilisation**, **Saturation**, **Errors** - applied to CPU, memory, disk, network. It is the right frame when you are asking "is this machine or this disk the problem?"',
      'They are complementary rather than competing. RED tells you the service is unhealthy; USE tells you which resource is responsible. In practice a good dashboard has RED at the top for the service and USE below for its resources.',
      'The value of naming them in an interview is that they give you a **checklist** - if you can measure all four signals for a service, you will detect essentially any user-visible problem, which is a much better position than instrumenting whatever seemed interesting.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which framework fits what you are looking at?',
        caption: 'RED for services, USE for resources - they answer different questions.',
        question: 'What are you monitoring?',
        branches: [
          {
            condition: 'A request-driven service',
            result: 'RED - rate, errors, duration',
            detail: 'Is the service healthy from outside?',
            tone: 'success',
          },
          {
            condition: 'A resource - CPU, disk, network',
            result: 'USE - utilisation, saturation, errors',
            detail: 'Which resource is the constraint?',
            tone: 'accent',
          },
          {
            condition: 'A queue or batch system',
            result: 'Depth, age, throughput, failure rate',
            detail: 'RED adapted - the oldest item matters most',
            tone: 'accent',
          },
          {
            condition: 'Anything, as a completeness check',
            result: 'Four golden signals',
            detail: 'Latency, traffic, errors, saturation',
            tone: 'muted',
          },
        ],
      },
    ],
    traps: [
      'Measuring latency without splitting successful from failed requests - fast failures make the average look good.',
      'Ignoring saturation, which is the only one of the four that is predictive rather than reactive.',
      'Applying RED to a queue worker, where queue age matters more than request rate.',
    ],
    followUps: [
      'Why split latency by success and failure?',
      'What would RED look like for a queue consumer?',
    ],
    tags: ['golden signals', 'red method', 'use method', 'monitoring', 'sre'],
  },
  {
    id: 'itv-prom-28',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you monitor a batch job or a cron job?',
    probing: 'A case the pull model handles badly, and where most teams have a gap.',
    answer: [
      'Batch jobs are awkward because they **do not run continuously**, so there is nothing to scrape most of the time, and the most important failure mode - **the job did not run at all** - produces no signal whatsoever.',
      'The mechanism is the **Pushgateway**: the job pushes its results when it finishes, and Prometheus scrapes the gateway. The metrics that matter are a **last success timestamp**, a **duration**, and a **records processed count** - plus whatever is meaningful to the job.',
      'The alert that matters most is on **staleness of the last success**, not on failure. `time() - job_last_success_timestamp_seconds > expected_interval * 2` catches the job failing, the job not being scheduled, the scheduler being broken, and the whole machine being gone - all of which a failure-based alert would miss entirely.',
      'On Kubernetes, **kube-state-metrics** gives you CronJob and Job status without any instrumentation, which covers the scheduling half well. The Pushgateway is still useful for the job’s own business metrics.',
      'The caution with the Pushgateway is that metrics **persist until explicitly deleted**. A decommissioned job keeps reporting its last value forever, which eventually alerts on staleness for something that no longer exists - so deleting the group when a job is retired is part of decommissioning.',
    ],
    code: [
      {
        title: 'Push results at the end of a job',
        language: 'bash',
        code: `#!/usr/bin/env bash
set -euo pipefail

JOB="nightly-report"
PGW="http://pushgateway:9091/metrics/job/\${JOB}"
START=$(date +%s)

if ./run-report.sh; then
  STATUS=0
else
  STATUS=1
fi

END=$(date +%s)

cat <<METRICS | curl -sf --data-binary @- "$PGW"
# TYPE job_last_success_timestamp_seconds gauge
job_last_success_timestamp_seconds $( [ "$STATUS" -eq 0 ] && echo "$END" || echo 0 )
# TYPE job_duration_seconds gauge
job_duration_seconds $(( END - START ))
# TYPE job_last_exit_code gauge
job_last_exit_code $STATUS
METRICS`,
      },
      {
        title: 'Alert on staleness, which catches every failure mode',
        language: 'yaml',
        code: `- alert: BatchJobStale
  # Expected daily; alert if there has been no success for 26 hours
  expr: time() - job_last_success_timestamp_seconds{job="nightly-report"} > 26 * 3600
  for: 10m
  labels: { severity: critical }
  annotations:
    summary: "nightly-report has not succeeded for over 26 hours"
    description: >
      This covers the job failing, not being scheduled, and the scheduler
      being down - none of which a failure-only alert would detect.`,
      },
    ],
    traps: [
      'Alerting only on job failure, which misses the job never running.',
      'Pushgateway metrics left behind after a job is decommissioned, alerting forever.',
      'Using the Pushgateway for long-running services, which loses the `up` signal.',
      'No duration metric, so a job that gradually slows is invisible until it overruns its window.',
    ],
    followUps: [
      'Why alert on staleness rather than on failure?',
      'What happens to Pushgateway metrics when a job is deleted?',
    ],
    tags: ['batch jobs', 'pushgateway', 'alerting', 'cron'],
  },
  {
    id: 'itv-prom-29',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these are legitimate reasons an alert did not fire during an outage? Select all that apply.',
    probing: 'Post-incident reasoning about monitoring gaps - a genuinely senior line of thinking.',
    options: [
      {
        id: 'a',
        text: 'The target stopped being scraped, so the metric was absent rather than bad - and the rule had no `absent()` check',
      },
      { id: 'b', text: 'The `for:` duration was longer than the outage' },
      { id: 'c', text: 'Prometheus itself was down, or could not reach Alertmanager' },
      { id: 'd', text: 'The alert was silenced, or inhibited by another rule' },
      { id: 'e', text: 'PromQL cannot express the condition that occurred' },
    ],
    correct: ['a', 'b', 'c', 'd'],
    answer: [
      'PromQL is expressive enough for essentially any condition you can measure - if something was not detectable, the gap is in the **instrumentation**, not the query language. That is the wrong option.',
      'The others are all real and all common. **Absent metrics** are the most insidious: a rule like `error_rate > 0.05` is simply not true when the metric does not exist, so a service that died completely and stopped exposing metrics never triggers it. `absent()` or an `up == 0` alert is what covers that.',
      '**A `for:` longer than the outage** means a five-minute outage never fires a rule with `for: 10m`. Legitimate for noise suppression, and a real gap if the outage was shorter.',
      '**Prometheus itself being down** is the monitoring-the-monitoring problem. It needs an external check - a dead man’s switch, an alert that fires **continuously** and pages if the notification *stops* arriving.',
      '**Silenced or inhibited** is worth checking explicitly in any postmortem, because a silence created for maintenance and never removed is extremely common.',
    ],
    code: [
      {
        title: 'The two rules that cover the gaps',
        language: 'yaml',
        code: `# Absent metrics - the service died and stopped exposing anything
- alert: MetricsAbsent
  expr: absent(http_requests_total{job="api"})
  for: 5m
  labels: { severity: critical }

# Dead man's switch - always firing. An external system pages if this
# notification STOPS arriving, which detects Prometheus being down.
- alert: Watchdog
  expr: vector(1)
  labels: { severity: none }
  annotations:
    summary: "Always firing. Alerting on its absence proves the pipeline works."`,
      },
    ],
    deeper: [
      'The dead man’s switch is the only way to detect that your alerting pipeline has stopped working, and it is very often missing.',
      'Test alerting rules with `promtool test rules` against synthetic data, so you know they fire when they should.',
      'After any incident, ask "what would have alerted on this?" as a standing item. It is where the best monitoring improvements come from.',
    ],
    traps: [
      'Rules that only compare a metric to a threshold, silently doing nothing when the metric is absent.',
      'No monitoring of the monitoring.',
      'Silences that outlive the maintenance they were created for.',
    ],
    followUps: [
      'What is a dead man’s switch and why do you need one?',
      'How would you test that an alert rule actually fires?',
    ],
    tags: ['alerting', 'gaps', 'postmortem', 'absent', 'advanced'],
  },
  {
    id: 'itv-prom-30',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the difference between monitoring and observability?',
    probing: 'A term that is frequently used loosely. A clear, non-buzzword answer is worth a lot.',
    answer: [
      '**Monitoring** is watching for **known failure modes**. You decide in advance what could go wrong, instrument it, and alert on it. It answers questions you thought of beforehand: is the error rate high, is the disk full, is the service reachable.',
      '**Observability** is the ability to answer questions you **did not think of in advance**, from the data the system already emits. It is about being able to investigate a novel problem without deploying new instrumentation first.',
      'The practical distinction: monitoring tells you **that** something is wrong; observability helps you work out **why**, particularly when the cause is something nobody anticipated. Complex distributed systems fail in ways nobody predicted, which is why the second matters more as systems grow.',
      'The three signals usually cited are **metrics** (cheap, aggregated, good for alerting and trends), **logs** (detailed, expensive at volume, good for specific events), and **traces** (request flow across services, good for latency attribution in a distributed call chain). Prometheus does the first well and is deliberately not a tool for the other two.',
      'I would push back slightly on the way the term is often used: "observability" is frequently a vendor word for "we sell all three". The useful core of the idea is genuine - can you debug a novel problem without shipping new code - and that is a reasonable thing to assess a system against.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'The three signals and what each is for',
        caption:
          'Each is good at something the others are bad at - the cost profiles differ enormously.',
        root: {
          label: 'Observability signals',
          children: [
            {
              label: 'Metrics (Prometheus)',
              detail: 'Cheap, aggregated, alertable. Low cardinality only.',
              tone: 'success',
            },
            {
              label: 'Logs (Loki, Splunk, ELK)',
              detail: 'High detail per event. Expensive at volume.',
              tone: 'accent',
            },
            {
              label: 'Traces (Jaeger, Tempo)',
              detail: 'Request flow across services. Usually sampled.',
              tone: 'warning',
            },
          ],
        },
      },
    ],
    traps: [
      'Treating observability as a product you buy rather than a property of a system.',
      'Trying to use metrics for high-cardinality lookup, which is what logs and traces are for.',
      'Collecting all three and correlating none of them - the value is in moving between them.',
    ],
    followUps: [
      'Which signal would you use to answer "why was this specific request slow"?',
      'Why is Prometheus a bad fit for per-request detail?',
    ],
    tags: ['observability', 'monitoring', 'concepts', 'fundamentals'],
  },
]
