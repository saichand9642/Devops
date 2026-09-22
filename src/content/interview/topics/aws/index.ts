import type { InterviewTopic } from '../../../types'
import { awsCoreQuestions } from './core'
import { awsCoreServiceQuestions } from './core-services'
import { awsOperationsQuestions } from './operations'
import { awsPlatformQuestions } from './platform'
import { awsScenarioQuestions } from './scenarios'
import { awsBedrockQuestions } from './bedrock'
import { awsCloudFormationQuestions } from './cloudformation'

export const awsTopic: InterviewTopic = {
  id: 'aws',
  title: 'AWS',
  shortTitle: 'AWS',
  icon: '☁️',
  order: 5,
  oneLiner:
    'VPC design, IAM, compute choices, storage, high availability, Bedrock and GenAI, and the cost and security questions that follow.',
  headlines: [
    'A subnet is public if its route table has a route to an **internet gateway**. Nothing else makes it public.',
    'Security groups are **stateful** and allow-only; NACLs are **stateless** and have explicit deny.',
    'IAM: prefer **roles** over users, and attach policies to roles rather than to individual identities.',
    'An Availability Zone is a failure domain. Multi-AZ is the baseline for anything that matters.',
    'S3 is object storage with eleven nines of durability - not a filesystem.',
    'The shared responsibility model: AWS secures the cloud, you secure what you put in it.',
    'An explicit **Deny** anywhere wins. An SCP, a permission boundary or a KMS key policy can all remove an Allow.',
    'Bedrock is a managed **inference API**, billed per token. It hosts several providers\u2019 models - it is not a model AWS built.',
    'A knowledge gap is a **retrieval** problem (RAG). Fine-tuning teaches behaviour and form, not facts.',
    'In CloudFormation, read the change set\u2019s **Replacement** column first. `True` on a database means a new, empty one.',
    '`DeletionPolicy` fires on stack deletion, `UpdateReplacePolicy` on replacement. Set **both** on anything holding data.',
  ],
  questions: [
    ...awsCoreQuestions,
    ...awsCoreServiceQuestions,
    ...awsOperationsQuestions,
    ...awsPlatformQuestions,
    ...awsScenarioQuestions,
    ...awsBedrockQuestions,
    ...awsCloudFormationQuestions,
  ],
}
