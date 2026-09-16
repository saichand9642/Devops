import type { InterviewQuestion } from '../../../types'

/** Running Splunk: clustering, configuration, apps, access control and cost. */
export const splunkOperationsQuestions: InterviewQuestion[] = [
  {
    id: 'itv-splunk-21',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does indexer clustering work, and what does the replication factor control?',
    probing: 'High availability for the data tier.',
    answer: [
      'An **indexer cluster** replicates data across indexers so the loss of one does not lose data or make it unsearchable. A **cluster master** coordinates - it decides which peer holds which bucket copy and manages recovery when a peer fails.',
      'Two numbers control it. The **replication factor** is how many copies of the raw data exist: with RF=3 you can lose two indexers without losing data. The **search factor** is how many of those copies are **searchable** - copies with the index files built, not just the compressed raw data. With SF=2 you can lose one indexer and still search everything immediately.',
      'The distinction matters because a non-searchable copy has the data but has to have its index files rebuilt before it can serve searches, which takes time. SF must be less than or equal to RF, and a common configuration is RF=3, SF=2.',
      'The cost is storage and indexing work: RF=3 means roughly three times the raw storage, and SF=2 means index files maintained twice. That is the price of not losing data.',
      'For the search tier, a **search head cluster** replicates knowledge objects - saved searches, dashboards, lookups - across members and provides a captain that coordinates scheduled searches so they are not run by every member. The **deployer** pushes apps to the cluster rather than configuring members individually.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'A clustered deployment',
        caption:
          'RF protects the data; SF determines how quickly it is searchable after a failure.',
        root: {
          label: 'Splunk deployment',
          children: [
            {
              label: 'Search head cluster',
              detail: 'Captain coordinates; knowledge objects replicated',
              tone: 'accent',
            },
            {
              label: 'Indexer cluster (RF=3, SF=2)',
              detail: 'Three copies of data, two searchable',
              tone: 'success',
            },
            {
              label: 'Cluster master',
              detail: 'Coordinates bucket placement and recovery',
              tone: 'warning',
            },
            {
              label: 'Deployer / deployment server',
              detail: 'Pushes apps and inputs out',
              tone: 'muted',
            },
          ],
        },
      },
    ],
    traps: [
      'Setting RF without accounting for the storage multiplication.',
      'SF greater than RF, which is invalid.',
      'Treating the cluster master as optional - it is a single point of coordination and needs its own availability plan.',
      'Configuring cluster members individually instead of through the deployer, so they drift.',
    ],
    followUps: [
      'What is the difference between replication factor and search factor?',
      'What happens when an indexer fails in a clustered deployment?',
    ],
    tags: ['clustering', 'replication factor', 'high availability', 'architecture'],
  },
  {
    id: 'itv-splunk-22',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How is Splunk configured? Explain the configuration file precedence.',
    probing:
      'The `.conf` file layering, which is a genuine source of confusion and of hard-to-diagnose problems.',
    answer: [
      'Configuration lives in `.conf` files - `inputs.conf`, `props.conf`, `transforms.conf`, `indexes.conf`, `outputs.conf`, `savedsearches.conf` and others - spread across a directory hierarchy, and the same setting can appear in several places.',
      'The layering, from lowest precedence to highest: **`$SPLUNK_HOME/etc/system/default`** (shipped defaults - never edit these, they are overwritten on upgrade), then **app default** directories, then **app local** directories, then **`etc/system/local`**, which wins over everything else.',
      "The rule is that you **always edit `local`, never `default`**. An app ships its settings in `default`; you override them in the same app's `local`. Editing `default` means your change is lost the next time the app is updated, and there is no record that you made it.",
      'There is a second dimension: for some files, precedence also depends on **context** - whether the setting is being applied globally, per app, or per user - which makes tracing a value genuinely non-trivial.',
      'The tool that resolves all of this is **`btool`**, which shows the effective merged configuration and, with `--debug`, which file each setting came from. It is the first thing to reach for when a setting does not appear to be taking effect.',
    ],
    code: [
      {
        title: 'btool: what is actually in effect, and from where',
        language: 'bash',
        code: `# The merged, effective configuration
$SPLUNK_HOME/bin/splunk btool inputs list --debug

# Which file is setting this sourcetype's line breaking?
$SPLUNK_HOME/bin/splunk btool props list access_combined --debug

# Check an app's configuration specifically
$SPLUNK_HOME/bin/splunk btool --app=my_app inputs list --debug

# Validate before restarting
$SPLUNK_HOME/bin/splunk btool check`,
        explanation:
          '--debug prefixes each line with the file it came from, which is what makes precedence traceable.',
      },
    ],
    traps: [
      'Editing files in `default`, losing changes on upgrade.',
      'The same stanza defined in several apps, with the winner determined by alphabetical app name - a genuinely surprising rule.',
      'Changing configuration and not restarting, or restarting the wrong component.',
      'Guessing at precedence instead of running `btool`.',
    ],
    followUps: [
      'A setting is not taking effect. How do you find out why?',
      'Why should you never edit files in `default`?',
    ],
    tags: ['configuration', 'conf files', 'btool', 'precedence'],
  },
  {
    id: 'itv-splunk-23',
    level: 'basic',
    kind: 'open',
    prompt: 'What is an app in Splunk, and what does it contain?',
    probing: 'The packaging model.',
    answer: [
      'An **app** is a packaged collection of configuration and content: inputs, field extractions, sourcetype definitions, saved searches, dashboards, lookups, and sometimes custom search commands and visualisations. It is how Splunk functionality is distributed and how configuration is organised.',
      'A **technology add-on (TA)** is a specific kind of app that handles **getting data in and normalising it** - the input definitions, parsing rules, field extractions and CIM mappings for a particular product. `Splunk_TA_nix`, `Splunk_TA_windows`, the AWS add-on and so on. Add-ons are typically installed on forwarders and indexers; apps with dashboards go on search heads.',
      'Splunkbase hosts a large library of both, which means for most common data sources - a firewall vendor, a cloud provider, a database - someone has already written the parsing and CIM mapping. Writing your own for a supported product is usually wasted effort.',
      "Organisationally, apps are also how you **separate configuration by team or purpose**, with permissions set per app. That keeps one team's saved searches and extractions from colliding with another's.",
    ],
    code: [
      {
        title: 'App directory structure',
        language: 'text',
        code: `$SPLUNK_HOME/etc/apps/my_app/
├── default/               # shipped configuration - do not edit
│   ├── app.conf
│   ├── inputs.conf
│   ├── props.conf
│   ├── transforms.conf
│   └── savedsearches.conf
├── local/                 # YOUR overrides go here
│   └── inputs.conf
├── metadata/
│   ├── default.meta       # default permissions
│   └── local.meta         # permission overrides
├── bin/                   # scripted inputs, custom commands
├── lookups/               # CSV lookup tables
└── static/                # icons, images`,
      },
    ],
    traps: [
      'Installing an app on the wrong tier - add-ons on search heads do nothing useful for parsing.',
      "Editing an app's `default` directory rather than `local`.",
      'Writing custom parsing for a product that has a supported TA on Splunkbase.',
    ],
    followUps: ['Where would you install a technology add-on, and why?'],
    tags: ['apps', 'add-ons', 'splunkbase', 'packaging', 'fundamentals'],
  },
  {
    id: 'itv-splunk-24',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you control who can see what data in Splunk?',
    probing: 'Access control, which matters because logs frequently contain sensitive data.',
    answer: [
      'The primary mechanism is **roles**. A role has capabilities (what actions the user can perform) and **`srchIndexesAllowed`** (which indexes they can search). A user gets one or more roles, and their access is the union.',
      'That makes **index design an access-control decision**, not just a storage one. If HR logs and application logs are in the same index, you cannot separate access to them without additional filtering. Putting sensitive data in its own index from the start is much easier than separating it later.',
      'For finer control there is **search filtering** - `srchFilter` on a role appends a filter to every search that role runs, so a team can be restricted to `host=web-*` within a shared index. It works, and it is more fragile than index separation because it depends on the filter being correct and on the data having the field it filters on.',
      'There is also **field-level masking** at index time, using `SEDCMD` in `props.conf` to redact patterns - card numbers, national insurance numbers - before the data is written. That is the right approach for data that should never be stored in the clear, because unlike search-time filtering it cannot be bypassed.',
      'And for **knowledge objects** - saved searches, dashboards, lookups - permissions are set per object with private, app-level or global scope, plus read and write per role.',
    ],
    code: [
      {
        title: 'Role-based index access and a search filter',
        language: 'text',
        code: `# authorize.conf
[role_app_team]
importRoles = user
srchIndexesAllowed = app;web
srchIndexesDefault = app
srchFilter = host=app-* OR host=web-*
srchJobsQuota = 5
rtSrchJobsQuota = 0                   # no real-time searches for this role

[role_security]
importRoles = user
srchIndexesAllowed = *
srchDiskQuota = 10000`,
      },
      {
        title: 'Redact sensitive data before it is indexed',
        language: 'text',
        code: `# props.conf - masks card numbers at index time, permanently
[payment_logs]
SEDCMD-mask_card = s/\\d{4}-\\d{4}-\\d{4}-(\\d{4})/XXXX-XXXX-XXXX-\\1/g
SEDCMD-mask_ssn  = s/\\d{3}-\\d{2}-\\d{4}/XXX-XX-XXXX/g`,
        explanation:
          'Index-time masking cannot be bypassed by a user with search access, unlike a search filter.',
      },
    ],
    traps: [
      'Sensitive and non-sensitive data in the same index, forcing reliance on fragile search filters.',
      'Relying on `srchFilter` for a compliance requirement, where index-time redaction is what is actually needed.',
      'Over-broad roles, where everyone gets `srchIndexesAllowed = *` because it is easier.',
      'No search quotas, so one user can consume the platform.',
    ],
    followUps: [
      'Why is index design an access-control decision?',
      'When is search filtering not sufficient?',
    ],
    tags: ['rbac', 'roles', 'security', 'access control', 'redaction'],
  },
  {
    id: 'itv-splunk-25',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you reduce Splunk costs?',
    probing: 'A very common real pressure, with a structured answer rather than "log less".',
    answer: [
      'Splunk is traditionally licensed by **daily ingest volume**, so cost reduction means reducing what is indexed, and the work is to do that without losing the data you actually need.',
      'First **measure**: `index=_internal` licence usage by sourcetype and by host. It is almost always concentrated - two or three sources are most of the volume, and one of them is usually something nobody meant to send.',
      'Then **filter at the forwarder**. Route noise to `nullQueue` before it crosses the network: health check requests, debug logging in production, repetitive status lines, verbose framework output. This is the highest-value change and it is usually a one-line transform.',
      'Then **trim the events**: stop logging full request and response bodies, drop stack traces from non-error lines, and remove fields the application emits that nobody has ever searched.',
      "Then **route by value**: send high-volume, low-value data somewhere cheaper - object storage, or a different tool - and keep Splunk for what is genuinely searched. Splunk's own archiving and federated search options make this less painful than it used to be.",
      'Then **retention**: check whether the retention on each index matches an actual requirement. Long retention is often inherited rather than chosen, and storage is a real cost even where ingest is the licensed unit.',
      'And structurally, consider the **workload-based pricing** models if you are on an ingest licence - depending on usage patterns the economics can be quite different.',
      'The thing to avoid is blanket cuts. Losing the log line that would have explained an incident costs more than it saved.',
    ],
    code: [
      {
        title: 'Find the volume, then target it',
        language: 'text',
        code: `# Where is the licence going?
index=_internal source=*license_usage.log type=Usage earliest=-7d
| stats sum(b) as bytes by st, h
| eval GB=round(bytes/1024/1024/1024, 2)
| sort -GB | head 20

# Is anything being indexed that nobody ever searches?
index=_audit action=search earliest=-30d
| rex field=search "index\\s*=\\s*\\"?(?<idx>[\\w_*-]+)"
| stats count by idx
| sort count`,
        explanation:
          'The second search finds indexes nobody queries - strong candidates for reduced retention or removal.',
      },
    ],
    traps: [
      'Blanket filtering that removes the data needed for the next incident.',
      'Filtering at the indexer rather than the forwarder, so the bandwidth is still used.',
      'Reducing retention without checking compliance requirements.',
      'A one-off cleanup with no ongoing monitoring, so volume grows straight back.',
    ],
    followUps: [
      'What is the risk of aggressive filtering?',
      'How would you find data that is indexed but never searched?',
    ],
    tags: ['cost', 'licensing', 'ingest', 'filtering', 'advanced'],
  },
  {
    id: 'itv-splunk-26',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What is the difference between a lookup and a data model?',
    probing: 'Two enrichment mechanisms that are sometimes confused.',
    options: [
      {
        id: 'a',
        text: 'A lookup enriches events with fields from an external table; a data model is a structured description of a dataset used for acceleration and reporting',
      },
      { id: 'b', text: 'They are the same, with different names' },
      { id: 'c', text: 'A lookup is for security data and a data model for operational data' },
      { id: 'd', text: 'A data model stores raw events and a lookup does not' },
    ],
    correct: ['a'],
    answer: [
      'A **lookup** joins events to an external table - usually a CSV or a database query - adding fields. Mapping a host name to its owning team, an IP to a location, a product code to a description. It is enrichment: adding context the event does not carry.',
      'A **data model** is a **structured definition of a dataset**: which events belong to it and what fields they have, in a consistent hierarchy. Its main purposes are to enable **acceleration** for fast searching and to provide a consistent interface for reporting and for apps like Enterprise Security.',
      'They are complementary and often used together: a lookup adds the `team` field to events, and the data model includes it so `tstats` can aggregate by team quickly.',
      'The practical detail about lookups is that **automatic lookups** (configured in `props.conf`) apply to every search against a sourcetype without anyone writing `| lookup`. That is convenient and costs something on every search, so a large automatic lookup applied to a high-volume sourcetype is worth thinking about.',
    ],
    code: [
      {
        title: 'Lookup enrichment, and an automatic one',
        language: 'text',
        code: `# Explicit lookup in a search
index=web
| lookup host_owners host OUTPUT team, oncall_rota
| stats count by team

# Automatic lookup - applies to every search of this sourcetype
# props.conf
# [access_combined]
# LOOKUP-owners = host_owners host OUTPUT team, oncall_rota

# A lookup backed by a scheduled search rather than a static file
| inputlookup host_owners.csv
| eval updated=strftime(now(), "%F")
| outputlookup host_owners.csv`,
      },
    ],
    traps: [
      'A large automatic lookup on a high-volume sourcetype, adding cost to every search.',
      'Lookup tables that go stale because nothing updates them.',
      'Case sensitivity in lookup matching, which silently fails to match.',
    ],
    followUps: ['What is the cost of an automatic lookup?'],
    tags: ['lookups', 'data models', 'enrichment', 'fundamentals'],
  },
  {
    id: 'itv-splunk-27',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Data has stopped arriving in an index. Nobody changed anything. How do you investigate?',
    probing: 'A very common operational problem, worked through systematically.',
    answer: [
      'I would work **backwards from the index towards the source**, because that order eliminates whole layers quickly.',
      '**Is anything arriving at all?** Search the index with a wide time range. If some hosts are reporting and others are not, it is a source-side problem; if nothing at all is arriving, it is further along the path.',
      "**Is the forwarder connected?** `index=_internal` has the forwarder's own logs, and the indexer's metrics show which forwarders are sending. A forwarder that has stopped connecting shows up immediately here.",
      "**Is the forwarder running and reading the file?** On the host, check the process, then check the forwarder's log for the file in question. The most common cause is that the file was **rotated in a way the forwarder did not follow** - renamed rather than truncated, or moved to a path the input does not monitor. The second most common is a **permissions change** after a deployment, so the forwarder can no longer read the file.",
      '**Is the data being dropped after arrival?** A `nullQueue` transform someone added for a different purpose can match more than intended. `btool` shows the effective props and transforms for that sourcetype.',
      '**Is the licence exceeded?** On some licence types, exceeding the quota stops indexing. `index=_internal` licence usage shows this.',
      '**Is the disk full on the indexer?** Splunk stops indexing when a volume drops below its minimum free space, and it logs this clearly.',
      'The thing to bear in mind is that "nobody changed anything" is usually false - a log rotation policy, a deployment that changed file permissions, or a retention change are all changes that nobody thinks of as changes.',
    ],
    code: [
      {
        title: 'Working backwards from the index',
        language: 'text',
        code: `# 1. What is the most recent event, and from which hosts?
| tstats latest(_time) as last_seen where index=web by host
| eval age_minutes=round((now()-last_seen)/60, 0)
| sort -age_minutes

# 2. Are the forwarders connecting?
index=_internal sourcetype=splunkd component=TcpInputProc earliest=-1h
| stats latest(_time) as last by hostname

# 3. Is anything being dropped or erroring?
index=_internal sourcetype=splunkd log_level IN (ERROR, WARN) earliest=-2h
| stats count by component, message | sort -count

# 4. Licence and disk
index=_internal source=*license_usage.log type=RolloverSummary earliest=-7d
index=_internal component=DiskMon OR "insufficient disk space"`,
      },
      {
        title: 'On the forwarder itself',
        language: 'bash',
        code: `# Is it running, and what does it think it is monitoring?
$SPLUNK_HOME/bin/splunk status
$SPLUNK_HOME/bin/splunk list monitor

# Its own log - file not found, permission denied, rotation issues
tail -100 $SPLUNK_HOME/var/log/splunk/splunkd.log | grep -Ei 'error|warn|permission|not found'

# Can the forwarder user actually read it?
sudo -u splunk head -1 /var/log/app/application.log`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Working backwards to find where data stopped',
        caption:
          'Each step eliminates a layer. Log rotation and permissions are the two most common causes.',
        nodes: [
          {
            label: 'Some hosts or none?',
            detail: 'Narrows to source-side or path',
            tone: 'accent',
          },
          { label: 'Are forwarders connecting?', detail: 'index=_internal on the indexer' },
          { label: 'Is the forwarder running and reading?', detail: 'splunk list monitor' },
          {
            label: 'Rotation or permissions changed?',
            detail: 'The usual culprits',
            tone: 'warning',
          },
          { label: 'Dropped by a transform?', detail: 'btool props for the sourcetype' },
          { label: 'Licence exceeded or disk full?', detail: 'Both stop indexing', tone: 'danger' },
        ],
      },
    ],
    deeper: [
      '`splunk list monitor` on the forwarder shows exactly which files it is tracking - often the fastest way to see that the path changed.',
      'Log rotation that renames rather than truncates can leave the forwarder holding the old inode. `crcSalt` and correct `followTail` settings address this.',
      'Set up an alert on **data absence** per index and per source - "no events from this sourcetype in 30 minutes" - so this is detected rather than reported by a user.',
    ],
    traps: [
      'Believing "nothing changed" - log rotation, deployments and permission changes all count.',
      'Restarting the forwarder before looking at its log, losing the evidence.',
      'Looking only at the indexer when the problem is on the host.',
      'No monitoring for data absence, so the gap is discovered days later.',
    ],
    followUps: [
      'How would you detect this automatically next time?',
      'Why does log rotation so often break file monitoring?',
    ],
    tags: ['scenario', 'troubleshooting', 'forwarders', 'ingest', 'advanced'],
  },
  {
    id: 'itv-splunk-28',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do you build a dashboard that is useful and does not slow the platform down?',
    probing: 'Dashboard design plus the performance consequence, which people forget.',
    answer: [
      'The design half is the same as anywhere: know **who opens this and why**. An incident dashboard needs to answer "is it broken and where" in seconds; a capacity dashboard is a different artefact. Mixing them produces something that serves neither.',
      'Practically: the **summary at the top** - error rate, volume, latency - and detail below. **Time range as an input**, not hardcoded. **Consistent layout** across services so familiarity transfers. And **fewer panels chosen deliberately** rather than every metric that exists.',
      'The performance half is specific to Splunk and frequently overlooked: **every panel is a search**. A dashboard with twelve panels, opened by twenty people, is 240 searches. If they run over 30 days of raw events, that dashboard alone can saturate the platform.',
      'The fixes: **base searches** with post-process, so several panels share one search rather than each running their own. **Accelerated data models** or **summary indexes**, so panels read pre-computed results. **Scheduled reports** backing panels, so the search runs once on a schedule regardless of how many people look. And **sensible default time ranges** - a dashboard defaulting to "All time" is a platform hazard.',
      'The rule I would apply: a dashboard that many people open should read **summarised data**, not raw events. Recomputing the same aggregation per viewer is pure waste.',
    ],
    code: [
      {
        title: 'One base search feeding several panels',
        language: 'text',
        code: `<dashboard>
  <search id="base">
    <query>
      index=web sourcetype=access_combined
      | fields status, uri_path, duration, host
    </query>
    <earliest>$time.earliest$</earliest>
    <latest>$time.latest$</latest>
  </search>

  <row>
    <panel>
      <chart>
        <search base="base">
          <query>| stats count by status</query>
        </search>
      </chart>
    </panel>
    <panel>
      <table>
        <search base="base">
          <query>| stats avg(duration) as avg_ms by uri_path | sort -avg_ms | head 10</query>
        </search>
      </table>
    </panel>
  </row>
</dashboard>`,
        explanation:
          'One search runs; both panels post-process its results. Without this, each panel searches independently.',
      },
    ],
    traps: [
      'Every panel running its own full search over raw events.',
      'A default time range of "All time".',
      'Real-time panels, which hold resources continuously.',
      'Twenty panels, so nobody can find the signal during an incident.',
    ],
    followUps: [
      'A dashboard is opened by fifty people. How do you make that cheap?',
      'What would you put on a dashboard used during an incident?',
    ],
    tags: ['dashboards', 'performance', 'base searches', 'design'],
  },
  {
    id: 'itv-splunk-29',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the Splunk Common Information Model (CIM)?',
    probing: 'Normalisation, which is what makes cross-source correlation possible.',
    options: [
      {
        id: 'a',
        text: 'A set of standard field names and data models, so events from different vendors can be searched and correlated consistently',
      },
      { id: 'b', text: 'Splunk’s internal storage format' },
      { id: 'c', text: 'A licensing model based on data volume' },
      { id: 'd', text: 'The configuration file format used by apps' },
    ],
    correct: ['a'],
    answer: [
      'The CIM is a **normalisation standard**: a set of data models with agreed field names for common concepts. Authentication events from any source have `user`, `src`, `dest`, `action` regardless of what the vendor originally called them.',
      'The value is that a detection or a dashboard written against the CIM works across **every** data source that maps to it. Without it, "failed logins" has to be written separately for Linux, Windows, the VPN, the cloud provider and every application - and each one breaks independently when a log format changes.',
      "This is why Splunk apps like **Enterprise Security** work at all: they are written against CIM field names, so installing the right technology add-on for a product makes all of ES's content work against it immediately.",
      "The practical implication is that **CIM mapping is worth doing at ingest time**, through the vendor's technology add-on where one exists. It is unglamorous work, and skipping it means every subsequent search is source-specific.",
    ],
    code: [
      {
        title: 'One search across every authentication source',
        language: 'text',
        code: `# Works for Linux, Windows, VPN, cloud - anything CIM-mapped
| tstats summariesonly=true count from datamodel=Authentication
  where Authentication.action=failure earliest=-24h
  by Authentication.user, Authentication.src, Authentication.dest

# Without CIM this would be several source-specific searches, each
# using different field names, appended together.`,
      },
    ],
    traps: [
      'Ingesting data without CIM mapping and then writing per-source searches forever.',
      'Assuming an add-on maps to CIM - check, because not all do completely.',
      'Custom field names that almost match CIM but do not, which silently break data model searches.',
    ],
    followUps: ['Why does Enterprise Security depend on CIM?'],
    tags: ['cim', 'normalisation', 'data models', 'security'],
  },
  {
    id: 'itv-splunk-30',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you design a Splunk deployment for a company ingesting 1 TB per day?',
    probing: 'Capacity planning and architecture at a scale where the design actually matters.',
    answer: [
      'At 1 TB/day the design decisions are about **indexer capacity, storage tiering and search isolation**.',
      '**Indexers** are the main sizing question. A rough planning figure is around 100-200 GB/day per indexer for indexing plus a reasonable search load, so 1 TB/day suggests something in the range of 8-12 indexers before accounting for replication and headroom. Reference hardware matters - fast local disk for hot and warm buckets is not optional.',
      '**Replication** multiplies storage: RF=3 means three copies of the raw data. With compression, 1 TB/day of raw data is perhaps 400-500 GB indexed per day per copy, so the storage arithmetic has to be done deliberately against the retention requirement.',
      '**Storage tiering** is where the cost is controlled. Hot and warm on fast local disk sized for the period people actually search interactively; cold on cheaper storage; and **SmartStore** with object storage for anything longer, which decouples retention from indexer disk entirely and is the single biggest change available at this scale.',
      '**Search head cluster** of at least three members for availability and to spread the scheduled search load, with the captain coordinating so scheduled searches run once.',
      '**Separation of workloads** matters at this size: ad-hoc user searches, scheduled searches and a security app like ES competing for the same indexers is how everything becomes slow. Search head clustering plus workload management to reserve capacity per class of search is what keeps interactive searches responsive.',
      'And **ingest reduction first**. Before sizing for 1 TB, I would check how much of it is worth indexing - it is common to find 20-30% is debug logging, health checks or duplicated data. Reducing it is cheaper than every other option on this list.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'A 1 TB/day deployment',
        caption:
          'SmartStore is the change that most decouples retention cost from indexer capacity.',
        root: {
          label: 'Splunk platform - 1 TB/day',
          children: [
            {
              label: 'Search head cluster (3+)',
              detail: 'Availability, scheduled search distribution',
              tone: 'accent',
            },
            {
              label: 'Indexer cluster (8-12, RF=3 SF=2)',
              detail: 'Fast local disk for hot/warm',
              tone: 'success',
            },
            {
              label: 'SmartStore on object storage',
              detail: 'Warm and cold decoupled from indexer disk',
              tone: 'success',
            },
            {
              label: 'Heavy forwarders / intermediate tier',
              detail: 'Filtering and routing before ingest',
              tone: 'warning',
            },
            {
              label: 'Deployment server + cluster master',
              detail: 'Configuration management',
              tone: 'muted',
            },
          ],
        },
      },
    ],
    deeper: [
      'Indexer sizing depends heavily on the search load, not just ingest. A deployment with heavy scheduled searching needs considerably more than one doing pure ingest.',
      'SmartStore changes the economics substantially - indexers need enough local disk for a working cache rather than for the full retention period.',
      "Workload management lets you guarantee that an analyst's ad-hoc search is not starved by scheduled reports.",
      'Plan for growth: 1 TB/day today is frequently 2 TB in eighteen months, and the architecture should scale by adding indexers rather than by redesign.',
    ],
    traps: [
      'Sizing for ingest and ignoring the search load.',
      'Under-provisioning disk speed on indexers, which is usually the real bottleneck.',
      'Forgetting the replication multiplier in storage planning.',
      'Sizing for the volume you currently receive rather than the volume worth indexing.',
    ],
    followUps: [
      'What would you check before sizing for 1 TB?',
      'How does SmartStore change the storage design?',
    ],
    tags: ['capacity planning', 'architecture', 'smartstore', 'scale', 'advanced'],
  },
  {
    id: 'itv-splunk-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is a summary index and when would you use one?',
    probing: 'A pre-aggregation technique that predates data model acceleration.',
    answer: [
      'A **summary index** holds the **results of a scheduled search** rather than raw events. A search runs hourly, aggregates something expensive, and writes a small number of summary events into a dedicated index. Dashboards and reports then search the summary, which is tiny and fast, instead of recomputing over raw data.',
      'It is worth it when the same expensive aggregation is needed repeatedly - a daily report over a month of data, a dashboard panel showing a long trend, or a search whose cost grows with retention.',
      'The advantages over data model acceleration are that it is **simple and explicit** - you control exactly what is stored and for how long - and it can summarise **anything a search can compute**, including things a data model cannot express.',
      'The disadvantages are that it is **not automatic**: you maintain the scheduled search, and if it fails or is skipped there is a **gap** in the summary that will not fill itself. Backfilling requires running the search for the missed period manually. And a change to the summarisation logic does **not** apply retroactively.',
      'In modern deployments, **accelerated data models** cover most of what summary indexes were used for, with less maintenance. Summary indexes remain useful for bespoke aggregations that do not fit a data model, and for very long-term trend data where you want to keep summaries long after the raw data has been frozen.',
    ],
    code: [
      {
        title: 'Populating and reading a summary index',
        language: 'text',
        code: `# Scheduled hourly - writes a handful of events instead of scanning millions
index=web sourcetype=access_combined earliest=-1h@h latest=@h
| stats count as requests, count(eval(status>=500)) as errors,
        avg(duration) as avg_ms, perc95(duration) as p95_ms
  by service, host
| collect index=summary_web marker="report=hourly_web"

# The dashboard reads the summary - instant, regardless of retention
index=summary_web report=hourly_web earliest=-30d
| timechart span=1h sum(requests) as requests, sum(errors) as errors by service`,
      },
    ],
    traps: [
      'A skipped scheduled search leaving a permanent gap nobody notices.',
      'Double-counting from overlapping time ranges - the `earliest=-1h@h latest=@h` snapping matters.',
      'Changing the summarisation logic and forgetting that historical summaries used the old definition.',
      'Using a summary index where an accelerated data model would need no maintenance.',
    ],
    followUps: [
      'What happens if the populating search is skipped?',
      'When would you choose this over data model acceleration?',
    ],
    tags: ['summary index', 'performance', 'scheduled searches', 'reporting'],
  },
  {
    id: 'itv-splunk-32',
    level: 'basic',
    kind: 'open',
    prompt: 'How do you extract a field from an unparsed log line?',
    probing: 'A very practical everyday task.',
    answer: [
      'The quickest way in a search is **`rex`**, which applies a regular expression with **named capture groups** and creates fields from them. It is search-time, so it applies retroactively to all existing data and can be changed freely.',
      'For something you will use repeatedly, define it as a **field extraction on the sourcetype** - through the Field Extractor UI or in `props.conf` - so every search of that sourcetype gets the field without anyone writing `rex`.',
      'For structured formats there are better options than regex. **`spath`** parses JSON and XML, and if the sourcetype is set correctly Splunk parses JSON automatically. **Delimiter-based extraction** handles CSV and key-value pairs. Reaching for a regular expression on structured data is usually a sign the sourcetype is wrong.',
      'The practical advice: **use the Field Extractor** rather than writing regex by hand where you can. It generates the expression from examples and validates it against real events, which catches the cases a hand-written pattern misses.',
      'And test against **real varied events**, not one example. Log lines vary more than people expect, and a regex that matches the first ten events and not the eleventh produces silently incomplete results.',
    ],
    code: [
      {
        title: 'rex, spath, and a permanent extraction',
        language: 'text',
        code: `# Ad-hoc extraction with named capture groups
index=app "payment failed"
| rex field=_raw "order=(?<order_id>\\w+)\\s+amount=(?<amount>[\\d.]+)\\s+reason=(?<reason>[^,]+)"
| stats count, sum(amount) as total by reason

# Structured data - do not use regex for this
index=app sourcetype=json
| spath input=_raw path=request.headers.user_agent output=ua
| stats count by ua

# Permanent, in props.conf - every search gets it
# [my_sourcetype]
# EXTRACT-order = order=(?<order_id>\\w+)\\s+amount=(?<amount>[\\d.]+)`,
      },
    ],
    traps: [
      'Regex written against one example event, silently failing on variants.',
      'Using `rex` on JSON where `spath` or a correct sourcetype would parse it automatically.',
      'Greedy quantifiers matching far more than intended.',
      'Expensive regex applied to a high-volume sourcetype as an automatic extraction.',
    ],
    followUps: [
      'When should you use `spath` rather than `rex`?',
      'How would you make an extraction permanent?',
    ],
    tags: ['rex', 'field extraction', 'spath', 'regex', 'fundamentals'],
  },
  {
    id: 'itv-splunk-33',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these would you expect in a well-run Splunk deployment? Select all that apply.',
    probing: 'Operational maturity across configuration, cost and reliability.',
    options: [
      {
        id: 'a',
        text: 'Configuration managed as apps in version control and deployed through the deployment server',
      },
      { id: 'b', text: 'Monitoring of licence usage, with alerts before the quota is exceeded' },
      {
        id: 'c',
        text: 'Alerts on data absence per source, so a broken forwarder is detected rather than reported',
      },
      {
        id: 'd',
        text: 'All users given `srchIndexesAllowed = *` so nobody is blocked during an incident',
      },
      {
        id: 'e',
        text: 'Scheduled search times spread out, and heavy dashboards backed by accelerated data or summaries',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Giving everyone access to every index is the wrong one. Logs frequently contain personal data, credentials and business-sensitive information, and access should be scoped by role. "Nobody blocked during an incident" is solved by an escalation path or a break-glass role, not by making everything readable by default.',
      '**Configuration as apps in version control**, deployed centrally, is what makes a Splunk deployment reproducible and auditable rather than a set of servers somebody configured.',
      '**Licence monitoring with alerts before the quota** is important because exceeding it can stop indexing, and discovering that during an incident is the worst possible time.',
      '**Data absence alerts** catch the most common silent failure - a forwarder that stopped - which is otherwise found days later when someone searches for something that is not there.',
      '**Spread schedules and accelerated dashboards** are what keep the platform responsive as the number of saved searches grows.',
    ],
    code: [
      {
        title: 'Alert on data absence',
        language: 'text',
        code: `| tstats latest(_time) as last_seen where index=* earliest=-24h by index, sourcetype
| eval age_minutes=round((now()-last_seen)/60, 0)
| where age_minutes > 60
| lookup expected_sources index sourcetype OUTPUT expected_interval_minutes
| where age_minutes > (expected_interval_minutes * 2)
| table index, sourcetype, age_minutes, expected_interval_minutes`,
      },
    ],
    traps: [
      'Blanket index access because scoping is fiddly.',
      'Configuration changed directly on servers and not captured anywhere.',
      'Licence monitored only after indexing has already stopped.',
    ],
    followUps: ['How would you handle an analyst needing broader access during an incident?'],
    tags: ['best practices', 'operations', 'monitoring', 'security', 'advanced'],
  },
  {
    id: 'itv-splunk-34',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How would you correlate events across different data sources?',
    probing: 'The core value of a log platform, and what makes it hard.',
    answer: [
      'Correlation needs a **shared key** and **consistent field names**, and the difficulty is almost always one of those two.',
      'The shared key is usually a **transaction or trace ID** propagated through every service, a **user identifier**, a **session ID**, or a **source IP**. If the application does not propagate a correlation ID, the single most valuable change you can make is to add one - it turns correlation from guesswork into a join.',
      'Consistent field names come from **CIM normalisation**. Without it, one source calls it `src_ip`, another `clientIP`, another `remote_addr`, and every correlation needs manual aliasing. With it, a single search spans every source.',
      'The mechanisms: **`stats` with a `by` clause** on the shared key is the fastest and should be the default - it groups events from any source that share the key. **`transaction`** groups events into a single event with a duration, which is more expressive and much more expensive. **`join`** exists and should generally be avoided; it has result limits and poor performance, and `stats` can usually express the same thing.',
      'And **lookups** for enrichment where there is no shared key - mapping a host to an owning team so events from unrelated sources can be grouped by team.',
      'The practical advice: reach for `stats by` first, use `transaction` only when you genuinely need event ordering or duration within the group, and treat `join` as a last resort.',
    ],
    code: [
      {
        title: 'stats by, rather than join or transaction',
        language: 'text',
        code: `# Trace one request across the web tier, the app tier and the database
index=web OR index=app OR index=db earliest=-1h
| rex field=_raw "trace_id=(?<trace_id>[a-f0-9]{16})"
| stats min(_time) as start, max(_time) as end,
        values(index) as tiers,
        values(status) as statuses,
        count as events by trace_id
| eval duration_ms=round((end-start)*1000, 0)
| where duration_ms > 2000
| sort -duration_ms`,
      },
      {
        title: 'transaction, when you need the ordering',
        language: 'text',
        code: `# More expressive, considerably more expensive - use only when needed
index=app earliest=-1h
| transaction session_id maxspan=30m maxpause=5m
  startswith="login" endswith="logout"
| where duration > 3600
| table session_id, user, duration, eventcount`,
      },
    ],
    traps: [
      '`join`, which has a result limit that silently truncates and performs badly.',
      '`transaction` over a large dataset where `stats by` would work.',
      'No correlation ID propagated, making cross-service correlation guesswork based on timestamps.',
      'Field names not normalised, so every correlation needs manual aliasing.',
    ],
    followUps: [
      'Why avoid `join`?',
      'What would you change in the applications to make this easier?',
    ],
    tags: ['correlation', 'stats', 'transaction', 'trace id', 'cim'],
  },
  {
    id: 'itv-splunk-35',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the difference between `_time` and `_indextime`?',
    probing: 'A small distinction that explains a class of confusing problems.',
    answer: [
      "**`_time`** is the timestamp **of the event** - parsed from the log line itself when the data is indexed. It is what every search's time range filters on and what every chart is bucketed by.",
      '**`_indextime`** is when Splunk **actually indexed** the event. Normally they are within seconds of each other.',
      'The difference matters when they diverge, which happens more than people expect. A **forwarder that was down** and then catches up indexes hours of old events now: their `_time` is in the past, so a search over the last hour will not find them even though they arrived in the last minute. A **misparsed timestamp** - wrong timezone, or a format Splunk misread - puts events at the wrong `_time` entirely, sometimes years out, which is why events occasionally appear to be from 1970 or from the future.',
      'The practical uses: comparing the two tells you the **ingest lag**, which is worth monitoring. And when troubleshooting "where did my data go", searching by `_indextime` finds events that arrived recently regardless of what timestamp they claim.',
      'Timestamp parsing configuration - `TIME_PREFIX`, `TIME_FORMAT`, `MAX_TIMESTAMP_LOOKAHEAD` and `TZ` in `props.conf` - is what prevents this, and getting it right at onboarding avoids a lot of confusion later.',
    ],
    code: [
      {
        title: 'Measure ingest lag, and find recently arrived events',
        language: 'text',
        code: `# How far behind is ingest?
index=web earliest=-1h
| eval lag_seconds=_indextime - _time
| stats avg(lag_seconds) as avg_lag, max(lag_seconds) as max_lag by host, sourcetype
| where max_lag > 300

# Find events that ARRIVED recently, whatever timestamp they claim
index=web earliest=-30d
| where _indextime > relative_time(now(), "-15m")
| stats count by host, sourcetype`,
      },
    ],
    traps: [
      'Searching by time range and missing backfilled events with an old `_time`.',
      'A timezone misconfiguration putting events hours out, so they appear missing.',
      'Not monitoring ingest lag, so a slow pipeline is invisible until someone notices stale dashboards.',
    ],
    followUps: [
      'A forwarder was down for six hours and came back. Where are those events?',
      'How would you detect a timestamp parsing problem?',
    ],
    tags: ['time fields', 'indextime', 'timestamps', 'troubleshooting'],
  },
]
