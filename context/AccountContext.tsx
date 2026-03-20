import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../supabase'

export type Account = {
  id: string
  name: string
  color: string
  icon: string
}

type AccountContextType = {
  accounts: Account[]
  currentAccount: Account | null
  setCurrentAccount: (a: Account) => void
  refreshAccounts: () => Promise<void>
  plan: 'free' | 'pro'
  refreshPlan: () => Promise<void>
}

const AccountContext = createContext<AccountContextType>({
  accounts: [],
  currentAccount: null,
  setCurrentAccount: () => {},
  refreshAccounts: async () => {},
  plan: 'free',
  refreshPlan: async () => {},
})

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [currentAccount, setCurrentAccountState] = useState<Account | null>(null)
  const [plan, setPlan] = useState<'free' | 'pro'>('free')

  // Use a ref to track currentAccount inside callbacks without adding it as a dependency.
  // This prevents refreshAccounts from being recreated on every account switch,
  // which would cause cascading re-renders across all screens.
  const currentAccountRef = useRef<Account | null>(null)

  const setCurrentAccount = useCallback((a: Account) => {
    currentAccountRef.current = a
    setCurrentAccountState(a)
  }, [])

  // No dependency on currentAccount — uses ref instead to avoid re-render loops
  const refreshAccounts = useCallback(async () => {
    const { data } = await supabase.from('accounts').select('*').order('created_at', { ascending: true })
    if (!data) return
    setAccounts(data)
    const current = currentAccountRef.current
    if (data.length === 0) {
      currentAccountRef.current = null
      setCurrentAccountState(null)
    } else if (!current) {
      currentAccountRef.current = data[0]
      setCurrentAccountState(data[0])
    } else {
      const stillExists = data.find((a: Account) => a.id === current.id)
      if (!stillExists) {
        currentAccountRef.current = data[0]
        setCurrentAccountState(data[0])
      }
    }
  }, [])

  const refreshPlan = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('plan').eq('id', user.id).single()
    if (data) setPlan(data.plan as 'free' | 'pro')
  }, [])

  useEffect(() => {
    refreshAccounts()
    refreshPlan()
  }, [])

  return (
    <AccountContext.Provider value={{ accounts, currentAccount, setCurrentAccount, refreshAccounts, plan, refreshPlan }}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  return useContext(AccountContext)
}
