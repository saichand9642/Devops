import { stateFundamentals } from './state-fundamentals'
import { localBackend } from './local-backend'
import { remoteBackends } from './remote-backends'
import { stateLocking } from './state-locking'
import { driftAndStateCommands } from './drift-and-state-commands'

export const stateTopics = [
  stateFundamentals,
  localBackend,
  remoteBackends,
  stateLocking,
  driftAndStateCommands,
]
