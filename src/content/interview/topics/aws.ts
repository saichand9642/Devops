import type { InterviewTopic } from '../../types'

export const awsTopic: InterviewTopic = {
  id: 'aws',
  title: 'AWS',
  shortTitle: 'AWS',
  icon: '☁️',
  order: 5,
  oneLiner:
    'VPC design, IAM, compute choices, storage, high availability and the cost and security questions that follow.',
  headlines: [
    'A subnet is public if its route table has a route to an **internet gateway**. Nothing else makes it public.',
    'Security groups are **stateful** and allow-only; NACLs are **stateless** and have explicit deny.',
    'IAM: prefer **roles** over users, and attach policies to roles rather than to individual identities.',
    'An Availability Zone is a failure domain. Multi-AZ is the baseline for anything that matters.',
    'S3 is object storage with eleven nines of durability - not a filesystem.',
    'The shared responsibility model: AWS secures the cloud, you secure what you put in it.',
  ],
  questions: [
    {
      id: 'itv-aws-1',
      level: 'basic',
      kind: 'open',
      prompt: 'Explain the difference between a Region, an Availability Zone and an Edge Location.',
      probing:
        'Foundational vocabulary. It underpins every high-availability and latency question that follows.',
      answer: [
        'A **Region** is a geographic area - `eu-west-1` is Ireland. Regions are fully isolated from each other; data does not move between them unless you move it, which matters for both resilience and data residency.',
        'An **Availability Zone** is one or more physically separate data centres within a Region, with independent power, cooling and networking. They are close enough for low-latency synchronous replication - typically single-digit milliseconds - but far enough apart that one failing does not take out another.',
        'The AZ is the **failure domain**. That is why "deploy across at least two AZs" is the single most repeated piece of AWS architecture advice: it is the cheapest meaningful resilience you can buy.',
        'An **Edge Location** is a CloudFront point of presence - there are hundreds, far more than Regions. They cache content close to users to cut latency. They are for delivery, not for running your workloads.',
      ],
      deeper: [
        'AZ names are deliberately shuffled per account: `eu-west-1a` in your account is not necessarily the same physical zone as `eu-west-1a` in mine. That stops everyone piling into "the first one". The stable identifier is the AZ ID, like `euw1-az1`.',
        'Some services are regional and some are global. IAM, Route 53, CloudFront and WAF are global; EC2, VPC, RDS and most others are regional. Knowing which is which avoids a lot of confusion.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'Region, AZ, subnet',
          caption:
            'The AZ is the failure domain. Spreading across two is the baseline for anything that matters.',
          root: {
            label: 'Region: eu-west-1 (Ireland)',
            detail: 'Isolated from other Regions',
            tone: 'accent',
            children: [
              {
                label: 'Availability Zone eu-west-1a',
                detail: 'Independent power, cooling, networking',
                children: [
                  { label: 'Public subnet 10.0.1.0/24', detail: 'Route to internet gateway' },
                  { label: 'Private subnet 10.0.11.0/24', detail: 'Route via NAT gateway' },
                ],
              },
              {
                label: 'Availability Zone eu-west-1b',
                detail: 'A separate failure domain',
                children: [
                  { label: 'Public subnet 10.0.2.0/24' },
                  { label: 'Private subnet 10.0.12.0/24' },
                ],
              },
              {
                label: 'Edge locations (global)',
                detail: 'CloudFront caches - delivery, not compute',
                tone: 'muted',
              },
            ],
          },
        },
      ],
      traps: [
        'Saying an AZ is a single data centre. It is one or more.',
        'Assuming `eu-west-1a` is the same physical zone in every account.',
      ],
      followUps: [
        'How many AZs would you deploy across, and why?',
        'Which AWS services are global rather than regional?',
      ],
      tags: ['fundamentals', 'regions', 'availability'],
    },
    {
      id: 'itv-aws-2',
      level: 'basic',
      kind: 'mcq',
      prompt: 'What makes a subnet in a VPC "public"?',
      options: [
        { id: 'a', text: 'Setting the "public" flag on the subnet' },
        { id: 'b', text: 'Its route table has a route to an internet gateway' },
        { id: 'c', text: 'Its instances have security groups allowing 0.0.0.0/0' },
        { id: 'd', text: 'It uses a public CIDR range' },
      ],
      correct: ['b'],
      probing:
        'There is no "public" flag. Whether you know this predicts whether you can design or debug a VPC.',
      answer: [
        'A subnet is public purely because its **route table** contains a route for `0.0.0.0/0` pointing at an **internet gateway**. There is no flag, no checkbox, and no special subnet type.',
        'An instance in that subnet also needs a **public IP** (or an Elastic IP) to be reachable from the internet, and a security group allowing the traffic. But the route table is what makes the subnet itself public.',
        'A **private** subnet has no internet-gateway route. If instances there need outbound internet - for updates or to call an API - you route `0.0.0.0/0` to a **NAT gateway** that sits in a public subnet. That allows outbound connections but nothing inbound.',
        'Security groups do not change any of this. They filter traffic that reaches an interface; they do not create routes.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'Public, private, or isolated?',
          caption: 'It is entirely about the route table. Everything else is filtering on top.',
          question: 'What does the subnet route table say for 0.0.0.0/0?',
          branches: [
            {
              condition: 'it points at an internet gateway',
              result: 'Public subnet',
              detail: 'Instances with a public IP are reachable from the internet',
              tone: 'accent',
            },
            {
              condition: 'it points at a NAT gateway',
              result: 'Private subnet with egress',
              detail: 'Outbound works; nothing can initiate inbound',
            },
            {
              condition: 'there is no 0.0.0.0/0 route at all',
              result: 'Isolated subnet',
              detail: 'Local VPC traffic and VPC endpoints only',
            },
            {
              condition: 'you added a permissive security group',
              result: 'Changes nothing',
              detail: 'Security groups filter; they do not route',
              tone: 'warning',
            },
          ],
        },
      ],
      traps: [
        'Thinking a security group can make a subnet public. Routing and filtering are different layers.',
        'Putting a NAT gateway in a private subnet. It must sit in a public one to reach the internet itself.',
      ],
      followUps: [
        'How do instances in a private subnet get software updates?',
        'What is the cost implication of a NAT gateway?',
      ],
      tags: ['vpc', 'networking', 'subnets'],
    },
    {
      id: 'itv-aws-3',
      level: 'intermediate',
      kind: 'open',
      prompt: 'Compare security groups and network ACLs.',
      probing: 'The stateful/stateless distinction. It comes up constantly in real debugging.',
      answer: [
        'A **security group** attaches to an elastic network interface - so effectively to an instance, a load balancer, an RDS instance. A **NACL** attaches to a **subnet** and applies to everything in it.',
        'The crucial difference is state. Security groups are **stateful**: if you allow inbound on 443, the response traffic is automatically allowed out. You do not write an outbound rule for it.',
        'NACLs are **stateless**: every packet is evaluated independently in both directions. Allowing inbound 443 without allowing the outbound **ephemeral port range** (1024-65535) means requests arrive and replies are dropped - which produces a maddening "connects but hangs" symptom.',
        'Security groups also have **allow rules only** - anything not explicitly allowed is denied. NACLs have both allow and deny, evaluated by rule number in order, first match wins. That explicit deny is the reason NACLs exist: blocking a specific IP range is something security groups simply cannot do.',
        'In practice you do most of your work with security groups and use NACLs as a coarse subnet-level backstop.',
      ],
      deeper: [
        'Security groups can reference **other security groups** as a source, which is enormously useful: "allow 5432 from the app security group" keeps working as instances come and go, with no IP addresses to maintain.',
        'Default NACL allows everything both ways; a **custom** NACL denies everything until you add rules. Creating a custom NACL and forgetting the ephemeral-port outbound rule is a classic self-inflicted outage.',
      ],
      code: [
        {
          title: 'The stateless trap, and referencing groups',
          language: 'bash',
          code: `# NACL: BOTH directions needed, because it is stateless
#   Inbound  rule 100: ALLOW tcp 443    from 0.0.0.0/0
#   Outbound rule 100: ALLOW tcp 1024-65535 to 0.0.0.0/0   <- the reply path
# Omit the outbound rule and connections hang rather than fail fast.

# Security group: stateful, so only one rule is needed
aws ec2 authorize-security-group-ingress \\
  --group-id sg-web \\
  --protocol tcp --port 443 --cidr 0.0.0.0/0
# The response is allowed out automatically.

# Referencing another security group - no IPs to maintain
aws ec2 authorize-security-group-ingress \\
  --group-id sg-database \\
  --protocol tcp --port 5432 \\
  --source-group sg-application`,
        },
      ],
      traps: [
        'Forgetting the ephemeral port range on a custom NACL. Traffic arrives, replies are dropped, everything hangs.',
        'Trying to block a single malicious IP with a security group. Only NACLs can deny.',
      ],
      followUps: [
        'How would you block one IP address?',
        'Why is referencing a security group better than a CIDR?',
        'Traffic reaches the instance but the reply never arrives - where do you look?',
      ],
      tags: ['security', 'vpc', 'networking'],
    },
    {
      id: 'itv-aws-4',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How does IAM work? Explain users, roles, policies and the evaluation logic.',
      probing:
        'IAM is where most AWS security incidents originate. They want roles-over-keys and explicit-deny-wins.',
      answer: [
        'IAM has **identities** - users, groups and roles - and **policies** that grant or deny permissions. A policy is JSON: Effect, Action, Resource, and optional Condition.',
        'A **user** is a long-lived identity with a password or access keys. A **role** is an identity that is **assumed** temporarily, handing back short-lived credentials. The strong preference is roles: an EC2 instance gets an instance profile, a Pod gets IRSA, a CI pipeline uses OIDC - and in none of those cases does a permanent key exist to leak.',
        'Evaluation is: an **explicit Deny always wins**. Otherwise, an explicit Allow grants access. Otherwise it is denied by default. So permissions are additive across attached policies, but a single deny anywhere - in an identity policy, a resource policy, an SCP or a permissions boundary - overrides every allow.',
        'For cross-account access you have both an **identity policy** on the caller and a **resource policy** (or trust policy) on the target, and both must permit it.',
      ],
      deeper: [
        'Service Control Policies at the Organization level are a **maximum permission** boundary, not a grant. An SCP cannot give anyone access; it can only take it away. Something being denied despite a correct IAM policy is very often an SCP.',
        'For diagnosis, the IAM **policy simulator** and CloudTrail are the tools. CloudTrail records the exact API call and the reason for an AccessDenied, which is usually faster than reasoning about it.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'How a request is authorised',
          caption:
            'Explicit deny short-circuits everything. Default is deny, so no matching allow also means no.',
          nodes: [
            { label: 'API request arrives', detail: 'With an identity attached' },
            {
              label: 'Is there an explicit DENY anywhere?',
              detail: 'Identity policy, resource policy, SCP, permissions boundary',
              tone: 'accent',
              branch: {
                label: 'Yes',
                detail: 'DENIED. Nothing can override it.',
              },
            },
            {
              label: 'Is there an explicit ALLOW?',
              detail: 'In an identity or resource policy',
              arrowLabel: 'no deny found',
              branch: {
                label: 'No allow',
                detail: 'DENIED by default - IAM is deny-by-default',
              },
            },
            {
              label: 'Allowed',
              detail: 'The action proceeds',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'A scoped policy, and a trust policy',
          language: 'json',
          explanation:
            'Note the Condition - scoping by tag or source is what turns a broad permission into a safe one.',
          code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ReadOneBucketOnly",
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::acme-reports",
        "arn:aws:s3:::acme-reports/*"
      ]
    },
    {
      "Sid": "DenyUnencryptedUploads",
      "Effect": "Deny",
      "Action": "s3:PutObject",
      "Resource": "arn:aws:s3:::acme-reports/*",
      "Condition": {
        "StringNotEquals": { "s3:x-amz-server-side-encryption": "aws:kms" }
      }
    }
  ]
}`,
        },
      ],
      traps: [
        'Using IAM users with access keys for applications. Roles and short-lived credentials are the answer in almost every case now.',
        'Thinking an SCP grants permissions. It only limits them.',
        'Assuming `"Resource": "*"` is fine "for now". It is how blast radius happens.',
      ],
      followUps: [
        'Why prefer a role over an IAM user for an application?',
        'You have an Allow but still get AccessDenied. What are the possibilities?',
        'What is a permissions boundary?',
      ],
      tags: ['iam', 'security', 'policies'],
    },
    {
      id: 'itv-aws-5',
      level: 'intermediate',
      kind: 'mcq',
      prompt:
        'You need to run a containerised service with variable traffic and do not want to manage servers. Which is the most appropriate?',
      options: [
        { id: 'a', text: 'EC2 instances in an Auto Scaling group' },
        { id: 'b', text: 'ECS or EKS on Fargate' },
        { id: 'c', text: 'Lambda' },
        { id: 'd', text: 'Elastic Beanstalk on EC2' },
      ],
      correct: ['b'],
      probing:
        'Compute selection. They want to hear the reasoning about the trade-offs, not just the answer.',
      answer: [
        '**Fargate** is the direct answer: it runs containers with no servers to patch, scale or manage, and it bills per vCPU-second and GB-second of what the task actually requests.',
        'EC2 with Auto Scaling works but leaves you owning AMIs, patching, capacity planning and scaling policies - that is the "manage servers" the question rules out.',
        '**Lambda** is genuinely serverless but is a different execution model: event-driven, up to 15 minutes, with cold starts. It is excellent for spiky, short, event-triggered work and a poor fit for a long-running service holding connections.',
        'Beanstalk on EC2 abstracts the deployment but the instances are still yours.',
        'The honest caveat: Fargate costs more per unit of compute than EC2. At large, steady scale, EC2 or Fargate Spot becomes cheaper - so the right answer depends on whether you are optimising for operational burden or for unit cost.',
      ],
      diagrams: [
        {
          kind: 'decision',
          title: 'Which compute?',
          caption:
            'The axis is how much of the stack you want to own versus how much you want to pay.',
          question: 'What shape is the workload?',
          branches: [
            {
              condition: 'short, event-driven, bursty',
              result: 'Lambda',
              detail: 'Up to 15 minutes, pay per invocation, cold starts',
              tone: 'accent',
            },
            {
              condition: 'a long-running container, no servers to manage',
              result: 'ECS or EKS on Fargate',
              detail: 'Per-second billing, nothing to patch',
            },
            {
              condition: 'steady high scale, cost matters most',
              result: 'EC2 or Fargate Spot',
              detail: 'Cheaper per unit, more operational work',
            },
            {
              condition: 'you need Kubernetes APIs specifically',
              result: 'EKS',
              detail: 'On Fargate or on managed node groups',
            },
          ],
        },
      ],
      traps: [
        'Choosing Lambda for a long-running service. The 15-minute limit and cold starts make it the wrong shape.',
        'Saying Fargate is always cheaper. Per unit of compute it is more expensive; it saves operational cost.',
      ],
      followUps: [
        'When would EC2 be the better choice?',
        'What are the downsides of Fargate?',
        'ECS or EKS - how would you decide?',
      ],
      tags: ['compute', 'containers', 'fargate', 'serverless'],
    },
    {
      id: 'itv-aws-6',
      level: 'intermediate',
      kind: 'open',
      prompt: 'How would you design a highly available three-tier web application on AWS?',
      probing:
        'The classic architecture question. They want multi-AZ everywhere and no single points of failure.',
      answer: [
        'I would start with a VPC spanning **at least two Availability Zones**, with public subnets for the load balancer and NAT gateways, private subnets for the application, and isolated subnets for the database.',
        '**Web tier**: an Application Load Balancer across both AZs, with Route 53 in front and CloudFront if there is static content worth caching at the edge.',
        '**Application tier**: containers on ECS/EKS or instances in an Auto Scaling group, spread across both AZs, in private subnets. The ASG or service replaces unhealthy tasks automatically, and scales on a metric that reflects real load.',
        '**Data tier**: RDS with **Multi-AZ** enabled, which keeps a synchronous standby in the second AZ and fails over automatically. Read replicas if reads dominate. ElastiCache for session or query caching, also multi-AZ.',
        'Then the things that make it actually available rather than nominally: health checks at every layer, automated backups with a tested restore, infrastructure as code so it can be rebuilt, and monitoring with alarms on the symptoms users would notice.',
      ],
      deeper: [
        'The design questions I would expect to be pushed on: **stateless application tier**, so any instance can serve any request and scaling is trivial - sessions go in ElastiCache or a cookie, not on disk. And **NAT gateway per AZ**, because a single NAT gateway is both a single point of failure and a cross-AZ data charge.',
        'For disaster recovery beyond AZ failure, you need a second **Region**, and that is a significant step up in cost and complexity - cross-region replication, Route 53 failover, and a decision about RPO and RTO. Worth naming as a deliberate trade-off rather than doing by default.',
      ],
      diagrams: [
        {
          kind: 'nested',
          title: 'Multi-AZ three-tier layout',
          caption:
            'Every tier exists in both AZs. The database standby is synchronous, so failover loses no committed data.',
          root: {
            label: 'VPC 10.0.0.0/16',
            children: [
              {
                label: 'Public subnets (both AZs)',
                detail: 'ALB and one NAT gateway per AZ',
                tone: 'accent',
                children: [
                  { label: 'Application Load Balancer', detail: 'Health checks the app tier' },
                  { label: 'NAT gateway per AZ', detail: 'Not one shared - that is an SPOF' },
                ],
              },
              {
                label: 'Private app subnets (both AZs)',
                detail: 'No inbound from the internet',
                children: [
                  { label: 'ECS tasks / EC2 in an ASG', detail: 'Stateless, spread across AZs' },
                ],
              },
              {
                label: 'Isolated data subnets (both AZs)',
                detail: 'No route to the internet at all',
                children: [
                  { label: 'RDS primary (AZ a)', detail: 'Multi-AZ enabled' },
                  { label: 'RDS standby (AZ b)', detail: 'Synchronous, automatic failover' },
                  { label: 'ElastiCache replication group', detail: 'Sessions and cache' },
                ],
              },
            ],
          },
        },
      ],
      traps: [
        'A single NAT gateway. It is a single point of failure and it generates cross-AZ data charges.',
        'Storing sessions on the application instances, which prevents scaling and breaks on failover.',
        'Saying "Multi-AZ RDS gives you read scaling". It does not - the standby serves no traffic. Read replicas are for that.',
      ],
      followUps: [
        'What is the difference between Multi-AZ and a read replica?',
        'How would you extend this to survive a Region failure?',
        'Where would you put the NAT gateways and why?',
      ],
      tags: ['architecture', 'high availability', 'vpc', 'rds'],
    },
    {
      id: 'itv-aws-7',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'Your AWS bill has doubled this month with no obvious change in traffic. How do you find out why?',
      probing:
        'Cost awareness is a core DevOps responsibility now. They want a systematic approach, not guesses.',
      answer: [
        'I would start in **Cost Explorer**, grouped by **service**, comparing this month against last. That immediately tells me whether it is one service or a general increase, which determines everything that follows.',
        'Then I would group by **usage type** and by **tag** within the offending service, to narrow it to a specific resource class and owner. This is where a tagging policy pays for itself - without tags you are reduced to guessing which team owns what.',
        'The usual culprits, roughly in order of how often I have actually seen them: **NAT gateway data processing** charges from chatty traffic to S3 or ECR that should have gone through a VPC endpoint; **unattached EBS volumes and old snapshots** accumulating quietly; **data transfer**, especially cross-AZ and egress to the internet; **forgotten non-production environments** left running; and **CloudWatch Logs** ingestion and retention from a service that started logging verbosely.',
        'A doubling with flat traffic also strongly suggests something that is not traffic-driven - a resource left running, a retention policy change, or a new environment - so I would check **CloudTrail** for recent resource creation and **AWS Config** for configuration changes around the date the cost stepped up.',
        'Longer term: Budgets with alerts so this is caught in days not at month end, Cost Anomaly Detection, mandatory tagging enforced by SCP, and lifecycle policies on logs and snapshots.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'Narrowing a cost spike',
          caption: 'Each step halves the search space. Tags are what make step two possible.',
          nodes: [
            {
              label: 'Cost Explorer, grouped by service',
              detail: 'Compare month over month - which service moved?',
              tone: 'accent',
            },
            {
              label: 'Group by usage type',
              detail: 'DataTransfer? NatGateway-Bytes? TimedStorage?',
              arrowLabel: 'service identified',
            },
            {
              label: 'Group by tag, then by resource',
              detail: 'Which team, which environment, which resource',
              branch: {
                label: 'Nothing is tagged',
                detail: 'Fix that first - you are guessing until then',
              },
            },
            {
              label: 'Correlate with CloudTrail and Config',
              detail: 'What was created or changed on the day it stepped up?',
            },
            {
              label: 'Fix, then add a Budget alert',
              detail: 'So the next one is caught in days, not at month end',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Finding the usual suspects',
          language: 'bash',
          code: `# Month-over-month by service
