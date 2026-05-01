import { router } from 'expo-router'
import { useEffect, useState } from 'react'
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Purchases, { PurchasesPackage } from 'react-native-purchases'
import { useAccount } from '../context/AccountContext'
import { supabase } from '../supabase'

const FEATURES = [
  { icon: '♾️', text: 'Transacciones ilimitadas' },
  { icon: '📅', text: 'Historial completo sin límite' },
  { icon: '📊', text: 'Gráficos avanzados' },
  { icon: '🏦', text: 'Múltiples cuentas' },
  { icon: '📤', text: 'Exportar a Excel/PDF' },
  { icon: '🔔', text: 'Notificaciones de presupuesto' },
]

export default function Paywall() {
  const { refreshPlan } = useAccount()
  const [pkg, setPkg] = useState<PurchasesPackage | null>(null)
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState(false)
  const [restoring, setRestoring] = useState(false)

  useEffect(() => {
    loadOfferings()
  }, [])

  async function loadOfferings() {
    try {
      const offerings = await Purchases.getOfferings()
      const current = offerings.current
      if (current && current.availablePackages.length > 0) {
        setPkg(current.availablePackages[0])
      }
    } catch (e: any) {
      Alert.alert('Error', 'No se pudieron cargar los planes.')
    } finally {
      setLoading(false)
    }
  }

  async function upgradePlanInSupabase() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ plan: 'pro' }).eq('id', user.id)
  }

  async function handlePurchase() {
    if (!pkg) return
    setPurchasing(true)
    try {
      const { customerInfo } = await Purchases.purchasePackage(pkg)
      if (customerInfo.entitlements.active['pro']) {
        await upgradePlanInSupabase()
        await refreshPlan()
        Alert.alert('¡Bienvenido a Pro!', 'Tu plan fue actualizado correctamente.', [
          { text: 'Genial', onPress: () => router.back() },
        ])
      }
    } catch (e: any) {
      if (!e.userCancelled) {
        Alert.alert('Error', e.message || 'No se pudo completar la compra.')
      }
    } finally {
      setPurchasing(false)
    }
  }

  async function handleRestore() {
    setRestoring(true)
    try {
      const customerInfo = await Purchases.restorePurchases()
      if (customerInfo.entitlements.active['pro']) {
        await upgradePlanInSupabase()
        await refreshPlan()
        Alert.alert('Compra restaurada', 'Tu plan Pro fue restaurado.', [
          { text: 'OK', onPress: () => router.back() },
        ])
      } else {
        Alert.alert('Sin compras', 'No se encontraron compras anteriores de Pro.')
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'No se pudo restaurar la compra.')
    } finally {
      setRestoring(false)
    }
  }

  const price = pkg?.product.priceString ?? '...'

  return (
    <View style={s.container}>
      <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
        <Text style={s.closeBtnText}>✕</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.badge}>
          <Text style={s.badgeText}>PRO</Text>
        </View>
        <Text style={s.title}>ReVault Pro</Text>
        <Text style={s.subtitle}>Todo el poder de tus finanzas, sin límites.</Text>

        <View style={s.featureList}>
          {FEATURES.map((f, i) => (
            <View key={i} style={s.featureRow}>
              <Text style={s.featureIcon}>{f.icon}</Text>
              <Text style={s.featureText}>{f.text}</Text>
            </View>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator color="#c8f135" style={{ marginTop: 32 }} />
        ) : (
          <>
            <TouchableOpacity
              style={[s.buyBtn, (purchasing || !pkg) && s.buyBtnDisabled]}
              onPress={handlePurchase}
              disabled={purchasing || !pkg}
            >
              {purchasing
                ? <ActivityIndicator color="#0d0d0f" />
                : <Text style={s.buyBtnText}>{pkg ? `Obtener Pro · ${price}` : 'No disponible'}</Text>
              }
            </TouchableOpacity>

            <TouchableOpacity style={s.restoreBtn} onPress={handleRestore} disabled={restoring}>
              <Text style={s.restoreBtnText}>{restoring ? 'Restaurando...' : 'Restaurar compra'}</Text>
            </TouchableOpacity>
          </>
        )}

        <Text style={s.legal}>
          La suscripción se renueva automáticamente. Podés cancelar en cualquier momento desde la Play Store.
        </Text>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0f' },
  closeBtn: {
    position: 'absolute', top: 56, right: 20, zIndex: 10,
    backgroundColor: '#1a1a1e', borderRadius: 20,
    width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
  },
  closeBtnText: { color: '#888', fontSize: 16 },
  scroll: { alignItems: 'center', paddingTop: 80, paddingBottom: 48, paddingHorizontal: 24 },
  badge: {
    backgroundColor: '#c8f135', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: 16,
  },
  badgeText: { color: '#0d0d0f', fontWeight: '800', fontSize: 12, letterSpacing: 2 },
  title: { color: '#f0f0f0', fontSize: 32, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#888', fontSize: 15, textAlign: 'center', marginBottom: 32 },
  featureList: {
    width: '100%', backgroundColor: '#1a1a1e',
    borderRadius: 16, padding: 20, gap: 14, marginBottom: 32,
  },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { fontSize: 20, width: 28, textAlign: 'center' },
  featureText: { color: '#f0f0f0', fontSize: 15, fontWeight: '500', flex: 1 },
  buyBtn: {
    backgroundColor: '#c8f135', borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 32,
    alignItems: 'center', width: '100%', marginBottom: 12,
  },
  buyBtnDisabled: { opacity: 0.6 },
  buyBtnText: { color: '#0d0d0f', fontWeight: '800', fontSize: 17 },
  restoreBtn: { paddingVertical: 12 },
  restoreBtnText: { color: '#555', fontSize: 14, textAlign: 'center' },
  legal: { color: '#333', fontSize: 11, textAlign: 'center', marginTop: 24, lineHeight: 16 },
})
