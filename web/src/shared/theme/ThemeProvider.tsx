import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  applyResolvedTheme,
  nextThemePreference,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/shared/lib/theme'

interface ThemeContextValue {
  theme: ThemePreference
  resolved: ResolvedTheme
  setTheme: (theme: ThemePreference) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemePreference>(() =>
    typeof window === 'undefined' ? 'system' : readStoredTheme(),
  )
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    typeof window === 'undefined' ? 'light' : resolveTheme(readStoredTheme()),
  )

  useEffect(() => {
    const sync = () => {
      const next = resolveTheme(theme)
      setResolved(next)
      applyResolvedTheme(next)
    }
    sync()

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [theme])

  const setTheme = useCallback((next: ThemePreference) => {
    writeStoredTheme(next)
    setThemeState(next)
  }, [])

  const cycleTheme = useCallback(() => {
    setTheme(nextThemePreference(theme))
  }, [setTheme, theme])

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme, cycleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