aws ce get-cost-and-usage \\
  --time-period Start=2026-08-01,End=2026-09-30 \\
  --granularity MONTHLY --metrics UnblendedCost \\
  --group-by Type=DIMENSION,Key=SERVICE \\
  --output table

# Unattached EBS volumes - pure waste
aws ec2 describe-volumes --filters Name=status,Values=available \\
  --query 'Volumes[].{ID:VolumeId,GB:Size,Created:CreateTime}' --output table

# Old snapshots
aws ec2 describe-snapshots --owner-ids self \\
  --query 'Snapshots[?StartTime<=\`2026-03-01\`].[SnapshotId,VolumeSize,StartTime]' \\
  --output table

# Log groups with no retention set - these grow forever
aws logs describe-log-groups \\
  --query 'logGroups[?retentionInDays==null].[logGroupName,storedBytes]' \\
  --output table

# Idle load balancers
aws elbv2 describe-load-balancers \\
  --query 'LoadBalancers[].[LoadBalancerName,State.Code]' --output table`,
        },
      ],
      deeper: [
        'The NAT gateway one deserves special mention because it is so common and so avoidable. Every byte your private-subnet workloads pull from S3, ECR or DynamoDB through a NAT gateway is charged for data processing. A **VPC gateway endpoint** for S3 and DynamoDB is free and removes that entirely; interface endpoints for other services cost less than the NAT processing they replace.',
      ],
      traps: [
        'Jumping to "we need Reserved Instances" before knowing what the spend is. Commitment discounts on waste just lock in the waste.',
        'Looking only at compute. Data transfer and storage are very often the actual answer.',
      ],
      followUps: [
        'What is a VPC endpoint and why does it save money?',
        'How would you prevent this happening again?',
        'How do you allocate shared costs between teams?',
      ],
      tags: ['scenario', 'cost', 'finops', 'troubleshooting'],
    },
    {
      id: 'itv-aws-8',
      level: 'advanced',
      kind: 'open',
      prompt: 'How do you give an application running on EKS access to AWS services securely?',
      probing:
        'Modern, specific and practical. The answer is IRSA or Pod Identity, and knowing why node roles are wrong.',
      answer: [
        'The wrong answer, which is still common, is to attach a broad policy to the **node instance role**. Every Pod on that node then inherits those permissions, including Pods from other teams and namespaces - so one compromised container has the union of everything any workload on that node needed.',
        'The right answer is **IRSA** - IAM Roles for Service Accounts. The EKS cluster has an OIDC provider; you annotate a Kubernetes ServiceAccount with an IAM role ARN; the role’s trust policy accepts that specific ServiceAccount in that specific namespace. Pods using that ServiceAccount receive short-lived credentials automatically through the AWS SDK.',
        'The result is per-Pod, least-privilege, short-lived credentials with no secrets stored anywhere and nothing to rotate.',
        '**EKS Pod Identity** is the newer alternative. It does the same job without needing an OIDC provider per cluster and with simpler trust policies, which makes it easier to manage at scale. Either is a correct answer; Pod Identity is where things are heading.',
      ],
      code: [
        {
          title: 'IRSA end to end',
          language: 'bash',
          explanation:
            'The trust policy condition is the critical part - it binds the role to exactly one ServiceAccount in one namespace.',
          code: `# 1. Associate an OIDC provider with the cluster (once per cluster)
