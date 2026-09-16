import { useContext } from 'react'
import { AccessContext, type AccessApi } from './access-context'

export function useAccess(): AccessApi {
  const context = useContext(AccessContext)
  if (!context) {
    throw new Error('useAccess must be used inside an <AccessProvider>')
  }
  return context
}
