import type { Topic } from '../../types'
import { whatIsAContainer, imagesAndLayers, registriesAndTags } from './foundations'
import { dockerfileBasics, buildCache, multiStageBuilds } from './build'
import { containerLifecycle, configAndResources } from './run'
import { volumesAndMounts, networkingAndPorts } from './data'
import { composeBasics, composeProduction } from './compose'
import { imageSecurity, loggingAndDebugging, ciAndPublishing } from './operations'

/** Every lesson in the Docker course, in teaching order. */
export const dockerTopics: Topic[] = [
  whatIsAContainer,
  imagesAndLayers,
  registriesAndTags,
  dockerfileBasics,
  buildCache,
  multiStageBuilds,
  containerLifecycle,
  configAndResources,
  volumesAndMounts,
  networkingAndPorts,
  composeBasics,
  composeProduction,
  imageSecurity,
  loggingAndDebugging,
  ciAndPublishing,
]
