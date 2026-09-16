import type { InterviewQuestion } from '../../../types'

/** Databases, messaging, observability, security and cost on AWS. */
export const awsOperationsQuestions: InterviewQuestion[] = [
  {
    id: 'itv-aws-24',
    level: 'intermediate',
    kind: 'open',
    prompt: 'When would you use RDS, Aurora or DynamoDB?',
    probing: 'Database selection - the answer should be about access patterns, not preference.',
    answer: [
      '**RDS** is managed relational database hosting - PostgreSQL, MySQL, SQL Server and others - where AWS handles backups, patching, and Multi-AZ failover. You get the database you already know, with less operational work. Right when you need SQL, joins, transactions and an existing schema.',
      '**Aurora** is AWS’s own reimplementation of the MySQL and PostgreSQL engines with a distributed storage layer. It gives much faster failover (typically under 30 seconds), up to 15 read replicas sharing the same storage, and storage that grows automatically. It costs more per hour and is worth it when you need the read scaling or the failover speed. **Aurora Serverless v2** scales capacity continuously, which suits variable or unpredictable load.',
      '**DynamoDB** is a NoSQL key-value and document store with single-digit millisecond latency at effectively any scale. The trade-off is that you must **design the table around your access patterns** up front - queries not supported by your keys or indexes require a scan, which is slow and expensive. There are no joins and no ad-hoc queries.',
      'How I would choose: if the access patterns are **known, simple and high-volume** - a session store, a user profile lookup, an event log - DynamoDB is excellent and operationally trivial. If you need **flexible queries, joins, or reporting**, use a relational database and reach for Aurora when RDS’s scaling or failover characteristics become the constraint.',
      'The honest caveat: choosing DynamoDB because it scales, and then discovering you need a query the key design does not support, is a common and expensive mistake. Access patterns first, database second.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which database?',
        caption: 'Start from the access patterns, not from the technology.',
        question: 'What do the queries look like?',
        branches: [
          {
            condition: 'Known key-based lookups at high volume',
            result: 'DynamoDB',
            detail: 'Design the keys first',
            tone: 'success',
          },
          {
            condition: 'SQL, joins, ad-hoc reporting',
            result: 'RDS',
            detail: 'The familiar engine, managed',
            tone: 'success',
          },
          {
            condition: 'Relational, but needs read scale or fast failover',
            result: 'Aurora',
            detail: 'Up to 15 replicas on shared storage',
            tone: 'accent',
          },
          {
            condition: 'Relational with unpredictable load',
            result: 'Aurora Serverless v2',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'DynamoDB on-demand billing removes capacity planning and is usually right until volume is both high and predictable, at which point provisioned capacity with autoscaling is far cheaper.',
      'RDS Multi-AZ is for availability, not read scaling - the standby serves no traffic. Read replicas are a separate feature.',
      'DynamoDB single-table design is powerful and genuinely hard; multiple simple tables are often the better choice for a team without that experience.',
    ],
    traps: [
      'Choosing DynamoDB for its scale, then needing a query the key schema cannot serve.',
      'Assuming the RDS Multi-AZ standby handles read traffic. It does not.',
      'Forgetting that failover takes 60-120 seconds on RDS, during which writes fail.',
    ],
    followUps: [
      'What happens if you need a new access pattern on an existing DynamoDB table?',
      'Why does RDS Multi-AZ not help with read load?',
    ],
    tags: ['databases', 'rds', 'aurora', 'dynamodb', 'architecture'],
  },
  {
    id: 'itv-aws-25',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Compare SQS, SNS, EventBridge and Kinesis.',
    probing: 'Messaging selection - these are routinely confused.',
    answer: [
      '**SQS** is a **queue**: one producer writes, one consumer reads and deletes. Messages are processed once by one worker. It decouples components and absorbs bursts - the classic use is a work queue where each job must be done exactly once.',
      '**SNS** is **pub/sub fan-out**: one message is delivered to many subscribers simultaneously. The common pattern is SNS to several SQS queues, so several independent systems each get their own copy to process at their own pace.',
      '**EventBridge** is an **event bus with routing rules**. It matches on the content of the event and routes to targets, integrates natively with AWS services and SaaS providers, supports schema discovery and archiving, and can replay events. It is the right choice for event-driven architectures where the routing logic matters.',
      '**Kinesis** is a **streaming** service: an ordered, replayable log that multiple consumers read independently, with retention measured in days. Use it for high-throughput telemetry, clickstreams or anything where order within a partition and the ability to re-read history matter.',
      'The distinguishing questions: does one message go to one consumer (**SQS**) or many (**SNS**)? Do you need **content-based routing** (EventBridge)? Do you need **ordering and replay** over a stream of records (Kinesis)?',
    ],
    code: [
      {
        title: 'Fan-out with a dead-letter queue',
        language: 'bash',
        code: `# One event, several independent consumers, each with its own backlog
aws sns create-topic --name order-events

aws sns subscribe --topic-arn "$TOPIC" --protocol sqs --notification-endpoint "$BILLING_QUEUE"
aws sns subscribe --topic-arn "$TOPIC" --protocol sqs --notification-endpoint "$SHIPPING_QUEUE"

# A DLQ so a poison message does not block the queue forever
aws sqs set-queue-attributes --queue-url "$BILLING_QUEUE" --attributes '{
  "RedrivePolicy": "{\\"deadLetterTargetArn\\":\\"arn:aws:sqs:eu-west-1:123456789012:billing-dlq\\",\\"maxReceiveCount\\":\\"5\\"}"
}'`,
      },
    ],
    deeper: [
      'SQS standard queues are **at-least-once** delivery with best-effort ordering, so consumers must be **idempotent**. FIFO queues give exactly-once and strict ordering at much lower throughput.',
      'A **dead-letter queue** is essential on any queue. Without one, a message that always fails is retried forever and blocks progress.',
      '**Visibility timeout** must exceed the processing time, or the message reappears and is processed twice while the first attempt is still running.',
      'EventBridge archive and replay is genuinely valuable for recovering from a consumer bug - you can reprocess events from before the fix.',
    ],
    traps: [
      'Assuming SQS standard preserves order. It does not.',
      'No DLQ, so one poison message stalls a queue indefinitely.',
      'A visibility timeout shorter than processing time, causing duplicate work.',
      'Using SNS where you needed durability - a subscriber that is down misses the message unless it is an SQS subscriber.',
    ],
    followUps: [
      'Why must SQS consumers be idempotent?',
      'How would you handle a message that always fails?',
    ],
    tags: ['messaging', 'sqs', 'sns', 'eventbridge', 'kinesis'],
  },
  {
    id: 'itv-aws-26',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How do CloudWatch metrics, logs and alarms fit together, and what would you alert on?',
    probing:
      'Observability practice. The alerting philosophy matters more than the service knowledge.',
    answer: [
      '**Metrics** are numeric time series - CPU, request count, queue depth, plus any custom metric you publish. **Logs** are text, grouped into log groups and streams, queryable with Logs Insights. **Alarms** watch a metric against a threshold and trigger an action - usually SNS to a paging system, or an autoscaling adjustment. **Metric filters** bridge the two, turning a pattern in logs into a metric you can alarm on.',
      'The more important half of the question is **what to alert on**. The principle I would apply is to **alert on symptoms users experience, not on causes**. High CPU is not a problem if requests are being served; a 5% error rate is a problem regardless of what the CPU is doing. Alerting on causes produces pages for things that do not matter and misses the ones that do.',
      'Concretely: **error rate**, **latency at a high percentile** (p99, not average - the average hides the users having a bad time), **availability from the user’s side** via a synthetic canary, and **saturation signals** that predict imminent failure - queue depth growing without bound, disk approaching full, connection pool exhaustion.',
      'And every alert that pages a human should be **actionable and urgent**. If the response is "look at it tomorrow", it should be a ticket or a dashboard, not a page. Alert fatigue is the failure mode here: a team that receives forty alerts a night stops reading them, and the one that mattered is lost among them.',
    ],
    code: [
      {
        title: 'An alarm on a symptom, not a cause',
        language: 'bash',
        code: `# Page when users actually see errors
aws cloudwatch put-metric-alarm \\
  --alarm-name api-5xx-rate \\
  --namespace AWS/ApplicationELB \\
  --metric-name HTTPCode_Target_5XX_Count \\
  --statistic Sum --period 60 --evaluation-periods 3 --datapoints-to-alarm 2 \\
  --threshold 25 --comparison-operator GreaterThanThreshold \\
  --treat-missing-data notBreaching \\
  --alarm-actions "$PAGER_TOPIC_ARN"`,
        explanation: 'datapoints-to-alarm 2 of 3 avoids paging on a single noisy minute.',
      },
      {
        title: 'Turn a log pattern into an alarmable metric',
        language: 'bash',
        code: `aws logs put-metric-filter \\
  --log-group-name /aws/lambda/order-processor \\
  --filter-name payment-failures \\
  --filter-pattern '{ $.level = "ERROR" && $.component = "payment" }' \\
  --metric-transformations \\
    metricName=PaymentFailures,metricNamespace=App,metricValue=1,defaultValue=0`,
        explanation:
          'defaultValue=0 matters - without it the metric is absent rather than zero, and alarms behave oddly.',
      },
    ],
    deeper: [
      'CloudWatch Logs with no retention policy is a common slow-growing cost. Set retention on every log group.',
      'Logs Insights is powerful but charges per gigabyte scanned. Narrow the time range before the query runs.',
      '`treat-missing-data` deserves a deliberate choice per alarm - `notBreaching` is right for error counts, `breaching` is right for a heartbeat.',
      'Composite alarms reduce noise by paging only when several conditions hold together.',
    ],
    traps: [
      'Alerting on CPU and disk rather than on what users experience.',
      'Alerting on the average latency, which hides the tail.',
      'Alarms with no `datapoints-to-alarm`, so a single spike pages someone.',
      'No log retention, producing a large and invisible bill.',
    ],
    followUps: [
      'Why alert on p99 rather than average latency?',
      'How would you reduce the number of pages a team receives at night?',
    ],
    tags: ['cloudwatch', 'monitoring', 'alerting', 'observability'],
  },
  {
    id: 'itv-aws-27',
    level: 'advanced',
    kind: 'open',
    prompt:
      'What is the difference between Secrets Manager and Parameter Store, and how do applications get secrets?',
    probing: 'Secret handling on AWS, including the rotation question.',
    answer: [
      '**Parameter Store** (part of Systems Manager) stores configuration values, with a `SecureString` type encrypted by KMS. The standard tier is **free**, which matters at volume. It has no built-in rotation.',
      '**Secrets Manager** is purpose-built for secrets and its distinguishing feature is **automatic rotation** - it can rotate an RDS password by invoking a Lambda that changes it in the database and updates the stored value, with no downtime. It also supports cross-region replication and has a per-secret monthly charge.',
      'The choice is usually about rotation and volume. Database credentials that should rotate: **Secrets Manager**. Hundreds of configuration values and a handful of static secrets: **Parameter Store**, at a fraction of the cost.',
      'How applications get them: **never baked into the image or the code**. The application should fetch them at startup using its **IAM role** - an ECS task role, an EC2 instance profile, an EKS service account with IRSA - so there is no bootstrap credential to protect. ECS and Lambda can inject them directly from either store into the environment, which removes even the SDK call.',
      'The remaining detail worth raising: **cache them**, because fetching a secret on every request is both slow and a real cost at volume, but **respect rotation** - a cached credential must be refreshed, or rotation silently breaks the application some hours later.',
    ],
    code: [
      {
        title: 'ECS injecting secrets at task start',
        language: 'json',
        code: `{
  "containerDefinitions": [{
    "name": "api",
    "image": "123456789012.dkr.ecr.eu-west-1.amazonaws.com/api:sha256-abc",
    "secrets": [
      {
        "name": "DATABASE_PASSWORD",
        "valueFrom": "arn:aws:secretsmanager:eu-west-1:123456789012:secret:prod/db-AbC123:password::"
      },
      {
        "name": "API_KEY",
        "valueFrom": "arn:aws:ssm:eu-west-1:123456789012:parameter/prod/api-key"
      }
    ],
    "environment": [{ "name": "LOG_LEVEL", "value": "info" }]
  }],
  "executionRoleArn": "arn:aws:iam::123456789012:role/ecs-execution"
}`,
        explanation:
          'The execution role needs permission to read the secret and to use the KMS key - two permissions, and missing the second is a common confusing failure.',
      },
    ],
    deeper: [
      'Rotation only works end to end if the application handles a credential changing underneath it. Test the rotation, do not just enable it.',
      'The KMS key policy is a second authorisation layer - useful, and a frequent source of "access denied" when only the secret permission was granted.',
      'Parameter Store advanced tier adds higher limits and policies at a per-parameter cost, which erodes its main advantage.',
      'CloudTrail logs every secret access, which is worth alerting on for the most sensitive values.',
    ],
    traps: [
      'Secrets in environment variables set at build time, baked into the image.',
      'Enabling rotation without testing that the application survives it.',
      'Granting secret access but not KMS decrypt permission.',
      'Fetching a secret on every request, adding latency and cost.',
    ],
    followUps: [
      'What breaks when a secret rotates and the application has cached it?',
      'How does a Lambda get a secret without any stored credential?',
    ],
    tags: ['secrets', 'security', 'kms', 'rotation', 'advanced'],
  },
  {
    id: 'itv-aws-28',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'An EC2 instance in a private subnet cannot reach an external API. Everything looks correct. How do you debug it?',
    probing: 'Layered network debugging on AWS, where there are more layers than usual.',
    answer: [
      'AWS networking has several independent layers that can each break this, so I would check them in order rather than jumping around.',
      '**Route table**: does the private subnet have a `0.0.0.0/0` route, and does it point at a **NAT gateway** that is in a *public* subnet and in the **available** state? A NAT gateway in the same private subnet cannot work, and that is a surprisingly common mistake.',
      '**Security group**: security groups are stateful, so you only need the **outbound** rule. The default allows all outbound, but a hardened one may not - check that 443 outbound is permitted.',
      '**Network ACL**: stateless, so you need an outbound rule for 443 **and an inbound rule for the ephemeral port range** for the response. Missing the return rule produces exactly this symptom - a timeout with everything else looking correct.',
      '**DNS**: can the instance resolve the hostname at all? `enableDnsSupport` and `enableDnsHostnames` on the VPC, or a custom DHCP option set pointing at a resolver that is not reachable. A DNS failure looks like a connectivity failure from the application’s point of view.',
      '**The far end**: the external API may be allow-listing source IPs, and the NAT gateway’s address may not be on the list - especially after a NAT gateway was recreated and got a new elastic IP.',
      'To distinguish these quickly: **timeout versus connection refused**. A timeout points at routing, a security group, a NACL or a firewall. Connection refused means packets are arriving and being rejected, so the path works. And **VPC Flow Logs** with `ACCEPT`/`REJECT` show you exactly where packets are being dropped, which turns this from guesswork into a lookup.',
    ],
    code: [
      {
        title: 'Check the layers in order',
        language: 'bash',
        code: `# 1. Route: does 0.0.0.0/0 point at an available NAT gateway?
aws ec2 describe-route-tables \\
  --filters "Name=association.subnet-id,Values=subnet-abc123" \\
  --query 'RouteTables[].Routes[?DestinationCidrBlock==\`0.0.0.0/0\`]'
aws ec2 describe-nat-gateways --query 'NatGateways[].[NatGatewayId,State,SubnetId]' --output table

# 2. Flow logs - see the actual REJECT and which layer produced it
aws logs start-query \\
  --log-group-name /aws/vpc/flowlogs \\
  --start-time $(date -d '15 minutes ago' +%s) --end-time $(date +%s) \\
  --query-string 'fields @timestamp, srcAddr, dstAddr, dstPort, action
                  | filter action = "REJECT" | sort @timestamp desc | limit 50'

# 3. From the instance itself (via SSM, no SSH needed)
aws ssm start-session --target i-0abc123
  dig +short api.example.com          # DNS working?
  curl -sv --max-time 5 https://api.example.com/health
  curl -s https://checkip.amazonaws.com    # which source IP does the API see?`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Layers to eliminate, in order',
        caption:
          'Timeout means the packet is being dropped; refused means it arrived and was rejected.',
        nodes: [
          {
            label: 'Route table -> NAT gateway',
            detail: 'NAT must be in a public subnet',
            tone: 'accent',
          },
          { label: 'Security group outbound', detail: 'Stateful - one direction only' },
          {
            label: 'NACL both directions',
            detail: 'Stateless - ephemeral ports needed',
            tone: 'warning',
          },
          { label: 'DNS resolution', detail: 'Looks like a connectivity failure' },
          { label: 'Remote allow-list', detail: 'Is the NAT elastic IP listed?' },
          { label: 'VPC Flow Logs show the REJECT', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'The NACL ephemeral-port rule is the single most common cause of this exact symptom, precisely because NACLs are stateless and most people reason about them as if they were not.',
      'VPC Reachability Analyzer tests a path without sending traffic and names the blocking component directly - worth reaching for early.',
      'If the destination is an AWS service, a **VPC endpoint** removes the NAT dependency entirely and is usually cheaper as well.',
      'Use SSM Session Manager rather than a bastion - it works without inbound access and is auditable.',
    ],
    traps: [
      'Adding outbound NACL rules and forgetting the inbound ephemeral-port rule.',
      'A NAT gateway placed in a private subnet.',
      'Assuming it is the network when DNS is the failure.',
      'Not checking whether the NAT elastic IP changed after a rebuild.',
    ],
    followUps: [
      'The error is "connection refused" rather than a timeout. What does that change?',
      'How would you avoid NAT entirely for calls to AWS services?',
    ],
    tags: ['scenario', 'vpc', 'networking', 'troubleshooting', 'advanced'],
  },
  {
    id: 'itv-aws-29',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'What is the most reliable way to give an EC2 instance permission to read an S3 bucket?',
    probing: 'Credential handling - the wrong answers are all things people actually do.',
    options: [
      { id: 'a', text: 'Store an access key and secret in a file on the instance' },
      {
        id: 'b',
        text: 'Attach an IAM instance profile with a role granting the required S3 permissions',
      },
      { id: 'c', text: 'Put the credentials in an environment variable in the user data script' },
      { id: 'd', text: 'Make the bucket public and skip authentication' },
    ],
    correct: ['b'],
    answer: [
      'An **instance profile** attaches an IAM role to the instance. The SDK then obtains **temporary credentials from the instance metadata service** automatically, rotates them before they expire, and never writes them to disk. There is nothing to leak, nothing to rotate manually, and nothing that keeps working if the instance is compromised and the attacker copies a file.',
      'Every other option leaves a **long-lived credential** somewhere: on disk, in user data (which is readable from the metadata service by anything on the instance), or removed entirely by making the data public.',
      'One hardening note: require **IMDSv2**, which uses a session token and blocks the SSRF attack pattern where a vulnerable application is tricked into fetching instance credentials from the metadata endpoint on an attacker’s behalf. That attack has been used in real breaches, and IMDSv2 prevents it.',
    ],
    code: [
      {
        title: 'Instance profile with IMDSv2 required',
        language: 'bash',
        code: `aws ec2 associate-iam-instance-profile \\
  --instance-id i-0abc123 \\
  --iam-instance-profile Name=app-s3-reader

# Require IMDSv2 - blocks the SSRF credential-theft pattern
aws ec2 modify-instance-metadata-options \\
  --instance-id i-0abc123 \\
  --http-tokens required \\
  --http-put-response-hop-limit 1

# Confirm which identity the instance actually has
aws sts get-caller-identity`,
      },
    ],
    traps: [
      'Access keys on disk, which outlive the instance and are copied into AMIs.',
      'Credentials in user data, readable by any process on the instance.',
      'Leaving IMDSv1 enabled, keeping the SSRF path open.',
    ],
    followUps: ['What is IMDSv2 protecting against?'],
    tags: ['iam', 'ec2', 'security', 'credentials'],
  },
  {
    id: 'itv-aws-30',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you reduce AWS costs by 30% without degrading service?',
    probing:
      'FinOps in practice. The expected structure is measure, then eliminate waste, then commit.',
    answer: [
      'I would work in order of **risk-free first**, because a large share of the saving is usually available without touching anything users can see.',
      '**Eliminate waste**: unattached EBS volumes, old snapshots, idle load balancers, unassociated elastic IPs, development environments running at weekends, CloudWatch Logs with infinite retention. This is pure waste and typically 5-15% on an unmanaged account.',
      '**Right-size**: most instances are provisioned from a guess and never revisited. Compute Optimizer gives concrete recommendations from actual utilisation. Moving to **Graviton** (arm64) is typically 20-40% cheaper for the same performance and is often just a rebuild.',
      '**Storage tiering**: S3 lifecycle rules to move old data to cheaper classes, gp2 to gp3 EBS volumes (cheaper and faster), and expiry of old object versions.',
      '**Data transfer**: cross-AZ traffic and NAT gateway processing are frequently large and invisible. VPC endpoints for S3 and DynamoDB, and zone-aware routing, can remove a surprising amount.',
      '**Then commit**: Savings Plans and Reserved Instances give 30-70% off, but only commit to the baseline that remains **after** right-sizing - committing first locks in the oversized footprint.',
      'And the thing that makes it stick: **attribution**. Tagging enforced by policy, per-team budgets and anomaly detection, so cost is visible to the people who create it. A one-off 30% reduction without that drifts back within a year.',
    ],
    code: [
      {
        title: 'Find the obvious waste',
        language: 'bash',
        code: `# Unattached EBS volumes
aws ec2 describe-volumes --filters Name=status,Values=available \\
  --query 'Volumes[].[VolumeId,Size,CreateTime]' --output table

# Unassociated elastic IPs (billed when not attached)
aws ec2 describe-addresses \\
  --query 'Addresses[?AssociationId==null].[PublicIp,AllocationId]' --output table

# Log groups with no retention - these grow forever
aws logs describe-log-groups \\
  --query 'logGroups[?retentionInDays==null].[logGroupName,storedBytes]' --output table

# Load balancers with no healthy targets
aws elbv2 describe-target-groups \\
  --query 'TargetGroups[].TargetGroupArn' --output text | tr '\\t' '\\n' |
while read -r tg; do
  n=$(aws elbv2 describe-target-health --target-group-arn "$tg" \\
        --query 'length(TargetHealthDescriptions)')
  [ "$n" = "0" ] && echo "empty target group: $tg"
done`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Cost reduction, in order of risk',
        caption:
          'Commit last. Committing before right-sizing locks in the waste you were about to remove.',
        nodes: [
          {
            label: 'Measure and attribute',
            detail: 'Tags, Cost Explorer, Storage Lens',
            tone: 'accent',
          },
          { label: 'Delete waste', detail: 'Orphans, idle, no-retention logs', tone: 'success' },
          { label: 'Right-size and move to Graviton', detail: 'Compute Optimizer' },
          { label: 'Tier storage, fix data transfer', detail: 'Lifecycle rules, VPC endpoints' },
          {
            label: 'Commit to the new baseline',
            detail: 'Savings Plans on what remains',
            tone: 'warning',
          },
          { label: 'Budgets, anomaly detection, ownership', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'Compute Savings Plans are more flexible than EC2 Instance Savings Plans and cover Lambda and Fargate too - usually the better first commitment.',
      'Spot instances are 60-90% cheaper and suit fault-tolerant, interruptible work. Not for a stateful database.',
      'Non-production environments shut down outside working hours is a straightforward 60%+ saving on that portion of the estate.',
      'Track cost per unit of business value - per request, per customer - rather than absolute spend. Growing costs on growing traffic is not a problem.',
    ],
    traps: [
      'Buying reservations before right-sizing, locking in the oversized footprint for a year.',
      'Cutting non-production environments so hard that developers are slowed down - that cost is higher than the saving.',
      'A one-off exercise with no ownership, which drifts back.',
      'Ignoring data transfer because it is not a named service line.',
    ],
    followUps: [
      'Why commit to Savings Plans last rather than first?',
      'How do you keep costs down permanently rather than once?',
    ],
    tags: ['cost', 'finops', 'optimisation', 'savings plans', 'advanced'],
  },
  {
    id: 'itv-aws-31',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is CloudFormation, and how does it compare with Terraform?',
    probing: 'Infrastructure as code on AWS, with a fair comparison rather than advocacy.',
    answer: [
      '**CloudFormation** is AWS’s native infrastructure-as-code service. You describe resources in YAML or JSON as a **stack**, and AWS creates, updates and deletes them, tracking state itself. **Change sets** preview what an update will do, and a failed update **rolls back automatically** by default.',
      'Its advantages are all about being native: **no state file to manage or secure**, day-one support for new AWS features, deep integration with Organizations through **StackSets** for deploying across accounts and regions, and drift detection built in.',
      '**Terraform** is cloud-agnostic, has a much larger provider ecosystem (so one tool manages AWS, Datadog, GitHub and your DNS provider), has a more expressive language with modules and functions, and a considerably better developer experience - `terraform plan` output is far more readable than a change set.',
      'The honest comparison: if you are entirely on AWS and want nothing extra to operate, CloudFormation - or **CDK**, which generates CloudFormation from TypeScript or Python and removes most of the YAML pain - is a reasonable choice. If you use several providers, or you want the module ecosystem and the language, Terraform is better and is the industry default for good reasons.',
      'The thing I would not do is use both for the same resources. Two tools with two notions of desired state fighting over one resource is a genuinely unpleasant situation.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'CloudFormation, CDK or Terraform?',
        caption: 'The deciding factor is usually how many providers you need to manage.',
        question: 'What is the scope of the infrastructure?',
        branches: [
          {
            condition: 'AWS only, want nothing extra to operate',
            result: 'CloudFormation or CDK',
            detail: 'No state file, native rollback',
            tone: 'success',
          },
          {
            condition: 'Several providers beyond AWS',
            result: 'Terraform',
            detail: 'One tool, one workflow',
            tone: 'success',
          },
          {
            condition: 'Want a real programming language',
            result: 'CDK or Pulumi',
            detail: 'Generates the underlying template',
            tone: 'accent',
          },
          {
            condition: 'Deploying a baseline across many accounts',
            result: 'CloudFormation StackSets',
            detail: 'Native to Organizations',
            tone: 'accent',
          },
        ],
      },
    ],
    deeper: [
      'CloudFormation automatic rollback is a real advantage over Terraform, where a failed apply leaves you partway through with state to reconcile.',
      'Terraform state is the main operational burden: remote backend, locking, encryption, and access control. Getting it wrong causes genuine incidents.',
      'CDK is popular because it removes the YAML, but it still produces CloudFormation - so the underlying limits and behaviours still apply.',
      'Neither removes the need to understand the services themselves. Infrastructure as code makes changes reviewable and repeatable; it does not make bad architecture good.',
    ],
    traps: [
      'Managing the same resource with two tools.',
      'Manual changes in the console, which cause drift in either tool.',
      'Assuming CDK avoids CloudFormation’s limitations. It does not.',
    ],
    followUps: [
      'What is the biggest operational burden Terraform adds that CloudFormation does not?',
      'How would you handle someone changing a resource in the console?',
    ],
    tags: ['cloudformation', 'terraform', 'iac', 'cdk', 'comparison'],
  },
  {
    id: 'itv-aws-32',
    level: 'basic',
    kind: 'open',
    prompt: 'What is the shared responsibility model?',
    probing: 'A fundamental that shapes every security conversation about cloud.',
    answer: [
      'AWS is responsible for security **of** the cloud; the customer is responsible for security **in** the cloud.',
      'AWS handles the physical data centres, the hardware, the hypervisor, the network infrastructure and the managed service software itself. You are responsible for everything you put on top: your data, your IAM configuration, your security groups, your operating system patching where applicable, your encryption choices and your application code.',
      'The line **moves with the service**. On EC2 you patch the operating system; on RDS AWS patches the database engine but you still control access, encryption and network placement; on Lambda or S3 you are responsible for almost nothing but configuration and data - which is precisely why almost every S3 breach is a customer misconfiguration rather than an AWS failure.',
      'The practical implication to state: **using a managed service moves work to AWS but never moves accountability**. A public S3 bucket is your incident, not theirs.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'Where the line sits',
        caption: 'The more managed the service, the less is yours - but configuration always is.',
        root: {
          label: 'Shared responsibility',
          children: [
            {
              label: 'AWS: security OF the cloud',
              detail: 'Facilities, hardware, hypervisor, network, service software',
              tone: 'muted',
            },
            {
              label: 'You: security IN the cloud',
              detail: 'Always yours, on every service',
              tone: 'accent',
              children: [
                { label: 'Data and its classification', tone: 'danger' },
                { label: 'IAM and access control', tone: 'danger' },
                { label: 'Network configuration', detail: 'Security groups, NACLs, subnets' },
                { label: 'Encryption choices', detail: 'At rest and in transit' },
                { label: 'OS patching', detail: 'On EC2 - not on Lambda or RDS', tone: 'warning' },
              ],
            },
          ],
        },
      },
    ],
    traps: [
      'Assuming a managed service is secure by default. It is available by default; secure is your configuration.',
      'Thinking AWS backs up your data. They provide backup services; using them is your job.',
      'Forgetting that the line differs per service, so an EC2 mental model misleads you on RDS.',
    ],
    followUps: ['Who is responsible when an S3 bucket is left public?'],
    tags: ['security', 'shared responsibility', 'fundamentals', 'compliance'],
  },
  {
    id: 'itv-aws-33',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you approach disaster recovery on AWS? What are the strategies?',
    probing:
      'DR planning. The expected structure is RTO/RPO first, then the four standard patterns.',
    answer: [
      'Start with the **requirements**, because they determine everything else and are usually unstated. **RTO** is how long you can be down; **RPO** is how much data you can afford to lose. A business that can tolerate four hours of downtime and one hour of data loss needs a completely different - and far cheaper - design from one that can tolerate neither.',
      'There are four standard strategies, increasing in cost and decreasing in RTO. **Backup and restore**: backups in another region, rebuild on demand. Cheapest; RTO of hours to days. **Pilot light**: core services such as the database replicating continuously, everything else switched off until needed. RTO of tens of minutes. **Warm standby**: a scaled-down but fully working copy running, scaled up on failover. RTO of minutes. **Multi-site active/active**: full capacity in both regions serving traffic. RTO near zero, and roughly double the cost.',
      'What I would actually recommend for most systems is **multi-AZ within one region, plus backup and restore across regions**. Multi-AZ handles the failures that actually happen - instance failures, rack failures, a data centre problem - at very little extra cost. Full region loss is rare, and designing for it multiplies cost and complexity for every service.',
      'The part that matters more than the strategy: **test it**. An untested DR plan is a document, not a capability. Regular game days that actually fail over, with the runbook followed by someone who did not write it, are what turn it into something you can rely on. Most DR plans fail on their first real use because of a dependency nobody documented - a DNS record, a certificate, a hardcoded endpoint, a manual step.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which DR strategy?',
        caption: 'RTO and RPO choose this for you. Decide those first.',
        question: 'How much downtime and data loss is acceptable?',
        branches: [
          {
            condition: 'Hours of downtime acceptable',
            result: 'Backup and restore',
            detail: 'Cheapest; suits most internal systems',
            tone: 'success',
          },
          {
            condition: 'Tens of minutes',
            result: 'Pilot light',
            detail: 'Data replicating, compute off',
            tone: 'accent',
          },
          {
            condition: 'A few minutes',
            result: 'Warm standby',
            detail: 'Scaled-down copy running',
            tone: 'warning',
          },
          {
            condition: 'Near zero, and budget allows',
            result: 'Active/active multi-region',
            detail: 'Roughly double the cost',
            tone: 'danger',
          },
        ],
      },
    ],
    deeper: [
      'Data is the hard part. Cross-region database replication has lag, which sets your RPO; a globally consistent write path is a substantially harder architecture.',
      'Do not forget the dependencies: DNS, certificates, secrets, container images, and IAM roles all need to exist in the recovery region.',
      'AWS Backup centralises backup policy across services and accounts, which is much more reliable than per-service configuration.',
      'Write the runbook so someone unfamiliar can follow it at 3am, and test it that way.',
    ],
    traps: [
      'A DR plan that has never been tested.',
      'Designing for region failure when the real risk was a single-AZ deployment.',
      'Backups in the same region and account as the thing they protect.',
      'Forgetting that failover is only half of it - failing back is often harder.',
    ],
    followUps: [
      'How would you test a DR plan without risking production?',
      'What is usually the hardest part of a multi-region design?',
    ],
    tags: ['disaster recovery', 'rto', 'rpo', 'architecture', 'advanced'],
  },
  {
    id: 'itv-aws-34',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is CloudTrail and what would you use it for?',
    probing: 'Audit and forensics. Often the first thing asked for after an incident.',
    answer: [
      'CloudTrail records **API calls** made in your account - who did what, to which resource, from where, and whether it succeeded. Effectively every action in AWS goes through an API, so this is the audit log of everything that happened.',
      'It is used for three things. **Security investigation**: after an incident, CloudTrail tells you what an attacker did and which credentials were used. **Compliance**: an immutable record of access and change. And **operational forensics**: "who deleted that security group at 2am" is a CloudTrail query.',
      'The configuration that matters: an **organisation trail** covering every account, delivering to a **dedicated log archive account** that nobody can write to, with **log file validation** enabled so tampering is detectable, and encrypted with KMS. Sending it to a separate account is the critical part - an attacker who compromises an account must not be able to delete the evidence.',
      'One thing to know: **management events** (creating, deleting, configuring) are free and on by default; **data events** (individual S3 object reads, Lambda invocations) are high volume and charged, so they are enabled selectively on the buckets that matter.',
      'CloudTrail is also only useful if something looks at it. Pair it with **GuardDuty**, which analyses CloudTrail along with other sources and alerts on suspicious patterns, rather than relying on someone to query it after the fact.',
    ],
    code: [
      {
        title: 'Query CloudTrail for a specific action',
        language: 'bash',
        code: `# Who deleted that security group?
aws cloudtrail lookup-events \\
  --lookup-attributes AttributeKey=EventName,AttributeValue=DeleteSecurityGroup \\
  --start-time 2026-09-15T00:00:00Z \\
  --query 'Events[].[EventTime,Username,CloudTrailEvent]' --output text

# At scale, query the S3-delivered logs with Athena instead
# SELECT eventtime, useridentity.arn, eventname, sourceipaddress
# FROM cloudtrail_logs
# WHERE eventname = 'DeleteSecurityGroup' AND date >= '2026/09/15'`,
      },
    ],
    traps: [
      'Trail delivery into the same account it audits, so an attacker can delete it.',
      'Assuming CloudTrail records S3 object access by default. Data events must be enabled.',
      'Enabling data events on every bucket and generating a very large bill.',
      'Collecting it and never looking at it.',
    ],
    followUps: [
      'Why deliver CloudTrail to a separate account?',
      'What does CloudTrail not record?',
    ],
    tags: ['cloudtrail', 'audit', 'security', 'compliance', 'forensics'],
  },
  {
    id: 'itv-aws-35',
    level: 'basic',
    kind: 'mcq',
    prompt: 'Which of these is billed even when the resource is not actively used?',
    probing: 'Cost intuition about idle resources - a common source of waste.',
    options: [
      { id: 'a', text: 'A stopped EC2 instance’s compute charge' },
      { id: 'b', text: 'An EBS volume attached to a stopped instance' },
      { id: 'c', text: 'A Lambda function with no invocations' },
      { id: 'd', text: 'An S3 bucket with no objects' },
    ],
    correct: ['b'],
    answer: [
      '**EBS volumes are billed for their provisioned size**, continuously, whether the instance is running, stopped, or the volume is attached to nothing at all. A stopped instance stops the compute charge but the disk keeps costing money, which is why "we stopped everything" often produces a disappointing bill reduction.',
      'A **stopped instance** incurs no compute charge. **Lambda** is billed per invocation and duration, so an unused function costs nothing. An **empty S3 bucket** costs nothing - S3 is billed on stored bytes and requests.',
      'The related trap is **elastic IPs**, which are charged when *not* attached to a running instance - the opposite intuition from everything else, and a steady small cost that accumulates across an estate.',
    ],
    traps: [
      'Stopping instances to save money and forgetting the volumes and snapshots.',
      'Unattached elastic IPs quietly billed across many accounts.',
      'Snapshots of deleted volumes retained indefinitely.',
    ],
    followUps: ['What else is billed while idle that people forget?'],
    tags: ['cost', 'ebs', 'billing', 'fundamentals'],
  },
  {
    id: 'itv-aws-36',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'An AWS access key has been leaked in a public GitHub repository. Which of these should happen? Select all that apply.',
    probing: 'Incident response for the most common real AWS security event.',
    options: [
      { id: 'a', text: 'Deactivate and delete the key immediately' },
      {
        id: 'b',
        text: 'Review CloudTrail for what the key was used for, including in regions you do not normally use',
      },
      {
        id: 'c',
        text: 'Check for resources created by the key - particularly EC2 instances and IAM users',
      },
      { id: 'd', text: 'Remove the commit from git history and consider the key safe again' },
      {
        id: 'e',
        text: 'Replace the key with a role or federated access so there is no key to leak next time',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Rewriting git history does **not** make the key safe. It was public; it has been scraped. Automated scanners find committed AWS keys within **minutes**, and forks, caches, clones and third-party mirrors mean it cannot be recalled. The only valid response is to treat it as compromised permanently.',
      'The immediate action is to **deactivate the key** - deactivate before delete, so you retain the ability to investigate - and then work out what was done with it. **CloudTrail across all regions** matters because the standard attack pattern is to spin up expensive compute for cryptomining in regions nobody watches.',
      'Then look for **persistence**: new IAM users, new access keys on existing users, new roles with trust policies pointing at external accounts, modified security groups. An attacker’s first move after getting credentials is usually to create a second way in.',
      'And the durable fix is to **remove the need for static keys at all**: IAM roles for workloads, OIDC federation for CI, and SSO for humans. If there is no long-lived key, there is nothing to commit. Pair that with secret scanning in CI and push protection on the repository.',
    ],
    code: [
      {
        title: 'The first three commands',
        language: 'bash',
        code: `# 1. Deactivate first - keeps the key for investigation, stops it working
aws iam update-access-key --access-key-id AKIAEXAMPLE --status Inactive --user-name app-user

# 2. What did it do, everywhere?
for region in $(aws ec2 describe-regions --query 'Regions[].RegionName' --output text); do
  echo "=== $region"
  aws cloudtrail lookup-events --region "$region" \\
    --lookup-attributes AttributeKey=AccessKeyId,AttributeValue=AKIAEXAMPLE \\
    --query 'Events[].[EventTime,EventName,EventSource]' --output text | head -20
done

# 3. Persistence: anything created recently?
aws iam list-users --query 'Users[?CreateDate>=\`2026-09-01\`].[UserName,CreateDate]' --output table`,
      },
    ],
    deeper: [
      'AWS itself scans public repositories and will often quarantine the key and email you before you notice - but assume an attacker found it first.',
      'Check for unexpected costs immediately. Cryptomining in an unused region is the most common outcome and can reach thousands of pounds within hours.',
      'GuardDuty flags this pattern well - unusual regions, unusual API calls, credential use from a new location.',
      'Enable push protection and secret scanning so the next one is blocked before it is pushed.',
    ],
    traps: [
      'Rewriting history and considering it resolved.',
      'Deleting the key before investigating what it did.',
      'Checking only the regions you normally use.',
      'Fixing this incident without removing the reason a static key existed.',
    ],
    followUps: [
      'Why is rewriting git history insufficient?',
      'How do you make static keys unnecessary?',
    ],
    tags: ['security', 'incident response', 'iam', 'credentials', 'advanced'],
  },
]
