import type { Question } from '../../types'
import { dockerFoundationsQuestions } from './foundations'
import { dockerBuildQuestions } from './build'
import { dockerRunQuestions } from './run'
import { dockerDataQuestions } from './data'
import { dockerComposeQuestions } from './compose'
import { dockerOperationsQuestions } from './operations'

export const dockerQuestions: Question[] = [
  ...dockerFoundationsQuestions,
  ...dockerBuildQuestions,
  ...dockerRunQuestions,
  ...dockerDataQuestions,
  ...dockerComposeQuestions,
  ...dockerOperationsQuestions,
]
