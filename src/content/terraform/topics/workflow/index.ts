import { workflowOverview } from './workflow-overview'
import { init } from './init'
import { validateAndFmt } from './validate-and-fmt'
import { plan } from './plan'
import { applyAndDestroy } from './apply-and-destroy'

export const workflowTopics = [workflowOverview, init, validateAndFmt, plan, applyAndDestroy]