eksctl utils associate-iam-oidc-provider --cluster prod --approve

# 2. Create the role and ServiceAccount together
eksctl create iamserviceaccount \\
  --cluster prod \\
  --namespace payments \\
  --name checkout-api \\
  --attach-policy-arn arn:aws:iam::111122223333:policy/CheckoutS3Read \\
  --approve

# 3. Use it - just reference the ServiceAccount
# apiVersion: apps/v1
# kind: Deployment
# spec:
#   template:
#     spec:
#       serviceAccountName: checkout-api

# 4. Verify from inside the Pod
kubectl -n payments exec deploy/checkout-api -- \\
  aws sts get-caller-identity
# Should show the IRSA role, NOT the node instance role.`,
        },
        {
          title: 'The trust policy that scopes it',
          language: 'json',
          code: `{
  "Effect": "Allow",
  "Principal": {
    "Federated": "arn:aws:iam::111122223333:oidc-provider/oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE"
  },
  "Action": "sts:AssumeRoleWithWebIdentity",
  "Condition": {
    "StringEquals": {
      "oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE:aud": "sts.amazonaws.com",
      "oidc.eks.eu-west-1.amazonaws.com/id/EXAMPLE:sub":
        "system:serviceaccount:payments:checkout-api"
    }
  }
}`,
        },
      ],
      traps: [
        'Attaching permissions to the node role "because it works". Every Pod on the node gets them.',
        'Using `StringLike` with a wildcard on the `sub` condition, which lets any ServiceAccount assume the role.',
        'Forgetting to block Pod access to the instance metadata service - otherwise a Pod can still reach the node role credentials directly.',
      ],
      followUps: [
        'Why is the node instance role a bad place for permissions?',
        'What is EKS Pod Identity and how does it differ?',
        'How would you stop a Pod reaching the instance metadata endpoint?',
      ],
      tags: ['eks', 'iam', 'security', 'irsa', 'kubernetes'],
    },
    {
      id: 'itv-aws-9',
      level: 'advanced',
      kind: 'multi',
      prompt:
        'Which of these genuinely improve the durability or availability of data in S3? (Select all that apply.)',
      options: [
        { id: 'a', text: 'Enabling versioning' },
        { id: 'b', text: 'Cross-Region Replication' },
        { id: 'c', text: 'Enabling server-side encryption' },
        { id: 'd', text: 'Object Lock in compliance mode' },
        { id: 'e', text: 'Moving objects to S3 Glacier Deep Archive' },
      ],
      correct: ['a', 'b', 'd'],
      probing:
        'Whether you can separate durability, availability, confidentiality and cost - four different properties people routinely conflate.',
      answer: [
        'A, B and D protect data. **C and E do not** - and that is the point of the question.',
        '**Versioning** protects against the most common real cause of data loss, which is not disk failure but someone overwriting or deleting an object. Previous versions remain recoverable.',
        '**Cross-Region Replication** protects against a Region-level event and is the only one of these that improves availability across Regions.',
        '**Object Lock in compliance mode** makes objects immutable for a retention period - nobody, including the root account, can delete them. That is the defence against ransomware and against a malicious or mistaken administrator.',
        '**Encryption** protects **confidentiality**, not durability. An encrypted object that is deleted is just as gone. **Glacier Deep Archive** is a cost optimisation; it has the same 11-nines durability as Standard but *worse* availability, with retrieval taking hours.',
      ],
      deeper: [
        'S3 Standard is designed for 99.999999999% durability - eleven nines - by replicating across at least three AZs automatically. So single-AZ hardware failure is already handled; what you are protecting against with these features is human error, malicious action and regional events.',
        'Worth knowing the distinction in an interview: **durability** is "will the bytes still exist", **availability** is "can I get them right now". Glacier has the same durability and much lower availability.',
      ],
      traps: [
        'Treating encryption as a data-protection measure in the durability sense. It protects against the wrong threat.',
        'Assuming Glacier improves resilience. It is a cost trade-off that reduces availability.',
        'Forgetting that versioning increases storage cost, so it needs a lifecycle policy to expire old versions.',
      ],
      followUps: [
        'What is the difference between durability and availability?',
        'How do you protect against a malicious administrator deleting a bucket?',
        'What does versioning cost you?',
      ],
      tags: ['s3', 'storage', 'durability', 'backup'],
    },
    {
      id: 'itv-aws-10',
      level: 'advanced',
      kind: 'scenario',
      prompt:
        'An Auto Scaling group keeps launching and terminating instances in a loop. What is happening?',
      probing:
        'A specific failure pattern that tests whether you understand how ASG health checks and scaling policies interact.',
      answer: [
        'A launch-terminate loop almost always means instances are being marked **unhealthy shortly after launch**, so the ASG replaces them, and the replacements fail the same way.',
        'The most common cause is the **health check grace period** being shorter than the application’s startup time. The instance boots, the ELB health check fails because the app is still starting, the ASG terminates it, and the cycle repeats forever. The fix is to raise `HealthCheckGracePeriod` above the real worst-case startup time.',
        'The second cause is the health check itself being wrong - pointing at a port or path the application does not serve, or at an endpoint that depends on something unavailable.',
        'The third is the instance genuinely failing to start: a bad AMI, a failing user-data script, a missing IAM permission, or no capacity in the AZ.',
        'To diagnose I would look at **ASG activity history** for the stated reason for each termination, the **target group health** to see which check is failing, and then get onto an instance before it is killed - suspending the `Terminate` process temporarily is the trick that makes that possible.',
      ],
      diagrams: [
        {
          kind: 'flow',
          title: 'The grace-period loop',
          caption:
            'Nothing is broken except a timing mismatch. The instance never gets long enough to become healthy.',
          nodes: [
            {
              label: 'ASG launches an instance',
              detail: 'Desired capacity is below target',
              tone: 'accent',
            },
            {
              label: 'Application starts booting',
              detail: 'Takes, say, 180 seconds to serve traffic',
            },
            {
              label: 'Health check begins after the grace period',
              detail: 'Grace period is 60s - the app is not ready',
              arrowLabel: 'too early',
              branch: {
                label: 'Marked unhealthy',
                detail: 'Through no fault of the instance',
              },
            },
            {
              label: 'ASG terminates and replaces it',
              detail: 'And the replacement does exactly the same',
              tone: 'warning',
            },
            {
              label: 'Fix: grace period > real startup time',
              detail: 'Plus a health endpoint that reflects readiness',
              tone: 'success',
            },
          ],
        },
      ],
      code: [
        {
          title: 'Diagnosing and stopping the loop',
          language: 'bash',
          code: `# Why is it terminating them? The reason is recorded here.
aws autoscaling describe-scaling-activities \\
  --auto-scaling-group-name web-asg --max-items 20 \\
  --query 'Activities[].{Time:StartTime,Status:StatusCode,Cause:Description}' \\
  --output table

# Which health check is failing?
aws elbv2 describe-target-health --target-group-arn <arn> \\
  --query 'TargetHealthDescriptions[].{Id:Target.Id,State:TargetHealth.State,Reason:TargetHealth.Reason}'

# Current grace period versus real startup time
aws autoscaling describe-auto-scaling-groups \\
  --auto-scaling-group-name web-asg \\
  --query 'AutoScalingGroups[0].[HealthCheckType,HealthCheckGracePeriod]'

# STOP THE LOOP so you can actually look at an instance
aws autoscaling suspend-processes \\
  --auto-scaling-group-name web-asg \\
  --scaling-processes Terminate ReplaceUnhealthy

# ... investigate on the instance, then ...
aws autoscaling resume-processes --auto-scaling-group-name web-asg

# The likely fix
aws autoscaling update-auto-scaling-group \\
  --auto-scaling-group-name web-asg \\
  --health-check-grace-period 300`,
        },
      ],
      traps: [
        'Raising desired capacity to "get more healthy instances". They fail the same way and you pay more.',
        'Not suspending the Terminate process, so every instance you try to inspect is killed before you can log in.',
      ],
      followUps: [
        'How do you work out the right grace period?',
        'What is the difference between EC2 and ELB health check types?',
        'How would this present differently in Kubernetes?',
      ],
      tags: ['scenario', 'autoscaling', 'troubleshooting', 'ec2'],
    },
  ],
}
