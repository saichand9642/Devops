import type { InterviewQuestion } from '../../../types'

/**
 * "Production is doing this on AWS - walk me through it."
 *
 * Chosen for failures whose cause is somewhere other than where the symptom
 * appears: the load balancer that is fine but has no healthy target in one
 * zone, the IAM policy that is correct but overridden two levels up, the
 * failover that worked while the application kept using the old endpoint.
 */
export const awsScenarioQuestions: InterviewQuestion[] = [
  {
    id: 'itv-aws-51',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'An Application Load Balancer is returning 503 Service Unavailable, but the target instances look healthy. Walk me through it.',
    probing:
      'A 503 from an ALB means something very specific. They want you to read the error rather than guess.',
    answer: [
      'An ALB 503 means **no healthy target was available in a targeted Availability Zone**. That is narrower than a generic error, and it points the investigation immediately. A 502 would mean the target answered with something invalid; a 504 would mean it did not answer in time. 503 means there was nothing to send the request to.',
      'The most instructive cause, and the one this scenario is usually testing, is a **zone mismatch**. An ALB places a node in each subnet you attach it to, and Route 53 returns those node addresses round-robin. If the ALB has subnets in three AZs but healthy targets in only two - because an ASG scaled unevenly, or the targets in one zone failed - then requests arriving at the node in the empty zone have nowhere to go and return 503. Roughly a third of requests fail while every dashboard shows healthy instances, which is exactly the confusing symptom described.',
      '**Cross-zone load balancing** is the fix and the explanation: with it enabled, a node in an empty zone can forward to targets in other zones. It is on by default for ALB, but it is off by default for NLB, and it can be disabled at the target-group level - so I would check that setting explicitly.',
      'The second family of causes is that the targets are not as healthy as they appear. "Instance running" is not "target healthy": the target group has its own health check, on its own port and path, and the security group on the instance must allow the ALB’s security group on the **traffic port** and the **health check port** if they differ. I would look at the `HealthyHostCount` metric per AZ, not at the EC2 console.',
      'Third, **capacity and surge**. `RejectedConnectionCount` rising means the ALB itself hit a limit; a very sudden traffic spike can outpace ALB scaling, which is what pre-warming or a gradual ramp exists for.',
      'My order would be: look at `HTTPCode_ELB_503_Count` alongside `HealthyHostCount` **broken down by Availability Zone**, because that single view usually shows one zone at zero and ends the investigation. Then check cross-zone load balancing, then the target group health check and security groups.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Why a healthy fleet still returns 503',
        caption: 'The node in the empty zone has nowhere to forward when cross-zone is off.',
        nodes: [
          {
            label: 'Client resolves the ALB name',
            detail: 'Route 53 returns one node address per AZ, round-robin',
            tone: 'accent',
          },
          {
            label: 'Request lands on the node in eu-west-1c',
            detail: 'a perfectly healthy ALB node',
            arrowLabel: 'one third of requests',
          },
          {
            label: 'No healthy target registered in 1c',
            detail: 'ASG scaled unevenly, or those instances failed the check',
            arrowLabel: 'lookup',
            tone: 'danger',
          },
          {
            label: 'Cross-zone disabled',
            detail: 'so it may not forward to healthy targets in 1a or 1b',
            arrowLabel: 'blocked',
            tone: 'danger',
          },
          {
            label: 'ALB returns 503',
            detail: 'while the EC2 console shows every instance running',
            arrowLabel: 'result',
            tone: 'danger',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Break the metrics down by Availability Zone',
        language: 'bash',
        explanation:
          'The per-AZ view is what makes this obvious. The aggregate hides it completely.',
        code: `# Healthy targets PER ZONE - the query that usually ends the investigation
aws cloudwatch get-metric-statistics \\
  --namespace AWS/ApplicationELB --metric-name HealthyHostCount \\
  --dimensions Name=TargetGroup,Value=$TG Name=LoadBalancer,Value=$LB \\
               Name=AvailabilityZone,Value=eu-west-1c \\
  --start-time "$(date -u -d '1 hour ago' +%FT%TZ)" \\
  --end-time "$(date -u +%FT%TZ)" --period 60 --statistics Minimum

# Why is each target unhealthy? The reason string is specific.
aws elbv2 describe-target-health --target-group-arn "$TG" \\
  --query 'TargetHealthDescriptions[].[Target.Id,TargetHealth.State,TargetHealth.Reason]' \\
  --output table
#   Target.ResponseCodeMismatch  -> health check path returns the wrong code
#   Target.Timeout               -> security group or app not listening
#   Target.FailedHealthChecks    -> app is genuinely failing

# Is cross-zone load balancing on for this target group?
aws elbv2 describe-target-group-attributes --target-group-arn "$TG" \\
  --query "Attributes[?Key=='load_balancing.cross_zone.enabled']"

# Which subnets/AZs is the ALB actually in?
aws elbv2 describe-load-balancers --load-balancer-arns "$LB" \\
  --query 'LoadBalancers[].AvailabilityZones[].ZoneName'`,
      },
      {
        title: 'The configuration that prevents it',
        language: 'hcl',
        explanation:
          'Cross-zone on, a health check that matches reality, and an ASG balanced across the same zones.',
        code: `resource "aws_lb_target_group" "app" {
  name     = "app-tg"
  port     = 8080
  protocol = "HTTP"
  vpc_id   = var.vpc_id

  # ALB defaults to true, NLB defaults to FALSE. Be explicit either way.
  load_balancing_cross_zone_enabled = true

  health_check {
    path                = "/healthz"   # must NOT depend on downstream services
    port                = "traffic-port"
    matcher             = "200"
    interval            = 15
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  # Let in-flight requests finish before the target is removed
  deregistration_delay = 30
}

resource "aws_autoscaling_group" "app" {
  # The ASG must span the SAME zones as the ALB, or one zone
  # will have listener capacity and no targets.
  vpc_zone_identifier = var.private_subnet_ids

  min_size         = 3
  desired_capacity = 6
  health_check_type = "ELB"      # not "EC2" - use the load balancer's view
  health_check_grace_period = 120
}`,
      },
    ],
    deeper: [
      'ALB 502, 503 and 504 mean genuinely different things: 502 is an invalid response from the target, 503 is no healthy target available, 504 is the target timing out. Knowing which you have removes most of the search space before you start.',
      '`health_check_type = "ELB"` on the ASG is important: with the default `EC2` the ASG only replaces instances that fail the hypervisor check, so an instance whose application has died stays in service indefinitely.',
      'A health check that calls a database makes every target unhealthy during a database blip, converting a degraded dependency into a total outage. Health checks should answer "can this instance serve", not "is the whole system healthy".',
    ],
    traps: [
      'Reading the aggregate `HealthyHostCount` rather than the per-AZ breakdown, which is where the zero is.',
      'Assuming NLB behaves like ALB. Cross-zone is off by default on NLB and is separately billed.',
      'Trusting the EC2 console. "Running" says nothing about target group health.',
    ],
    followUps: [
      'What is the difference between a 502, 503 and 504 from an ALB?',
      'Why is cross-zone off by default on NLB?',
      'What should and should not be in a health check?',
    ],
    tags: ['aws', 'alb', 'troubleshooting', 'networking'],
  },
  {
    id: 'itv-aws-52',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A Lambda function worked fine, then stopped reaching the internet after being attached to a VPC. Explain and fix.',
    probing:
      'A precise, extremely common AWS gotcha. It tests whether you understand Lambda networking.',
    answer: [
      'This is expected behaviour, not a bug, and the explanation is short: **a Lambda function in a VPC loses the AWS-managed internet path and uses your VPC routing instead.**',
      'Outside a VPC, Lambda runs in an AWS-managed network with outbound internet access provided for you. Attach it to a VPC and it gets an elastic network interface in your subnets, and from then on it can only reach what your route tables allow.',
      'Crucially, **a Lambda ENI never gets a public IP**, so putting it in a public subnet does not help - a route to an internet gateway requires a public IP to work. The function must be in a **private** subnet whose route table sends `0.0.0.0/0` to a **NAT gateway** in a public subnet. Putting the function in the public subnet is the single most common wrong fix, and it produces exactly the same timeout.',
      'The symptom is characteristic too: calls to external endpoints **hang until the function times out** rather than failing fast, because packets are being dropped rather than rejected. If you see a Lambda that suddenly times out on every external call right after a networking change, this is almost always it.',
      'I would verify the subnet is private, that its route table has a NAT gateway route, that the NAT gateway is in a public subnet with an internet gateway route and has an elastic IP, and that the function’s security group allows outbound - although outbound is allowed by default unless someone has restricted it.',
      'There is an important cost and design footnote. If the function is calling **AWS services** - S3, DynamoDB, Secrets Manager - do not route that through NAT. Use **VPC endpoints**: a gateway endpoint for S3 and DynamoDB, which is free, and interface endpoints for the rest. That avoids NAT data processing charges entirely and keeps the traffic off the public internet. A function calling S3 through a NAT gateway is a genuinely expensive mistake at volume.',
      'And the design question worth raising: does it need to be in the VPC at all? Attaching to a VPC is only necessary to reach private resources such as RDS or an internal service. If it is only calling public APIs and AWS services, taking it back out of the VPC is simpler and cheaper.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Lambda in a VPC - which path does it need?',
        caption: 'A Lambda ENI has no public IP, so a public subnet is never the answer.',
        question: 'What does the function need to reach?',
        branches: [
          {
            condition: 'Nothing private - public APIs only',
            result: 'Take it out of the VPC',
            detail: 'simplest and cheapest, and AWS provides the internet path',
            tone: 'success',
          },
          {
            condition: 'AWS services such as S3 or DynamoDB',
            result: 'Gateway VPC endpoint',
            detail: 'free, no NAT charges, traffic stays off the internet',
            tone: 'success',
          },
          {
            condition: 'Other AWS APIs - Secrets Manager, SQS, KMS',
            result: 'Interface VPC endpoint',
            detail: 'hourly plus data charge, still far cheaper than NAT at volume',
            tone: 'accent',
          },
          {
            condition: 'Third-party internet endpoints plus private RDS',
            result: 'Private subnet plus NAT gateway',
            detail: 'the only case that genuinely needs NAT',
            tone: 'warning',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Check the path the ENI actually has',
        language: 'bash',
        explanation:
          'Work from the function to its subnets to their route tables. The gap is always in there.',
        code: `# Which subnets and security groups is the function using?
aws lambda get-function-configuration --function-name my-fn \\
  --query 'VpcConfig'

# Is that subnet private - i.e. does it route 0.0.0.0/0 to a NAT?
aws ec2 describe-route-tables \\
  --filters "Name=association.subnet-id,Values=subnet-0abc123" \\
  --query 'RouteTables[].Routes[]' --output table
#   0.0.0.0/0 -> nat-xxxx   GOOD (private subnet)
#   0.0.0.0/0 -> igw-xxxx   BAD for Lambda - the ENI has no public IP

# Is the NAT gateway itself healthy and in a PUBLIC subnet?
aws ec2 describe-nat-gateways \\
  --query 'NatGateways[].[NatGatewayId,State,SubnetId]' --output table

# Reachability Analyzer proves the path without guesswork
aws ec2 create-network-insights-path \\
  --source "$ENI_ID" --destination-ip 1.1.1.1 --protocol tcp --destination-port 443`,
      },
      {
        title: 'Endpoints instead of NAT for AWS traffic',
        language: 'hcl',
        explanation:
          'A gateway endpoint for S3 is free and removes the NAT data processing charge entirely.',
        code: `# S3 and DynamoDB gateway endpoints: free, route-table based
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = var.vpc_id
  service_name      = "com.amazonaws.\${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = var.private_route_table_ids
}

# Interface endpoints for the API-based services
resource "aws_vpc_endpoint" "secretsmanager" {
  vpc_id              = var.vpc_id
  service_name        = "com.amazonaws.\${var.region}.secretsmanager"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = var.private_subnet_ids
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true     # so the normal SDK endpoint resolves here
}

resource "aws_lambda_function" "app" {
  function_name = "my-fn"
  # PRIVATE subnets. A Lambda ENI never receives a public IP.
  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }
}`,
      },
    ],
    deeper: [
      'Since the 2019 Hyperplane change, VPC-attached Lambda cold starts no longer include ENI creation, so the old "never put Lambda in a VPC because of cold starts" advice is out of date. The networking cost and complexity are still real reasons to avoid it when you can.',
      '`private_dns_enabled` on an interface endpoint is what makes the normal SDK call resolve to the endpoint. Without it your code still resolves the public endpoint and still needs NAT, which is a common half-finished migration.',
      'NAT gateway charges are per-hour **plus per-GB processed**. A high-volume function pulling objects from S3 through NAT can cost more in data processing than in Lambda execution.',
    ],
    traps: [
      'Putting the function in a public subnet. Without a public IP on the ENI it cannot use the internet gateway.',
      'Routing S3 and DynamoDB traffic through NAT when a free gateway endpoint exists.',
      'Attaching to a VPC when nothing private is being accessed.',
    ],
    followUps: [
      'Why does a public subnet not work for Lambda?',
      'Gateway versus interface endpoints - what is the difference?',
      'When is attaching Lambda to a VPC actually necessary?',
    ],
    tags: ['aws', 'lambda', 'vpc', 'networking', 'troubleshooting'],
  },
  {
    id: 'itv-aws-53',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'An IAM call is denied although the role has a policy that clearly allows it. Where do you look?',
    probing:
      'IAM policy evaluation has several layers. A senior answer names them in evaluation order.',
    answer: [
      'An identity policy granting Allow is only one input. The evaluation logic is: an **explicit Deny anywhere wins**, otherwise there must be an Allow, and several other policy types can remove the Allow. I would walk the layers in order.',
      '**Service control policies.** In an AWS Organization, an SCP sets the maximum permissions for an entire account. It grants nothing; it only bounds. A common case is an SCP denying actions outside approved regions, or denying a service the organisation has not sanctioned - and the account administrator cannot override it. This is the number one cause of "the policy is right and it still says no".',
      '**Permission boundaries.** A boundary attached to a role caps what its identity policies can grant. The effective permission is the intersection, so a role with `AdministratorAccess` and a restrictive boundary has only what the boundary allows.',
      '**Resource-based policies.** For S3, KMS, SQS, Secrets Manager and others, the resource has its own policy. For cross-account access **both** sides must allow it. And a KMS key policy is the classic hidden failure: you have `s3:GetObject`, the bucket allows you, and the object is SSE-KMS encrypted with a key whose policy does not include you - so the denial mentions S3 while the cause is KMS.',
      '**Session policies and role chaining.** An assumed-role session can carry a session policy narrowing it further, and chained roles reduce the maximum session duration.',
      '**Condition keys that do not match.** A policy allowing an action only from a source VPC endpoint, an IP range, with MFA present, or with a specific tag, will deny silently when the condition is not met. Tag-based conditions are especially easy to get wrong because the resource simply lacks the tag.',
      'The tool that short-circuits all of this is **IAM Policy Simulator**, and better still the **CloudTrail event** for the failed call: it records the exact action, resource, principal and, for most services, which policy type caused the denial. I would read the CloudTrail entry first rather than reasoning from the policy documents.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'IAM evaluation order',
        caption: 'Every layer can remove an Allow. Only an explicit Deny is final.',
        nodes: [
          {
            label: 'Explicit Deny anywhere',
            detail: 'in any policy type - this wins immediately, always',
            tone: 'danger',
          },
          {
            label: 'Service control policy',
            detail: 'organisation ceiling - grants nothing, only bounds',
            arrowLabel: 'then',
            tone: 'warning',
          },
          {
            label: 'Permission boundary',
            detail: 'caps what identity policies may grant',
            arrowLabel: 'then',
            tone: 'warning',
          },
          {
            label: 'Identity policy',
            detail: 'the one people check first - and it is not enough on its own',
            arrowLabel: 'then',
            tone: 'accent',
          },
          {
            label: 'Resource policy and KMS key policy',
            detail: 'cross-account needs both sides; encryption needs the key too',
            arrowLabel: 'then',
            tone: 'accent',
          },
          {
            label: 'Conditions must match',
            detail: 'source VPC, IP, MFA, tags - a silent denial if they do not',
            arrowLabel: 'finally',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Let AWS tell you which layer denied it',
        language: 'bash',
        explanation: 'CloudTrail records the denial and usually names the policy type responsible.',
        code: `# The failed call, with the reason
aws cloudtrail lookup-events \\
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetObject \\
  --start-time "$(date -u -d '1 hour ago' +%FT%TZ)" \\
  --query 'Events[].CloudTrailEvent' --output text \\
  | jq -r 'select(.errorCode != null)
           | {errorCode, errorMessage, principal: .userIdentity.arn}'
#   "explicit deny in a service control policy"  <- names the layer

# Simulate, including the boundary and any conditions
aws iam simulate-principal-policy \\
  --policy-source-arn arn:aws:iam::111122223333:role/app-role \\
  --action-names s3:GetObject \\
  --resource-arns arn:aws:s3:::my-bucket/key.json \\
  --query 'EvaluationResults[].[EvalDecision,MatchedStatements[].SourcePolicyType]'

# Which SCPs apply to this account?
aws organizations list-policies-for-target \\
  --target-id 111122223333 --filter SERVICE_CONTROL_POLICY

# Is there a permission boundary on the role?
aws iam get-role --role-name app-role --query 'Role.PermissionsBoundary'

# The KMS key policy - the hidden cause behind many S3 denials
aws kms get-key-policy --key-id "$KEY_ID" --policy-name default`,
      },
      {
        title: 'Cross-account access needs both sides plus the key',
        language: 'json',
        explanation: 'Three documents must agree. Missing the KMS one produces an S3-shaped error.',
        code: `{
  "_comment_1": "1. Bucket policy in the ACCOUNT THAT OWNS THE BUCKET",
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowPartnerRead",
      "Effect": "Allow",
      "Principal": { "AWS": "arn:aws:iam::444455556666:role/app-role" },
      "Action": ["s3:GetObject"],
      "Resource": "arn:aws:s3:::shared-bucket/*",
      "Condition": {
        "StringEquals": { "aws:PrincipalOrgID": "o-exampleorgid" }
      }
    }
  ],

  "_comment_2": "2. The ROLE in 4444 also needs s3:GetObject on that ARN",

  "_comment_3": "3. And if the objects are SSE-KMS, the KEY POLICY must allow",
  "_comment_4": "   kms:Decrypt for that same role - this is the step that is",
  "_comment_5": "   missed most often, and the error still says AccessDenied on S3"
}`,
      },
    ],
    deeper: [
      'The KMS key policy is the most frequently missed layer. An `AccessDenied` on `s3:GetObject` for an SSE-KMS object is very often a `kms:Decrypt` problem, and the error message does not say so.',
      'SCPs never grant permission. A common misconception is that adding an Allow to an SCP gives access - it only widens the ceiling, and the identity still needs its own Allow.',
      'IAM Access Analyzer finds resource policies granting access outside your account or organisation, which is the inverse of this problem and worth mentioning as a preventative control.',
    ],
    traps: [
      'Reading only the identity policy. Four other layers can override it.',
      'Forgetting that cross-account needs an Allow on both sides - neither alone is sufficient.',
      'Missing a condition key such as `aws:SourceVpce` or an MFA requirement, which denies silently.',
    ],
    followUps: [
      'What is the order of IAM policy evaluation?',
      'How do SCPs differ from permission boundaries?',
      'Why would a KMS key cause an S3 AccessDenied?',
    ],
    tags: ['aws', 'iam', 'security', 'troubleshooting'],
  },
  {
    id: 'itv-aws-54',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Multi-AZ RDS failed over successfully in 90 seconds, but the application stayed down for fifteen minutes. Why?',
    probing:
      'The gap between infrastructure recovery and application recovery. A senior distinction.',
    answer: [
      'RDS did its job: it promoted the standby and repointed the DNS CNAME to the new instance. What failed was the application’s ability to **notice**, and there are three well-understood reasons.',
      '**DNS caching.** RDS failover works by updating the endpoint’s DNS record. The RDS record has a short TTL, but many runtimes ignore it - the JVM historically caches DNS resolutions **forever** by default with `networkaddress.cache.ttl` set to -1 under a security manager. So the application keeps resolving the old IP long after the record changed. This is the classic cause and the one to lead with.',
      '**Stale connection pools.** Even with correct DNS, the pool holds established TCP connections to the old instance. Those sockets do not fail immediately - they hang until an OS-level timeout, which can be minutes. The pool hands out dead connections, each request blocks, and the service appears down while every health indicator on the database is green.',
      '**No failure detection in the pool.** A pool without a validation query or with a very long idle timeout will keep reusing broken connections rather than discarding and reopening them.',
      'The fixes are all application-side, which is the point of the question. Set the JVM DNS TTL to something short - 30 seconds or less. Configure the connection pool to validate connections before handing them out, with a short socket and connection timeout so a dead connection fails fast rather than hanging. And use a driver-level mechanism where one exists: the **AWS JDBC wrapper** and Aurora’s cluster endpoints detect failover in seconds rather than waiting for DNS.',
      'The broader lesson I would offer is that **infrastructure high availability does not give you application high availability**. Failover time is the sum of detection, promotion and client recovery, and the client half is usually the largest and is entirely yours to fix. Anyone claiming a 90-second RTO because RDS promotes in 90 seconds has measured a third of the problem.',
      'And the test that matters: exercise it. `reboot-db-instance --force-failover` in a non-production environment measures the real end-to-end recovery, which is the number worth knowing before an incident rather than after.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'Where the fifteen minutes went',
        caption: 'RDS recovered in 90 seconds. The client took the other thirteen minutes.',
        participants: [
          { id: 'app', label: 'Application' },
          { id: 'pool', label: 'Connection pool' },
          { id: 'dns', label: 'DNS resolver' },
          { id: 'rds', label: 'RDS' },
        ],
        messages: [
          { from: 'rds', to: 'dns', label: 'failover: CNAME now points to standby' },
          { from: 'app', to: 'pool', label: 'borrow a connection' },
          {
            from: 'pool',
            to: 'app',
            label: 'returns a socket to the OLD instance',
            kind: 'return',
          },
          { from: 'app', to: 'rds', label: 'query hangs until TCP timeout' },
          { from: 'pool', to: 'dns', label: 'eventually re-resolves' },
          { from: 'dns', to: 'pool', label: 'cached old IP - JVM TTL is infinite', kind: 'return' },
          { from: 'pool', to: 'rds', label: 'new connection, finally to the promoted instance' },
        ],
      },
    ],
    code: [
      {
        title: 'The client settings that decide your real RTO',
        language: 'yaml',
        explanation:
          'DNS TTL, fast socket timeouts and pool validation. None of these are AWS settings.',
        code: `# JVM: the single most important line. Default can be cache-forever.
env:
  - name: JAVA_TOOL_OPTIONS
    value: >-
      -Dsum.net.inetaddr.ttl=30
      -Dnetworkaddress.cache.ttl=30
      -Dnetworkaddress.cache.negative.ttl=5

---
# HikariCP: fail fast and validate, so a dead connection is discarded
spring:
  datasource:
    url: jdbc:aws-wrapper:postgresql://mydb.cluster-abc.eu-west-1.rds.amazonaws.com:5432/app
    hikari:
      connection-timeout: 3000      # do not wait 30s for a dead host
      validation-timeout: 2000
      keepalive-time: 30000
      max-lifetime: 600000          # recycle connections every 10 minutes
      connection-test-query: SELECT 1
  # Socket-level timeouts matter as much as pool settings
  jpa:
    properties:
      javax.persistence.query.timeout: 5000

# Driver-level: connectTimeout and socketTimeout on the JDBC URL
#   ?connectTimeout=3&socketTimeout=10&tcpKeepAlive=true`,
      },
      {
        title: 'Measure the real recovery time',
        language: 'bash',
        explanation: 'Force a failover in staging and time the application, not the database.',
        code: `# Force a failover and watch the application recover
aws rds reboot-db-instance --db-instance-identifier staging-db --force-failover

# Time the END TO END recovery - this is your real RTO
while true; do
  code=$(curl -s -o /dev/null -w '%{http_code}' https://staging.internal/healthz)
  echo "$(date +%T) $code"
  sleep 1
done

# What did RDS itself think happened, and when?
aws rds describe-events --source-identifier staging-db \\
  --source-type db-instance --duration 30 \\
  --query 'Events[].[Date,Message]' --output table

# Confirm the endpoint now points somewhere new
dig +short mydb.cluster-abc.eu-west-1.rds.amazonaws.com`,
      },
    ],
    deeper: [
      'Aurora is materially better here: the cluster endpoint plus the AWS JDBC wrapper can detect and route around a failover in seconds, because the driver knows the cluster topology instead of waiting on DNS.',
      'RDS Proxy is the managed answer to this whole class of problem. It holds the pool, survives failover, and reduces failover time for applications you cannot easily change - a strong answer when the application is not yours to modify.',
      'Measure RTO from the user’s perspective, end to end. A database that promotes in 90 seconds and an application that recovers in 15 minutes has a 15-minute RTO, and that is the number that belongs in the SLA.',
    ],
    traps: [
      'Reporting the RDS failover time as the outage duration.',
      'Leaving the JVM DNS cache at its default, which can be infinite.',
      'A connection pool with no validation, handing out sockets to an instance that no longer exists.',
    ],
    followUps: [
      'Why does the JVM cache DNS forever by default?',
      'What does RDS Proxy change here?',
      'How would you test failover safely?',
    ],
    tags: ['aws', 'rds', 'high availability', 'troubleshooting'],
  },
  {
    id: 'itv-aws-55',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A DynamoDB table in on-demand mode is returning throttling errors. How is that possible and what do you do?',
    probing:
      'On-demand is widely misunderstood as unlimited. The real constraint is per-partition.',
    answer: [
      'On-demand removes the need to provision capacity; it does not remove **per-partition limits**. A single partition serves at most roughly 3,000 read units and 1,000 write units per second regardless of mode, so if traffic concentrates on one partition key you will be throttled while the table as a whole is nearly idle. That is a **hot partition**, and it is the usual answer here.',
      'There is a second on-demand-specific cause: on-demand scales by doubling, and it can absorb roughly double the previous peak immediately. A step change far beyond that - a marketing launch, a migration backfill - is throttled until the table finishes scaling, which takes minutes.',
      'To confirm, I would look at `ThrottledRequests` alongside `ConsumedReadCapacityUnits`. Throttling with low overall consumption is diagnostic of a hot key. **CloudWatch Contributor Insights for DynamoDB** is the purpose-built tool: it shows the most frequently accessed partition keys directly, which turns a guess into an answer.',
      'The fixes depend on the access pattern. If the key genuinely has low cardinality - a status field, a tenant with far more traffic than others, a date used as a partition key - the fix is **write sharding**: append a suffix to the partition key to spread items across partitions, and scatter-gather on read. If reads dominate and the data is small, **DAX** or an application cache absorbs the hot key entirely. If a **global secondary index** is the throttled thing, remember a GSI has its own capacity and a hot GSI throttles the base table’s writes, which is a surprising second-order effect.',
      'And the design point: this is usually a data-modelling problem rather than a capacity problem. A partition key should have high cardinality and roughly uniform access. Using something like `status` or a current date as the partition key guarantees a hot partition at scale, and no amount of capacity mode fixes it.',
      'Short-term mitigation while the model is fixed: exponential backoff with jitter in the SDK, which is on by default but often configured too tightly, and moving bulk backfills to a throttled background job so they do not compete with user traffic.',
    ],
    code: [
      {
        title: 'Confirm it is a hot key, not a capacity shortage',
        language: 'bash',
        explanation: 'Throttling with low total consumption means concentration, not volume.',
        code: `# Throttles alongside total consumption - the ratio is the tell
aws cloudwatch get-metric-statistics \\
  --namespace AWS/DynamoDB --metric-name ThrottledRequests \\
  --dimensions Name=TableName,Value=orders \\
  --start-time "$(date -u -d '2 hours ago' +%FT%TZ)" \\
  --end-time "$(date -u +%FT%TZ)" --period 60 --statistics Sum

# Which partition keys are hot? This is the purpose-built answer.
aws dynamodb update-contributor-insights \\
  --table-name orders --contributor-insights-action ENABLE
# then read TopContributors in CloudWatch Contributor Insights

# Is it the table or a GSI being throttled?
aws cloudwatch get-metric-statistics \\
  --namespace AWS/DynamoDB --metric-name ThrottledRequests \\
  --dimensions Name=TableName,Value=orders Name=GlobalSecondaryIndexName,Value=status-index \\
  --start-time "$(date -u -d '1 hour ago' +%FT%TZ)" \\
  --end-time "$(date -u +%FT%TZ)" --period 60 --statistics Sum`,
      },
      {
        title: 'Write sharding a low-cardinality key',
        language: 'python',
        explanation: 'Spread one hot key across N partitions on write, gather on read.',
        code: `import random
import boto3

SHARDS = 20
table = boto3.resource("dynamodb").Table("orders")

# BAD: every order for today lands on ONE partition.
#   pk = f"ORDER#{today}"

# GOOD: spread across SHARDS partitions.
def put_order(order_id: str, today: str, payload: dict) -> None:
    shard = random.randrange(SHARDS)
    table.put_item(
        Item={
            "pk": f"ORDER#{today}#{shard}",   # high cardinality now
            "sk": order_id,
            **payload,
        }
    )

# Read is a scatter-gather across the shards. This is the cost of
# sharding, and why you only do it for genuinely hot keys.
def orders_for_day(today: str) -> list[dict]:
    items: list[dict] = []
    for shard in range(SHARDS):
        resp = table.query(
            KeyConditionExpression="pk = :pk",
            ExpressionAttributeValues={":pk": f"ORDER#{today}#{shard}"},
        )
        items.extend(resp["Items"])
    return items

# If the shard must be derivable rather than random, hash a
# high-cardinality attribute instead:
#   shard = int(hashlib.md5(order_id.encode()).hexdigest(), 16) % SHARDS`,
      },
    ],
    deeper: [
      'A GSI has its own capacity and its own partitions. If a GSI is throttled, writes to the **base table** are throttled too, because DynamoDB cannot keep the index consistent - this catches people out because the base table looks fine.',
      'On-demand doubles capacity based on your previous peak, so a genuinely new peak more than 2x the old one throttles briefly. For a known launch, pre-warming by ramping traffic, or temporarily switching to provisioned with high capacity, avoids it.',
      'Adaptive capacity does isolate frequently-accessed items to some extent and has improved a lot, but it does not repeal the per-partition ceiling. Design for uniform access rather than relying on it.',
    ],
    traps: [
      'Believing on-demand means unlimited throughput. The per-partition limit applies in both modes.',
      'Using a low-cardinality attribute such as status or date as the partition key.',
      'Missing that the throttle is on a GSI, which then throttles base-table writes.',
    ],
    followUps: [
      'What is the per-partition limit?',
      'How does a hot GSI affect the base table?',
      'When would DAX be the right answer instead of sharding?',
    ],
    tags: ['aws', 'dynamodb', 'scaling', 'troubleshooting'],
  },
  {
    id: 'itv-aws-56',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'New EKS worker nodes launch but never join the cluster - they stay absent from kubectl get nodes. How do you debug?',
    probing:
      'EKS-specific bootstrapping. There is a short list of causes and each has a definitive check.',
    answer: [
      'The node is running as an EC2 instance but the kubelet has not successfully registered. There are five causes and each has a clear check, so this is a satisfying problem to debug methodically.',
      '**IAM.** The node’s instance profile needs `AmazonEKSWorkerNodePolicy`, `AmazonEC2ContainerRegistryReadOnly` and `AmazonEKS_CNI_Policy`. Without the CNI policy the node may join and then fail to allocate pod IPs; without the worker node policy it cannot register at all.',
      '**Authentication mapping.** This is the classic EKS answer. The node’s IAM role must be mapped to the `system:bootstrappers` and `system:nodes` Kubernetes groups - historically in the `aws-auth` ConfigMap, and in newer clusters through **EKS access entries**. A managed node group does this for you; a self-managed group or a Terraform-created ASG very often does not, and the node authenticates as an unknown identity and is refused. The kubelet log says `Unauthorized`, which is the giveaway.',
      '**Network path to the API server.** The kubelet must reach the cluster endpoint on 443. On a private-endpoint cluster that means correct security groups and routing; from a private subnet with a public endpoint it needs a NAT gateway. The cluster security group must allow the node group inbound and outbound on the right ports.',
      '**The bootstrap script.** A custom AMI or a launch template that overrides user data can fail to run `bootstrap.sh` with the right cluster name, endpoint and certificate authority. The wrong cluster name here is a surprisingly common copy-paste error.',
      '**DNS and version skew.** The node must resolve the API endpoint, and its kubelet version must not be ahead of the control plane.',
      'The decisive step is to get onto the instance and read the kubelet log - `journalctl -u kubelet` - because it states the failure in plain terms: `Unauthorized`, a connection timeout, or a bootstrap error. Everything else is inference. If SSH is not available, the EC2 serial console or SSM Session Manager gets you there.',
    ],
    code: [
      {
        title: 'Read the kubelet log first',
        language: 'bash',
        explanation:
          'The node states why it could not join. Guessing at IAM before reading this wastes time.',
        code: `# Get onto the instance without SSH
aws ssm start-session --target i-0abc123

# THE log. It names the cause.
sudo journalctl -u kubelet -n 100 --no-pager
#   "Unauthorized"                  -> aws-auth / access entry mapping
#   "dial tcp ...:443 i/o timeout"  -> security group or routing
#   "failed to run bootstrap.sh"    -> user data / launch template

# Did the bootstrap script run with the right cluster?
sudo cat /var/log/cloud-init-output.log | tail -40
sudo cat /etc/eks/bootstrap.sh >/dev/null && echo 'bootstrap present'

# Can the node reach the API server at all?
ENDPOINT=$(aws eks describe-cluster --name prod --query 'cluster.endpoint' --output text)
curl -sk --max-time 5 "$ENDPOINT/healthz" && echo reachable

# Is the role mapped? (aws-auth style)
kubectl -n kube-system get configmap aws-auth -o yaml

# Or the newer access-entry style
aws eks list-access-entries --cluster-name prod`,
      },
      {
        title: 'The mapping a self-managed node group needs',
        language: 'yaml',
        explanation: 'Without these two groups the kubelet authenticates as nobody and is refused.',
        code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: aws-auth
  namespace: kube-system
data:
  mapRoles: |
    - rolearn: arn:aws:iam::111122223333:role/eks-node-role
      username: system:node:{{EC2PrivateDNSName}}
      groups:
        - system:bootstrappers     # required to request a certificate
        - system:nodes             # required to register as a node

    # Human access, mapped separately
    - rolearn: arn:aws:iam::111122223333:role/platform-admin
      username: platform-admin
      groups:
        - system:masters

# Newer clusters prefer access entries, which are an AWS API object
# rather than a ConfigMap - and therefore auditable and IaC-friendly:
#   aws eks create-access-entry --cluster-name prod \\
#     --principal-arn arn:aws:iam::111122223333:role/eks-node-role \\
#     --type EC2_LINUX`,
      },
    ],
    deeper: [
      'A corrupt `aws-auth` ConfigMap can lock everyone out of the cluster, including you, because it governs human access too. EKS access entries exist partly to remove that footgun - they are a proper API with IAM permissions behind them.',
      'Managed node groups handle the IAM mapping, bootstrap and security groups for you. If a self-managed group is failing, ask whether it needs to be self-managed at all.',
      'The CNI policy is separate from the node policy. A node missing `AmazonEKS_CNI_Policy` can join and then leave every pod stuck in `ContainerCreating` because the VPC CNI cannot attach ENIs - a different symptom, same root category.',
    ],
    traps: [
      'Guessing at IAM before reading the kubelet log, which states the cause directly.',
      'Forgetting the aws-auth mapping for a self-managed node group.',
      'A private-endpoint cluster with no route from the node subnet to the API server.',
    ],
    followUps: [
      'What does the aws-auth ConfigMap do?',
      'How do access entries improve on it?',
      'What breaks if the CNI policy is missing?',
    ],
    tags: ['aws', 'eks', 'kubernetes', 'troubleshooting'],
  },
  {
    id: 'itv-aws-57',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'An S3 bucket holding customer data was found to be publicly readable. Walk me through your response.',
    probing:
      'Incident response for a security event. Order matters: contain, assess, then prevent.',
    answer: [
      'I would treat it as a security incident with three phases in order - **contain, assess, prevent** - and resist jumping straight to prevention, because the assessment is what determines whether this is reportable.',
      '**Contain, within minutes.** Enable S3 Block Public Access at the **bucket** level immediately, and then at the **account** level, which overrides every bucket policy and ACL and cannot be undone by a bucket-level misconfiguration. Then remove the offending grant from the bucket policy or ACL. Block Public Access first, because it takes effect instantly and does not require getting the policy edit exactly right under pressure.',
      '**Assess, in parallel.** The critical question is not "was it public" but **"was it accessed, by whom, and what did they take"**. That means S3 server access logs or, much better, CloudTrail data events for S3 - if data events were enabled. Look for requests from outside your accounts, unusual user agents, and enumeration patterns such as repeated `ListBucket` calls. Establish how long the exposure lasted by finding when the policy changed, which CloudTrail management events record.',
      'If data events were **not** enabled, say so honestly: you cannot prove what was read, and for personal data the conservative and usually correct assumption is that it was. That uncertainty is itself a finding worth fixing.',
      '**Then the obligations.** If customer personal data was exposed there are legal notification timelines - 72 hours under GDPR - so legal and the data protection officer are involved early, not at the end. Credentials or keys in the bucket must be rotated on the assumption they are compromised.',
      '**Prevent.** Account-level Block Public Access as a baseline, an SCP denying any attempt to disable it, default SSE-KMS encryption with a key policy that restricts decryption, IAM Access Analyzer to surface any resource reachable from outside the organisation, and AWS Config rules alerting on public buckets. Ideally the bucket is created by Terraform with these settings so the secure configuration is the default rather than something to remember.',
      'Finally the review: **how did it become public**? A console click, a Terraform change that passed review, a legacy ACL? The answer determines whether the fix is a guardrail, a pipeline check, or training - and the guardrail is nearly always the right answer, because relying on people not to make the mistake has already failed once.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Incident order',
        caption: 'Contain first - assessment takes hours and the exposure should not continue.',
        nodes: [
          {
            label: 'Block Public Access on the bucket',
            detail: 'instant, and does not need the policy edit to be perfect',
            tone: 'danger',
          },
          {
            label: 'Block Public Access at account level',
            detail: 'overrides every bucket policy and ACL in the account',
            arrowLabel: 'then',
            tone: 'danger',
          },
          {
            label: 'Assess exposure from CloudTrail',
            detail: 'who read what, and for how long was it open',
            arrowLabel: 'in parallel',
            tone: 'warning',
          },
          {
            label: 'Notify legal and rotate anything exposed',
            detail: 'GDPR timelines start at discovery, not at resolution',
            arrowLabel: 'if personal data',
            tone: 'warning',
          },
          {
            label: 'Guardrails so it cannot recur',
            detail: 'SCP, Config rules, Access Analyzer, secure-by-default IaC',
            arrowLabel: 'finally',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Contain, then find out what happened',
        language: 'bash',
        explanation: 'Block Public Access first. It is one call and it is immediate.',
        code: `# 1. CONTAIN - bucket level, right now
aws s3api put-public-access-block --bucket customer-data \\
  --public-access-block-configuration \\
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 2. CONTAIN - account level, which overrides every bucket
aws s3control put-public-access-block --account-id 111122223333 \\
  --public-access-block-configuration \\
  BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true

# 3. ASSESS - when did it become public, and who changed it?
aws cloudtrail lookup-events \\
  --lookup-attributes AttributeKey=ResourceName,AttributeValue=customer-data \\
  --query 'Events[?EventName==\`PutBucketPolicy\` || EventName==\`PutBucketAcl\`]
           .[EventTime,Username,EventName]' --output table

# 4. ASSESS - was it actually read from outside? Needs data events enabled.
aws cloudtrail lookup-events \\
  --lookup-attributes AttributeKey=EventName,AttributeValue=GetObject \\
  --start-time "$(date -u -d '30 days ago' +%FT%TZ)" \\
  --query 'Events[].CloudTrailEvent' --output text \\
  | jq -r 'select(.userIdentity.type == "AWSAccount" or .userIdentity.accountId != "111122223333")
           | [.eventTime, .sourceIPAddress, .requestParameters.key] | @tsv'`,
      },
      {
        title: 'The guardrail that stops it recurring',
        language: 'json',
        explanation:
          'An SCP denying the disabling of Block Public Access. Not even an account administrator can undo it.',
        code: `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyDisablingBlockPublicAccess",
      "Effect": "Deny",
      "Action": [
        "s3:PutAccountPublicAccessBlock",
        "s3:DeleteAccountPublicAccessBlock",
        "s3:PutBucketPublicAccessBlock"
      ],
      "Resource": "*",
      "Condition": {
        "ArnNotLike": {
          "aws:PrincipalArn": "arn:aws:iam::*:role/SecurityBreakGlass"
        }
      }
    },
    {
      "Sid": "DenyPublicBucketPolicies",
      "Effect": "Deny",
      "Action": ["s3:PutBucketPolicy", "s3:PutBucketAcl"],
      "Resource": "*",
      "Condition": {
        "StringEquals": { "s3:x-amz-acl": "public-read" }
      }
    }
  ]
}`,
      },
    ],
    deeper: [
      'Block Public Access at the account level is the control that matters, because it overrides every bucket policy and ACL underneath it. Setting it only on the offending bucket leaves every other bucket exposed to the same mistake.',
      'CloudTrail **data events** for S3 are off by default and are what tell you whether objects were actually read. If they were not enabled, you cannot prove non-access, and for personal data you generally have to assume the worst - which is itself a strong argument for enabling them on sensitive buckets in advance.',
      'IAM Access Analyzer continuously reports resources reachable from outside the organisation, which is how you find the other buckets rather than waiting for someone to report them.',
    ],
    traps: [
      'Editing the bucket policy first. Block Public Access is one call, immediate, and hard to get wrong.',
      'Declaring it resolved without establishing whether anything was actually read.',
      'Fixing this bucket only, when the same misconfiguration almost certainly exists elsewhere.',
    ],
    followUps: [
      'How would you prove whether data was accessed?',
      'What does account-level Block Public Access override?',
      'How would you find every other bucket at risk?',
    ],
    tags: ['aws', 's3', 'security', 'incident response'],
  },
  {
    id: 'itv-aws-58',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'Messages are accumulating in an SQS queue and the consumers appear to be running normally. What is going on?',
    probing:
      'SQS semantics. Several distinct causes, and the visibility timeout one is the most instructive.',
    answer: [
      'Messages accumulating with healthy-looking consumers points at one of four things, and the metrics distinguish them quickly.',
      '**Processing is slower than arrival.** The simplest case. `ApproximateNumberOfMessagesVisible` climbing steadily with consumers at high CPU means you need more consumers or faster processing. Scaling on queue depth - via KEDA in Kubernetes, or a target-tracking policy on an ASG - is the fix.',
      '**The visibility timeout is too short.** This is the interesting failure and the one worth leading with. When a consumer receives a message it becomes invisible for the visibility timeout. If processing takes longer than that, the message becomes visible again and is delivered to **another** consumer while the first is still working. Now two consumers process the same message, neither deletes it in time, and the queue never drains while doing double the work. The signature is `NumberOfMessagesReceived` much higher than `NumberOfMessagesDeleted`, and `ApproximateAgeOfOldestMessage` growing.',
      '**Messages are failing and being retried.** The consumer throws, never deletes, the message returns after the visibility timeout, and it loops. Without a **dead letter queue** and a `maxReceiveCount`, a single poison message can cycle forever and consume capacity indefinitely. A DLQ is not optional for production - it is what turns an infinite loop into one message set aside for inspection.',
      '**Consumers are not actually consuming.** They look alive but are blocked - a stuck database connection, an exhausted thread pool, a deadlock. `NumberOfMessagesReceived` at or near zero while the depth grows distinguishes this immediately from the others.',
      'There is also a FIFO-specific case worth knowing: in a FIFO queue, messages with the same `MessageGroupId` are processed **strictly in order**, so one stuck message blocks its entire group regardless of how many consumers you add. If the group id has low cardinality, your effective parallelism is the number of groups, not the number of consumers.',
      'My sequence: compare received against deleted to separate double-delivery from genuine backlog, check the age of the oldest message, confirm a DLQ exists and look at what is in it, and set the visibility timeout to roughly six times the expected processing time - or use `ChangeMessageVisibility` to extend it dynamically for long jobs.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'A visibility timeout that is too short',
        caption: 'Two consumers do the same work and neither finishes in time.',
        participants: [
          { id: 'q', label: 'SQS queue' },
          { id: 'c1', label: 'Consumer A' },
          { id: 'c2', label: 'Consumer B' },
        ],
        messages: [
          { from: 'c1', to: 'q', label: 'ReceiveMessage' },
          { from: 'q', to: 'c1', label: 'msg-1, invisible for 30s', kind: 'return' },
          { from: 'c1', to: 'c1', label: 'processing... takes 45s' },
          { from: 'q', to: 'q', label: '30s elapsed - msg-1 visible again' },
          { from: 'c2', to: 'q', label: 'ReceiveMessage' },
          { from: 'q', to: 'c2', label: 'the SAME msg-1', kind: 'return' },
          { from: 'c1', to: 'q', label: 'DeleteMessage - receipt handle expired' },
          { from: 'c2', to: 'c2', label: 'duplicate work, queue never drains' },
        ],
      },
    ],
    code: [
      {
        title: 'The metric comparison that identifies the cause',
        language: 'bash',
        explanation: 'Received far exceeding deleted means redelivery, not backlog.',
        code: `# Depth, and the age of the oldest message
aws cloudwatch get-metric-statistics --namespace AWS/SQS \\
  --metric-name ApproximateAgeOfOldestMessage \\
  --dimensions Name=QueueName,Value=orders \\
  --start-time "$(date -u -d '2 hours ago' +%FT%TZ)" \\
  --end-time "$(date -u +%FT%TZ)" --period 300 --statistics Maximum

# THE comparison: received vs deleted.
# received >> deleted  => redelivery (visibility timeout or failures)
# received ~= 0        => consumers are stuck, not slow
for m in NumberOfMessagesReceived NumberOfMessagesDeleted; do
  echo "== $m"
  aws cloudwatch get-metric-statistics --namespace AWS/SQS --metric-name "$m" \\
    --dimensions Name=QueueName,Value=orders \\
    --start-time "$(date -u -d '1 hour ago' +%FT%TZ)" \\
    --end-time "$(date -u +%FT%TZ)" --period 300 --statistics Sum \\
    --query 'Datapoints[].Sum'
done

# Current settings and whether a DLQ exists at all
aws sqs get-queue-attributes --queue-url "$Q" --attribute-names All \\
  --query 'Attributes.{Visibility:VisibilityTimeout,Redrive:RedrivePolicy,
           Visible:ApproximateNumberOfMessages,InFlight:ApproximateNumberOfMessagesNotVisible}'`,
      },
      {
        title: 'Visibility timeout, DLQ and dynamic extension',
        language: 'python',
        explanation: 'Extend the timeout for long jobs rather than setting one huge global value.',
        code: `import boto3

sqs = boto3.client("sqs")

# Rule of thumb: visibility timeout >= 6x expected processing time.
# For variable work, extend it while you are still working instead.
def handle(queue_url: str) -> None:
    resp = sqs.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=10,
        WaitTimeSeconds=20,        # long polling - fewer empty receives, cheaper
        VisibilityTimeout=60,
    )
    for msg in resp.get("Messages", []):
        handle_one(queue_url, msg)


def handle_one(queue_url: str, msg: dict) -> None:
    receipt = msg["ReceiptHandle"]
    try:
        for step in long_running_steps(msg["Body"]):
            step()
            # Still working - push the deadline out so nobody else
            # picks this message up behind us.
            sqs.change_message_visibility(
                QueueUrl=queue_url, ReceiptHandle=receipt, VisibilityTimeout=60
            )
        # Delete ONLY after successful processing
        sqs.delete_message(QueueUrl=queue_url, ReceiptHandle=receipt)
    except Exception:
        # Do not delete. After maxReceiveCount it goes to the DLQ,
        # which is what stops a poison message looping forever.
        raise`,
      },
    ],
    deeper: [
      'A DLQ with `maxReceiveCount` is the difference between a poison message being set aside and it consuming consumer capacity indefinitely. Alert on DLQ depth - a non-empty DLQ is always worth a human looking at it.',
      'Long polling (`WaitTimeSeconds: 20`) reduces both cost and empty receives substantially compared with short polling, and it is a one-line change that most teams have not made.',
      'For FIFO queues, parallelism is bounded by the number of distinct `MessageGroupId` values. A design using one group id for everything is single-threaded no matter how many consumers you run.',
    ],
    traps: [
      'Adding consumers when the real problem is redelivery. More consumers means more duplicate work.',
      'Running without a DLQ, so a poison message loops forever.',
      'Deleting the message before processing completes, which silently loses work on failure.',
    ],
    followUps: [
      'How do you size a visibility timeout?',
      'What does a DLQ actually protect you from?',
      'Why can a FIFO queue not be parallelised freely?',
    ],
    tags: ['aws', 'sqs', 'messaging', 'troubleshooting'],
  },
  {
    id: 'itv-aws-59',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Your NAT gateway charges are larger than your EC2 bill. How did that happen and how do you fix it?',
    probing:
      'A very common and very fixable cost surprise. It tests understanding of where traffic actually flows.',
    answer: [
      'NAT gateway pricing has two parts: an hourly charge per gateway, and a **per-gigabyte data processing charge on everything that passes through it**. The hourly cost is small; the data processing is what produces a bill larger than the compute it serves.',
      'The usual causes, and the first one accounts for most cases I have seen. **AWS service traffic routed through NAT.** A workload in a private subnet reading from S3, writing to DynamoDB, pulling secrets or sending to CloudWatch sends all of that through the NAT gateway by default. Every gigabyte is billed, and for S3 and DynamoDB a **gateway VPC endpoint is completely free** - so this is pure waste.',
      '**Container image pulls.** Nodes pulling images from ECR or Docker Hub on every scale-out event, across a large autoscaling fleet, moves a startling amount of data. An interface endpoint for ECR, plus caching, fixes it.',
      '**Cross-AZ NAT traffic**, which costs twice: the inter-AZ data transfer charge plus the NAT processing. This happens when there is one NAT gateway for a whole VPC and instances in other zones route to it. One NAT per AZ costs more in hourly charges and usually less overall - and it removes a single point of failure.',
      '**Chatty external traffic** - log shipping to a third-party SaaS, telemetry, backups to an external target - which is genuine egress but often far larger than anyone realises.',
      'To find it I would use **VPC flow logs** aggregated by destination, which shows exactly where the bytes are going, and Cost Explorer filtered to the `NatGateway-Bytes` usage type to confirm the scale. Flow logs are the tool that turns this from speculation into a ranked list.',
      'The fixes in order of value: gateway endpoints for S3 and DynamoDB, which are free and usually cut the bill immediately; interface endpoints for the other AWS services you use heavily; one NAT per AZ to eliminate cross-zone charges; and then look hard at whether the remaining external traffic is necessary at all.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Where is the traffic going?',
        caption: 'Most NAT spend is AWS traffic that never needed to leave the VPC.',
        question: 'What is the destination of the bytes?',
        branches: [
          {
            condition: 'S3 or DynamoDB',
            result: 'Gateway endpoint - free',
            detail: 'the single biggest win, and it costs nothing to add',
            tone: 'success',
          },
          {
            condition: 'ECR, Secrets Manager, SQS, KMS, CloudWatch',
            result: 'Interface endpoint',
            detail: 'hourly plus data charge, still much cheaper than NAT',
            tone: 'success',
          },
          {
            condition: 'Another AZ, then out through one NAT',
            result: 'One NAT per AZ',
            detail: 'removes the cross-AZ transfer charge and the single point of failure',
            tone: 'accent',
          },
          {
            condition: 'Genuine third-party internet traffic',
            result: 'NAT is correct - reduce volume',
            detail: 'compress, batch, or reconsider shipping that much data',
            tone: 'warning',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Find out where the bytes actually go',
        language: 'bash',
        explanation: 'Flow logs turn a guess into a ranked list of destinations.',
        code: `# Confirm the scale in Cost Explorer
aws ce get-cost-and-usage \\
  --time-period Start=2026-08-01,End=2026-09-01 --granularity MONTHLY \\
  --metrics UnblendedCost --group-by Type=DIMENSION,Key=USAGE_TYPE \\
  --filter '{"Dimensions":{"Key":"SERVICE","Values":["Amazon Virtual Private Cloud"]}}' \\
  --query 'ResultsByTime[].Groups[?contains(Keys[0], \`NatGateway\`)]'

# Where is the traffic going? Query flow logs in Athena.
# SELECT dstaddr, SUM(bytes)/1e9 AS gb
# FROM vpc_flow_logs
# WHERE interface_id = '<nat-eni>' AND day >= '2026/08/01'
# GROUP BY dstaddr ORDER BY gb DESC LIMIT 20;
#
# Then map the top destinations back to AWS services:
#   aws ec2 describe-prefix-lists --filters Name=prefix-list-name,Values='*s3*'

# Which endpoints already exist?
aws ec2 describe-vpc-endpoints \\
  --query 'VpcEndpoints[].[ServiceName,VpcEndpointType,State]' --output table`,
      },
      {
        title: 'Endpoints and per-AZ NAT',
        language: 'hcl',
        explanation: 'The S3 gateway endpoint is free and is usually the largest single saving.',
        code: `# FREE, and typically the biggest win. Route-table based, no ENI.
resource "aws_vpc_endpoint" "s3" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.\${var.region}.s3"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id            = aws_vpc.main.id
  service_name      = "com.amazonaws.\${var.region}.dynamodb"
  vpc_endpoint_type = "Gateway"
  route_table_ids   = aws_route_table.private[*].id
}

# Interface endpoints for the heavy API users. ECR needs both
# ecr.api and ecr.dkr, plus the S3 gateway endpoint for layer pulls.
locals {
  interface_services = ["ecr.api", "ecr.dkr", "secretsmanager", "sts", "logs"]
}

resource "aws_vpc_endpoint" "interface" {
  for_each            = toset(local.interface_services)
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.\${var.region}.\${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.endpoints.id]
  private_dns_enabled = true
}

# One NAT per AZ: no cross-zone transfer charge, no single point of failure
resource "aws_nat_gateway" "per_az" {
  count         = length(var.availability_zones)
  subnet_id     = aws_subnet.public[count.index].id
  allocation_id = aws_eip.nat[count.index].id
}`,
      },
    ],
    deeper: [
      'ECR image pulls need the S3 gateway endpoint as well as the two ECR interface endpoints, because the image **layers** are served from S3. Adding only the ECR endpoints leaves the bulk of the traffic still going through NAT - a very common half-fix.',
      'Interface endpoints are billed hourly per endpoint per AZ plus per GB, so adding twenty of them for lightly used services can cost more than the NAT traffic they save. Add them for the heavy hitters, measured, not speculatively.',
      'One NAT gateway for the whole VPC is also an availability problem: that AZ failing takes out egress for every zone. Per-AZ NAT is usually the right answer on both cost and resilience grounds.',
    ],
    traps: [
      'Sending S3 and DynamoDB traffic through NAT when gateway endpoints are free.',
      'Adding ECR interface endpoints without the S3 gateway endpoint, so layer traffic still pays NAT.',
      'Consolidating to one NAT gateway to save on hourly charges, and paying far more in cross-AZ transfer.',
    ],
    followUps: [
      'Why are gateway endpoints free and interface endpoints not?',
      'Why does ECR need an S3 endpoint too?',
      'How would you measure this before making changes?',
    ],
    tags: ['aws', 'cost', 'vpc', 'networking'],
  },
  {
    id: 'itv-aws-60',
    level: 'intermediate',
    kind: 'scenario',
    prompt:
      'A deployment went out an hour ago but users are still seeing the old version of the site. Where do you look?',
    probing:
      'Caching layers. The answer is a list of caches, checked in order from the user backwards.',
    answer: [
      'Old content after a deploy is a caching question, and there are several caches between the origin and the user. I would work from the user backwards, because that is the order in which they can mask each other.',
      '**The browser.** If assets are served with a long `Cache-Control` max-age and no content hash in the filename, returning visitors keep the old files regardless of anything you do server-side. The fix is fingerprinted filenames - `app.4f3a9b.js` - cached for a year, with a short-cached or no-cached `index.html` that references them. This is the design that makes every other layer behave.',
      '**CloudFront.** The distribution caches per its TTLs and its cache policy. A deploy does not invalidate it. Either invalidate explicitly after deploy, or - better - rely on fingerprinted asset names so new files have new keys and only the small HTML entry point needs invalidating. Note that a CloudFront invalidation is eventually consistent across edges and takes a few minutes, so "I invalidated and it is still old" is often just impatience.',
      '**The origin and any layer in between.** An ALB does not cache, but an nginx or Varnish tier might, as might an S3 website endpoint serving stale objects if the upload did not actually replace them.',
      '**DNS**, if the deploy changed where the site points. TTLs on the old record keep sending users to the old target until they expire, and some resolvers ignore short TTLs.',
      '**And the possibility that the deploy did not happen.** Before blaming caches I would confirm the new artefact is actually serving at the origin - `curl` the origin directly, bypassing CloudFront, and check the version. Half the time the answer is that the deployment succeeded in CI but the rollout did not complete, or it went to the wrong environment.',
      'The check that settles it quickly is a request with cache headers inspected at each layer: `X-Cache: Hit from cloudfront` versus `Miss from cloudfront` tells you immediately whether CloudFront is the one serving old content, and going straight to the origin tells you whether the origin is even updated.',
    ],
    code: [
      {
        title: 'Work backwards from the user',
        language: 'bash',
        explanation:
          'The X-Cache header tells you which layer served it. Start there, not at the origin.',
        code: `# 1. Did the origin actually update? Bypass CloudFront entirely.
curl -sI https://origin-direct.internal/index.html | grep -i 'etag\\|last-modified'
curl -s https://origin-direct.internal/version.json

# 2. What is CloudFront serving, and is it a cache hit?
curl -sI https://www.example.com/index.html \\
  | grep -i 'x-cache\\|age\\|cache-control\\|etag'
#   x-cache: Hit from cloudfront   -> CloudFront is serving stale
#   age: 3600                      -> how long it has been cached

# 3. Invalidate - and note it takes a few minutes to propagate
aws cloudfront create-invalidation \\
  --distribution-id E123456789 --paths '/index.html' '/'

aws cloudfront get-invalidation \\
  --distribution-id E123456789 --id I2J3K4L5M6 --query 'Invalidation.Status'

# 4. Did DNS change and is it still cached?
dig +short www.example.com
dig +nocmd +noall +answer www.example.com | awk '{print $2, $5}'   # TTL`,
      },
      {
        title: 'The caching design that removes the problem',
        language: 'hcl',
        explanation:
          'Fingerprinted assets cached forever, the HTML entry point barely cached at all.',
        code: `# Hashed asset filenames: immutable, cache for a year.
# A new build produces new filenames, so there is nothing to invalidate.
resource "aws_s3_object" "app_js" {
  bucket        = aws_s3_bucket.site.id
  key           = "assets/app.\${var.build_hash}.js"
  content_type  = "application/javascript"
  cache_control = "public, max-age=31536000, immutable"
  source        = "\${path.module}/dist/app.js"
}

# index.html references those filenames and must NOT be cached long,
# or users never learn about the new asset names.
resource "aws_s3_object" "index" {
  bucket        = aws_s3_bucket.site.id
  key           = "index.html"
  content_type  = "text/html"
  cache_control = "public, max-age=0, must-revalidate"
  source        = "\${path.module}/dist/index.html"
}

# With this design the deploy pipeline only ever invalidates /index.html,
# which is fast, cheap, and cannot leave mismatched assets behind.`,
      },
    ],
    deeper: [
      'Invalidating `/*` on every deploy is slow, is charged beyond the free allowance, and is a sign the cache design is wrong. Fingerprinted filenames mean the only thing needing invalidation is the HTML entry point.',
      'Mismatched asset versions are the dangerous failure mode: a cached old `index.html` requesting a new asset filename that no longer exists, or vice versa, gives a broken page rather than an old one. Immutable fingerprinted assets plus a short-cached HTML avoids it.',
      '`Cache-Control: immutable` tells the browser not even to revalidate, which removes a conditional request per asset per page load. Combined with fingerprinting it is safe and noticeably faster.',
    ],
    traps: [
      'Blaming CloudFront before confirming the origin actually updated.',
      'Invalidating and re-testing within seconds. Propagation takes a few minutes.',
      'Serving unfingerprinted assets with a long max-age, which makes every deploy a cache-busting exercise.',
    ],
    followUps: [
      'What does the X-Cache header tell you?',
      'Why is invalidating /* a smell?',
      'How do fingerprinted filenames remove the problem?',
    ],
    tags: ['aws', 'cloudfront', 'caching', 'troubleshooting'],
  },
]
