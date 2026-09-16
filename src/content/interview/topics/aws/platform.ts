import type { InterviewQuestion } from '../../../types'

/** Serverless, containers on AWS, networking at scale and platform questions. */
export const awsPlatformQuestions: InterviewQuestion[] = [
  {
    id: 'itv-aws-37',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is a Lambda cold start, and how do you reduce it?',
    probing: 'Serverless performance, and whether you know when it actually matters.',
    answer: [
      'A **cold start** is the time to create a new execution environment before your code runs: download the deployment package, start the runtime, and run any initialisation code outside the handler. It happens on the first invocation and whenever Lambda needs another concurrent environment.',
      'The size depends heavily on the runtime and the package. Python and Node are typically tens to low hundreds of milliseconds; a JVM or .NET function with a large dependency tree can be several seconds. Putting a Lambda inside a **VPC** used to add a great deal; that was largely fixed, but attaching an ENI still adds some.',
      'Reductions, in order of effectiveness: **shrink the deployment package** - only the dependencies you actually use, with tree-shaking or layers. **Move work into the init phase** outside the handler, because it runs once per environment rather than per invocation, and initialisation gets more CPU. **Choose a lighter runtime** where you can. **Increase memory**, which also increases CPU proportionally and often reduces both cold start and duration enough to be cost-neutral.',
      'And **provisioned concurrency** keeps environments warm, which removes cold starts entirely - at a cost that erodes the main economic advantage of Lambda. It is right for a latency-sensitive synchronous API and wrong as a general habit.',
      'The judgement to state: cold starts matter for **synchronous user-facing** requests. For asynchronous, queue-driven or scheduled work, a 300 ms cold start on a small fraction of invocations is usually irrelevant, and optimising it is wasted effort.',
    ],
    code: [
      {
        title: 'Initialise once, outside the handler',
        language: 'python',
        code: `import boto3, os, json

# Runs ONCE per execution environment, with extra CPU available.
# Connection pools, SDK clients and config parsing all belong here.
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["TABLE_NAME"])
CONFIG = json.loads(os.environ.get("CONFIG", "{}"))

def handler(event, context):
    # Runs on EVERY invocation - keep it to the actual work
    key = event["pathParameters"]["id"]
    result = table.get_item(Key={"id": key})
    return {"statusCode": 200, "body": json.dumps(result.get("Item", {}))}`,
        explanation:
          'Creating the boto3 client inside the handler is the single most common cause of avoidable Lambda latency.',
      },
    ],
    traps: [
      'Creating SDK clients or database connections inside the handler.',
      'Provisioned concurrency on an asynchronous function, paying for warmth nobody experiences.',
      'Bundling an entire SDK when three modules were needed.',
      'Optimising cold starts for a function that runs on a queue.',
    ],
    followUps: [
      'When do cold starts genuinely not matter?',
      'Why does increasing memory sometimes reduce cost?',
    ],
    tags: ['lambda', 'serverless', 'performance', 'cold start'],
  },
  {
    id: 'itv-aws-38',
    level: 'advanced',
    kind: 'open',
    prompt: 'How do EKS pods get AWS permissions? Explain IRSA.',
    probing:
      'A specific, very common EKS question. The node-role alternative is the wrong answer to contrast with.',
    answer: [
      'The naive approach is to give the **node’s** IAM role the permissions and let pods inherit them through the instance metadata service. That works and is a poor idea: **every pod on that node gets every permission**, so a compromised sidecar in one namespace has the same access as your most privileged workload.',
      '**IRSA** - IAM Roles for Service Accounts - gives each Kubernetes ServiceAccount its own IAM role. The cluster has an **OIDC provider** registered with IAM; the ServiceAccount is annotated with a role ARN; a webhook injects a **projected service account token** into the pod; and the AWS SDK exchanges that token for temporary credentials via `AssumeRoleWithWebIdentity`.',
      'The result is per-pod least privilege with **no static credentials anywhere**, and the token is short-lived and automatically rotated.',
      'The security of it rests on the **trust policy condition**, exactly as with GitHub OIDC. The `sub` claim is `system:serviceaccount:<namespace>:<name>`, and the condition must pin it. A trust policy with a wildcard means **any ServiceAccount in the cluster** can assume the role, which quietly undoes the whole point.',
      '**EKS Pod Identity** is the newer alternative: the same outcome with a simpler setup, no OIDC provider to manage and no SDK version requirements. For new clusters it is generally the better choice; IRSA remains what most existing clusters use.',
    ],
    code: [
      {
        title: 'ServiceAccount annotated with a role',
        language: 'yaml',
        code: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: order-processor
  namespace: prod
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/order-processor
---
apiVersion: apps/v1
kind: Deployment
metadata: { name: order-processor, namespace: prod }
spec:
  template:
    spec:
      serviceAccountName: order-processor    # without this, it uses "default"
      containers:
        - name: app
          image: order-processor:1.4`,
      },
      {
        title: 'The trust policy - pinned to one ServiceAccount',
        language: 'json',
        code: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Federated": "arn:aws:iam::123456789012:oidc-provider/oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE"
    },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE:aud": "sts.amazonaws.com",
        "oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE:sub":
          "system:serviceaccount:prod:order-processor"
      }
    }
  }]
}`,
        explanation:
          'StringLike with a wildcard here would let any pod in the cluster assume this role.',
      },
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'How a pod gets temporary AWS credentials',
        caption: 'No static credential exists anywhere in the path.',
        participants: [
          { id: 'pod', label: 'Pod' },
          { id: 'k8s', label: 'Kubernetes' },
          { id: 'sts', label: 'AWS STS' },
          { id: 'aws', label: 'AWS API' },
        ],
        messages: [
          { from: 'k8s', to: 'pod', label: 'inject projected SA token' },
          { from: 'pod', to: 'sts', label: 'AssumeRoleWithWebIdentity(token)' },
          { from: 'sts', to: 'sts', label: 'verify via cluster OIDC, check sub', kind: 'return' },
          { from: 'sts', to: 'pod', label: 'temporary credentials', kind: 'return' },
          { from: 'pod', to: 'aws', label: 'call S3, DynamoDB, ...' },
        ],
      },
    ],
    deeper: [
      'Block pod access to the instance metadata service (`--http-put-response-hop-limit 1`), or pods can bypass IRSA entirely and use the node role.',
      'The SDK must be recent enough to support web identity credentials - an old SDK silently falls back to the node role, which looks like it works.',
      'One role per workload, not one shared role. The whole benefit is per-pod scoping.',
    ],
    traps: [
      'A wildcard `sub` condition, allowing any ServiceAccount to assume the role.',
      'Forgetting `serviceAccountName` in the Deployment, so the pod uses `default` and gets nothing.',
      'Leaving the node role over-privileged as a fallback.',
      'Not blocking IMDS access from pods.',
    ],
    followUps: [
      'What is wrong with giving the node role the permissions?',
      'How would you stop a pod bypassing IRSA via the metadata service?',
    ],
    tags: ['eks', 'iam', 'irsa', 'kubernetes', 'security', 'advanced'],
  },
  {
    id: 'itv-aws-39',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is CloudFront and when would you put it in front of an application?',
    probing: 'CDN reasoning beyond "it makes things faster".',
    answer: [
      'CloudFront is a **content delivery network**: a global set of edge locations that cache content close to users and terminate connections there. A request goes to the nearest edge; if the content is cached it is served immediately, and if not the edge fetches it from the origin over AWS’s backbone network.',
      'The obvious benefit is **latency for cacheable content** - images, JavaScript, video. The less obvious ones often matter more. **TLS termination at the edge** cuts the handshake round trips, which helps even for content that cannot be cached. **Origin offload** reduces load and data transfer costs at the origin substantially. **AWS Shield Standard** comes free and absorbs common DDoS traffic, and **WAF** can attach at the edge so malicious requests never reach your infrastructure.',
      'When to use it: any public web application with static assets, any global user base, and anywhere you want the origin shielded. It is cheap and the data transfer out of CloudFront is generally cheaper than directly from S3 or an ALB, so it frequently reduces the bill as well.',
      'When it adds little: a purely internal application, an API with no cacheable responses and users in one region, or anything where the added invalidation complexity outweighs a small latency gain.',
      'The main operational cost is **cache invalidation**. Getting cache headers right matters - a long TTL with content-hashed filenames is the pattern that works; relying on invalidation for every deploy is slow and rate-limited.',
    ],
    code: [
      {
        title: 'Cache policy that works with hashed assets',
        language: 'bash',
        code: `# Long-lived cache for hashed assets; the filename changes when the content does
# app.a3f9c1.js  ->  Cache-Control: public, max-age=31536000, immutable

# Short or no cache for the HTML that references them
# index.html     ->  Cache-Control: no-cache

# Invalidation is then rare - only the entry point
aws cloudfront create-invalidation \\
  --distribution-id E1234567890ABC \\
  --paths '/index.html' '/'`,
        explanation:
          'Content-hashed filenames make invalidation almost unnecessary, which is the point.',
      },
    ],
    traps: [
      'Invalidating `/*` on every deploy - slow, rate-limited and charged beyond a free allowance.',
      'Caching a response that varies per user because the cache key ignores a header or cookie.',
      'Forgetting that the origin must still be protected - a CloudFront distribution does not stop anyone hitting the origin directly unless you restrict it.',
    ],
    followUps: [
      'How would you stop people bypassing CloudFront and hitting the origin directly?',
      'Why can content-hashed filenames remove the need for invalidation?',
    ],
    tags: ['cloudfront', 'cdn', 'performance', 'caching', 'security'],
  },
  {
    id: 'itv-aws-40',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you connect several VPCs and an on-premise network?',
    probing: 'Network architecture at scale - peering does not scale and that is the point.',
    answer: [
      '**VPC peering** connects two VPCs directly. It is simple and has no additional hourly charge, but it is **non-transitive**: if A peers with B and B peers with C, A cannot reach C. That means *n* VPCs need *n(n-1)/2* connections - ten VPCs is 45 peerings, each with route table entries in both directions. It does not scale.',
      '**Transit Gateway** is the answer at any real scale: a hub that every VPC attaches to once, with **route tables on the gateway** controlling which attachments can reach which. Ten VPCs is ten attachments rather than 45 peerings, and adding the eleventh is one attachment rather than ten more. It also supports **transitive routing**, so on-premise connectivity attached once reaches every VPC.',
      'For **on-premise**, the options are **Site-to-Site VPN** over the internet - quick, cheap, encrypted, but subject to internet variability - or **Direct Connect**, a dedicated physical circuit with consistent latency and lower data transfer costs, which takes weeks to provision and costs considerably more. The common pattern is Direct Connect with a VPN as a backup path.',
      'The other thing worth mentioning is that not everything needs network connectivity at all. **PrivateLink** exposes a single service endpoint into another VPC without joining the networks, which is often the better answer for "team B needs to call team A\'s API" - no overlapping CIDR problems, no broad network access, just one service.',
      'And the constraint that bites: **overlapping CIDR ranges cannot be routed between**. IP address planning across the organisation, done early, saves a great deal of pain later - it is the thing most often skipped and most expensive to fix.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'How should these networks connect?',
        caption: 'Peering is fine for two; beyond that the mesh becomes unmanageable.',
        question: 'What needs to reach what?',
        branches: [
          {
            condition: 'Two VPCs, simple and stable',
            result: 'VPC peering',
            detail: 'No hourly charge, but non-transitive',
            tone: 'accent',
          },
          {
            condition: 'Many VPCs, or on-premise too',
            result: 'Transit Gateway',
            detail: 'Hub and spoke, transitive, route tables',
            tone: 'success',
          },
          {
            condition: 'One service exposed to another VPC',
            result: 'PrivateLink',
            detail: 'No network join, no CIDR conflict',
            tone: 'success',
          },
          {
            condition: 'On-premise with consistent latency',
            result: 'Direct Connect + VPN backup',
            detail: 'Weeks to provision',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'Transit Gateway charges per attachment per hour and per gigabyte processed, so it is not free - but the operational simplicity almost always justifies it beyond a handful of VPCs.',
      'Transit Gateway route tables let you enforce isolation: production spokes that can reach shared services but not each other.',
      'PrivateLink is the only one of these that works cleanly with overlapping CIDRs, which makes it valuable after an acquisition.',
      'Plan the IP space centrally from the start. Retrofitting non-overlapping CIDRs across live VPCs is extremely painful.',
    ],
    traps: [
      'Expecting transitive routing from peering. It does not exist.',
      'Overlapping CIDR ranges, discovered when two networks need to connect.',
      'A full peering mesh that nobody can reason about after the sixth VPC.',
      'Forgetting the route table entries on both sides of a peering.',
    ],
    followUps: [
      'Two VPCs have overlapping CIDRs and must share a service. What are your options?',
      'Why does peering not scale?',
    ],
    tags: ['networking', 'transit gateway', 'vpc peering', 'direct connect', 'advanced'],
  },
  {
    id: 'itv-aws-41',
    level: 'basic',
    kind: 'open',
    prompt: 'What is an AMI and why does it matter for deployments?',
    probing: 'Immutable infrastructure thinking, introduced simply.',
    answer: [
      'An **AMI** is a machine image - a template containing the operating system, installed software and configuration - that EC2 instances are launched from. Every instance starts as a copy of one.',
      'It matters because it is the difference between **configuring servers** and **replacing them**. If you launch a bare AMI and configure it at boot, every instance runs a script that can fail, install a different package version, or be affected by a transient network problem. Instances drift apart, and "works on instance 3 but not instance 7" becomes possible.',
      'Baking a **complete, versioned AMI** - with Packer, typically - means every instance is byte-identical, boots in seconds rather than minutes, and a rollback is launching the previous AMI. That is immutable infrastructure: you never modify a running server, you replace it.',
      'The trade-off is build time: a change to any package means rebuilding and redistributing the image. The usual compromise is a **golden base AMI** rebuilt regularly with the OS and agents, and application code deployed on top - or, increasingly, containers, where the image serves the same purpose with a much faster build.',
    ],
    traps: [
      'Configuring at boot with a long script and treating the result as reproducible.',
      'Never rebuilding the base AMI, so instances launch with months-old unpatched packages.',
      'AMIs that are not versioned, so rollback means finding the right one by date.',
    ],
    followUps: ['How does this relate to container images?'],
    tags: ['ami', 'immutable infrastructure', 'ec2', 'fundamentals'],
  },
  {
    id: 'itv-aws-42',
    level: 'intermediate',
    kind: 'mcq',
    prompt: 'What does an ALB health check failing actually do?',
    probing: 'Load balancer behaviour under partial failure.',
    options: [
      {
        id: 'a',
        text: 'The target is removed from rotation and stops receiving new requests; it is not terminated',
      },
      { id: 'b', text: 'The instance is terminated immediately' },
      { id: 'c', text: 'The whole target group is taken out of service' },
      { id: 'd', text: 'Traffic continues but is logged as degraded' },
    ],
    correct: ['a'],
    answer: [
      'The load balancer stops sending **new requests** to that target and keeps checking it. If it recovers, traffic resumes automatically. The instance itself is untouched - the ALB has no power to terminate anything.',
      'Termination is a **separate** mechanism: if the autoscaling group is configured to use **ELB health checks** (rather than only EC2 status checks), it will replace a target the load balancer considers unhealthy. That configuration is frequently missed, which is why an instance can sit out of rotation indefinitely while the ASG believes everything is fine.',
      'Two details matter in practice. **Deregistration delay** (connection draining) lets in-flight requests finish before a target is removed during a deliberate deregistration. And if **every** target fails its health check, the ALB returns 503 - it does not fall back to sending traffic to unhealthy targets.',
    ],
    code: [
      {
        title: 'Make the ASG act on ELB health',
        language: 'bash',
        code: `aws autoscaling update-auto-scaling-group \\
  --auto-scaling-group-name api-asg \\
  --health-check-type ELB \\
  --health-check-grace-period 300     # do not judge an instance before it has booted`,
        explanation:
          'Without health-check-type ELB, the ASG only notices hardware-level EC2 failures.',
      },
    ],
    traps: [
      'ASG health check type left as EC2, so application failures never trigger replacement.',
      'A grace period shorter than boot time, causing a replacement loop.',
      'A health check that hits a path requiring authentication or a database, so a dependency blip removes every target at once.',
    ],
    followUps: ['What happens when every target in the group is unhealthy?'],
    tags: ['alb', 'health checks', 'autoscaling', 'reliability'],
  },
  {
    id: 'itv-aws-43',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'An RDS database has slowed dramatically. The application is timing out. Walk me through your response.',
    probing: 'Database incident response, with mitigation before root cause.',
    answer: [
      'First **establish the shape of it**, quickly. Is it all queries or some? Did it start suddenly or degrade gradually? Sudden and total points at a failover, a resource limit or a lock; gradual points at data growth or a query-plan change.',
      'Then look at the **RDS metrics** in this order: **CPU**, **freeable memory**, **read/write IOPS against the provisioned limit**, **database connections against `max_connections`**, and **burst balance** on gp2 volumes. That last one is a classic and easy to miss - a gp2 volume that exhausts its burst credits drops to baseline IOPS and the database becomes dramatically slower with no other signal.',
      '**Connection exhaustion** is the other frequent cause: an application without connection pooling, or a pool sized per-pod multiplied by a recent scale-out, hits `max_connections` and new connections are refused. That looks like a database problem and is really an application configuration problem.',
      'Then **Performance Insights** to find the actual expensive queries, which usually names the cause directly - a missing index after a schema change, a query whose plan flipped as the table grew, or a long-running transaction holding locks.',
      '**Mitigate before fixing properly**: kill a runaway query or blocking transaction, scale the instance up if it is genuinely resource-bound, or fail over if a specific instance is unhealthy. Restoring service comes first.',
      'Then the real fix - an index, a query change, connection pooling with RDS Proxy, a read replica for reporting load - and **alerting** on the leading indicators so the next one is caught before users notice: connection count approaching the limit, burst balance falling, replica lag growing.',
    ],
    code: [
      {
        title: 'What is the database actually doing?',
        language: 'bash',
        code: `# The metrics, in order of likelihood
for m in CPUUtilization FreeableMemory DatabaseConnections \\
         ReadIOPS WriteIOPS BurstBalance ReadLatency; do
  echo "=== $m"
  aws cloudwatch get-metric-statistics --namespace AWS/RDS --metric-name "$m" \\
    --dimensions Name=DBInstanceIdentifier,Value=prod-db \\
    --start-time "$(date -u -d '2 hours ago' +%FT%TZ)" --end-time "$(date -u +%FT%TZ)" \\
    --period 300 --statistics Average Maximum --output text | tail -5
done`,
      },
      {
        title: 'Find and stop the blocking query (PostgreSQL)',
        language: 'text',
        code: `-- What is running, and for how long?
SELECT pid, now() - query_start AS duration, state, wait_event_type, left(query, 120)
FROM pg_stat_activity
WHERE state != 'idle' AND now() - query_start > interval '30 seconds'
ORDER BY duration DESC;

-- Who is blocking whom?
SELECT blocked.pid AS blocked_pid, blocking.pid AS blocking_pid,
       left(blocked.query, 60) AS blocked_query
FROM pg_stat_activity blocked
JOIN pg_stat_activity blocking
  ON blocking.pid = ANY(pg_blocking_pids(blocked.pid));

-- Mitigate: cancel first, terminate only if it will not stop
SELECT pg_cancel_backend(12345);
SELECT pg_terminate_backend(12345);`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Narrowing an RDS slowdown',
        caption: 'Burst balance and connection count are the two causes most often missed.',
        nodes: [
          {
            label: 'All queries or some?',
            detail: 'Resource limit vs a specific query',
            tone: 'accent',
          },
          {
            label: 'CPU, memory, IOPS, connections',
            detail: 'Against their limits, not in isolation',
          },
          {
            label: 'Burst balance on gp2',
            detail: 'Exhausted = sudden severe slowdown',
            tone: 'warning',
          },
          { label: 'Performance Insights', detail: 'Which query, which wait event' },
          { label: 'Mitigate: kill, scale or fail over', tone: 'danger' },
          { label: 'Fix properly + alert on leading signals', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'gp3 volumes have no burst concept and provision IOPS independently of size - migrating from gp2 removes this failure mode entirely.',
      'RDS Proxy pools and multiplexes connections, which is usually the right answer when Lambda or a large number of pods exhaust `max_connections`.',
      'Enable Performance Insights before you need it. Turning it on during an incident gives you no history to compare against.',
      'Check for a recent deploy. A missing index on a newly added query is a very common cause of "it was fine yesterday".',
    ],
    traps: [
      'Scaling the instance up without finding the cause - it buys time and hides a query problem.',
      'Missing exhausted burst balance, which produces a dramatic slowdown with normal CPU.',
      'Terminating backends before cancelling, which can leave transactions to roll back.',
      'Treating connection exhaustion as a database problem rather than an application one.',
    ],
    followUps: [
      'The CPU is at 20% and it is still slow. What now?',
      'How would you have caught this before users did?',
    ],
    tags: ['scenario', 'rds', 'database', 'troubleshooting', 'performance', 'advanced'],
  },
  {
    id: 'itv-aws-44',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are VPC endpoints and why would you use them?',
    probing: 'Private connectivity to AWS services - both a cost and a security answer.',
    answer: [
      'By default, traffic from a private subnet to an AWS service such as S3 goes out through a **NAT gateway** to the public internet and back to AWS. That is both a cost (NAT hourly charge plus per-gigabyte processing) and, for some compliance regimes, an unwanted path.',
      'A **VPC endpoint** keeps that traffic on the AWS network. **Gateway endpoints** exist for **S3 and DynamoDB only**, work by adding a route to the route table, and are **free** - they should essentially always be present in any VPC using those services, because they remove the NAT cost entirely for that traffic.',
      '**Interface endpoints** (PrivateLink) work for most other services and for third-party or your own services. They create an ENI with a private IP in your subnet, and are charged per hour per availability zone plus per gigabyte - still usually cheaper than NAT, and they keep traffic off the public internet.',
      'The security angle is that an endpoint **policy** can restrict what the endpoint may be used for, and a bucket policy can require that access arrives via a specific endpoint (`aws:SourceVpce`). That combination means the bucket is genuinely unreachable from the internet, regardless of credentials.',
    ],
    code: [
      {
        title: 'A free gateway endpoint for S3',
        language: 'bash',
        code: `aws ec2 create-vpc-endpoint \\
  --vpc-id vpc-abc123 \\
  --service-name com.amazonaws.eu-west-1.s3 \\
  --vpc-endpoint-type Gateway \\
  --route-table-ids rtb-private-1a rtb-private-1b rtb-private-1c`,
      },
      {
        title: 'Bucket policy requiring the endpoint',
        language: 'json',
        code: `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Deny",
    "Principal": "*",
    "Action": "s3:*",
    "Resource": ["arn:aws:s3:::app-data", "arn:aws:s3:::app-data/*"],
    "Condition": {
      "StringNotEquals": { "aws:SourceVpce": "vpce-0abc123" }
    }
  }]
}`,
        explanation:
          'Even valid credentials cannot reach this bucket from outside the VPC endpoint.',
      },
    ],
    traps: [
      'Forgetting the S3 gateway endpoint and paying NAT data-processing charges on every object read.',
      'Adding an interface endpoint in only one availability zone, creating a dependency on that zone.',
      'A restrictive bucket policy that also blocks legitimate access from other accounts or services.',
    ],
    followUps: ['Which two services have free gateway endpoints, and why does that matter?'],
    tags: ['vpc endpoints', 'privatelink', 'cost', 'security', 'networking'],
  },
  {
    id: 'itv-aws-45',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you design a CI/CD pipeline deploying to AWS, using AWS-native services?',
    probing: 'AWS delivery tooling, and knowing when not to use it.',
    answer: [
      'The native stack is **CodePipeline** for orchestration, **CodeBuild** for build and test, **CodeDeploy** or **ECS/EKS deployments** for release, and **CodeArtifact** or **ECR** for artefacts. It integrates with IAM and CloudWatch natively, needs no servers, and keeps everything inside the account boundary - which matters in regulated environments.',
      'The shape I would build: source from CodeCommit or GitHub, CodeBuild for build and test producing an image pushed to **ECR** with the commit SHA, a deployment to a staging environment with automated smoke tests, a manual approval action, and a production deployment **by image digest**.',
      'For the production deployment I would use **CodeDeploy with a blue/green or canary configuration** on ECS, which shifts traffic gradually and **rolls back automatically on CloudWatch alarms**. That automated rollback is the part worth having: it acts in seconds without a human noticing.',
      'Cross-account is where the AWS-native approach earns its keep: the pipeline lives in a tooling account and **assumes a role** in each target account to deploy. No credentials are stored anywhere, and each target account controls exactly what the pipeline may do there.',
      'The honest caveat: for teams already on GitHub, **GitHub Actions with OIDC** into AWS is usually a better developer experience, and CodePipeline’s configuration is verbose. I would choose the native stack when account isolation, compliance, or keeping everything inside AWS is a genuine requirement - not by default.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Native pipeline with automated rollback',
        caption: 'The pipeline assumes a role per target account - no stored credentials anywhere.',
        nodes: [
          { label: 'Source', detail: 'CodeCommit or GitHub', tone: 'accent' },
          { label: 'CodeBuild: test + build image', detail: 'Pushed to ECR by SHA' },
          { label: 'Deploy to staging', detail: 'AssumeRole into the staging account' },
          { label: 'Automated smoke tests', detail: 'Failure stops the pipeline', tone: 'warning' },
          { label: 'Manual approval', detail: 'Optional, for higher-risk changes' },
          {
            label: 'CodeDeploy canary to production',
            detail: 'By digest, traffic shifted gradually',
          },
          { label: 'Alarm triggers automatic rollback', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'CodeDeploy’s alarm-triggered rollback is genuinely valuable - it responds faster than any human and does not depend on someone watching a dashboard.',
      'Cross-account deployment via AssumeRole is the strongest argument for the native stack; the target account grants exactly what it chooses.',
      'CodeBuild is billed per build minute with no idle cost, which suits bursty pipelines well.',
      'Keep the pipeline definition itself in infrastructure as code, or you have automated deployment with a hand-configured deployer.',
    ],
    traps: [
      'Choosing CodePipeline by default when the team lives in GitHub and would be better served by Actions.',
      'No automated rollback, relying on the approval gate to catch problems it cannot detect.',
      'Deploying a tag rather than a digest.',
      'A pipeline role with administrator access in the target account.',
    ],
    followUps: [
      'When would you use GitHub Actions instead?',
      'How does the pipeline deploy into another account without credentials?',
    ],
    tags: ['cicd', 'codepipeline', 'codedeploy', 'cross-account', 'advanced'],
  },
  {
    id: 'itv-aws-46',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between stopping and terminating an EC2 instance?',
    probing: 'A basic distinction with data-loss consequences.',
    options: [
      {
        id: 'a',
        text: 'Stopping shuts it down but keeps the EBS root volume and the instance; terminating deletes the instance and, by default, the root volume',
      },
      { id: 'b', text: 'They are the same, with different names in the console and the CLI' },
      { id: 'c', text: 'Stopping deletes the data; terminating preserves it' },
      { id: 'd', text: 'Terminating can be undone within 24 hours' },
    ],
    correct: ['a'],
    answer: [
      '**Stopping** shuts the instance down. The EBS root volume persists, the instance ID and any attached volumes remain, and you can start it again. You stop paying for compute but continue paying for storage.',
      '**Terminating** deletes the instance permanently, and by default deletes the **root EBS volume** with it (`DeleteOnTermination` is true for the root volume by default, false for additional attached volumes). It cannot be undone.',
      'Two things change on stop/start that surprise people: any data on **instance store** volumes is lost, because that is physically attached storage on the host and the instance moves to a different host; and the **public IPv4 address changes** unless you use an elastic IP.',
      '**Termination protection** is worth enabling on anything important - it makes accidental termination require a deliberate extra step.',
    ],
    traps: [
      'Data on instance store lost across a stop/start, which is by design but rarely expected.',
      'Assuming an additional EBS volume is deleted on termination. By default it is not, which quietly accumulates cost.',
      'No termination protection on a production instance.',
    ],
    followUps: ['What happens to the public IP when you stop and start an instance?'],
    tags: ['ec2', 'lifecycle', 'ebs', 'fundamentals'],
  },
  {
    id: 'itv-aws-47',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are spot instances and how do you use them safely?',
    probing: 'Cost optimisation with a real understanding of the interruption risk.',
    answer: [
      'Spot instances use AWS’s spare capacity at **60-90% below on-demand prices**. The trade-off is that AWS can **reclaim them with two minutes’ notice** when it needs the capacity back.',
      'They suit anything **interruptible and stateless**: batch processing, CI build agents, data pipelines, rendering, and stateless web tiers where losing an instance is routine. They are wrong for a database, for a stateful singleton, or for anything where an interruption means data loss.',
      'Using them safely comes down to a few practices. **Handle the interruption notice** - the instance metadata exposes it two minutes ahead, which is enough to drain connections, checkpoint work and deregister from the load balancer. **Diversify across instance types and availability zones**, because spot capacity is per instance type per zone and a pool can be exhausted; a fleet spanning ten types is far more stable than one requesting a single type. And **mix with on-demand**: a baseline of on-demand capacity that guarantees service, with spot on top for the variable portion.',
      'On Kubernetes this works well: spot node groups with a taint, workloads that tolerate it, and a PodDisruptionBudget plus the node termination handler so pods are drained gracefully when a node is reclaimed.',
    ],
    code: [
      {
        title: 'React to the interruption notice',
        language: 'bash',
        code: `#!/usr/bin/env bash
# Poll the metadata endpoint; act on the two-minute warning.
TOKEN=$(curl -sX PUT http://169.254.169.254/latest/api/token \\
  -H 'X-aws-ec2-metadata-token-ttl-seconds: 21600')

while true; do
  code=$(curl -s -o /dev/null -w '%{http_code}' \\
    -H "X-aws-ec2-metadata-token: $TOKEN" \\
    http://169.254.169.254/latest/meta-data/spot/instance-action)

  if [ "$code" = "200" ]; then
    echo "spot interruption notice received - draining"
    ./deregister-from-lb.sh      # stop new traffic
    ./checkpoint-work.sh         # save progress
    ./drain-connections.sh       # finish in-flight requests
    break
  fi
  sleep 5
done`,
      },
    ],
    traps: [
      'Requesting a single instance type, so one exhausted pool takes out the whole fleet.',
      'Ignoring the two-minute notice, so work in progress is lost.',
      'Spot for a database or any stateful singleton.',
      'A capacity-optimised allocation strategy assumed to mean "never interrupted" - it means less often.',
    ],
    followUps: [
      'How would you run CI build agents on spot safely?',
      'Why does diversifying instance types matter so much?',
    ],
    tags: ['spot', 'cost', 'ec2', 'resilience'],
  },
  {
    id: 'itv-aws-48',
    level: 'advanced',
    kind: 'multi',
    prompt:
      'Which of these would you expect in a well-run AWS production account? Select all that apply.',
    probing: 'Baseline operational maturity - a broad sanity check.',
    options: [
      {
        id: 'a',
        text: 'CloudTrail enabled organisation-wide, delivered to a separate log archive account',
      },
      {
        id: 'b',
        text: 'All infrastructure defined as code, with console changes treated as drift to be corrected',
      },
      { id: 'c', text: 'Block Public Access enabled at the account level, and GuardDuty on' },
      {
        id: 'd',
        text: 'Root account used for routine administration so there is a single audit trail',
      },
      { id: 'e', text: 'Budgets, cost anomaly detection and enforced tagging for attribution' },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'Using the **root account routinely** is the opposite of good practice. The root user can do things no IAM policy can restrict - closing the account, changing billing, deleting certain resources - and it cannot be scoped. It should have MFA, no access keys, and be used only for the handful of tasks that genuinely require it.',
      'The rest are the baseline. **Organisation-wide CloudTrail into a separate account** means an attacker who compromises an account cannot delete the evidence. **Infrastructure as code with drift treated as a defect** is what makes the environment reproducible and reviewable.',
      '**Account-level Block Public Access and GuardDuty** are two settings that between them prevent the most common breach and detect much of the rest. **Budgets, anomaly detection and tagging** are what stop cost becoming a quarterly surprise and make it attributable.',
      'I would add to the list: SSO rather than IAM users, MFA enforced, Config rules for compliance drift, and tested backups.',
    ],
    traps: [
      'Root account with access keys - the highest-risk single artefact in an AWS account.',
      'Console changes accepted as normal, so the code no longer describes reality.',
      'GuardDuty enabled but its findings routed nowhere.',
    ],
    followUps: ['What are the few tasks that genuinely require the root account?'],
    tags: ['best practices', 'governance', 'security', 'operations', 'advanced'],
  },
  {
    id: 'itv-aws-49',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does Route 53 routing work, and what policies are available?',
    probing: 'DNS-based traffic management.',
    answer: [
      'Route 53 is authoritative DNS with **health checks** and several routing policies that decide which answer a query receives.',
      '**Simple** returns one record. **Weighted** splits traffic by proportion, which is how you do a DNS-level canary or a gradual migration. **Latency-based** returns the region with the lowest latency for the querying resolver. **Geolocation** and **geoproximity** route by where the user is, for compliance or content localisation. **Failover** returns the primary while it is healthy and the secondary when it is not. **Multivalue answer** returns several healthy records and lets the client choose, which is a simple form of load balancing with health awareness.',
      '**Alias records** are a Route 53 feature worth knowing: they point at an AWS resource such as an ALB or CloudFront distribution, resolve to its current addresses automatically, work at the zone apex where a CNAME cannot, and are not charged for queries.',
      'The important limitation to state: **DNS is a poor failover mechanism** because of caching. Clients and resolvers cache answers for the TTL, and many ignore short TTLs. A 60-second TTL does not mean 60-second failover - some clients will hold the old address for much longer. For fast failover, a load balancer or a global accelerator is a better tool; DNS failover is for regional or coarse-grained changes.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which routing policy?',
        caption: 'DNS-level control is coarse; caching limits how quickly changes take effect.',
        question: 'What are you trying to achieve?',
        branches: [
          {
            condition: 'Gradual rollout or migration',
            result: 'Weighted',
            detail: 'Shift a percentage at a time',
            tone: 'accent',
          },
          {
            condition: 'Lowest latency for a global audience',
            result: 'Latency-based',
            tone: 'success',
          },
          {
            condition: 'Regional failover with health checks',
            result: 'Failover',
            detail: 'Subject to DNS caching',
            tone: 'warning',
          },
          {
            condition: 'Data residency or localised content',
            result: 'Geolocation',
            tone: 'accent',
          },
        ],
      },
    ],
    traps: [
      'Expecting a 60-second TTL to give 60-second failover. Client caching is not that obedient.',
      'A CNAME at the zone apex, which DNS does not allow - use an alias record.',
      'Health checks that test a path which fails for reasons unrelated to the service.',
    ],
    followUps: ['Why is DNS a poor mechanism for fast failover?'],
    tags: ['route 53', 'dns', 'routing', 'failover'],
  },
  {
    id: 'itv-aws-50',
    level: 'basic',
    kind: 'open',
    prompt: 'What is Infrastructure as Code and why does it matter on a cloud platform?',
    probing: 'A foundational question, phrased for a beginner but revealing at any level.',
    answer: [
      'Infrastructure as code means defining your servers, networks, databases and permissions in **files that are version controlled**, and having a tool create and update the real resources to match. Nobody clicks through a console to make a change; they change the file and apply it.',
      'It matters on a cloud platform specifically because **everything is an API call**, so everything can be described in code - and because cloud environments change constantly. Without it you get an environment nobody can fully describe, differences between staging and production that nobody can account for, and a disaster recovery plan that consists of remembering what was configured.',
      'The concrete benefits: changes are **reviewed** before they happen; the history of every change is in git with an author and a reason; environments are **reproducible**, so staging genuinely resembles production; and rebuilding after a loss is running a command rather than a week of archaeology.',
      'The discipline it requires is that **the code must be the only way changes happen**. One person making a quick fix in the console creates drift, and once the code no longer describes reality, people stop trusting it and stop using it - at which point you have the worst of both.',
    ],
    traps: [
      'Adopting IaC but allowing console changes, so the code and reality diverge.',
      'Committing state files or secrets alongside the code.',
      'Treating infrastructure code as less important than application code - no review, no tests, no standards.',
    ],
    followUps: ['What happens when someone makes a change in the console?'],
    tags: ['iac', 'fundamentals', 'terraform', 'practice'],
  },
]
