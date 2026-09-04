import { resourcesAndDataSources } from './resources-and-data-sources'
import { referencesAndDependencies } from './references-and-dependencies'
import { inputVariables } from './input-variables'
import { outputs } from './outputs'
import { localsAndComplexTypes } from './locals-and-complex-types'
import { expressionsAndFunctions } from './expressions-and-functions'
import { countAndForEach } from './count-and-for-each'
import { dynamicBlocksAndLifecycle } from './dynamic-blocks-and-lifecycle'
import { customConditions } from './custom-conditions'
import { sensitiveDataAndVault } from './sensitive-data-and-vault'

export const configurationTopics = [
  resourcesAndDataSources,
  referencesAndDependencies,
  inputVariables,
  outputs,
  localsAndComplexTypes,
  expressionsAndFunctions,
  countAndForEach,
  dynamicBlocksAndLifecycle,
  customConditions,
  sensitiveDataAndVault,
]
