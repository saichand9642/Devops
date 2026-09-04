import { useContext } from 'react'
import { ProgressContext, type ProgressApi } from './progress-context'

export function useProgress(): ProgressApi {
  const context = useContext(ProgressContext)
  if (!context) {
    throw new Error('useProgress must be used inside a <ProgressProvider>')
  }
  return context
}
