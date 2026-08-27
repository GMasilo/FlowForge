import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useRequiredInstance } from '@/features/instances/InstanceContext'
import { isAgentRole } from '@/shared/types/database'

/**
 * Agents only see inbox + conversations. Everything else redirects to inbox.
 */
export function AgentScopeGuard() {
  const { role } = useRequiredInstance()
  const { instanceId } = useParams()
  const location = useLocation()

  if (!isAgentRole(role) || !instanceId) {
    return <Outlet />
  }

  const base = `/instances/${instanceId}`
  const path = location.pathname
  const allowed =
    path === `${base}/inbox` ||
    path === `${base}/conversations` ||
    path.startsWith(`${base}/conversations/`)

  if (path === base || path === `${base}/`) {
    return <Navigate to={`${base}/inbox`} replace />
  }

  if (!allowed) {
    return <Navigate to={`${base}/inbox`} replace />
  }

  return <Outlet />
}
