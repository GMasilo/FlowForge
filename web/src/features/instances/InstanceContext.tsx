import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate, Outlet, useParams } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthProvider'
import { supabase } from '@/shared/lib/supabase'
import { applyInstanceBranding, clearInstanceBranding } from '@/shared/lib/instanceBranding'
import { useTheme } from '@/shared/theme/ThemeProvider'
import type { Instance, InstanceRole } from '@/shared/types/database'

interface InstanceContextValue {
  instance: Instance
  role: InstanceRole
}

const InstanceContext = createContext<InstanceContextValue | null>(null)

export function InstanceProvider({ children }: { children?: ReactNode }) {
  const { instanceId } = useParams()
  const { user, isSuperuser } = useAuth()

  const { resolved } = useTheme()

  const query = useQuery({
    queryKey: ['instance', instanceId, user?.id, isSuperuser],
    enabled: !!instanceId && !!user?.id,
    queryFn: async () => {
      const { data: instance, error } = await supabase
        .from('instances')
        .select('*')
        .eq('id', instanceId!)
        .single()
      if (error) throw error

      const { data: membership } = await supabase
        .from('instance_members')
        .select('role')
        .eq('instance_id', instanceId!)
        .eq('user_id', user!.id)
        .maybeSingle()

      if (membership?.role) {
        return { instance, role: membership.role as InstanceRole }
      }

      if (isSuperuser) {
        return { instance, role: 'owner' as InstanceRole }
      }

      throw new Error('Not a member of this organisation')
    },
  })

  const instance = query.data?.instance

  useEffect(() => {
    if (!instance) {
      clearInstanceBranding()
      return
    }
    applyInstanceBranding(instance)
    return () => clearInstanceBranding()
  }, [instance, resolved])

  if (query.isLoading) {
    return <div className="text-sm text-[var(--color-ink-muted)]">Loading organisation…</div>
  }

  if (query.isError || !query.data) {
    return <Navigate to="/" replace />
  }

  return (
    <InstanceContext.Provider value={query.data}>
      {children ?? <Outlet />}
    </InstanceContext.Provider>
  )
}

export function useInstanceContext() {
  return useContext(InstanceContext)
}

export function useRequiredInstance() {
  const ctx = useContext(InstanceContext)
  if (!ctx) throw new Error('useRequiredInstance must be used within InstanceProvider')
  return ctx
}
