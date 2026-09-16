import type { InterviewQuestion } from '../../../types'

/** Compute, storage, networking and identity - the services every AWS round covers. */
export const awsCoreServiceQuestions: InterviewQuestion[] = [
  {
    id: 'itv-aws-11',
    level: 'basic',
    kind: 'open',
    prompt: 'Explain regions, availability zones and edge locations.',
    probing: 'The foundation of every availability discussion in AWS.',
    answer: [
      'A **region** is a geographic area - `eu-west-1` is Ireland. Regions are fully independent of each other: separate power, separate networks, and most services do not replicate across them unless you configure it. Data stays in the region you put it in.',
      'An **availability zone** is one or more physically separate data centres within a region, with independent power, cooling and networking, connected to the other zones by low-latency private links. A region typically has three or more.',
      'The point of zones is that they fail independently. Running in one zone means a single data centre failure takes you down; spreading across three means you survive losing one. This is the cheapest availability improvement available in AWS and the first thing to check in any architecture.',
      '**Edge locations** are a much larger set of smaller sites used by CloudFront and Route 53 to serve cached content and DNS close to users. They are for latency, not for availability of your application.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'How the hierarchy nests',
        caption: 'Zones fail independently; that independence is what you are buying.',
        root: {
          label: 'AWS global',
          children: [
            {
              label: 'Region: eu-west-1 (Ireland)',
              detail: 'Independent of other regions',
              tone: 'accent',
              children: [
                { label: 'AZ: eu-west-1a', detail: 'Separate power and cooling', tone: 'success' },
                { label: 'AZ: eu-west-1b', detail: 'Separate power and cooling', tone: 'success' },
                { label: 'AZ: eu-west-1c', detail: 'Separate power and cooling', tone: 'success' },
              ],
            },
            {
              label: 'Edge locations (400+)',
              detail: 'CloudFront and Route 53 - latency, not availability',
              tone: 'muted',
            },
          ],
        },
      },
    ],
    traps: [
      'Running production in a single availability zone, which is the most common avoidable availability gap.',
      'Assuming data replicates across regions automatically. Almost nothing does.',
      'Thinking zone names map to the same physical site across accounts - `eu-west-1a` is randomised per account.',
    ],
    followUps: [
      'What breaks if an availability zone fails?',
      'When would you actually need multi-region rather than multi-AZ?',
    ],
    tags: ['regions', 'availability zones', 'architecture', 'fundamentals'],
  },
  {
    id: 'itv-aws-12',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between a security group and a network ACL?',
    probing: 'Core VPC networking, and the stateful/stateless distinction.',
    options: [
      { id: 'a', text: 'They are the same thing at different scopes' },
      {
        id: 'b',
        text: 'Security groups are stateful and attach to resources; NACLs are stateless and apply at the subnet level',
      },
      { id: 'c', text: 'Security groups work at the subnet level; NACLs attach to instances' },
      { id: 'd', text: 'NACLs are stateful and security groups are stateless' },
    ],
    correct: ['b'],
    answer: [
      'A **security group** attaches to a resource (an instance, a load balancer, an RDS database) and is **stateful**: if you allow traffic in, the response is automatically allowed out. You only write the rule for the direction you initiate. Security groups have **allow rules only** - there is no deny.',
      'A **network ACL** applies to a **subnet** and is **stateless**: it evaluates every packet independently, so allowing inbound traffic on port 443 does **not** allow the response out. You need rules in both directions, and the return traffic uses **ephemeral ports** (1024-65535), which is the detail that catches everyone.',
      'NACLs also have **numbered rules evaluated in order**, and they support **deny**, which is the one thing security groups cannot do. That makes them useful for blocking a specific IP range, which is otherwise awkward.',
      'In practice security groups do almost all the work. NACLs are a coarse secondary layer, and a misconfigured one produces confusing failures precisely because of the stateless return-traffic behaviour.',
    ],
    code: [
      {
        title: 'A security group referencing another, rather than an IP range',
        language: 'bash',
        code: `# The database accepts 5432 only from things in the app security group.
# No IP ranges to maintain as instances come and go.
aws ec2 authorize-security-group-ingress \\
  --group-id sg-database \\
  --protocol tcp --port 5432 \\
  --source-group sg-application`,
        explanation:
          'Referencing a security group rather than a CIDR is the idiomatic pattern and survives autoscaling.',
      },
    ],
    traps: [
      'Forgetting ephemeral port rules in a NACL, so responses are silently dropped.',
      'Trying to write a deny rule in a security group. There is no such thing.',
      'Using `0.0.0.0/0` on a database security group.',
    ],
    followUps: [
      'Why does a NACL need an ephemeral port rule?',
      'How would you block one specific IP address?',
    ],
    tags: ['vpc', 'security groups', 'nacl', 'networking', 'fundamentals'],
  },
  {
    id: 'itv-aws-13',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'Explain public and private subnets. How does an instance in a private subnet reach the internet?',
    probing: 'VPC design fundamentals - the answer must mention route tables, not just NAT.',
    answer: [
      'The distinction is entirely about **routing**, not a setting called "public". A **public subnet** is one whose route table has a route to an **internet gateway**. A **private subnet** does not.',
      'An instance in a private subnet reaches the internet **outbound** through a **NAT gateway**, which lives in a *public* subnet. The private subnet’s route table sends `0.0.0.0/0` to the NAT gateway, which translates the source address and forwards through the internet gateway. Return traffic comes back the same way. Nothing on the internet can initiate a connection inbound - that is the point.',
      'The typical three-tier layout: load balancers in public subnets, application instances in private subnets, databases in private subnets with no internet route at all. Only the load balancer is reachable from outside.',
      'Two practical notes. A NAT gateway is **per availability zone** - one in each, or a zone failure takes out egress for the instances in the surviving zones that route through it. And NAT gateways are billed per hour **and per gigabyte processed**, which makes them a surprisingly large line item; **VPC endpoints** for S3 and DynamoDB bypass NAT entirely and are usually worth adding.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Outbound path from a private subnet',
        caption:
          'The route table is what makes a subnet public or private - there is no other switch.',
        nodes: [
          { label: 'Instance in private subnet', detail: 'No public IP', tone: 'accent' },
          { label: 'Route table: 0.0.0.0/0 -> NAT', arrowLabel: 'default route' },
          { label: 'NAT gateway', detail: 'In a PUBLIC subnet, per AZ', tone: 'warning' },
          { label: 'Internet gateway', arrowLabel: 'source address translated' },
          { label: 'Internet', detail: 'Cannot initiate inbound', tone: 'success' },
        ],
      },
    ],
    deeper: [
      'One NAT gateway for all zones is a single point of failure *and* generates cross-AZ data charges. One per zone is the correct pattern.',
      'A **gateway endpoint** for S3 and DynamoDB is free and removes that traffic from NAT entirely - often the single biggest NAT cost reduction available.',
      '**Interface endpoints** (PrivateLink) do the same for most other services, at a per-hour cost, and also keep the traffic off the public internet for compliance reasons.',
      'An egress-only internet gateway is the IPv6 equivalent of NAT.',
    ],
    traps: [
      'A single NAT gateway shared across three zones.',
      'Putting the NAT gateway in a private subnet, which cannot work.',
      'Large S3 traffic going through NAT and appearing as an unexplained data-processing bill.',
    ],
    followUps: [
      'How would you reduce NAT gateway costs?',
      'What happens to a private subnet if its NAT gateway’s AZ fails?',
    ],
    tags: ['vpc', 'subnets', 'nat', 'networking', 'cost'],
  },
  {
    id: 'itv-aws-14',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does IAM work? Explain users, roles, policies and the evaluation logic.',
    probing:
      'IAM is where most AWS security incidents originate. The explicit-deny rule is the part to get right.',
    answer: [
      'An **identity** is a user, a group or a role. A **policy** is a JSON document granting or denying actions on resources. Policies attach to identities (identity-based) or to resources such as S3 buckets and KMS keys (resource-based).',
      'A **role** is the important concept and the one people underuse. It is a set of permissions with **no permanent credentials** - something *assumes* it and receives temporary credentials that expire. EC2 instances, Lambda functions, ECS tasks and federated users from another identity provider all get their permissions this way. If you find yourself creating an IAM user with access keys for an application, you almost certainly want a role instead.',
      'The **evaluation logic** is worth stating precisely because it is frequently misremembered: **an explicit Deny always wins**, anywhere in any applicable policy. Otherwise, an explicit Allow grants access. Otherwise, the default is **implicit deny**. So permissions are additive across policies, with any deny overriding everything.',
      'On top of that, **service control policies** at the organisation level set a maximum boundary - they do not grant anything, they only limit what member accounts can do, and nothing in an account can exceed that boundary.',
    ],
    code: [
      {
        title: 'A least-privilege policy with a condition',
        language: 'json',
        code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOwnPrefixOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::app-data/\${aws:PrincipalTag/team}/*"
    },
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::app-data/*",
      "Condition": {
        "StringNotEquals": { "s3:x-amz-server-side-encryption": "aws:kms" }
      }
    }
  ]
}`,
        explanation:
          'The explicit Deny wins regardless of any other policy that might allow the upload.',
      },
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'IAM evaluation order',
        caption: 'Deny wins, then Allow, then the implicit deny that is the default.',
        question: 'Is this request permitted?',
        branches: [
          {
            condition: 'Any applicable policy has an explicit Deny',
            result: 'Denied',
            detail: 'Nothing can override this',
            tone: 'danger',
          },
          {
            condition: 'An SCP or permission boundary excludes it',
            result: 'Denied',
            detail: 'Boundaries limit, they never grant',
            tone: 'danger',
          },
          {
            condition: 'An explicit Allow applies',
            result: 'Allowed',
            tone: 'success',
          },
          {
            condition: 'Nothing matches',
            result: 'Denied by default',
            detail: 'Implicit deny',
            tone: 'muted',
          },
        ],
      },
    ],
    deeper: [
      'Use **conditions** aggressively: source IP, MFA presence, requested region, resource tags. A policy without conditions is usually broader than intended.',
      '**IAM Access Analyzer** can generate a least-privilege policy from CloudTrail history, which is far more practical than writing one from scratch.',
      '**Permission boundaries** let you delegate IAM administration safely - a team can create roles, but never ones more powerful than the boundary.',
      'Long-lived access keys are the root of most AWS incidents. Prefer roles, and OIDC federation for CI systems.',
    ],
    traps: [
      'Attaching `AdministratorAccess` to solve a permissions problem.',
      'Creating IAM users with access keys for applications instead of using roles.',
      'Forgetting that an explicit Deny cannot be overridden by any Allow.',
      'Wildcards in `Resource` when a specific ARN would do.',
    ],
    followUps: [
      'How would you give a CI pipeline access without storing keys?',
      'What is the difference between an SCP and an IAM policy?',
    ],
    tags: ['iam', 'security', 'policies', 'roles', 'fundamentals'],
  },
  {
    id: 'itv-aws-15',
    level: 'intermediate',
    kind: 'open',
    prompt: 'Compare EC2, ECS, EKS, Fargate and Lambda. How would you choose?',
    probing:
      'Compute selection - the answer should be about operational burden and workload shape.',
    answer: [
      'Think of it as a spectrum from most control and most operational work to least of both.',
      '**EC2** gives you virtual machines. Maximum control, maximum responsibility: patching, scaling, capacity, AMI management. Right when you need specific hardware, a legacy application, or software with licensing tied to the host.',
      '**ECS** is AWS’s own container orchestrator - simpler than Kubernetes, deeply integrated with AWS, and with no control plane to operate. **EKS** is managed Kubernetes: you get the Kubernetes ecosystem and portability, at the cost of more complexity and a per-cluster charge. Choose ECS if you are committed to AWS and want less to learn; EKS if you already have Kubernetes skills or want portability.',
      '**Fargate** is a **capacity mode** rather than a separate orchestrator - it runs ECS or EKS tasks without you managing any instances at all. It costs more per unit of compute, and it removes node patching, capacity planning and autoscaling of instances entirely.',
      '**Lambda** is event-driven functions with no servers, per-millisecond billing and scale to zero. Right for spiky, short, event-driven work; wrong for long-running processes, anything needing more than 15 minutes, or steady high-volume traffic where a container is cheaper.',
      'My default reasoning: Lambda for genuinely event-driven work, Fargate for containerised services where the team is small, ECS or EKS on EC2 when the volume makes the Fargate premium material, and EC2 only when something specific requires it.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Choosing a compute service',
        caption:
          'The question is usually how much operational work you want, not what is possible.',
        question: 'What shape is the workload?',
        branches: [
          {
            condition: 'Short, event-driven, spiky',
            result: 'Lambda',
            detail: 'Scales to zero; 15-minute ceiling',
            tone: 'success',
          },
          {
            condition: 'Containerised service, small team',
            result: 'ECS on Fargate',
            detail: 'No instances to manage',
            tone: 'success',
          },
          {
            condition: 'Kubernetes skills or portability needed',
            result: 'EKS',
            detail: 'More power, more to operate',
            tone: 'accent',
          },
          {
            condition: 'Specific hardware, licensing, or legacy',
            result: 'EC2',
            detail: 'Full control, full responsibility',
            tone: 'warning',
          },
        ],
      },
    ],
    deeper: [
      'Lambda cold starts matter for latency-sensitive synchronous APIs; provisioned concurrency fixes it at a cost that erodes the serverless economics.',
      'Fargate’s premium is roughly 20-50% per unit of compute, but it removes real headcount cost. Below a certain scale it is cheaper overall.',
      'EKS charges per cluster per hour on top of nodes, which makes many small clusters expensive - a reason to prefer namespaces over cluster sprawl.',
      'Graviton (arm64) instances are typically 20-40% cheaper for the same performance across EC2, ECS, EKS and Lambda, and are usually the easiest cost win available.',
    ],
    traps: [
      'Choosing EKS because it is fashionable when ECS would need a fraction of the operational effort.',
      'Lambda for a steady high-throughput workload, where it is far more expensive than a container.',
      'Ignoring the 15-minute Lambda limit until a job starts timing out.',
    ],
    followUps: [
      'When is Lambda more expensive than a container?',
      'Why might you pick ECS over EKS?',
    ],
    tags: ['compute', 'ecs', 'eks', 'lambda', 'fargate', 'architecture'],
  },
  {
    id: 'itv-aws-16',
    level: 'intermediate',
    kind: 'multi',
    prompt: 'Which of these genuinely protect data in an S3 bucket? Select all that apply.',
    probing: 'S3 security, which is behind a large share of public data breaches.',
    options: [
      { id: 'a', text: 'Block Public Access at the account and bucket level' },
      {
        id: 'b',
        text: 'A bucket policy restricting access to specific principals or VPC endpoints',
      },
      {
        id: 'c',
        text: 'Server-side encryption with KMS, with key policies controlling decryption',
      },
      { id: 'd', text: 'Giving the bucket a name that is hard to guess' },
      {
        id: 'e',
        text: 'Versioning combined with MFA delete and Object Lock for ransomware resistance',
      },
    ],
    correct: ['a', 'b', 'c', 'e'],
    answer: [
      'An obscure name protects nothing. Bucket names are in a **global namespace**, they appear in DNS and TLS certificates, and they are routinely enumerated. Security through obscurity has never worked here.',
      '**Block Public Access** is the single most valuable control - enable it at the **account** level so no individual bucket can be made public by mistake. This one setting would have prevented most of the publicised S3 leaks.',
      '**Bucket policies** scope access to specific principals, and a condition on `aws:SourceVpce` restricts access to a VPC endpoint so the data is not reachable from the internet at all.',
      '**KMS encryption** adds a second authorisation layer: reading an object requires both S3 permission and permission to use the key, so a misconfigured bucket policy alone is not enough to leak data.',
      '**Versioning with MFA delete and Object Lock** is about a different threat - ransomware and accidental deletion. Object Lock in compliance mode means even the root account cannot delete an object before its retention expires.',
    ],
    code: [
      {
        title: 'The controls worth applying by default',
        language: 'bash',
        code: `# Account-wide: no bucket can be made public, whatever its own settings say
aws s3control put-public-access-block \\
  --account-id 123456789012 \\
  --public-access-block-configuration \\
    BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# Default encryption with a customer-managed key
aws s3api put-bucket-encryption --bucket app-data \\
  --server-side-encryption-configuration '{
    "Rules":[{"ApplyServerSideEncryptionByDefault":
      {"SSEAlgorithm":"aws:kms","KMSMasterKeyID":"arn:aws:kms:eu-west-1:123456789012:key/abc"},
      "BucketKeyEnabled":true}]}'

# Versioning, as the basis for recovery
aws s3api put-bucket-versioning --bucket app-data \\
  --versioning-configuration Status=Enabled`,
      },
    ],
    traps: [
      'Relying on a hard-to-guess name.',
      'Enabling Block Public Access per bucket rather than account-wide, leaving the next bucket unprotected.',
      'Versioning without a lifecycle rule, so old versions accumulate and the bill grows quietly.',
    ],
    followUps: [
      'How does KMS encryption add a second authorisation layer?',
      'How would you make a bucket resistant to ransomware?',
    ],
    tags: ['s3', 'security', 'encryption', 'kms', 'data protection'],
  },
  {
    id: 'itv-aws-17',
    level: 'advanced',
    kind: 'open',
    prompt: 'How would you design a highly available, fault-tolerant web application on AWS?',
    probing:
      'Classic architecture question. The structure of the answer matters as much as the services named.',
    answer: [
      'I would work through it in tiers, applying the same principle at each: **no single point of failure, and spread across availability zones**.',
      '**Edge**: Route 53 for DNS with health checks, CloudFront in front for caching and TLS termination close to users, and AWS WAF attached for basic protection.',
      '**Load balancing**: an Application Load Balancer across at least three availability zones, with health checks that reflect whether the application can actually serve requests rather than just that a port is open.',
      '**Compute**: the application in private subnets across three zones, in an autoscaling group or as ECS/EKS services, scaled on a metric that tracks user experience - request count or latency rather than CPU where possible. Stateless, so any instance can serve any request and losing one is uneventful.',
      '**Data**: RDS Multi-AZ for automatic failover to a standby in another zone, with read replicas if reads dominate. ElastiCache for caching, also multi-AZ. S3 for objects, which is already multi-AZ by design.',
      '**State**: sessions in ElastiCache or DynamoDB rather than on instances, because instance-local state is what turns a routine scale-in into an incident.',
      'Then the parts people forget: **backups tested by restoring them**, **alerting on user-facing symptoms** rather than just infrastructure metrics, **infrastructure as code** so the environment can be rebuilt, and a clear statement of the **RTO and RPO** you are actually designing for - because "highly available" without numbers means nothing, and multi-region costs several times more than multi-AZ for a failure mode that is far rarer.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'Three-tier, three zones',
        caption:
          'Every tier spans zones, and only the load balancer is reachable from the internet.',
        root: {
          label: 'Region (eu-west-1)',
          children: [
            {
              label: 'Public subnets (3 AZs)',
              detail: 'ALB + NAT gateway per AZ',
              tone: 'warning',
            },
            {
              label: 'Private app subnets (3 AZs)',
              detail: 'Autoscaling group / ECS service, stateless',
              tone: 'accent',
            },
            {
              label: 'Private data subnets (3 AZs)',
              detail: 'RDS Multi-AZ, ElastiCache, no internet route',
              tone: 'success',
            },
          ],
        },
      },
    ],
    deeper: [
      'Multi-AZ handles the overwhelming majority of real failures. Multi-region addresses a much rarer event at several times the cost and complexity - only justify it with an actual requirement.',
      'RDS Multi-AZ failover takes 60-120 seconds, during which writes fail. The application needs connection retry logic or that window becomes an outage.',
      'Test the failure modes deliberately - terminate instances, fail over the database - rather than assuming the design works.',
      'Define RTO and RPO explicitly. They drive every subsequent decision and are usually left unstated.',
    ],
    traps: [
      'A single NAT gateway, quietly reintroducing a single point of failure into an otherwise multi-AZ design.',
      'Sessions stored on instances, so scale-in logs users out.',
      'Backups that have never been restored.',
      'Calling it highly available without stating what failure it survives.',
    ],
    followUps: [
      'What is your RTO and RPO, and how did you arrive at them?',
      'When would you actually go multi-region?',
    ],
    tags: ['architecture', 'high availability', 'design', 'multi-az', 'advanced'],
  },
  {
    id: 'itv-aws-18',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What is the difference between an Application Load Balancer and a Network Load Balancer?',
    probing: 'Load balancer selection - layer 7 versus layer 4.',
    answer: [
      'An **ALB** works at **layer 7** - HTTP and HTTPS. It can route on hostname, path, header, query string or method, terminate TLS, do sticky sessions, redirect, and integrate with Cognito for authentication. That routing intelligence is what you want in front of a web application or a set of microservices behind one domain.',
      'An **NLB** works at **layer 4** - TCP, UDP and TLS passthrough. It does not inspect the request, so it cannot route on a path, but it handles **extremely high throughput with very low latency**, supports **static IP addresses** per availability zone, and **preserves the client source IP** without needing headers.',
      'Choose ALB for HTTP applications, which is most of the time. Choose NLB when you need a non-HTTP protocol, a static IP (often for a customer’s firewall allow-list), TLS passthrough to the backend, or throughput where the ALB’s per-request processing is the constraint.',
      'The **Gateway Load Balancer** is a third option that exists for a narrow purpose: inserting virtual appliances such as firewalls transparently into the traffic path.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Which load balancer?',
        caption: 'The deciding question is usually whether you need to route on request content.',
        question: 'What does the traffic need?',
        branches: [
          {
            condition: 'HTTP routing by host, path or header',
            result: 'Application Load Balancer',
            tone: 'success',
          },
          {
            condition: 'Static IP, UDP, or TLS passthrough',
            result: 'Network Load Balancer',
            tone: 'accent',
          },
          {
            condition: 'Extreme throughput, minimal latency',
            result: 'Network Load Balancer',
            tone: 'accent',
          },
          {
            condition: 'Transparent firewall appliance insertion',
            result: 'Gateway Load Balancer',
            tone: 'muted',
          },
        ],
      },
    ],
    traps: [
      'Choosing NLB then needing path-based routing, which it cannot do.',
      'Expecting the client IP in application logs behind an ALB without reading `X-Forwarded-For`.',
      'Forgetting that an ALB’s IP addresses change, so a customer firewall rule needs NLB or a DNS-based approach.',
    ],
    followUps: ['How do you get the real client IP behind each of them?'],
    tags: ['load balancing', 'alb', 'nlb', 'networking'],
  },
  {
    id: 'itv-aws-19',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Your AWS bill jumped 40% last month with no deployment changes. How do you find out why?',
    probing: 'Cost investigation with a method. Increasingly a core DevOps responsibility.',
    answer: [
      'Start in **Cost Explorer** grouped by **service**, comparing this month against last. That narrows it to one or two services almost immediately - the increase is rarely spread evenly.',
      'Then group by **usage type** within that service, which tells you *what kind* of usage grew: data transfer, storage, instance hours, request count. "EC2 went up" is not actionable; "EC2-Other: NAT gateway data processing went up 300%" is.',
      'Then attribute it. **Cost allocation tags** grouped by team or environment tell you whose it is. If tagging is poor - which it usually is - that is the first thing to fix, because without it every future investigation starts from nothing.',
      'The common causes when nothing was deployed: **data transfer** growth, especially cross-AZ or NAT gateway processing after a traffic pattern change. **Storage accumulating** - S3 versions with no lifecycle rule, old EBS snapshots, CloudWatch Logs with infinite retention. **Something left running** from an experiment. **Autoscaling responding to a genuine traffic increase**, which is the system working correctly. A **Savings Plan or Reserved Instance expiring**, which raises the rate with no usage change at all - and is very easy to miss. Or **a new service being used** by a team you have not spoken to.',
      'Then make it visible: **AWS Budgets with alerts**, **Cost Anomaly Detection** which catches this class of jump automatically, and a tagging policy enforced by SCP so future attribution is possible. A 40% jump should have alerted on day three, not at the invoice.',
    ],
    code: [
      {
        title: 'Narrow it down from the CLI',
        language: 'bash',
        code: `# 1. Which service grew?
aws ce get-cost-and-usage \\
  --time-period Start=2026-07-01,End=2026-09-01 \\
  --granularity MONTHLY --metrics UnblendedCost \\
  --group-by Type=DIMENSION,Key=SERVICE \\
  --output table

# 2. What kind of usage within it?
aws ce get-cost-and-usage \\
  --time-period Start=2026-08-01,End=2026-09-01 \\
  --granularity MONTHLY --metrics UnblendedCost \\
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["EC2 - Other"]}}' \\
  --group-by Type=DIMENSION,Key=USAGE_TYPE

# 3. Whose is it?
aws ce get-cost-and-usage \\
  --time-period Start=2026-08-01,End=2026-09-01 \\
  --granularity MONTHLY --metrics UnblendedCost \\
  --group-by Type=TAG,Key=team`,
      },
      {
        title: 'Stop it happening silently again',
        language: 'bash',
        code: `# Catch anomalies automatically instead of at invoice time
aws ce create-anomaly-monitor --anomaly-monitor \\
  '{"MonitorName":"all-services","MonitorType":"DIMENSIONAL","MonitorDimension":"SERVICE"}'

# Untagged resources make every future investigation harder
aws resourcegroupstaggingapi get-resources --tags-per-page 100 \\
  --output json | jq -r '.ResourceTagMappingList[]
    | select([.Tags[].Key] | index("team") | not) | .ResourceARN' | head -50`,
      },
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Narrowing a cost increase',
        caption: 'Each step reduces the search space by an order of magnitude.',
        nodes: [
          { label: 'Group by service', detail: 'Usually one or two stand out', tone: 'accent' },
          { label: 'Group by usage type', detail: 'Transfer? Storage? Hours?' },
          { label: 'Group by tag', detail: 'Whose workload is it?' },
          {
            label: 'Check for expired commitments',
            detail: 'Rate change, not usage change',
            tone: 'warning',
          },
          { label: 'Fix the cause' },
          {
            label: 'Add budgets + anomaly detection',
            detail: 'Catch it in days, not weeks',
            tone: 'success',
          },
        ],
      },
    ],
    deeper: [
      'An expiring Savings Plan or Reserved Instance raises costs with no usage change whatsoever, and Cost Explorer grouped by usage type will not make it obvious. Check commitment expiry dates early.',
      'Cross-AZ data transfer is billed in both directions and is invisible until you look for it. Zone-aware routing often removes it entirely.',
      'CloudWatch Logs with no retention policy is a classic slow-growing cost that nobody notices for a year.',
      'Enforce tagging with an SCP. Voluntary tagging never reaches full coverage.',
    ],
    traps: [
      'Looking only at the total and guessing.',
      'Assuming nothing changed because there was no deployment - traffic, data volume and commitments all change without one.',
      'Optimising the largest service rather than the one that actually grew.',
    ],
    followUps: [
      'A Savings Plan expired. How would you have spotted that?',
      'How would you make sure this alerts within days next time?',
    ],
    tags: ['scenario', 'cost', 'finops', 'troubleshooting', 'advanced'],
  },
  {
    id: 'itv-aws-20',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What are the S3 storage classes and how would you choose between them?',
    probing: 'Storage cost optimisation, including the retrieval-cost trap.',
    answer: [
      '**Standard** is the default: millisecond access, no retrieval fee, highest storage price. **Standard-IA** and **One Zone-IA** are cheaper to store and charge a **per-gigabyte retrieval fee**, with a 30-day minimum billing duration - right for data accessed occasionally. One Zone-IA is cheaper still but lives in a single availability zone, so it is only appropriate for data you could regenerate.',
      '**Glacier Instant Retrieval** gives millisecond access at archive prices with a higher retrieval fee and a 90-day minimum. **Glacier Flexible Retrieval** takes minutes to hours to restore. **Glacier Deep Archive** is the cheapest storage available and takes up to 12 hours, with a 180-day minimum - for compliance retention you hope never to read.',
      '**Intelligent-Tiering** moves objects between tiers automatically based on access patterns, for a small per-object monitoring fee. For data with unpredictable or unknown access patterns it is usually the right default, because it removes the need to guess.',
      'The trap is optimising for storage price alone. Infrequent Access is cheaper to store and **more expensive to read**; if you move actively-read data there, the bill goes **up**. Check the actual access pattern in S3 Storage Lens before applying a lifecycle rule, and watch the minimum duration charges - moving an object that is deleted after a week to a class with a 30-day minimum costs more than leaving it.',
    ],
    code: [
      {
        title: 'A lifecycle policy that ages data out',
        language: 'json',
        code: `{
  "Rules": [{
    "ID": "archive-and-clean",
    "Status": "Enabled",
    "Filter": { "Prefix": "logs/" },
    "Transitions": [
      { "Days": 30,  "StorageClass": "STANDARD_IA" },
      { "Days": 90,  "StorageClass": "GLACIER_IR" },
      { "Days": 365, "StorageClass": "DEEP_ARCHIVE" }
    ],
    "Expiration": { "Days": 2555 },
    "NoncurrentVersionExpiration": { "NoncurrentDays": 30 },
    "AbortIncompleteMultipartUpload": { "DaysAfterInitiation": 7 }
  }]
}`,
        explanation:
          'The last two rules are the ones people forget - old versions and abandoned multipart uploads are billed indefinitely otherwise.',
      },
    ],
    traps: [
      'Moving frequently-read data to Infrequent Access and increasing the bill.',
      'Ignoring minimum storage durations on short-lived objects.',
      'No `AbortIncompleteMultipartUpload` rule, leaving invisible partial uploads billed forever.',
      'Versioning enabled with no expiry for noncurrent versions.',
    ],
    followUps: [
      'How would you find out whether a prefix is actually read?',
      'Why can moving data to a cheaper class increase costs?',
    ],
    tags: ['s3', 'storage classes', 'cost', 'lifecycle'],
  },
  {
    id: 'itv-aws-21',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How would you structure AWS accounts for a company with several teams and environments?',
    probing: 'Multi-account strategy - a genuinely senior design question.',
    answer: [
      'The starting principle is that **the account is the strongest isolation boundary AWS provides**. IAM within one account is complex and easy to get wrong; separate accounts give you a hard wall for blast radius, security, quotas and cost attribution. So the default is **more accounts, not fewer**.',
      'I would use **AWS Organizations** with organisational units grouping accounts by purpose, and at minimum a **separate account per environment** - production isolated from everything else. A mistake in development then physically cannot affect production, and the production account can have stricter controls without slowing developers down.',
      'The standard structure is a **management account** doing nothing but organisation administration (no workloads at all), plus foundational accounts for **security tooling** (GuardDuty, Security Hub aggregation), **log archive** (immutable CloudTrail and config history, write-only from other accounts), and **shared services** (CI/CD, shared networking, container registries). Then workload accounts per team and environment.',
      '**Service control policies** at the OU level enforce guardrails that cannot be bypassed even by an account administrator: deny disabling CloudTrail, deny regions you do not operate in, deny deleting the security tooling, require encryption. These limit rather than grant, and they are what makes delegated autonomy safe.',
      'The costs to be honest about: more accounts means more to manage, more networking to connect, and centralised tooling to build. **Control Tower** or an equivalent landing zone automates account creation with the baseline applied, which is what makes this tractable rather than a full-time job.',
    ],
    diagrams: [
      {
        kind: 'nested',
        title: 'A typical organisation layout',
        caption:
          'The management account holds no workloads; SCPs at OU level enforce the guardrails.',
        root: {
          label: 'AWS Organization',
          children: [
            {
              label: 'Management account',
              detail: 'Organisation admin only - no workloads',
              tone: 'warning',
            },
            {
              label: 'OU: Security',
              detail: 'SCP: cannot be disabled by member accounts',
              tone: 'danger',
              children: [
                { label: 'security-tooling', detail: 'GuardDuty, Security Hub' },
                { label: 'log-archive', detail: 'Immutable CloudTrail + Config' },
              ],
            },
            {
              label: 'OU: Workloads',
              tone: 'accent',
              children: [
                { label: 'team-a-prod', detail: 'Strict SCPs' },
                { label: 'team-a-dev', detail: 'Looser, budget-capped' },
              ],
            },
            {
              label: 'OU: Shared services',
              detail: 'CI/CD, networking, registries',
              tone: 'muted',
            },
          ],
        },
      },
    ],
    deeper: [
      'Consolidated billing across the organisation means volume discounts and Savings Plans apply across all accounts, so many accounts does not mean losing purchasing power.',
      'Use **AWS SSO / IAM Identity Center** for human access, federated from the corporate identity provider - not IAM users per account, which becomes unmanageable immediately.',
      'Connect accounts with **Transit Gateway** or **VPC sharing** rather than a mesh of peering connections, which does not scale.',
      'Per-account budgets and anomaly detection give cost attribution for free, since the account boundary is also the billing boundary.',
    ],
    traps: [
      'Running workloads in the management account, which cannot be restricted by SCPs.',
      'One account for everything, so a development mistake reaches production.',
      'SCPs written to grant rather than to limit - they only ever restrict.',
      'Creating accounts by hand without a landing zone, so each one has a different baseline.',
    ],
    followUps: [
      'What would you put in an SCP that applies to every account?',
      'How do teams get access without IAM users per account?',
    ],
    tags: ['organizations', 'multi-account', 'governance', 'architecture', 'advanced'],
  },
  {
    id: 'itv-aws-22',
    level: 'basic',
    kind: 'mcq',
    prompt: 'What is the difference between EBS and S3?',
    probing: 'Storage type fundamentals.',
    options: [
      {
        id: 'a',
        text: 'EBS is block storage attached to one instance; S3 is object storage accessed over HTTP from anywhere',
      },
      { id: 'b', text: 'EBS is for backups and S3 is for live data' },
      { id: 'c', text: 'They are the same, with different pricing' },
      { id: 'd', text: 'S3 can be mounted as a filesystem and EBS cannot' },
    ],
    correct: ['a'],
    answer: [
      '**EBS** is a network-attached **block device**. It looks like a disk to the operating system, you format it with a filesystem, and it attaches to **one instance at a time** (except for the io2 multi-attach case) **within one availability zone**. It is what you put a database or an operating system on.',
      '**S3** is **object storage** accessed over an HTTP API. There is no filesystem, no mounting in the normal sense, and objects are replaced rather than modified in place. It is accessible from anywhere with the right credentials, stores effectively unlimited data, and is already replicated across availability zones.',
      'The practical consequences: you cannot boot from S3 or run a database on it, and you cannot share an EBS volume across instances or reach it from another zone. They solve different problems, and the choice is rarely ambiguous once you ask whether you need a filesystem.',
      'For a **shared filesystem** across instances, the answer is neither - that is **EFS** (NFS, multi-AZ) or **FSx**.',
    ],
    traps: [
      'Trying to share one EBS volume across several instances.',
      'Assuming an EBS volume can be attached from another availability zone - you need a snapshot.',
      'Using an S3 filesystem mount for a workload needing real filesystem semantics.',
    ],
    followUps: ['What would you use for a filesystem shared by twenty instances?'],
    tags: ['storage', 'ebs', 's3', 'fundamentals'],
  },
  {
    id: 'itv-aws-23',
    level: 'intermediate',
    kind: 'open',
    prompt: 'How does autoscaling work, and what should you scale on?',
    probing: 'Elasticity in practice, including why CPU is often the wrong metric.',
    answer: [
      'An **autoscaling group** maintains a desired number of instances across zones, replaces unhealthy ones, and adjusts the count according to scaling policies. **Target tracking** is the policy type to use by default: you name a metric and a target value, and AWS manages the arithmetic - much less error-prone than step scaling with hand-written thresholds.',
      'The important question is **what metric**. CPU is the default and is frequently wrong: a service bound by I/O, by a downstream API or by connection limits can be at 30% CPU and completely saturated. Scaling on CPU then does nothing until the problem is severe.',
      'Better signals are ones that track what users experience: **request count per target** on an ALB, **queue depth** for a worker pool, or a **custom metric** such as p99 latency or in-flight requests. For queue workers, scaling on messages-per-instance is both simpler and more accurate than any resource metric.',
      'Two settings decide whether it behaves well. **Warm-up and cooldown** prevent thrashing - scaling again before the new instances have started serving. And **scaling in should be slower than scaling out**, because being briefly over-provisioned is cheap and being under-provisioned during a spike is not.',
      'Finally, autoscaling only helps if the **instance can start fast enough**. If a new instance takes eight minutes to be ready, it cannot respond to a two-minute spike - which is an argument for a pre-baked AMI, or for containers, or for keeping a buffer of warm capacity.',
    ],
    code: [
      {
        title: 'Target tracking on request count rather than CPU',
        language: 'json',
        code: `{
  "TargetTrackingConfiguration": {
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ALBRequestCountPerTarget",
      "ResourceLabel": "app/my-alb/abc123/targetgroup/my-tg/def456"
    },
    "TargetValue": 1000,
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }
}`,
        explanation: 'Asymmetric cooldowns: quick to add capacity, slow to remove it.',
      },
    ],
    traps: [
      'Scaling on CPU for a workload that is not CPU-bound.',
      'A minimum of one instance, so there is no redundancy during quiet periods.',
      'Slow instance startup, making the whole mechanism too late to help.',
      'Symmetric cooldowns causing capacity to oscillate.',
    ],
    followUps: [
      'Your service is at 30% CPU and timing out. Would autoscaling help?',
      'How would you scale a queue worker?',
    ],
    tags: ['autoscaling', 'elasticity', 'metrics', 'performance'],
  },
]
