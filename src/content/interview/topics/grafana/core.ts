import type { InterviewQuestion } from '../../../types'

/** Grafana itself: what it is, how it queries, and how teams run it as code. */
export const grafanaCoreQuestions: InterviewQuestion[] = [
  {
    id: 'itv-graf-1',
    level: 'basic',
    kind: 'open',
    prompt: 'What is Grafana, and what is it not? How does it relate to Prometheus?',
    probing:
      'The most common confusion in an observability interview. They want to hear that Grafana stores nothing.',
    answer: [
      'Grafana is a **visualisation and alerting layer**. It queries data that lives somewhere else and draws it. It is not a database, it does not scrape anything, and if you turn Grafana off you lose no data at all - you lose the windows you were looking through.',
      'Prometheus is the opposite: it scrapes targets, stores time series in its own database, and answers PromQL queries. It has a basic built-in UI for running queries, but nobody builds dashboards in it.',
      'So the usual pairing is: Prometheus collects and stores metrics, Grafana adds a **data source** pointing at Prometheus and issues PromQL on your behalf whenever a panel is on screen. The same Grafana instance will typically also have a Loki data source for logs and a Tempo or Jaeger data source for traces, which is what lets you pivot between all three in one place.',
      'The practical consequence is worth saying out loud: a slow dashboard is almost never a Grafana problem. It is a query problem or a data-source problem, and that is where you should look first.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Where Grafana sits',
        caption: 'Grafana owns no data. Every panel is a live query against a data source.',
        nodes: [
          { label: 'Your applications', detail: 'expose metrics, write logs, emit spans' },
          {
            label: 'Collectors',
            detail: 'Prometheus scrapes, agents tail logs',
            arrowLabel: 'collect',
          },
          {
            label: 'Stores',
            detail: 'Prometheus, Loki, Tempo - each with its own query language',
            arrowLabel: 'store',
            tone: 'accent',
          },
          {
            label: 'Grafana',
            detail: 'queries on demand, renders panels, evaluates alert rules',
            arrowLabel: 'query',
            tone: 'success',
          },
          { label: 'You', detail: 'dashboards, ad-hoc exploration, alert notifications' },
        ],
      },
    ],
    traps: [
      'Saying Grafana "collects" or "stores" metrics. It does neither, and interviewers listen for this exact word.',
      'Saying Grafana replaces Prometheus. They solve different halves of the problem.',
    ],
    followUps: [
      'What is a data source, and where are its credentials stored?',
      'If a dashboard is slow, where do you look first?',
      'Could you use Grafana without Prometheus?',
    ],
    tags: ['grafana', 'architecture', 'fundamentals'],
  },
  {
    id: 'itv-graf-2',
    level: 'basic',
    kind: 'mcq',
    prompt: 'Where does Grafana store the dashboards and alert rules you create in the UI?',
    options: [
      { id: 'a', text: 'In Prometheus, alongside the metrics they query' },
      { id: 'b', text: 'In its own database - SQLite by default, or PostgreSQL/MySQL' },
      { id: 'c', text: 'In browser local storage, per user' },
      { id: 'd', text: 'Nowhere - they are rebuilt from the data source on each load' },
    ],
    correct: ['b'],
    probing:
      'Whether you understand what actually needs backing up, and why a stateless Grafana pod loses everything.',
    answer: [
      'Grafana keeps its **own configuration database**: dashboards, folders, users, teams, API keys, alert rules and data-source definitions. By default that is a SQLite file at `/var/lib/grafana/grafana.db`.',
      'This matters enormously in Kubernetes. Run Grafana as a plain Deployment with no volume, and every restart wipes every dashboard somebody built by hand. That is the single most common Grafana incident.',
      'There are two correct answers to that problem. Either give it a **PersistentVolume** and, for more than one replica, an external PostgreSQL or MySQL - SQLite cannot be shared across replicas. Or, better, stop treating dashboards as state at all and **provision them from files**, so the database is disposable and Git is the source of truth.',
      'The metrics themselves are never in here. Losing the Grafana database loses your dashboards, not your history.',
    ],
    code: [
      {
        title: 'Making Grafana state survive a restart',
        language: 'yaml',
        explanation:
          'Either a volume for the SQLite file, or an external database. The second scales to multiple replicas; the first does not.',
        code: `# Option 1: one replica, a PersistentVolume for grafana.db
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: grafana
spec:
  replicas: 1
  serviceName: grafana
  template:
    spec:
      containers:
        - name: grafana
          image: grafana/grafana:11.3.0
          volumeMounts:
            - name: storage
              mountPath: /var/lib/grafana
  volumeClaimTemplates:
    - metadata:
        name: storage
      spec:
        accessModes: ['ReadWriteOnce']
        resources:
          requests:
            storage: 10Gi

---
# Option 2: many replicas, shared external database
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-config
data:
  grafana.ini: |
    [database]
    type = postgres
    host = grafana-db.internal:5432
    name = grafana
    user = grafana
    # password comes from GF_DATABASE_PASSWORD, never from this file`,
      },
    ],
    traps: [
      'Running Grafana with multiple replicas against one SQLite file. It will corrupt.',
      'Backing up Prometheus and assuming your dashboards are safe. They are in a different database entirely.',
    ],
    followUps: [
      'How would you avoid needing to back up the Grafana database at all?',
      'What breaks if you scale a SQLite-backed Grafana to three replicas?',
    ],
    tags: ['grafana', 'state', 'kubernetes'],
  },
  {
    id: 'itv-graf-3',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'How do you manage Grafana dashboards as code rather than clicking them together in the UI?',
    probing:
      'Whether you treat observability as infrastructure. Hand-built dashboards are a recognised anti-pattern at scale.',
    answer: [
      'Grafana supports **provisioning**: at startup, and then on a poll interval, it reads YAML files from a config directory that declare data sources, folders and dashboards. Dashboards themselves are JSON files on disk. Nothing is clicked, everything is in Git.',
      'In Kubernetes this usually means mounting ConfigMaps. The Grafana Helm chart has a nice shortcut: a **dashboard sidecar** watches for ConfigMaps carrying a label such as `grafana_dashboard: "1"` and drops their contents into the dashboard directory automatically, so a team ships a dashboard by applying a ConfigMap alongside their app.',
      'The workflow people actually enjoy is: build it in the UI where iteration is fast, then export the JSON, commit it, and mark the provisioned copy read-only so nobody silently drifts from Git. The alternative is generating dashboards from a DSL - Grafonnet (Jsonnet) or Grafana Foundation SDK - which is far better when you need forty near-identical dashboards, one per service.',
      'Alerting is provisionable the same way. Since Grafana 9, unified alerting rules, contact points, notification policies and mute timings can all be declared in YAML, which means an on-call routing change goes through code review like anything else.',
    ],
    code: [
      {
        title: 'Provisioning a data source and a dashboard folder',
        language: 'yaml',
        explanation:
          'These files live under /etc/grafana/provisioning. Grafana reads them at boot and re-reads dashboards on updateIntervalSeconds.',
        code: `# /etc/grafana/provisioning/datasources/prometheus.yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    uid: prometheus          # pin the uid - dashboards reference it
    access: proxy            # Grafana calls Prometheus, not the browser
    url: http://prometheus-server.monitoring.svc:80
    isDefault: true
    jsonData:
      timeInterval: 30s      # match your scrape interval
      httpMethod: POST
  - name: Loki
    type: loki
    uid: loki
    access: proxy
    url: http://loki-gateway.monitoring.svc:80

---
# /etc/grafana/provisioning/dashboards/all.yaml
apiVersion: 1
providers:
  - name: 'git-dashboards'
    folder: 'Platform'
    type: file
    disableDeletion: true
    allowUiUpdates: false    # UI edits cannot drift from Git
    updateIntervalSeconds: 30
    options:
      path: /var/lib/grafana/dashboards
      foldersFromFilesStructure: true`,
      },
      {
        title: 'Shipping a dashboard from an application chart',
        language: 'yaml',
        explanation:
          'The Helm chart sidecar picks this up by label. The team that owns the service owns its dashboard.',
        code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: checkout-dashboard
  namespace: monitoring
  labels:
    grafana_dashboard: '1'
data:
  checkout.json: |
    {
      "title": "Checkout service",
      "uid": "checkout-svc",
      "panels": [ ... ],
      "templating": { "list": [ ... ] }
    }`,
      },
    ],
    deeper: [
      'Pin the data-source `uid` in provisioning. If you let Grafana generate it, an exported dashboard will reference a uid that does not exist in the next environment and every panel shows "Datasource not found".',
      'Use a dashboard variable for the data source itself (`type: datasource`) so the same JSON works against dev, staging and production without editing.',
      'Grafana 11 added **Git Sync** in some editions, which pushes UI edits back to a repository - worth knowing about, but file provisioning plus review is still the common answer.',
    ],
    traps: [
      'Exporting a dashboard without "Export for sharing externally", so the JSON hardcodes a local data-source uid.',
      'Leaving `allowUiUpdates: true` and then wondering why the file in Git no longer matches production.',
    ],
    followUps: [
      'How would you generate one dashboard per microservice without copy-pasting JSON?',
      'How do you provision alert rules?',
      'What happens to a UI edit on a read-only provisioned dashboard?',
    ],
    tags: ['grafana', 'as code', 'provisioning'],
  },
  {
    id: 'itv-graf-4',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Explain dashboard variables in Grafana. Why do they matter beyond convenience?',
    probing:
      'Templating is the difference between one reusable dashboard and two hundred copy-pasted ones.',
    answer: [
      'A **variable** is a placeholder in a query that the viewer picks from a dropdown at the top of the dashboard. Write `namespace="$namespace"` in the PromQL, and one dashboard serves every namespace instead of needing one dashboard each.',
      'The most useful kind is the **query variable**, whose options are themselves fetched from the data source - typically with `label_values()`. That means the dropdown stays correct on its own: deploy a new service and it appears in the list, with no dashboard change.',
      'Variables **chain**. A `cluster` variable feeds the query that populates `namespace`, which feeds `pod`. Picking a cluster narrows the namespace list automatically, which is what makes a large estate navigable.',
      'Beyond convenience there are two serious reasons. First, **maintenance**: a fix to a templated dashboard fixes it everywhere, where a fix to one of two hundred copies fixes one of them. Second, **repeating panels** - a row or panel can repeat over every value of a multi-value variable, so a dashboard automatically grows a panel when a new shard appears rather than silently omitting it.',
    ],
    code: [
      {
        title: 'Chained query variables',
        language: 'json',
        explanation:
          'The namespace query filters on the already-selected cluster, so the dropdowns narrow each other.',
        code: `{
  "templating": {
    "list": [
      {
        "name": "datasource",
        "type": "datasource",
        "query": "prometheus"
      },
      {
        "name": "cluster",
        "type": "query",
        "datasource": "\${datasource}",
        "query": "label_values(kube_pod_info, cluster)",
        "refresh": 1
      },
      {
        "name": "namespace",
        "type": "query",
        "datasource": "\${datasource}",
        "query": "label_values(kube_pod_info{cluster=\\"$cluster\\"}, namespace)",
        "refresh": 2,
        "includeAll": true,
        "multi": true
      }
    ]
  }
}`,
      },
      {
        title: 'Using variables safely in PromQL and LogQL',
        language: 'text',
        explanation:
          'Multi-value variables interpolate as a regex alternation, so they need =~ and the regex format.',
        code: `# Single value: plain equality is fine
sum(rate(http_requests_total{namespace="$namespace"}[5m]))

# Multi-value or "All": must use =~ and the regex formatter,
# otherwise the query silently matches nothing
sum(rate(http_requests_total{namespace=~"\${namespace:regex}"}[5m]))

# $__rate_interval adapts the window to the panel's resolution.
# Prefer it over a hardcoded [5m] - it prevents empty graphs when
# somebody zooms out to 30 days.
sum(rate(http_requests_total{namespace=~"\${namespace:regex}"}[$__rate_interval]))

# The same variable in a Loki query
{namespace=~"\${namespace:regex}", app="checkout"} |= "error"

# $__range and $__interval are also available:
#   $__range    the full selected time range, e.g. 6h
#   $__interval one pixel-width of the graph`,
      },
    ],
    deeper: [
      'Always reach for `$__rate_interval` rather than a fixed `[5m]`. It is computed from the scrape interval and the panel width, so the panel keeps working when the user zooms out - a hardcoded window produces empty graphs at long ranges.',
      'Set `refresh` to "on time range change" for variables whose options are time-dependent, otherwise a pod that existed yesterday will not appear when you look at yesterday.',
      'Hidden constant variables are a neat way to keep a job name or environment prefix in one place.',
    ],
    traps: [
      'Using `=` with a multi-value variable. It interpolates to `a|b` and matches literally nothing.',
      'Forgetting the `:regex` format modifier and getting broken queries the moment somebody selects All.',
    ],
    followUps: [
      'What is the difference between $__interval and $__rate_interval?',
      'How would you make one dashboard show every shard without editing it when a shard is added?',
    ],
    tags: ['grafana', 'dashboards', 'templating'],
  },
  {
    id: 'itv-graf-5',
    level: 'intermediate',
    kind: 'multi',
    prompt:
      'Which of these are genuine causes of a Grafana dashboard taking 30 seconds to load? Select all that apply.',
    options: [
      { id: 'a', text: 'Forty panels, each issuing its own query on every refresh' },
      { id: 'b', text: 'A time range of 90 days against raw high-resolution data' },
      { id: 'c', text: 'Queries that aggregate across very high-cardinality labels' },
      { id: 'd', text: 'The dashboard JSON file being large on disk' },
      { id: 'e', text: 'An auto-refresh of 5s on panels that take longer than 5s to return' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    probing:
      'Whether you debug the query layer rather than blaming the UI. Almost every "Grafana is slow" ticket is a data-source problem.',
    answer: [
      'Grafana renders a panel by issuing a query and drawing the result. Slowness is nearly always the query, the range, or the sheer number of queries - not the rendering.',
      '**A** is the classic: panels fire in parallel but the data source has finite concurrency, so forty panels queue. Splitting one giant dashboard into an overview plus drill-downs is the standard fix, along with collapsing rows - a collapsed row issues no queries until it is expanded.',
      '**B** is a data-volume problem. Ninety days of 15-second samples is a great deal of data to scan; **recording rules** that pre-compute the expensive aggregation, or downsampled long-term storage such as Thanos or Mimir, are the real answer.',
      '**C** is cardinality. Aggregating over a label with a hundred thousand values makes the data source do enormous work regardless of what Grafana asks.',
      '**E** is self-inflicted: if the query takes eight seconds and you refresh every five, requests pile up faster than they complete and the browser and the data source both suffer.',
      '**D** is the distractor. Dashboard JSON is a few hundred kilobytes at worst and is fetched once from the Grafana database. It is never the cause.',
    ],
    deeper: [
      'Use the query inspector on the slowest panel first - it shows the exact query sent and the time the data source took. That single step resolves most of these tickets.',
      'Grafana caches nothing by default in the open-source edition; Enterprise adds query caching. Recording rules are the open-source equivalent and are usually better anyway, because the alert rules benefit too.',
      'Set a sensible `Max data points` per panel. Asking for more points than the panel has pixels is pure waste.',
    ],
    followUps: [
      'What is a recording rule and when is it worth adding one?',
      'How would you find which panel is slow?',
    ],
    tags: ['grafana', 'performance', 'dashboards'],
  },
  {
    id: 'itv-graf-6',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'Grafana unified alerting: how does it work, and when would you alert in Grafana rather than in Prometheus?',
    probing:
      'Alerting is where observability earns its keep. They want a reasoned choice, not a default.',
    answer: [
      'Since Grafana 9, **unified alerting** is a single alerting system built into Grafana. A rule has a query, a condition, a `for` duration it must stay true, labels, and annotations. When it fires, Grafana routes it through a built-in Alertmanager: notification policies match on labels and deliver to contact points such as Slack, PagerDuty or email.',
      'The mechanics mirror Prometheus deliberately - `for`, labels, annotations, silences, grouping and inhibition all behave the same way, so knowledge transfers in both directions.',
      'The case for alerting **in Grafana** is that it can query any data source and can combine them. An alert that needs a Postgres row count, a CloudWatch metric or a Loki log rate has no Prometheus equivalent. It also gives non-Prometheus teams a UI, and keeps routing in one place across several Prometheus instances.',
      'The case for alerting **in Prometheus** is resilience and locality. Prometheus rules are evaluated by the same process that holds the data, so they keep firing even if Grafana is down - and Grafana is a much more commonly restarted component. Rules live in the same Git repo as the recording rules and scrape config, and they survive a Grafana database loss.',
      'My usual position: core availability and latency alerting lives in Prometheus rules next to the data; cross-data-source and business-level alerts live in Grafana. Whatever you choose, be deliberate - having half of each with no rule is how alerts get lost.',
    ],
    code: [
      {
        title: 'A provisioned Grafana alert rule',
        language: 'yaml',
        explanation:
          'Declared in YAML so on-call routing goes through code review. The pattern mirrors a Prometheus alerting rule.',
        code: `apiVersion: 1
groups:
  - orgId: 1
    name: checkout
    folder: Platform
    interval: 1m
    rules:
      - title: Checkout error ratio above 2%
        condition: threshold
        for: 5m
        labels:
          severity: page
          team: payments
        annotations:
          summary: Checkout is returning 5xx to customers
          runbook_url: https://runbooks.internal/checkout-errors
        data:
          - refId: query
            datasourceUid: prometheus
            model:
              expr: |
                sum(rate(http_requests_total{job="checkout",status=~"5.."}[5m]))
                  /
                sum(rate(http_requests_total{job="checkout"}[5m]))
          - refId: threshold
            datasourceUid: __expr__
            model:
              type: threshold
              expression: query
              conditions:
                - evaluator:
                    type: gt
                    params: [0.02]`,
      },
    ],
    deeper: [
      'The `for` duration is what stops flapping. A rule that is true for one evaluation is noise; one that is true for five minutes is a signal.',
      'Grafana alert state has a `NoData` and an `Error` handling policy. Decide deliberately: silently treating NoData as OK hides a dead exporter, which is exactly the outage you most want to know about.',
      'Alert on symptoms users feel - error ratio, latency, queue age - not on causes like CPU. Cause-based alerts are the main source of alert fatigue.',
    ],
    traps: [
      'Alerting on a raw counter instead of a rate.',
      'Leaving NoData mapped to OK, so a broken exporter looks healthy.',
      'Building alerts only in the Grafana UI, where they vanish with the Grafana database.',
    ],
    followUps: [
      'What happens to your alerts if Grafana is down?',
      'How do notification policies differ from the old notification channels?',
      'How would you stop a node failure from paging six separate teams?',
    ],
    tags: ['grafana', 'alerting', 'on-call'],
  },
  {
    id: 'itv-graf-7',
    level: 'basic',
    kind: 'mcq',
    prompt:
      'A Grafana panel shows "No data" but running the same query in Prometheus returns results. What do you check first?',
    options: [
      { id: 'a', text: 'The panel time range and the selected variable values' },
      { id: 'b', text: 'Whether Prometheus needs restarting' },
      { id: 'c', text: 'The Grafana database disk usage' },
      { id: 'd', text: 'Whether the browser needs a hard refresh' },
    ],
    correct: ['a'],
    probing: 'Basic triage. The answer is nearly always context, not infrastructure.',
    answer: [
      'The query you ran by hand and the query Grafana ran are almost certainly **not the same query**. Grafana substitutes variables into it and constrains it to the panel time range, and either can produce an empty result.',
      'The two usual culprits: a variable resolved to something that matches nothing - often a multi-value variable used with `=` instead of `=~`, or a stale value cached from a previous visit - or a time range that sits outside the data, such as looking at "last 5 minutes" for a batch job that ran this morning.',
      'The definitive step is the **query inspector**: open the panel menu, choose Inspect, then Query, and read the exact expression Grafana sent along with the response. Copy that expression into Prometheus and it will fail there too, which tells you it was never a Grafana problem.',
      'Only after that would I look at the data source itself - and the Data source settings page has a Test button that answers that question in one click.',
    ],
    code: [
      {
        title: 'Triage in order',
        language: 'bash',
        explanation: 'Work outwards from the panel. Most "No data" reports never reach step three.',
        code: `# 1. In the panel: Inspect > Query. Read the interpolated expression
#    and the time range Grafana actually used.

# 2. Run that exact expression against Prometheus yourself
curl -sG http://prometheus:9090/api/v1/query \\
  --data-urlencode 'query=up{job="checkout"}' | jq '.data.result | length'

# 3. Does the series exist at all, ignoring the time range?
curl -sG http://prometheus:9090/api/v1/label/job/values | jq

# 4. Is the data source reachable from the Grafana pod
#    (not from your laptop - that is a different network)?
kubectl -n monitoring exec deploy/grafana -- \\
  wget -qO- http://prometheus-server/-/healthy`,
      },
    ],
    traps: [
      'Restarting things before reading the interpolated query. It is almost never the server.',
      'Testing the data-source URL from your laptop when Grafana calls it from inside the cluster.',
    ],
    followUps: [
      'Where exactly is the query inspector?',
      'Why would a multi-value variable break a query that works with one value?',
    ],
    tags: ['grafana', 'troubleshooting', 'dashboards'],
  },
  {
    id: 'itv-graf-8',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How do you handle multi-tenancy in Grafana - many teams, one instance, and nobody seeing what they should not?',
    probing:
      'A platform-team question. They want to hear about the layers, and about where Grafana genuinely cannot help.',
    answer: [
      'There are three separate layers and conflating them is the usual mistake.',
      'The first is **Grafana access control**. Folders carry permissions, dashboards inherit them, and Teams map to your identity provider groups through OAuth or SAML. A team gets Editor on its own folder and Viewer elsewhere. Grafana Organisations give harder separation - completely separate dashboards, users and data sources - but they are heavyweight and cannot share anything, so most platforms use folders and teams instead.',
      'The second is **data-source access**, and this is where naive setups leak. If every team can query one shared Prometheus data source, folder permissions have bought you nothing: anyone can open Explore and query any metric in the cluster. Grafana can restrict which teams may use which data source, which is the control that actually matters.',
      'The third is **tenancy in the backend**, which is the only genuinely strong answer. Mimir, Loki and Tempo all implement tenants via the `X-Scope-OrgID` header. You create one Grafana data source per tenant, set that header in the data-source config, and restrict the data source to that team. The store itself then enforces the boundary, so even a crafted query cannot cross it.',
      'The honest caveat for an interview: Grafana is not a security boundary for data it proxies. If the requirement is hard isolation - separate customers, or regulated data - push the enforcement into the backend with per-tenant credentials, or run separate Grafana instances. Dashboard permissions only hide things from the UI.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'Where the boundary is actually enforced',
        caption:
          'Folder permissions hide dashboards. Only the backend tenant header stops a hand-written query.',
        root: {
          label: 'Grafana instance',
          detail: 'shared UI, SSO-backed teams',
          children: [
            {
              label: 'Folder: Payments',
              detail: 'team-payments has Editor, everyone else has none',
              tone: 'accent',
              children: [
                {
                  label: 'Data source: Mimir (tenant=payments)',
                  detail: 'sends X-Scope-OrgID: payments, usable by team-payments only',
                  tone: 'success',
                },
              ],
            },
            {
              label: 'Folder: Search',
              detail: 'team-search has Editor',
              tone: 'accent',
              children: [
                {
                  label: 'Data source: Mimir (tenant=search)',
                  detail: 'sends X-Scope-OrgID: search',
                  tone: 'success',
                },
              ],
            },
            {
              label: 'Data source: Prometheus (shared, no tenant)',
              detail: 'anyone who can use it can query everything - restrict it',
              tone: 'danger',
            },
          ],
        },
      },
    ],
    code: [
      {
        title: 'A per-tenant data source',
        language: 'yaml',
        explanation:
          'The tenant header is set server-side in the proxy, so the browser cannot change it.',
        code: `apiVersion: 1
datasources:
  - name: Mimir - payments
    type: prometheus
    uid: mimir-payments
    access: proxy              # essential: browser never talks to Mimir directly
    url: http://mimir-query-frontend.monitoring.svc/prometheus
    jsonData:
      httpHeaderName1: X-Scope-OrgID
    secureJsonData:
      httpHeaderValue1: payments
    # then restrict this data source to the payments team in
    # Administration > Data sources > Permissions`,
      },
    ],
    deeper: [
      '`access: proxy` versus `access: direct` is a security decision, not a networking one. Direct mode makes the browser call the data source, which exposes its URL and any credentials to the user and breaks the tenant header entirely. Direct mode is deprecated for good reason.',
      'Service accounts and their tokens replaced API keys in Grafana 9. Scope them per pipeline rather than sharing an admin token.',
      'Anonymous access plus a read-only org is a legitimate pattern for a wall-mounted NOC dashboard, but only with a data source that exposes nothing sensitive.',
    ],
    traps: [
      'Believing folder permissions restrict data. They restrict dashboards; Explore bypasses them entirely.',
      'Putting the tenant header in the dashboard JSON, where a user can change it.',
    ],
    followUps: [
      'How does X-Scope-OrgID work in Loki and Mimir?',
      'When would you run separate Grafana instances instead?',
      'How do you stop a viewer from using Explore at all?',
    ],
    tags: ['grafana', 'multi-tenancy', 'security'],
  },
  {
    id: 'itv-graf-9',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What are Grafana transformations, and when would you use one instead of changing the query?',
    probing:
      'Panel-building depth. The right answer includes knowing when a transformation is the wrong tool.',
    answer: [
      '**Transformations** reshape the data after the data source returns it and before the panel draws it. They run in the browser, chained in order. Common ones: Join by field to put two queries side by side, Organize fields to rename and hide columns, Group by to aggregate, Add field from calculation to compute a ratio, and Filter data by values.',
      'The classic use is a table that combines several queries. Query A gives requests per service, query B gives error rate, query C gives p99 latency; a join on the service label produces one row per service with three columns, which no single PromQL expression would give you cleanly.',
      'The rule I use: **do it in the query when the query can do it.** Anything that reduces the volume of data - filtering, aggregation, rate calculations - belongs in PromQL or LogQL, because that work happens on the server, benefits from indexes, and sends less over the wire. Transformations pull everything to the browser first.',
      'Transformations earn their place for presentation concerns the query language has no opinion about - renaming a column to something humans read, hiding an internal field, joining results from **two different data sources**, or computing a ratio between two results that could not be expressed in one query.',
    ],
    deeper: [
      'Transformations are applied in order and each sees the previous output, so a Filter before a Group by is very different from the reverse. The transformation tab shows the intermediate frames, which makes debugging much easier than guessing.',
      'A transformation on a hundred thousand rows will freeze the browser tab. If you find yourself transforming that much, the query is wrong.',
      'Field overrides are a separate mechanism and often the better answer for pure styling - units, colour, thresholds on one series - with no data reshaping at all.',
    ],
    traps: [
      'Using a transformation to filter out most of the data. The data was already fetched; you have saved nothing and slowed the browser.',
      'Assuming transformations apply to alert rule evaluation. Alerting uses server-side expressions instead.',
    ],
    followUps: [
      'How would you build a table of every service with its error rate and p99?',
      'What is the difference between a transformation and a field override?',
    ],
    tags: ['grafana', 'panels', 'transformations'],
  },
  {
    id: 'itv-graf-10',
    level: 'advanced',
    kind: 'open',
    prompt:
      'Prometheus does not scale to your retention and cardinality needs. Walk me through the options.',
    probing:
      'Scaling observability is a senior topic. They want the trade-offs, not a product recommendation.',
    answer: [
      'First I would check the problem is real. A single Prometheus handles a surprising amount - millions of active series on a well-specified node - and the usual cause of pain is **cardinality**, not scale. Dropping a handful of high-cardinality labels with `metric_relabel_configs` often solves the whole problem without new infrastructure.',
      'If it is genuinely scale, the first step is **functional sharding**: several Prometheus servers each scraping a subset of targets, and a Grafana data source per shard, or one Thanos Query in front so they look like one. This is cheap and needs no new storage system.',
      '**Thanos** adds a sidecar that ships TSDB blocks to object storage, a Query component that fans out and deduplicates across shards, a Compactor that downsamples for long ranges, and a Store Gateway that serves historical data from the bucket. Its strength is that you keep normal Prometheus servers and bolt long-term storage on; its weakness is the number of moving parts.',
      '**Mimir** takes the other approach: Prometheus remote-writes into a horizontally scalable, natively multi-tenant system, and Prometheus becomes a thin forwarder. Better for very large estates and for hard tenant isolation; a bigger commitment, and now the write path is a service that can be down.',
      'For Grafana specifically, the change is small - both speak PromQL - but I would keep the per-shard data sources available too, because when the aggregation layer is unhealthy you want a way to query a single Prometheus directly.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which scaling step do you actually need?',
        caption: 'Most teams reaching for Thanos needed a relabel rule.',
        question: 'What is actually hurting?',
        branches: [
          {
            condition: 'Memory grows without target growth',
            result: 'Fix cardinality first',
            detail: 'metric_relabel_configs to drop or aggregate away the offending label',
            tone: 'success',
          },
          {
            condition: 'Too many targets for one server',
            result: 'Shard by function or by hashmod',
            detail: 'several Prometheus servers, one query layer in front',
            tone: 'accent',
          },
          {
            condition: 'Need a year of history, cheaply',
            result: 'Thanos or Mimir on object storage',
            detail: 'downsampling makes long ranges fast and cheap',
            tone: 'accent',
          },
          {
            condition: 'Hard per-tenant isolation required',
            result: 'Mimir',
            detail: 'native multi-tenancy with per-tenant limits',
            tone: 'warning',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Killing cardinality before buying infrastructure',
        language: 'yaml',
        explanation:
          'metric_relabel_configs runs after the scrape, before storage - so dropped labels never cost anything.',
        code: `scrape_configs:
  - job_name: checkout
    metric_relabel_configs:
      # Drop a label that carries a user id - the usual cardinality killer
      - regex: 'user_id'
        action: labeldrop

      # Drop an entire metric you never query
      - source_labels: [__name__]
        regex: 'go_gc_duration_seconds.*'
        action: drop

      # Collapse a high-cardinality path into a route template
      - source_labels: [path]
        regex: '/api/users/[0-9]+'
        target_label: path
        replacement: '/api/users/:id'`,
      },
      {
        title: 'Finding what is costing you',
        language: 'bash',
        explanation: 'Prometheus tells you exactly which metric and label are to blame.',
        code: `# The TSDB status page ranks series by metric name and by label
curl -s localhost:9090/api/v1/status/tsdb | jq '.data.seriesCountByMetricName[:10]'

# How many series does one metric have?
count({__name__="http_requests_total"})

# Which label is exploding? Count distinct values
count(count by (path) (http_requests_total))

# Total active series - the number that decides your memory
prometheus_tsdb_head_series`,
      },
    ],
    deeper: [
      'Downsampling is the hidden benefit of Thanos and Mimir. A 90-day dashboard reads 5-minute resolution blocks rather than 15-second raw data, which is what makes long-range panels fast.',
      'Remote write is not free: it adds a queue, a failure mode and back-pressure to every Prometheus. Monitor `prometheus_remote_storage_samples_pending` or you will discover gaps after the fact.',
      'Whatever you deploy, keep a plain Prometheus per cluster for local alerting. The global query layer should not be in the path of "is this cluster up".',
    ],
    traps: [
      'Jumping to Thanos when a single relabel rule would have fixed it.',
      'Assuming remote write is lossless under back-pressure. It drops when the queue fills.',
    ],
    followUps: [
      'How does Thanos deduplicate data from two replicas?',
      'What does X-Scope-OrgID do in Mimir?',
      'How would you find your top ten metrics by series count?',
    ],
    tags: ['prometheus', 'scaling', 'thanos', 'mimir'],
  },
  {
    id: 'itv-graf-11',
    level: 'basic',
    kind: 'open',
    prompt: 'What is Grafana Explore, and how does it differ from a dashboard?',
    probing:
      'Whether you actually use the tool day to day. Explore is where real debugging happens.',
    answer: [
      'A dashboard answers questions you already knew you would ask. **Explore** is for the questions an incident just raised: a single query box against one data source, no panel to save, built for iterating quickly.',
      'Two features make it the debugging tool of choice. **Split view** puts two panes side by side - metrics on the left, logs on the right - with a shared time range, so you can line up an error-rate spike against the logs from that exact minute.',
      'And **data-source linking**: from a Loki log line you can jump to the trace it mentions in Tempo, and from a trace span back to the logs for that pod. That is what people mean by correlated observability, and it is configured on the data source, not the dashboard.',
      'The workflow that follows is worth mentioning: explore until you have a query worth keeping, then use "Add to dashboard" to promote it. Dashboards should accumulate from real investigations rather than being designed up front.',
    ],
    traps: [
      'Forgetting that Explore ignores dashboard folder permissions - anyone with data-source access can query anything in it.',
    ],
    followUps: [
      'How do you set up a link from a log line to a trace?',
      'When would you promote an Explore query into a dashboard?',
    ],
    tags: ['grafana', 'explore', 'debugging'],
  },
  {
    id: 'itv-graf-12',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you design dashboards for a platform with 200 microservices without building 200 dashboards?',
    probing:
      'Dashboard architecture at scale. A senior answer is about hierarchy and generation, not about panels.',
    answer: [
      'I would build a **three-level hierarchy**, not a flat pile.',
      'At the top, one **overview** dashboard showing service health as a grid - one cell per service, coloured by SLO burn or error ratio. It answers "is anything wrong" in a glance and nothing else. It is generated from a query, so a new service appears without anybody editing it.',
      'In the middle, one **templated service dashboard** with a `service` variable. It shows the RED metrics - Rate, Errors, Duration - plus saturation, dependencies and deploy markers. One JSON file serves all 200 services because every service is instrumented to the same standard. That standard is the real work: it means a shared instrumentation library so `http_requests_total` means the same thing everywhere.',
      'At the bottom, a small number of hand-written **deep-dive** dashboards for the genuinely unusual services - the database, the queue, the payment gateway - where domain-specific panels earn their place.',
      'Everything is generated and provisioned. For the generation step I would use Grafonnet or the Foundation SDK, so the overview grid and per-service dashboards come from one definition of what a service dashboard is. And I would pair every dashboard with a **runbook link in the alert annotation**, because a dashboard without a next action is just a picture.',
      'The failure mode I would be explicitly guarding against is dashboard sprawl: hundreds of near-duplicates, no owner, nobody sure which is current. Generated dashboards with `allowUiUpdates: false` make that structurally impossible.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Three levels, one source of truth',
        caption: 'Every level is generated from the same service catalogue.',
        nodes: [
          {
            label: 'Service catalogue',
            detail: 'name, team, tier, SLO - in Git',
            tone: 'accent',
          },
          {
            label: 'Generator',
            detail: 'Grafonnet or Foundation SDK, run in CI',
            arrowLabel: 'renders',
          },
          {
            label: 'Overview grid',
            detail: 'one cell per service, red means burning error budget',
            arrowLabel: 'level 1',
            tone: 'success',
          },
          {
            label: 'Templated service dashboard',
            detail: 'RED metrics, one JSON for all services',
            arrowLabel: 'level 2',
            tone: 'success',
          },
          {
            label: 'Deep dives',
            detail: 'hand-written, only where domain knowledge is needed',
            arrowLabel: 'level 3',
          },
        ],
      },
    ],
    deeper: [
      'Deploy annotations are the highest-value, lowest-effort addition to any dashboard. A vertical line at each release turns "when did this start?" from an investigation into a glance.',
      'The kube-prometheus-stack mixins are a good model: dashboards defined in Jsonnet, versioned, and regenerated rather than edited.',
      'Standardise metric names before you standardise dashboards. A templated dashboard is only possible because every service emits the same names - that is an instrumentation-library decision.',
    ],
    traps: [
      'Letting each team hand-build its own dashboard. You get 200 different definitions of "error rate".',
      'Putting 60 panels on the overview. An overview that needs scrolling is not an overview.',
    ],
    followUps: [
      'What are RED and USE methods?',
      'How would you add deploy annotations?',
      'How do you stop dashboard sprawl once it has started?',
    ],
    tags: ['grafana', 'dashboards', 'scale', 'design'],
  },
]
