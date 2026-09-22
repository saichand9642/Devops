import type { InterviewQuestion } from '../../../types'

/**
 * CloudFormation, beyond "it is AWS's Terraform".
 *
 * The comparison question lives in operations.ts. These are the mechanics an
 * interviewer probes once they know you have actually run it in anger: what an
 * update does to a live resource, why a stack is wedged, and what happens to
 * the data when a stack goes away.
 */
export const awsCloudFormationQuestions: InterviewQuestion[] = [
  {
    id: 'itv-aws-73',
    level: 'basic',
    kind: 'open',
    prompt:
      'Walk me through the anatomy of a CloudFormation template. What are the intrinsic functions for?',
    probing:
      'Whether you have written templates rather than only read them. Ref versus GetAtt is the tell.',
    answer: [
      'Only one section is mandatory - **Resources**. Everything else exists to stop the template being a pile of hardcoded strings.',
      '**Parameters** are inputs supplied at deploy time: environment name, instance size, VPC id. They are typed, and AWS-specific types such as `AWS::EC2::VPC::Id` give you a validated dropdown in the console and a failure at submit time rather than at resource-creation time.',
      '**Mappings** are static lookup tables - region to AMI id, environment to instance type - read with `Fn::FindInMap`. **Conditions** are named boolean expressions that decide whether a resource is created at all, which is how one template serves dev and production without duplication.',
      '**Outputs** publish values other people need: a load balancer DNS name, a VPC id. An output with an `Export` becomes importable by another stack, which is a decision with long-term consequences - more on that if you ask about cross-stack references.',
      'The **intrinsic functions** are what make the template dynamic, and three matter most.',
      '`!Ref` returns the "default" identifier for a resource, and what that means depends on the type - for an EC2 instance it is the instance id, for an S3 bucket the bucket name, for a parameter the parameter value. `!GetAtt` returns a **named attribute**: `!GetAtt MyBucket.Arn`, `!GetAtt MyLB.DNSName`. The distinction is the single most common beginner confusion, and the documentation’s Return Values section for each resource type is the authority.',
      '`!Sub` does string interpolation - `!Sub "arn:aws:s3:::${BucketName}/*"` - and is far more readable than the `!Join` chains it replaced. **Pseudo parameters** such as `AWS::Region`, `AWS::AccountId`, `AWS::StackName` and `AWS::Partition` are available everywhere and are what keep a template portable across accounts and regions.',
      'The habit worth naming: `DependsOn` should be rare. CloudFormation infers ordering from `!Ref` and `!GetAtt`, so if you reference a resource you already have the dependency. Reaching for `DependsOn` usually means a dependency that is real but invisible - an IAM policy that must exist before a Lambda runs, for instance.',
    ],
    code: [
      {
        title: 'The sections, in one template',
        language: 'yaml',
        explanation:
          'Conditions plus parameters is how one template serves every environment without a copy per stage.',
        code: `AWSTemplateFormatVersion: '2010-09-09'
Description: Application bucket and queue

Parameters:
  Environment:
    Type: String
    AllowedValues: [dev, staging, prod]
  VpcId:
    Type: AWS::EC2::VPC::Id        # validated - a typo fails at submit time

Mappings:
  EnvConfig:
    dev:     { Retention: 7 }
    staging: { Retention: 30 }
    prod:    { Retention: 365 }

Conditions:
  IsProd: !Equals [!Ref Environment, prod]

Resources:
  Bucket:
    Type: AWS::S3::Bucket
    # Keep production data if the stack is ever deleted
    DeletionPolicy: !If [IsProd, Retain, Delete]
    UpdateReplacePolicy: !If [IsProd, Retain, Delete]
    Properties:
      # Pseudo parameters keep this unique per account and region
      BucketName: !Sub '\${AWS::StackName}-\${AWS::AccountId}-\${AWS::Region}'
      LifecycleConfiguration:
        Rules:
          - Id: expire
            Status: Enabled
            ExpirationInDays: !FindInMap [EnvConfig, !Ref Environment, Retention]

  ReplicationRole:
    Type: AWS::IAM::Role
    Condition: IsProd              # only exists in production
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal: { Service: s3.amazonaws.com }
            Action: sts:AssumeRole

Outputs:
  BucketName:
    Value: !Ref Bucket             # Ref on a bucket returns its NAME
  BucketArn:
    Value: !GetAtt Bucket.Arn      # GetAtt for anything else`,
      },
    ],
    traps: [
      'Using `!Ref` where you needed `!GetAtt`. What `Ref` returns differs per resource type - check the Return Values documentation.',
      'Scattering `DependsOn` everywhere. A `!Ref` already creates the dependency; `DependsOn` is for the ones CloudFormation cannot see.',
      'Hardcoding a region or account id instead of using the pseudo parameters, which makes the template single-use.',
    ],
    followUps: [
      'What does `!Ref` return for an S3 bucket versus an EC2 instance?',
      'When do you actually need `DependsOn`?',
      'How would one template serve dev and production?',
    ],
    tags: ['aws', 'cloudformation', 'iac', 'fundamentals'],
  },
  {
    id: 'itv-aws-74',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'Explain the CloudFormation stack lifecycle. What does a change set tell you, and what does it not?',
    probing:
      'Change sets are the safety mechanism people trust too much. The limits are the interesting half.',
    answer: [
      'A stack moves through states you can read directly: `CREATE_IN_PROGRESS` to `CREATE_COMPLETE`, or to `ROLLBACK_IN_PROGRESS` and `ROLLBACK_COMPLETE` if creation fails. Updates go `UPDATE_IN_PROGRESS`, then `UPDATE_COMPLETE_CLEANUP_IN_PROGRESS` while old resources are removed, then `UPDATE_COMPLETE`.',
      'A **change set** is a dry run. You submit the new template, CloudFormation computes the difference against the current stack, and returns the list of actions without executing anything: Add, Modify, Remove - and critically, for each Modify, the **Replacement** field: `True`, `False` or `Conditional`.',
      '`Replacement: True` is the one to read carefully. It means the resource will be destroyed and recreated with a new physical id - a new database, a new bucket, a new instance. For a stateful resource that is data loss, and the change set is where you catch it.',
      'What a change set does **not** tell you is just as important.',
      'It does not validate that the change will **succeed**. A quota you will exceed, an IAM permission you lack, a name collision, a subnet with no free addresses - none of those appear. The change set is a diff, not a plan-and-verify.',
      'It does not show changes made **outside** CloudFormation. If someone edited a security group in the console, the change set is computed against the **template**, not against reality, so drift is invisible here - drift detection is a separate operation.',
      'It does not evaluate **custom resources** or the dynamic outcome of `Fn::ImportValue`, and nested-stack changes appear only as "the nested stack will change" unless you opt into including nested stacks.',
      'Operationally I would always create a change set for production rather than updating directly, read the Replacement column before anything else, and pair it with drift detection - because those two together cover "what will this do" and "is reality what I think it is", and neither answers the other.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'What an update actually does',
        caption: 'The cleanup phase is where old resources go. A failure before it rolls back.',
        nodes: [
          {
            label: 'Submit template as a change set',
            detail: 'nothing executes yet - this is the diff',
            tone: 'accent',
          },
          {
            label: 'Read the Replacement column',
            detail: 'True means destroy and recreate, with a new physical id',
            arrowLabel: 'review',
            tone: 'warning',
          },
          {
            label: 'Execute',
            detail: 'new resources created, modified resources updated in place',
            arrowLabel: 'apply',
          },
          {
            label: 'Cleanup',
            detail: 'replaced and removed resources deleted here, not earlier',
            arrowLabel: 'UPDATE_COMPLETE_CLEANUP',
          },
          {
            label: 'UPDATE_COMPLETE',
            detail: 'or an automatic rollback to the previous template on failure',
            arrowLabel: 'done',
            tone: 'success',
            branch: {
              label: 'Rollback fails too',
              detail: 'UPDATE_ROLLBACK_FAILED - manual intervention needed',
              tone: 'danger',
            },
          },
        ],
      },
    ],
    code: [
      {
        title: 'The change-set workflow',
        language: 'bash',
        explanation:
          'Create, read, then execute. The Replacement field is the one that causes outages.',
        code: `# 1. Create the change set - nothing happens yet
aws cloudformation create-change-set \\
  --stack-name app-prod --change-set-name review-$(date +%s) \\
  --template-body file://template.yaml \\
  --parameters ParameterKey=Environment,ParameterValue=prod \\
  --capabilities CAPABILITY_NAMED_IAM

# 2. Read it. Replacement=True on a stateful resource is the red flag.
aws cloudformation describe-change-set \\
  --stack-name app-prod --change-set-name review-123 \\
  --query 'Changes[].ResourceChange.{Action:Action,Type:ResourceType,
           LogicalId:LogicalResourceId,Replacement:Replacement,
           Scope:Scope,Reason:Details[0].ChangeSource}' --output table

# 3. Only then execute
aws cloudformation execute-change-set \\
  --stack-name app-prod --change-set-name review-123
aws cloudformation wait stack-update-complete --stack-name app-prod

# A change set does NOT check reality. Do this too:
aws cloudformation detect-stack-drift --stack-name app-prod`,
      },
    ],
    deeper: [
      'Rollback on failure is genuinely valuable and is the main operational advantage over a tool that leaves you halfway. But it is not free: the rollback itself can fail, which is how a stack ends up in `UPDATE_ROLLBACK_FAILED`.',
      '`--disable-rollback` on a create is worth knowing for debugging: the failed resources stay in place so you can inspect why, instead of being deleted before you can look.',
      'Nested stacks are excluded from a change set by default. Pass `--include-nested-stacks` or the diff will understate what is about to happen.',
    ],
    traps: [
      'Treating a change set as a guarantee the update will work. It is a diff, not a validation.',
      'Skipping the Replacement column, which is where the accidental database recreation hides.',
      'Assuming the change set accounts for console edits. It compares against the template, not reality.',
    ],
    followUps: [
      'What does Replacement: Conditional mean?',
      'How would you detect a console edit?',
      'What happens if the rollback itself fails?',
    ],
    tags: ['aws', 'cloudformation', 'iac', 'operations'],
  },
  {
    id: 'itv-aws-75',
    level: 'intermediate',
    kind: 'mcq',
    prompt:
      'You change the `DBInstanceIdentifier` on an `AWS::RDS::DBInstance` in a production stack. What happens?',
    options: [
      {
        id: 'a',
        text: 'The database is replaced - a new instance is created and the old one deleted',
      },
      { id: 'b', text: 'The identifier is updated in place with no interruption' },
      { id: 'c', text: 'CloudFormation rejects the change because the property is immutable' },
      { id: 'd', text: 'The instance restarts briefly but the data is preserved' },
    ],
    correct: ['a'],
    probing:
      'Update behaviour is the highest-stakes CloudFormation knowledge. This is how people lose production data.',
    answer: [
      'Changing a property that requires **replacement** makes CloudFormation create a brand-new resource, switch references to it, and then delete the old one during the cleanup phase. For an RDS instance that means a new, empty database - the data in the old one goes with it unless a `DeletionPolicy: Snapshot` or `Retain` saves you.',
      'Every resource property falls into one of three update behaviours, and they are documented per property in the resource reference.',
      '**No interruption** - updated in place, the resource keeps running and keeps its physical id. Changing an RDS instance’s `BackupRetentionPeriod`, for example.',
      '**Some interruption** - updated in place but unavailable briefly. Changing an EC2 instance type stops and starts it.',
      '**Replacement** - a new physical resource, then the old one is deleted. Typically triggered by identity-like properties: a name, an identifier, an availability zone, a subnet, an engine that cannot be changed in place.',
      'The mechanism that protects you is the **change set**, whose `Replacement` column says `True`, `False` or `Conditional` per resource before anything executes. `Conditional` means it depends on other properties changing in the same update - treat it as True until proven otherwise.',
      'The layered defence I would want on a production stateful resource: `DeletionPolicy: Snapshot` or `Retain` and `UpdateReplacePolicy` set the same way, a **stack policy** denying updates to that logical id, and a mandatory change-set review in the pipeline. Any one of those alone eventually fails to a rushed deploy.',
    ],
    code: [
      {
        title: 'Making replacement survivable',
        language: 'yaml',
        explanation:
          'UpdateReplacePolicy covers the replacement case; DeletionPolicy covers stack deletion. Set both.',
        code: `Resources:
  Database:
    Type: AWS::RDS::DBInstance
    # Stack deleted -> take a final snapshot instead of destroying data
    DeletionPolicy: Snapshot
    # Property change forces replacement -> snapshot the OLD one first.
    # Different trigger, different attribute. Setting only DeletionPolicy
    # is the common half-fix.
    UpdateReplacePolicy: Snapshot
    Properties:
      Engine: postgres
      DBInstanceClass: db.r6g.large
      AllocatedStorage: 200
      MultiAZ: true
      # Deliberately NOT setting DBInstanceIdentifier: letting
      # CloudFormation generate the name means nobody can "tidy it up"
      # later and trigger a replacement.`,
      },
      {
        title: 'A stack policy that refuses to replace the database',
        language: 'json',
        explanation:
          'Applied to the stack, not the template. It blocks the update outright, even if the change set is approved.',
        code: `{
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "Update:*",
      "Principal": "*",
      "Resource": "*"
    },
    {
      "Effect": "Deny",
      "Action": ["Update:Replace", "Update:Delete"],
      "Principal": "*",
      "Resource": "LogicalResourceId/Database"
    }
  ]
}`,
      },
    ],
    deeper: [
      '`DeletionPolicy` and `UpdateReplacePolicy` are triggered by different events - stack deletion versus replacement during an update. Teams routinely set the first and are surprised when a property change still destroys the data.',
      'Letting CloudFormation generate physical names for stateful resources removes a whole class of accident: nobody renames what has no meaningful name, and a rename is exactly what forces replacement.',
      'A stack policy is set on the stack with `set-stack-policy`, not in the template, and overriding it for a deliberate change requires an explicit temporary override - which is the friction you want.',
    ],
    traps: [
      'Setting `DeletionPolicy` alone and assuming replacement is covered.',
      'Renaming a resource to tidy up the template, which forces replacement of the underlying resource.',
      'Reading a change set and skipping the Replacement column.',
    ],
    followUps: [
      'What is the difference between DeletionPolicy and UpdateReplacePolicy?',
      'What does Replacement: Conditional mean?',
      'How does a stack policy differ from IAM?',
    ],
    tags: ['aws', 'cloudformation', 'iac', 'data loss'],
  },
  {
    id: 'itv-aws-76',
    level: 'advanced',
    kind: 'open',
    prompt:
      'Compare nested stacks and cross-stack references. How would you split a large estate into stacks?',
    probing:
      'Stack decomposition is an architecture decision with a well-known trap. The export lock-in is the thing to know.',
    answer: [
      'CloudFormation has a hard template size limit and, more practically, a blast-radius problem: one enormous stack means every change risks everything and every update is slow. So you split - and there are two mechanisms with very different coupling.',
      '**Cross-stack references** use `Outputs` with an `Export`, consumed elsewhere with `Fn::ImportValue`. The stacks are independent: separate lifecycles, separate deployments, each owned by a different team if you like.',
      'The trap is that an export is **locked while it is imported**. You cannot change or delete an exported value while any stack imports it, and you cannot delete the exporting stack either. Renaming a VPC export that eight stacks import becomes a coordinated multi-step migration - publish a new export, move consumers one at a time, then retire the old one. People discover this the day they need to change something foundational.',
      '**Nested stacks** make child templates resources of type `AWS::CloudFormation::Stack` inside a parent. The parent passes parameters down and reads outputs back with `!GetAtt Child.Outputs.Value`. They deploy and roll back as one unit, which is genuinely useful for a template you want reused - a standard three-tier VPC, say.',
      'Their downside is that the unit of failure is the whole tree: a failure in a grandchild rolls back the parent, and troubleshooting means walking down through several stack events to find the actual error. They are also awkward to deploy independently, because you go through the parent.',
      'How I would actually split it: by **rate of change and ownership**, not by service type. A **foundation** stack for the VPC, subnets and shared security groups - changes rarely, exported deliberately and with stable names. A **platform** stack per shared capability - the cluster, the database. An **application** stack per service, deployed by the team that owns it, many times a day.',
      'And I would prefer **SSM Parameter Store over exports** for cross-stack values that might ever change. Writing the VPC id to a parameter and reading it with the `AWS::SSM::Parameter::Value<String>` parameter type gives the same decoupling with none of the lock-in - the consumer resolves the value at deploy time and there is no dependency edge to get stuck on. That is the answer that shows you have been bitten by exports.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'How should these stacks relate?',
        caption: 'Exports couple lifecycles permanently. SSM parameters do not.',
        question: 'What is the relationship between the pieces?',
        branches: [
          {
            condition: 'Reusable template, deployed as one unit',
            result: 'Nested stacks',
            detail: 'one rollback boundary, parameters down and outputs up',
            tone: 'accent',
          },
          {
            condition: 'Separate teams, separate release cadence',
            result: 'Separate stacks',
            detail: 'independent lifecycles - now choose how they share values',
            tone: 'success',
          },
          {
            condition: 'Shared value that will never change',
            result: 'Export and ImportValue',
            detail: 'strong guarantee, and locked while imported',
            tone: 'warning',
          },
          {
            condition: 'Shared value that might change',
            result: 'SSM Parameter Store',
            detail: 'same decoupling, no dependency lock',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Export and import, and why it locks',
        language: 'yaml',
        explanation: 'Once the consumer exists, the producer cannot change or delete that export.',
        code: `# --- foundation stack ---
Outputs:
  VpcId:
    Value: !Ref Vpc
    Export:
      # The export name is now a permanent public interface.
      Name: !Sub '\${AWS::StackName}-VpcId'

# --- consumer stack ---
Resources:
  AppSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      VpcId: !ImportValue foundation-VpcId
      GroupDescription: Application tier

# From this moment the foundation stack cannot change VpcId's export
# name or value, and cannot be deleted, until this stack stops
# importing it.`,
      },
      {
        title: 'The decoupled alternative',
        language: 'yaml',
        explanation:
          'The producer publishes to SSM; the consumer resolves at deploy time with no dependency edge.',
        code: `# --- foundation stack publishes ---
Resources:
  VpcIdParameter:
    Type: AWS::SSM::Parameter
    Properties:
      Name: /platform/network/vpc-id
      Type: String
      Value: !Ref Vpc

# --- consumer stack reads, with no coupling ---
Parameters:
  VpcId:
    # Resolved at deploy time from Parameter Store.
    Type: AWS::SSM::Parameter::Value<AWS::EC2::VPC::Id>
    Default: /platform/network/vpc-id

Resources:
  AppSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      VpcId: !Ref VpcId
      GroupDescription: Application tier`,
      },
    ],
    deeper: [
      'Export names are unique per account per region, which is a real constraint at scale. Prefix them with the stack name so two environments in one account cannot collide.',
      'Nested stacks are excluded from a parent change set unless you pass `--include-nested-stacks`, so the diff you review can quietly omit the change that matters.',
      'The `AWS::SSM::Parameter::Value<...>` parameter types validate as well as resolve, so a missing or malformed parameter fails at submit time rather than midway through creating resources.',
    ],
    traps: [
      'Exporting values that will need to change. The lock is the whole problem.',
      'Splitting stacks by AWS service rather than by ownership and change rate, which produces dependency spaghetti.',
      'Reviewing a parent change set without nested stacks included.',
    ],
    followUps: [
      'How would you rename an export that eight stacks import?',
      'When are nested stacks the right choice?',
      'Why is Parameter Store better for shared values?',
    ],
    tags: ['aws', 'cloudformation', 'architecture', 'iac'],
  },
  {
    id: 'itv-aws-77',
    level: 'intermediate',
    kind: 'open',
    prompt:
      'What are StackSets, and how would you use them to deploy a baseline across an organisation?',
    probing:
      'Multi-account operations. The permission model is the part that distinguishes real experience.',
    answer: [
      'A **StackSet** deploys one template to many accounts and many regions from a single place. You define the template once and give it target accounts or organisational units, and CloudFormation creates a **stack instance** in each account-region pair, tracking them together.',
      'The natural use is a security and compliance baseline: a CloudTrail configuration, Config rules, GuardDuty enablement, an IAM role for the central platform team, standard tagging or a default VPC replacement. Anything every account must have.',
      'There are two permission models and the distinction matters. **Self-managed** requires you to create an administration role in the management account and an execution role in every target account, with a trust relationship between them - fine for a handful of accounts, tedious beyond that. **Service-managed** integrates with AWS Organizations, creates the roles for you, targets OUs rather than account lists, and supports **automatic deployment**: a new account joining the OU gets the baseline without anybody doing anything. That last property is the reason service-managed is the right default.',
      'The rollout controls are worth knowing because a bad template deployed to 200 accounts at once is a genuinely bad day. `MaxConcurrentPercentage` and `FailureTolerancePercentage` govern how fast it proceeds and when it stops, and `RegionOrder` sequences regions. I would set a low failure tolerance so a broken template halts after the first couple of accounts rather than completing everywhere.',
      'Two operational details I would raise. **Drift** is tracked per stack instance, so you can find the one account where somebody edited the resource by hand. And **deleting a stack instance** offers a retain option - removing an account from the StackSet’s scope without tearing down what it created, which is what you want when an account leaves an OU but must keep functioning.',
      'The honest limitation: a StackSet is still CloudFormation, so the template must be genuinely account-agnostic. Anything needing per-account variation has to come from parameter overrides per instance, and heavy use of those is a sign the baseline is trying to do too much.',
    ],
    code: [
      {
        title: 'A service-managed StackSet across an OU',
        language: 'bash',
        explanation:
          'Auto-deployment is the point: accounts added to the OU get the baseline automatically.',
        code: `aws cloudformation create-stack-set \\
  --stack-set-name security-baseline \\
  --template-body file://baseline.yaml \\
  --permission-model SERVICE_MANAGED \\
  --auto-deployment Enabled=true,RetainStacksOnAccountRemoval=true \\
  --capabilities CAPABILITY_NAMED_IAM

# Roll out to an OU, deliberately slowly
aws cloudformation create-stack-instances \\
  --stack-set-name security-baseline \\
  --deployment-targets OrganizationalUnitIds=ou-abc1-11111111 \\
  --regions eu-west-1 us-east-1 \\
  --operation-preferences \\
      FailureTolerancePercentage=0,MaxConcurrentPercentage=25,\\
RegionConcurrencyType=SEQUENTIAL

# Which instances are unhealthy or drifted?
aws cloudformation list-stack-instances --stack-set-name security-baseline \\
  --query 'Summaries[?Status!=\`CURRENT\`].[Account,Region,Status,StatusReason]' \\
  --output table

# Find the account where somebody edited it by hand
aws cloudformation detect-stack-set-drift --stack-set-name security-baseline`,
      },
    ],
    deeper: [
      '`FailureTolerancePercentage=0` means the operation stops at the first failure. On a fleet-wide baseline that is what you want - the alternative is discovering a broken template in 200 accounts.',
      '`RetainStacksOnAccountRemoval` decides what happens when an account leaves the OU. Retaining is usually right: the account keeps working, and you clean up deliberately rather than by accident.',
      'StackSets cannot easily express per-account differences. If you find yourself writing many parameter overrides, the baseline is probably two baselines.',
    ],
    traps: [
      'Deploying to every account at once with no failure tolerance limit.',
      'Using self-managed permissions at organisation scale, which means creating roles in every account by hand.',
      'Assuming a new account automatically gets the baseline - only service-managed with auto-deployment does that.',
    ],
    followUps: [
      'What is the difference between the two permission models?',
      'What happens when an account leaves the OU?',
      'How would you find an account that has drifted?',
    ],
    tags: ['aws', 'cloudformation', 'organizations', 'governance'],
  },
  {
    id: 'itv-aws-78',
    level: 'intermediate',
    kind: 'open',
    prompt: 'What is drift detection, what does it miss, and what do you do when you find drift?',
    probing:
      'Whether you know the limits of the tool. "Just run drift detection" is a half answer.',
    answer: [
      '**Drift detection** compares the actual configuration of each resource in a stack against what the template says it should be, and reports each resource as `IN_SYNC`, `MODIFIED`, `DELETED` or `NOT_CHECKED`, with a property-level diff for the modified ones.',
      'The usual causes are mundane: somebody fixed something in the console during an incident and never went back to the template, an operator ran a CLI command, or another tool touched the same resource.',
      'What it misses is the important half.',
      '**Not every resource type is supported**, and unsupported resources come back as `NOT_CHECKED` - which reads reassuringly like "fine" and means "not examined". Custom resources are never checked.',
      'It only compares **properties present in the template**. A property you never specified, left at its AWS default and then changed by hand, is not drift as far as CloudFormation is concerned, because the template expresses no opinion about it.',
      'It is a **point-in-time scan**, not continuous. Nothing tells you drift happened; you have to go and look, which is why I would run it on a schedule - an EventBridge rule invoking detection weekly and on every deployment - rather than only when something is already wrong.',
      'For handling it, the decision is which side is right.',
      'If the **template** is right, re-deploy the stack and let CloudFormation correct reality. That is the normal case and it is why drift detection exists.',
      'If the **console change** is right - somebody fixed a genuine problem - then update the template to match and deploy, so the fix is recorded. Never leave a correct manual change undocumented; the next deployment will silently revert it, usually at the worst moment.',
      'And then address the cause: tighten IAM so humans cannot modify what CloudFormation owns, or accept that break-glass access exists and add a post-incident step to reconcile the template. Drift is almost always a process signal rather than a technical one.',
    ],
    code: [
      {
        title: 'Detect, then read the property-level diff',
        language: 'bash',
        explanation:
          'Detection is asynchronous - start it, poll, then list the resources that differ.',
        code: `# Start detection and keep the id
ID=$(aws cloudformation detect-stack-drift --stack-name app-prod \\
      --query StackDriftDetectionId --output text)

aws cloudformation describe-stack-drift-detection-status \\
  --stack-drift-detection-id "$ID" \\
  --query '{Status:DetectionStatus,Drifted:StackDriftStatus,Count:DriftedStackResourceCount}'

# What exactly differs, property by property
aws cloudformation describe-stack-resource-drifts \\
  --stack-name app-prod \\
  --stack-resource-drift-status-filters MODIFIED DELETED \\
  --query 'StackResourceDrifts[].{Resource:LogicalResourceId,
           Status:StackResourceDriftStatus,
           Diff:PropertyDifferences[].{Path:PropertyPath,
             Expected:ExpectedValue,Actual:ActualValue}}'

# NOT_CHECKED is not the same as IN_SYNC - know your blind spots
aws cloudformation describe-stack-resource-drifts --stack-name app-prod \\
  --stack-resource-drift-status-filters NOT_CHECKED \\
  --query 'StackResourceDrifts[].[LogicalResourceId,ResourceType]' --output table`,
      },
      {
        title: 'Detect on a schedule, not on suspicion',
        language: 'yaml',
        explanation:
          'Drift is silent. A weekly scheduled scan is what turns it into something you notice.',
        code: `Resources:
  WeeklyDriftCheck:
    Type: AWS::Events::Rule
    Properties:
      ScheduleExpression: 'cron(0 6 ? * MON *)'
      Targets:
        - Id: drift-detector
          Arn: !GetAtt DriftFunction.Arn

  # And alert when a stack reports itself drifted
  DriftAlarm:
    Type: AWS::CloudWatch::Alarm
    Properties:
      AlarmName: cloudformation-drift-detected
      Namespace: Custom/CloudFormation
      MetricName: DriftedStacks
      Statistic: Maximum
      Period: 86400
      EvaluationPeriods: 1
      Threshold: 0
      ComparisonOperator: GreaterThanThreshold`,
      },
    ],
    deeper: [
      '`NOT_CHECKED` is the dangerous status because it looks like a pass. Know which of your resource types are unsupported, and do not claim full coverage you do not have.',
      'A property you never set in the template cannot drift, by definition. If a setting matters, express it explicitly - that is as much about drift detection as about clarity.',
      'AWS Config with conformance packs is the continuous complement: it evaluates on change rather than on a schedule, and it covers resources CloudFormation does not manage at all.',
    ],
    traps: [
      'Reading `NOT_CHECKED` as "no drift".',
      'Re-deploying to correct drift without checking whether the manual change was the correct one.',
      'Running drift detection only during incidents, when the damage is already done.',
    ],
    followUps: [
      'What would you do if the console change was the right one?',
      'How does this compare with AWS Config?',
      'Why can an unset property never drift?',
    ],
    tags: ['aws', 'cloudformation', 'operations', 'governance'],
  },
  {
    id: 'itv-aws-79',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How do custom resources work, and how does CloudFormation know an EC2 instance finished bootstrapping?',
    probing:
      'Both are signalling mechanisms. The failure mode - a stack hanging for an hour - is the memorable part.',
    answer: [
      'Both questions are the same underlying idea: CloudFormation only knows what it is told, so anything outside its model has to **signal back**.',
      'A **custom resource** lets a template manage something CloudFormation has no resource type for - a third-party API, a DNS record at an external provider, a database schema migration, a lookup that has to happen at deploy time. You declare `Type: Custom::Something` with a `ServiceToken` pointing at a Lambda function or an SNS topic.',
      'CloudFormation then calls that Lambda with an event containing `RequestType` - **Create**, **Update** or **Delete** - the resource properties, and critically a pre-signed `ResponseURL`. Your function does its work and must **PUT a response to that URL** saying SUCCESS or FAILED, along with a `PhysicalResourceId`.',
      'The failure mode everybody meets once: **if the function never responds, CloudFormation waits.** The default timeout is an hour, and there is no error to look at because nothing failed - the stack simply sits in `CREATE_IN_PROGRESS`. An unhandled exception, a Lambda timeout, or a function in a VPC with no route out to the response URL all produce this. So the rule is: wrap the entire handler in try/except and **always send a response, including on failure**, and handle `Delete` by responding SUCCESS even when there is nothing to delete - otherwise the stack cannot be deleted either.',
      'The `PhysicalResourceId` matters more than it looks. If you return a **different** id on an Update, CloudFormation treats it as a replacement and sends a Delete for the old one afterwards. Returning the same id means an in-place update. Getting this wrong causes a Delete you did not expect.',
      'For the **EC2 bootstrapping** half: CloudFormation considers an instance created the moment EC2 returns an instance id, which is long before user data has finished. A `CreationPolicy` with a `ResourceSignal` changes that - the stack waits until the instance calls `cfn-signal`, or until the timeout expires and the creation fails. That is how a stack can genuinely mean "the application is up" rather than "the VM exists".',
      'The same applies to an Auto Scaling group, where the `CreationPolicy` can require a **count** of signals, and to rolling updates via `UpdatePolicy` with `WaitOnResourceSignals` - so a rolling replacement waits for each batch to report healthy before continuing. Without it a rolling update will happily replace every instance with broken ones.',
    ],
    diagrams: [
      {
        kind: 'sequence',
        title: 'Custom resource handshake',
        caption: 'No response means no error - just an hour of CREATE_IN_PROGRESS.',
        participants: [
          { id: 'cfn', label: 'CloudFormation' },
          { id: 'lambda', label: 'Your Lambda' },
          { id: 'api', label: 'External API' },
          { id: 's3', label: 'Response URL' },
        ],
        messages: [
          { from: 'cfn', to: 'lambda', label: 'RequestType Create, with ResponseURL' },
          { from: 'lambda', to: 'api', label: 'do the actual work' },
          { from: 'api', to: 'lambda', label: 'result', kind: 'return' },
          { from: 'lambda', to: 's3', label: 'PUT SUCCESS plus PhysicalResourceId' },
          { from: 's3', to: 'cfn', label: 'response received', kind: 'return' },
          { from: 'cfn', to: 'cfn', label: 'resource CREATE_COMPLETE, continue' },
        ],
      },
    ],
    code: [
      {
        title: 'A custom resource handler that cannot hang the stack',
        language: 'python',
        explanation:
          'Always respond. The try/finally is the whole lesson - an exception must still send FAILED.',
        code: `import json
import urllib.request


def send(event, context, status, physical_id, data=None, reason=None):
    body = json.dumps({
        "Status": status,
        "Reason": reason or f"See CloudWatch log stream {context.log_stream_name}",
        "PhysicalResourceId": physical_id,
        "StackId": event["StackId"],
        "RequestId": event["RequestId"],
        "LogicalResourceId": event["LogicalResourceId"],
        "Data": data or {},
    }).encode()
    req = urllib.request.Request(
        event["ResponseURL"], data=body, method="PUT",
        headers={"content-type": "", "content-length": str(len(body))},
    )
    urllib.request.urlopen(req)


def handler(event, context):
    # Keeping the SAME physical id across updates means in-place update.
    # Returning a different one makes CloudFormation delete the old resource.
    physical_id = event.get("PhysicalResourceId", f"custom-{event['LogicalResourceId']}")
    try:
        if event["RequestType"] == "Delete":
            # Must succeed even if there is nothing to delete, or the
            # stack can never be deleted.
            delete_thing(event["ResourceProperties"])
        elif event["RequestType"] == "Create":
            create_thing(event["ResourceProperties"])
        else:
            update_thing(event["ResourceProperties"], event["OldResourceProperties"])
        send(event, context, "SUCCESS", physical_id)
    except Exception as exc:
        # NEVER let this escape. An unhandled exception means no response,
        # and no response means the stack waits an hour with no error.
        send(event, context, "FAILED", physical_id, reason=str(exc))`,
      },
      {
        title: 'Waiting for the application, not the instance',
        language: 'yaml',
        explanation:
          'Without a CreationPolicy the stack is COMPLETE while the app is still installing.',
        code: `Resources:
  AppServer:
    Type: AWS::EC2::Instance
    CreationPolicy:
      ResourceSignal:
        Count: 1
        Timeout: PT15M        # fail the stack if no signal in 15 minutes
    Properties:
      ImageId: !Ref LatestAmi
      UserData:
        Fn::Base64: !Sub |
          #!/bin/bash -xe
          # -e matters: if any step fails we fall through to the trap
          trap 'cfn-signal -e 1 --stack \${AWS::StackName} \\
                  --resource AppServer --region \${AWS::Region}' ERR

          yum install -y aws-cfn-bootstrap
          /opt/app/install.sh
          systemctl start app
          curl -sf localhost:8080/healthz      # prove it actually serves

          # Only now tell CloudFormation the resource is ready
          cfn-signal -e 0 --stack \${AWS::StackName} \\
            --resource AppServer --region \${AWS::Region}

  AppGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    CreationPolicy:
      ResourceSignal:
        Count: 3              # wait for three healthy instances
        Timeout: PT20M
    UpdatePolicy:
      AutoScalingRollingUpdate:
        MinInstancesInService: 2
        MaxBatchSize: 1
        PauseTime: PT10M
        # Do not continue to the next batch until this one signals
        WaitOnResourceSignals: true`,
      },
    ],
    deeper: [
      'A Lambda-backed custom resource inside a VPC needs a route to the response URL, which is an S3 pre-signed URL. No NAT gateway and no S3 gateway endpoint means the response never arrives and the stack hangs - one of the most confusing versions of this failure.',
      'Lambda’s own timeout is separate from CloudFormation’s hour. A function that times out mid-work never sends a response at all, so long-running work should respond first and continue asynchronously, or use a state machine.',
      'AWS Lambda-backed custom resources have largely been superseded for common cases by registry resource types and, for orchestration, by `AWS::CloudFormation::CustomResource` patterns baked into CDK constructs - but the signalling contract underneath is identical.',
    ],
    traps: [
      'Letting an exception escape the handler, which hangs the stack for an hour with no error.',
      'Not handling `Delete`, which makes the stack undeletable.',
      'Omitting `CreationPolicy` and believing `CREATE_COMPLETE` means the application is running.',
    ],
    followUps: [
      'What happens if the Lambda never responds?',
      'Why does changing PhysicalResourceId cause a delete?',
      'How do you make a rolling update wait for health?',
    ],
    tags: ['aws', 'cloudformation', 'lambda', 'iac'],
  },
  {
    id: 'itv-aws-80',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'A production stack is stuck in UPDATE_ROLLBACK_FAILED. Walk me through getting it back.',
    probing:
      'The classic CloudFormation incident. There is a correct procedure and a very tempting wrong one.',
    answer: [
      'This state means two things went wrong: the update failed, and then the **automatic rollback also failed**. The stack cannot be updated or deleted while it is here, so it needs deliberate intervention rather than another deploy.',
      'First, **find out what actually failed**, because the rollback failure is usually a consequence of the original one. The stack events list, read newest-first, names the resource and gives a status reason - and that reason is almost always specific enough to act on.',
      'The common causes are worth knowing because they repeat. A resource was **modified or deleted outside CloudFormation**, so rolling back to the previous state is impossible - the thing it wants to restore is gone. An IAM permission was **removed mid-update**, so the rollback cannot undo what it did. A resource has a **dependency that blocks deletion** - a security group still attached, a subnet still in use. Or a **custom resource failed to respond** during rollback.',
      'The fix is `continue-update-rollback`. On its own, it retries the rollback - which works if the underlying problem has since been resolved, so if the cause was a transient permission issue or a manual change you have now reverted, fix that first and simply retry.',
      'If a specific resource cannot be rolled back at all, the same command takes `--resources-to-skip`. CloudFormation then abandons that resource, marking it `UPDATE_COMPLETE` without touching it, and completes the rollback for everything else. The stack returns to `UPDATE_ROLLBACK_COMPLETE` and is usable again.',
      'The important caveat, which I would say out loud: **skipping a resource leaves the stack lying about it.** CloudFormation now believes that resource matches the template when it may not. So immediately afterwards I would run drift detection, reconcile the template with reality, and deploy a small corrective change - otherwise the next update starts from a false premise.',
      'What I would **not** do is delete the stack to get out of it. On a production stack that destroys real resources, and the underlying problem usually still exists. And I would not keep retrying the same update - it will fail the same way.',
      'For prevention: a change set reviewed before execution, a stack policy protecting stateful resources, and IAM that stops humans editing what CloudFormation owns. Nearly every stuck stack I have seen traced back to a manual change made during an earlier incident.',
    ],
    diagrams: [
      {
        kind: 'decision',
        title: 'Getting out of UPDATE_ROLLBACK_FAILED',
        caption: 'Read the reason first - it decides which of these applies.',
        question: 'Why did the rollback fail?',
        branches: [
          {
            condition: 'Transient - permissions, throttling, a dependency now gone',
            result: 'Fix it, then continue-update-rollback',
            detail: 'plain retry, nothing skipped, nothing lost',
            tone: 'success',
          },
          {
            condition: 'A resource was deleted outside CloudFormation',
            result: 'continue-update-rollback with resources-to-skip',
            detail: 'then reconcile the template - the stack now believes something untrue',
            tone: 'warning',
          },
          {
            condition: 'A custom resource never responded',
            result: 'Fix the handler, then retry',
            detail: 'it must always send a response, including on Delete',
            tone: 'warning',
          },
          {
            condition: 'Tempted to delete the stack',
            result: 'Do not, on production',
            detail: 'it destroys real resources and does not address the cause',
            tone: 'danger',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Diagnose, then recover',
        language: 'bash',
        explanation:
          'The status reason on the first failed event is the whole diagnosis. Read it before acting.',
        code: `# What failed, newest first? This names the resource and the reason.
aws cloudformation describe-stack-events --stack-name app-prod \\
  --query 'StackEvents[?ResourceStatus==\`UPDATE_FAILED\` ||
           ResourceStatus==\`UPDATE_ROLLBACK_FAILED\`]
           .[Timestamp,LogicalResourceId,ResourceStatus,ResourceStatusReason]' \\
  --output table | head -20

# Which resources are in a bad state right now?
aws cloudformation describe-stack-resources --stack-name app-prod \\
  --query 'StackResources[?contains(ResourceStatus, \`FAILED\`)]
           .[LogicalResourceId,ResourceType,ResourceStatus,ResourceStatusReason]' \\
  --output table

# 1. Preferred: fix the cause, then plain retry
aws cloudformation continue-update-rollback --stack-name app-prod

# 2. If one resource genuinely cannot be rolled back, abandon just that one
aws cloudformation continue-update-rollback --stack-name app-prod \\
  --resources-to-skip LegacySecurityGroup

aws cloudformation wait stack-rollback-complete --stack-name app-prod

# 3. MANDATORY after skipping - the stack's view is now unreliable
aws cloudformation detect-stack-drift --stack-name app-prod`,
      },
    ],
    deeper: [
      '`--resources-to-skip` accepts nested-stack resources in the form `ParentLogicalId.ChildLogicalId`, which is how you skip something inside a nested stack without touching the parent.',
      'After skipping anything, the stack’s model and reality have diverged by definition. Drift detection plus a corrective deploy is not optional tidying - it is what stops the next update failing for a new reason.',
      '`--disable-rollback` on the original update turns this failure mode into a stack that simply stops in `UPDATE_FAILED` with everything left in place for inspection. For a risky production change that is often the better trade.',
    ],
    traps: [
      'Deleting the stack to escape the state, which destroys production resources.',
      'Skipping resources before reading why the rollback failed.',
      'Skipping a resource and never reconciling afterwards, leaving the stack with a false picture.',
    ],
    followUps: [
      'What does --resources-to-skip actually do to the stack’s view?',
      'Why is a manual console change the usual root cause?',
      'When would you use --disable-rollback?',
    ],
    tags: ['aws', 'cloudformation', 'incident', 'troubleshooting'],
  },
  {
    id: 'itv-aws-81',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Deleting a stack fails with DELETE_FAILED and the stack will not go away. What is holding it up?',
    probing:
      'A short list of well-known culprits. Knowing them by name is the difference between minutes and hours.',
    answer: [
      'The stack is blocked on one or more resources that cannot be deleted, and the event reason names them. There is a familiar set of causes.',
      '**A non-empty S3 bucket.** CloudFormation will not delete a bucket with objects in it, and it has no "force" option. Versioned buckets are worse - you must delete every version and every delete marker, not just the current objects. This is by far the most common one.',
      '**Network interfaces left behind by Lambda.** A Lambda function attached to a VPC creates ENIs, and they can take several minutes to be released after the function is deleted. The subnet or security group delete then fails because the ENI still holds it. Often this resolves itself on a retry a few minutes later, which is worth knowing before you go hunting.',
      '**A security group still referenced** by another security group’s rule, or still attached to a resource outside the stack.',
      '**Resources with dependants outside the stack** generally: someone attached a manually created instance to your subnet, or another stack imports one of your exports - and an export that is imported blocks deletion of the exporting stack entirely.',
      '**Resources with `DeletionPolicy: Retain`** are not a failure - they are skipped deliberately and left behind, which is correct but surprises people who then find orphaned resources still costing money.',
      'To resolve it, I would read the failure reason, clear the blocker - empty the bucket, wait for ENIs, remove the external dependency - and retry the delete. If one resource genuinely cannot go and I am willing to orphan it, `delete-stack --retain-resources` abandons the named resources and deletes the rest, leaving them to be cleaned up by hand.',
      'The preventative pattern for the bucket case is a **custom resource that empties the bucket on Delete**, so the stack is self-cleaning in non-production. For production I would keep `DeletionPolicy: Retain` on data and accept that the cleanup is deliberate - the point is that the data survives, not that the delete is tidy.',
      'One organisational note: every retained or orphaned resource keeps costing money and nobody owns it any more. Whatever route you take, write down what was left behind.',
    ],
    code: [
      {
        title: 'Find the blocker, clear it, retry',
        language: 'bash',
        explanation: 'The DELETE_FAILED event names the resource and usually says exactly why.',
        code: `# What is blocking the delete?
aws cloudformation describe-stack-events --stack-name app-dev \\
  --query 'StackEvents[?ResourceStatus==\`DELETE_FAILED\`]
           .[LogicalResourceId,ResourceType,ResourceStatusReason]' --output table
#   "The bucket you tried to delete is not empty"
#   "resource sg-0abc has a dependent object"

# S3: empty it, INCLUDING versions and delete markers
aws s3 rm s3://my-bucket --recursive
aws s3api list-object-versions --bucket my-bucket \\
  --query '{Objects: Versions[].{Key:Key,VersionId:VersionId}}' > v.json
aws s3api delete-objects --bucket my-bucket --delete file://v.json

# Security group: what still references it?
aws ec2 describe-network-interfaces \\
  --filters Name=group-id,Values=sg-0abc \\
  --query 'NetworkInterfaces[].[NetworkInterfaceId,Description,Status]' --output table
#   a Lambda ENI here usually just needs a few more minutes

# Is another stack importing one of our exports?
aws cloudformation list-imports --export-name foundation-VpcId

# Retry, or abandon the resource you cannot delete
aws cloudformation delete-stack --stack-name app-dev
aws cloudformation delete-stack --stack-name app-dev \\
  --retain-resources DataBucket`,
      },
      {
        title: 'A bucket that empties itself on delete',
        language: 'yaml',
        explanation:
          'Sensible for ephemeral environments. Never for production data - use Retain there.',
        code: `Resources:
  Bucket:
    Type: AWS::S3::Bucket
    DeletionPolicy: Delete          # dev only - prod would be Retain

  EmptyBucketOnDelete:
    Type: Custom::EmptyBucket
    Properties:
      ServiceToken: !GetAtt EmptyBucketFunction.Arn
      BucketName: !Ref Bucket

  EmptyBucketFunction:
    Type: AWS::Lambda::Function
    Properties:
      Runtime: python3.12
      Handler: index.handler
      Role: !GetAtt EmptyBucketRole.Arn
      Timeout: 300
      Code:
        ZipFile: |
          import boto3, cfnresponse
          def handler(event, context):
              try:
                  if event['RequestType'] == 'Delete':
                      bucket = boto3.resource('s3').Bucket(
                          event['ResourceProperties']['BucketName'])
                      bucket.object_versions.delete()   # versions too
                  cfnresponse.send(event, context, cfnresponse.SUCCESS, {})
              except Exception as exc:
                  # Always respond, or the stack hangs for an hour
                  cfnresponse.send(event, context, cfnresponse.FAILED,
                                   {}, reason=str(exc))`,
      },
    ],
    deeper: [
      'Lambda ENIs are the one where patience is the correct action. They are released asynchronously and a retry five to ten minutes later usually just works - hunting for them manually wastes time.',
      'An export that another stack imports blocks deletion of the whole exporting stack, and `list-imports` is the only quick way to find who. This is the export lock-in problem showing up at the worst moment.',
      '`--retain-resources` only works on a stack already in `DELETE_FAILED`, and the retained resources become untracked and unowned. Record them somewhere or they become permanent mystery spend.',
    ],
    traps: [
      'Forgetting object versions and delete markers when emptying a versioned bucket.',
      'Hunting for phantom dependencies when a Lambda ENI just needs a few minutes.',
      'Abandoning resources with `--retain-resources` and not recording what was left behind.',
    ],
    followUps: [
      'Why does a versioned bucket need extra work?',
      'How would you find which stack imports your export?',
      'What happens to resources with DeletionPolicy Retain?',
    ],
    tags: ['aws', 'cloudformation', 'troubleshooting', 'operations'],
  },
  {
    id: 'itv-aws-82',
    level: 'advanced',
    kind: 'open',
    prompt:
      'How should CloudFormation itself be permitted? Explain service roles and the CAPABILITY flags.',
    probing:
      'A security question people answer badly. By default CloudFormation uses YOUR permissions.',
    answer: [
      'The default surprises people: **CloudFormation acts as the caller**. If you run `deploy`, every resource is created with your permissions, which means the human or pipeline deploying a stack needs permission to create everything in it - IAM roles, databases, networking. That is a very wide grant to hand to a deployment identity.',
      'The fix is a **service role**: an IAM role passed with `--role-arn` that CloudFormation assumes to perform the operations. Now the deployer needs only `cloudformation:*` on the stack plus `iam:PassRole` for that role, and the role itself holds the resource permissions. Two benefits follow - the human identity is far less privileged, and the role is scoped to exactly what this stack may touch, so a template that suddenly tries to create an admin role simply fails.',
      'Crucially, the service role is **remembered on the stack**, so subsequent updates use it too - which also means anybody who can update the stack effectively wields that role. Protect the stack with IAM accordingly.',
      'The **capability flags** are a separate, deliberate confirmation. `CAPABILITY_IAM` acknowledges that the template creates IAM resources; `CAPABILITY_NAMED_IAM` is required when those resources have **explicit names**, because a named role is a bigger deal - it can be referenced from elsewhere and it can collide across stacks. `CAPABILITY_AUTO_EXPAND` acknowledges macros and transforms such as SAM, which can generate resources you did not literally write.',
      'They exist because a template is code that can grant privilege. Requiring an explicit acknowledgement stops someone deploying a template from a blog post that quietly creates an administrator role. The failure mode I would flag is a pipeline that passes `CAPABILITY_NAMED_IAM` unconditionally on every deploy - that turns a deliberate confirmation into noise, and the review that was supposed to happen never does.',
      'For a production setup I would want: a dedicated service role per stack or per stack family with least-privilege policies, a deployment identity that can only call CloudFormation and pass that specific role, a **permission boundary** on any IAM role the template creates so a compromised template cannot escalate, capabilities granted deliberately rather than blanket, and CloudTrail on `cloudformation:*` and `iam:PassRole` so the privileged path is auditable.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Who is actually creating the resources?',
        caption: 'Without a service role, the answer is the person who ran the deploy.',
        nodes: [
          {
            label: 'Deployer runs create-stack',
            detail: 'a human, or the CI/CD role',
            tone: 'accent',
          },
          {
            label: 'No role-arn passed',
            detail: 'CloudFormation uses the CALLER credentials for everything',
            arrowLabel: 'default',
            tone: 'danger',
          },
          {
            label: 'role-arn passed',
            detail: 'CloudFormation assumes the service role instead',
            arrowLabel: 'better',
            tone: 'success',
          },
          {
            label: 'Deployer needs far less',
            detail: 'cloudformation on the stack, plus iam:PassRole for that role',
            arrowLabel: 'result',
            tone: 'success',
          },
          {
            label: 'Role is remembered on the stack',
            detail: 'later updates reuse it - so guard who can update the stack',
            arrowLabel: 'note',
            tone: 'warning',
          },
        ],
      },
    ],
    code: [
      {
        title: 'Service role plus a narrow deployer',
        language: 'yaml',
        explanation:
          'The deployer cannot create resources directly - only ask CloudFormation to, with this one role.',
        code: `Resources:
  # What CloudFormation is allowed to do
  StackServiceRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: cfn-app-service-role
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal: { Service: cloudformation.amazonaws.com }
            Action: sts:AssumeRole
      Policies:
        - PolicyName: app-resources
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action: ['s3:*', 'sqs:*', 'lambda:*', 'logs:*']
                Resource: '*'
              # Roles this stack creates must carry a boundary, so a
              # compromised template cannot mint an administrator.
              - Effect: Allow
                Action: ['iam:CreateRole', 'iam:PutRolePolicy', 'iam:AttachRolePolicy']
                Resource: '*'
                Condition:
                  StringEquals:
                    iam:PermissionsBoundary: !Sub
                      'arn:aws:iam::\${AWS::AccountId}:policy/AppBoundary'

  # What the PIPELINE is allowed to do - deliberately almost nothing
  DeployerRole:
    Type: AWS::IAM::Role
    Properties:
      AssumeRolePolicyDocument:
        Version: '2012-10-17'
        Statement:
          - Effect: Allow
            Principal: { Federated: !Ref GitHubOidcProvider }
            Action: sts:AssumeRoleWithWebIdentity
      Policies:
        - PolicyName: deploy-only
          PolicyDocument:
            Version: '2012-10-17'
            Statement:
              - Effect: Allow
                Action:
                  - cloudformation:CreateChangeSet
                  - cloudformation:ExecuteChangeSet
                  - cloudformation:DescribeStacks
                  - cloudformation:DescribeChangeSet
                Resource: !Sub 'arn:aws:cloudformation:\${AWS::Region}:\${AWS::AccountId}:stack/app-*/*'
              - Effect: Allow
                Action: iam:PassRole
                Resource: !GetAtt StackServiceRole.Arn`,
      },
      {
        title: 'Deploying with it',
        language: 'bash',
        explanation:
          'Capabilities are acknowledgements. Granting them unconditionally defeats the point.',
        code: `aws cloudformation deploy \\
  --stack-name app-prod \\
  --template-file template.yaml \\
  --role-arn arn:aws:iam::111122223333:role/cfn-app-service-role \\
  --capabilities CAPABILITY_NAMED_IAM \\
  --no-execute-changeset          # produce the change set, do not run it

# A human or an approval gate reviews, then:
aws cloudformation execute-change-set --stack-name app-prod --change-set-name <id>`,
      },
    ],
    deeper: [
      'The service role is stored on the stack, so it governs future updates too. That makes `cloudformation:UpdateStack` on a stack as powerful as the role behind it - scope who can update production stacks accordingly.',
      'A permission boundary condition on `iam:CreateRole` is the control that stops privilege escalation through a template. Without it, a service role that can create IAM roles can create one with more privilege than itself.',
      '`CAPABILITY_AUTO_EXPAND` matters for SAM and macros, which generate resources at deploy time - so what you reviewed is not literally what is created. Treat it as a bigger acknowledgement than the IAM ones, not a smaller one.',
    ],
    traps: [
      'Deploying without a service role, which requires the human or pipeline to hold every permission the template needs.',
      'Passing `CAPABILITY_NAMED_IAM` unconditionally in CI, which turns a safety confirmation into a formality.',
      'Letting a service role create IAM roles with no permission boundary, which is a privilege-escalation path.',
    ],
    followUps: [
      'Whose permissions are used if you do not pass a service role?',
      'Why does NAMED_IAM exist separately from IAM?',
      'How does a permission boundary prevent escalation here?',
    ],
    tags: ['aws', 'cloudformation', 'iam', 'security'],
  },
  {
    id: 'itv-aws-83',
    level: 'advanced',
    kind: 'scenario',
    prompt:
      'Design the pipeline that deploys a CloudFormation change to production safely. What gates would you put in?',
    probing:
      'Ties the whole topic together. They want gates with reasons, not a list of pipeline stages.',
    answer: [
      'I would build it as a series of gates that each catch a different class of mistake, because no single check catches them all.',
      '**Static validation, on every commit.** `validate-template` catches syntax, and **cfn-lint** catches far more - invalid property names, wrong types, resources that do not exist in the target region. Then **cfn-nag** or **Checkov** for security posture: a wide-open security group, an unencrypted bucket, an over-broad IAM policy. These are fast and they run before a human looks at anything.',
      '**Deploy to a non-production account first**, from the same template with different parameters. Not a different template - if staging and production diverge, staging stops predicting anything. Run smoke tests against the result.',
      '**A change set against production, reviewed by a human.** This is the gate that matters most. The reviewer is looking for one thing above all: `Replacement: True` on anything stateful. I would have the pipeline print the change set in the approval request so the reviewer does not have to go and find it, and fail the build automatically if a replacement is proposed on a protected logical id.',
      '**Drift detection before executing.** A change set is computed against the template, not reality, so if production has drifted the diff is misleading. Detecting first means you are not applying a change on top of an unknown state.',
      '**Execute with a service role**, not with the pipeline’s own broad permissions, and with **rollback triggers** - CloudWatch alarms that CloudFormation monitors during and after the update, rolling back automatically if error rate or latency breaches while it watches. That turns "the deploy succeeded but the application is broken" into an automatic revert.',
      '**Then verify**, because `UPDATE_COMPLETE` means the resources exist, not that the service works. Post-deploy smoke tests against real endpoints, and a monitoring window before the pipeline declares success.',
      'Underneath all of it, the standing protections: stack policies denying replacement of stateful resources, `DeletionPolicy` and `UpdateReplacePolicy` set to `Retain` or `Snapshot` on data, and termination protection on production stacks.',
      'The one I would argue hardest for is the change-set review. Every serious CloudFormation incident I have seen was visible in the change set and nobody read it.',
    ],
    diagrams: [
      {
        kind: 'flow',
        title: 'Gates, and what each one catches',
        caption: 'Each gate catches a different class of mistake. None of them catches all.',
        nodes: [
          {
            label: 'Lint and security scan',
            detail: 'cfn-lint plus cfn-nag - typos, bad types, open security groups',
            tone: 'accent',
          },
          {
            label: 'Deploy to staging',
            detail: 'same template, different parameters - then smoke test',
            arrowLabel: 'catches: it does not work',
          },
          {
            label: 'Drift detection on production',
            detail: 'so the diff is computed against a known state',
            arrowLabel: 'catches: reality moved',
            tone: 'warning',
          },
          {
            label: 'Change set, reviewed by a human',
            detail: 'fail the build on Replacement True for protected resources',
            arrowLabel: 'catches: data loss',
            tone: 'danger',
          },
          {
            label: 'Execute with service role and rollback triggers',
            detail: 'alarms watched during and after - auto-revert on breach',
            arrowLabel: 'catches: broken deploy',
            tone: 'success',
          },
          {
            label: 'Post-deploy smoke tests',
            detail: 'UPDATE_COMPLETE is not the same as working',
            arrowLabel: 'catches: silent failure',
            tone: 'success',
          },
        ],
      },
    ],
    code: [
      {
        title: 'The pipeline, with the gate that matters',
        language: 'yaml',
        explanation:
          'The failing check is automated: a proposed replacement of a protected resource stops the build.',
        code: `name: deploy-infrastructure
on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pip install cfn-lint checkov
      - run: cfn-lint template.yaml --regions eu-west-1
      - run: checkov -f template.yaml --framework cloudformation

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    environment: production        # human approval gate lives here
    permissions:
      id-token: write              # OIDC - no long-lived AWS keys
    steps:
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::111122223333:role/deployer
          aws-region: eu-west-1

      # Know the current state before diffing against it
      - name: Detect drift
        run: |
          ID=$(aws cloudformation detect-stack-drift --stack-name app-prod \\
                --query StackDriftDetectionId --output text)
          sleep 30
          aws cloudformation describe-stack-drift-detection-status \\
            --stack-drift-detection-id "$ID"

      - name: Create change set
        run: |
          aws cloudformation deploy --stack-name app-prod \\
            --template-file template.yaml \\
            --role-arn arn:aws:iam::111122223333:role/cfn-app-service-role \\
            --capabilities CAPABILITY_NAMED_IAM \\
            --no-execute-changeset

      # THE gate: refuse to replace anything stateful
      - name: Block replacement of protected resources
        run: |
          CS=$(aws cloudformation list-change-sets --stack-name app-prod \\
                --query 'Summaries[0].ChangeSetName' --output text)
          aws cloudformation describe-change-set --stack-name app-prod \\
            --change-set-name "$CS" > cs.json
          cat cs.json | jq -r '.Changes[].ResourceChange
            | select(.Replacement=="True")
            | "\\(.LogicalResourceId) \\(.ResourceType)"' > replacements.txt
          if grep -Eq 'Database|Bucket|Table' replacements.txt; then
            echo "::error::Change set would REPLACE a stateful resource:"
            cat replacements.txt
            exit 1
          fi

      - name: Execute
        run: |
          CS=$(aws cloudformation list-change-sets --stack-name app-prod \\
                --query 'Summaries[0].ChangeSetName' --output text)
          aws cloudformation execute-change-set --stack-name app-prod \\
            --change-set-name "$CS"
          aws cloudformation wait stack-update-complete --stack-name app-prod

      - name: Smoke test
        run: ./scripts/smoke-test.sh https://app.example.com`,
      },
      {
        title: 'Rollback triggers: let the alarms decide',
        language: 'bash',
        explanation:
          'CloudFormation watches these alarms during and after the update, and reverts on breach.',
        code: `aws cloudformation update-stack \\
  --stack-name app-prod \\
  --template-body file://template.yaml \\
  --role-arn arn:aws:iam::111122223333:role/cfn-app-service-role \\
  --capabilities CAPABILITY_NAMED_IAM \\
  --rollback-configuration '{
    "RollbackTriggers": [
      {"Arn":"arn:aws:cloudwatch:eu-west-1:111122223333:alarm:app-5xx-rate",
       "Type":"AWS::CloudWatch::Alarm"},
      {"Arn":"arn:aws:cloudwatch:eu-west-1:111122223333:alarm:app-p99-latency",
       "Type":"AWS::CloudWatch::Alarm"}
    ],
    "MonitoringTimeInMinutes": 15
  }'

# Production stacks should also refuse to be deleted by accident
aws cloudformation update-termination-protection \\
  --stack-name app-prod --enable-termination-protection`,
      },
    ],
    deeper: [
      'Rollback triggers are underused and are the closest CloudFormation gets to a progressive deployment: the alarms are monitored for a window after the update completes, so a change that breaks the application reverts itself without anybody being paged.',
      'Keep staging and production on the same template with different **parameters**. The moment they are different templates, staging stops being evidence about production.',
      'Automating the "no replacement of stateful resources" check is worth more than asking a human to look, because the human is reviewing at 5pm on a Friday and the check never gets tired.',
    ],
    traps: [
      'Treating `UPDATE_COMPLETE` as success without a smoke test.',
      'Reviewing a change set by eye with no automated check on replacements.',
      'Running the pipeline with broad AWS permissions instead of a scoped service role.',
    ],
    followUps: [
      'What do rollback triggers actually watch, and for how long?',
      'Why compute a change set after drift detection rather than before?',
      'How would you stop a stateful resource ever being replaced?',
    ],
    tags: ['aws', 'cloudformation', 'cicd', 'iac'],
  },
]
