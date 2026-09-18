import { useCallback, useState } from 'react'
import { pingHealth } from '../services/repositoryApi'
import { friendlyError, type AppStatus } from '../utils/status'

export function useApiHealth() {
  const [health, setHealth] = useState('…')

  const checkHealth = useCallback(async (): Promise<AppStatus> => {
    try {
      setHealth(await pingHealth())
      return {
        tone: 'success',
        title: 'Core is reachable',
        detail: 'Spring Boot answered on the API health endpoint.',
      }
    } catch {
      setHealth('core unreachable — start Spring Boot on :8090')
      return friendlyError(new Error('Failed to fetch'))
    }
  }, [])

  return { health, checkHealth }
}
