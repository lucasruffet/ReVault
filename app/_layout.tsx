import { Session } from '@supabase/supabase-js'
import * as Notifications from 'expo-notifications'
import { Stack, router } from 'expo-router'
import { useEffect, useState } from 'react'
import { AccountProvider } from '../context/AccountContext'
import { supabase } from '../supabase'

// Configure how notifications are shown while the app is in the foreground.
// Must be set at the app root level, before any screen renders.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
})

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        router.replace('/(tabs)')
      } else {
        router.replace('/')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return null

  return (
    <AccountProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="presupuesto" />
        <Stack.Screen name="graficos" />
      </Stack>
    </AccountProvider>
  )
}
