import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/shared/lib/supabase'
import type { Profile } from '@/shared/types/database'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  isSuperuser: boolean
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, displayName: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<Profile | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const claimInvites = useCallback(async () => {
    const { error } = await supabase.rpc('claim_my_organisation_invites')
    if (error && !/claim_my_organisation_invites/i.test(error.message)) {
      console.warn('claim_my_organisation_invites', error.message)
    }
  }, [])

  const loadProfile = useCallback(async (userId: string) => {
    await claimInvites()
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
    return data
  }, [claimInvites])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      else setProfile(null)
      if (mounted) setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      if (next?.user) void loadProfile(next.user.id)
      else setProfile(null)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error) await claimInvites()
    return { error: error?.message ?? null }
  }, [claimInvites])

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    })
    if (error) return { error: error.message }

    // When "Confirm email" is disabled, signUp returns a session and the user is signed in.
    // When it is still enabled, there is no session until they click the email link.
    if (!data.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        return {
          error:
            'Account created, but email confirmation is still required. Disable “Confirm email” in Supabase Auth → Providers → Email, then try signing in.',
        }
      }
    }

    await claimInvites()
    return { error: null }
  }, [claimInvites])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const refreshProfile = useCallback(async () => {
    if (!session?.user?.id) return null
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle()
    setProfile(data)
    return data
  }, [session?.user?.id])

  const isSuperuser = !!profile?.is_superuser

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      isSuperuser,
      loading,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, isSuperuser, loading, signIn, signUp, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
