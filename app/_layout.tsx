import * as Linking from 'expo-linking'
import * as Notifications from 'expo-notifications'
import { Stack, router } from 'expo-router'
import { useEffect } from 'react'
import Purchases from 'react-native-purchases'
import { AccountProvider } from '../context/AccountContext'
import { supabase } from '../supabase'

const RC_GOOGLE_KEY = process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_KEY ?? ''

// Configure how notifications are shown while the app is in the foreground.
// Must be set at the app root level, before any screen renders.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const SUPABASE_HOST = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace('https://', '') ?? ''

async function handleDeepLink(url: string) {
  const parsed = Linking.parse(url)
  const { queryParams } = parsed
  // Only exchange codes that originate from our Supabase project
  const host = parsed.hostname ?? ''
  if (queryParams?.code && (host === SUPABASE_HOST || host === '' /* app-scheme deep links */)) {
    await supabase.auth.exchangeCodeForSession(queryParams.code as string)
  }
}

export default function RootLayout() {
  useEffect(() => {
    Purchases.configure({ apiKey: RC_GOOGLE_KEY })

    // Handle deep link when app is opened from the confirmation email
    Linking.getInitialURL().then(url => { if (url) handleDeepLink(url) })
    const linkSub = Linking.addEventListener('url', ({ url }) => handleDeepLink(url))

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') {
        if (session) {
          Purchases.logIn(session.user.id)
          router.replace('/(tabs)')
        } else {
          router.replace('/')
        }
      } else if (event === 'SIGNED_IN') {
        if (session) Purchases.logIn(session.user.id)
        router.replace('/(tabs)')
      }
    })
    return () => { subscription.unsubscribe(); linkSub.remove() }
  }, [])

  return (
    <AccountProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="presupuesto" />
        <Stack.Screen name="graficos" />
        <Stack.Screen name="paywall" />
      </Stack>
    </AccountProvider>
  )
}
