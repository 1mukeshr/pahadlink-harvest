import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

const AdminChromeContext = createContext(null)

export function AdminChromeProvider({ children }) {
  const [headerSearch, setHeaderSearchState] = useState(null)

  const setHeaderSearch = useCallback((next) => {
    setHeaderSearchState((prev) => {
      // Avoid useless updates that re-render the whole admin shell.
      if (prev === next) return prev
      if (
        prev &&
        next &&
        prev.value === next.value &&
        prev.placeholder === next.placeholder &&
        prev.ariaLabel === next.ariaLabel &&
        prev.enabled === next.enabled
      ) {
        return prev
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({ headerSearch, setHeaderSearch }),
    [headerSearch, setHeaderSearch]
  )

  return (
    <AdminChromeContext.Provider value={value}>
      {children}
    </AdminChromeContext.Provider>
  )
}

export function useAdminChrome() {
  const ctx = useContext(AdminChromeContext)
  if (!ctx) {
    throw new Error('useAdminChrome must be used within AdminChromeProvider')
  }
  return ctx
}

/**
 * Registers page search into the main admin topbar.
 * Pass `enabled: false` to hide (e.g. dashboard view).
 */
export function useAdminHeaderSearch({
  enabled = true,
  placeholder = 'Search…',
  value = '',
  onChange,
  onClear,
  onSubmit,
  'aria-label': ariaLabel = 'Search',
} = {}) {
  const { setHeaderSearch } = useAdminChrome()
  const onChangeRef = useRef(onChange)
  const onClearRef = useRef(onClear)
  const onSubmitRef = useRef(onSubmit)

  onChangeRef.current = onChange
  onClearRef.current = onClear
  onSubmitRef.current = onSubmit

  useEffect(() => {
    if (!enabled) {
      setHeaderSearch(null)
      return () => setHeaderSearch(null)
    }

    setHeaderSearch({
      placeholder,
      value,
      ariaLabel,
      onChange: (event) => onChangeRef.current?.(event),
      onClear: () => onClearRef.current?.(),
      onSubmit: (event) => onSubmitRef.current?.(event),
    })

    return () => setHeaderSearch(null)
  }, [enabled, placeholder, value, ariaLabel, setHeaderSearch])
}
