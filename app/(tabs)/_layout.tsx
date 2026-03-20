import { Tabs } from 'expo-router'

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarStyle: { backgroundColor: '#0d0d0f', borderTopColor: '#2a2a30' },
      tabBarActiveTintColor: '#c8f135',
      tabBarInactiveTintColor: '#555',
    }}>
      <Tabs.Screen name="index" options={{ title: 'Resumen' }} />
      <Tabs.Screen name="movimiento" options={{ title: 'Movimientos' }} />
      <Tabs.Screen name="ahorro" options={{ title: 'Ahorro' }} />
      <Tabs.Screen name="calendario" options={{ title: 'Calendario' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
      <Tabs.Screen name="explore" options={{ href: null }} />
      <Tabs.Screen name="Movimiento" options={{ href: null }} />
    </Tabs>
  )
}
