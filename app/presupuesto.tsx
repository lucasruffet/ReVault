import * as Notifications from 'expo-notifications'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useAccount } from '../context/AccountContext'
import { supabase } from '../supabase'

// Categories that can have budgets (expense categories only)
const EXPENSE_CATS = [
  '🏋️ Deporte','🎮 Ocio','💊 Medicina','🚗 Transporte',
  '✈️ Viaje','🍔 Comida','🛍️ Ropa','🏠 Hogar','📱 Tech','💸 Otros'
]

async function requestAndSendNotification(category: string, pct: number, spent: number, limit: number) {
  try {
    const { status } = await Notifications.requestPermissionsAsync()
    if (status !== 'granted') return
    const over = pct >= 1
    await Notifications.scheduleNotificationAsync({
      content: {
        title: over ? `🚨 Presupuesto superado: ${category}` : `⚠️ Alerta: ${category}`,
        body: over
          ? `Gastaste $${spent.toLocaleString('es-AR',{maximumFractionDigits:0})} de tu límite $${limit.toLocaleString('es-AR',{maximumFractionDigits:0})}`
          : `Llevás el ${Math.round(pct*100)}% ($${spent.toLocaleString('es-AR',{maximumFractionDigits:0})} / $${limit.toLocaleString('es-AR',{maximumFractionDigits:0})})`,
      },
      trigger: null,
    })
  } catch (_) {}
}


export default function Presupuesto() {
  const { currentAccount, plan } = useAccount()
  const [budgets, setBudgets] = useState<any[]>([])
  const [spentByCat, setSpentByCat] = useState<Record<string, number>>({})
  const [showModal, setShowModal] = useState(false)
  const [editingBudget, setEditingBudget] = useState<any>(null)
  const [selCategory, setSelCategory] = useState(EXPENSE_CATS[0])
  const [limitAmount, setLimitAmount] = useState('')
  const [saving, setSaving] = useState(false)

  useFocusEffect(useCallback(() => { fetchData() }, [currentAccount]))
  useEffect(() => { fetchData() }, [currentAccount])

  async function fetchData() {
    if (!currentAccount) return
    // Fetch budgets for this account
    const { data: bData } = await supabase.from('budgets')
      .select('*').eq('account_id', currentAccount.id).order('created_at', { ascending: true })
    setBudgets(bData || [])

    // Fetch current month spending per category
    const now = new Date()
    const start = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`
    const end = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-31`
    const { data: txData } = await supabase.from('transactions').select('*')
      .eq('account_id', currentAccount.id)
      .eq('type', 'expense')
      .gte('date', start).lte('date', end)

    const spent: Record<string, number> = {}
    ;(txData || []).forEach((t: any) => {
      spent[t.category] = (spent[t.category] || 0) + t.amount
    })
    setSpentByCat(spent)

    // Fire notifications for any category at/above 80%
    if (bData && bData.length > 0) {
      for (const b of bData) {
        const s = spent[b.category] || 0
        const pct = s / b.amount
        if (pct >= 0.8) {
          requestAndSendNotification(b.category, pct, s, b.amount)
        }
      }
    }
  }

  function openCreate() {
    setEditingBudget(null)
    setSelCategory(EXPENSE_CATS[0])
    setLimitAmount('')
    setShowModal(true)
  }

  function openEdit(b: any) {
    setEditingBudget(b)
    setSelCategory(b.category)
    setLimitAmount(String(b.amount))
    setShowModal(true)
  }

  async function saveBudget() {
    if (!limitAmount || parseFloat(limitAmount) <= 0) {
      Alert.alert('Error', 'Ingresá un monto válido mayor a 0')
      return
    }
    if (!currentAccount) return
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      if (editingBudget) {
        const { error } = await supabase.from('budgets')
          .update({ category: selCategory, amount: parseFloat(limitAmount) })
          .eq('id', editingBudget.id)
        if (error) { Alert.alert('Error', 'No se pudo guardar el presupuesto'); return }
      } else {
        // Upsert: if same category already exists, update it
        const { error } = await supabase.from('budgets').upsert({
          user_id: user.id,
          account_id: currentAccount.id,
          category: selCategory,
          amount: parseFloat(limitAmount),
        }, { onConflict: 'user_id,account_id,category' })
        if (error) { Alert.alert('Error', 'No se pudo guardar el presupuesto'); return }
      }
      await fetchData()
      setShowModal(false)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo guardar')
    } finally {
      setSaving(false)
    }
  }

  async function deleteBudget(id: string) {
    Alert.alert('Eliminar presupuesto', '¿Eliminar este límite?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('budgets').delete().eq('id', id)
        fetchData()
      }}
    ])
  }

  const fmt = (n: number) => '$' + n.toLocaleString('es-AR', {maximumFractionDigits:0})

  if (plan !== 'pro') {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Presupuestos</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={s.proGate}>
          <Text style={s.proGateEmoji}>🎯</Text>
          <Text style={s.proGateTitle}>Función Pro</Text>
          <Text style={s.proGateText}>Los presupuestos con notificaciones son exclusivos del plan Pro.</Text>
          <TouchableOpacity style={s.proGateBtn} onPress={() => Alert.alert('Próximamente', 'El upgrade a Pro estará disponible pronto.')}>
            <Text style={s.proGateBtnText}>Mejorar a Pro</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  if (!currentAccount) {
    return (
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
            <Text style={s.backBtnText}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>Presupuestos</Text>
          <View style={{ width: 70 }} />
        </View>
        <View style={s.proGate}>
          <Text style={s.proGateText}>Seleccioná una cuenta primero</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backBtnText}>‹ Volver</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>Presupuestos</Text>
        <TouchableOpacity style={s.addHeaderBtn} onPress={openCreate}>
          <Text style={s.addHeaderBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      <View style={s.infoCard}>
        <Text style={s.infoText}>📱 Recibirás una notificación cuando alcances el 80% o superes cualquier límite en el mes actual.</Text>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        {budgets.length === 0 ? (
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>Sin presupuestos</Text>
            <Text style={s.emptyText}>Agregá límites por categoría para recibir alertas cuando te estés pasando.</Text>
            <TouchableOpacity style={s.emptyBtn} onPress={openCreate}>
              <Text style={s.emptyBtnText}>+ Crear primer presupuesto</Text>
            </TouchableOpacity>
          </View>
        ) : (
          budgets.map(b => {
            const spent = spentByCat[b.category] || 0
            const pct = Math.min(spent / b.amount, 1)
            const isOver = spent > b.amount
            const isWarning = !isOver && pct >= 0.8
            const barColor = isOver ? '#ff4d6a' : isWarning ? '#f5a623' : '#3bf5a0'
            return (
              <View key={b.id} style={[s.budgetCard, isOver && s.budgetCardOver, isWarning && s.budgetCardWarn]}>
                <View style={s.budgetTop}>
                  <View style={s.budgetLeft}>
                    <Text style={s.budgetCat}>{b.category}</Text>
                    <Text style={[s.budgetStatus, isOver && {color:'#ff4d6a'}, isWarning && {color:'#f5a623'}]}>
                      {isOver ? '🚨 Superado' : isWarning ? '⚠️ Cerca del límite' : '✓ En control'}
                    </Text>
                  </View>
                  <View style={s.budgetActions}>
                    <TouchableOpacity style={s.iconBtn} onPress={() => openEdit(b)}>
                      <Text>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.iconBtn} onPress={() => deleteBudget(b.id)}>
                      <Text style={{color:'#555', fontSize:20}}>×</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={s.budgetBarWrap}>
                  <View style={[s.budgetBar, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
                </View>
                <View style={s.budgetBottom}>
                  <Text style={[s.budgetSpent, isOver && {color:'#ff4d6a'}]}>{fmt(spent)} gastado</Text>
                  <Text style={s.budgetLimit}>límite: {fmt(b.amount)}</Text>
                </View>
              </View>
            )
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Add / Edit modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBg} onPress={() => setShowModal(false)} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>{editingBudget ? 'Editar presupuesto' : 'Nuevo presupuesto'}</Text>
            <Text style={s.modalLabel}>CATEGORÍA</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
              <View style={s.catPills}>
                {EXPENSE_CATS.map(c => (
                  <TouchableOpacity
                    key={c}
                    style={[s.catPill, selCategory === c && s.catPillSelected]}
                    onPress={() => setSelCategory(c)}
                  >
                    <Text style={[s.catPillText, selCategory === c && {color:'#c8f135'}]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <Text style={s.modalLabel}>LÍMITE MENSUAL</Text>
            <TextInput
              style={s.input}
              placeholder="Ej: 50000"
              placeholderTextColor="#555"
              value={limitAmount}
              onChangeText={setLimitAmount}
              keyboardType="decimal-pad"
            />
            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowModal(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.btnSave} onPress={saveBudget} disabled={saving}>
                <Text style={s.btnSaveText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0d0d0f' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, paddingTop:60 },
  headerTitle: { color:'#f0f0f0', fontSize:20, fontWeight:'800' },
  backBtn: { paddingVertical:4 },
  backBtnText: { color:'#c8f135', fontSize:16, fontWeight:'700' },
  addHeaderBtn: { backgroundColor:'#c8f135', borderRadius:8, paddingHorizontal:12, paddingVertical:6 },
  addHeaderBtnText: { color:'#0d0d0f', fontWeight:'700', fontSize:13 },
  infoCard: { marginHorizontal:16, marginBottom:12, backgroundColor:'#0d1a2a', borderWidth:1, borderColor:'#1a3a5a', borderRadius:12, padding:12 },
  infoText: { color:'#5b9cf6', fontSize:12, lineHeight:18 },
  scroll: { flex:1, paddingHorizontal:16 },
  emptyWrap: { alignItems:'center', paddingTop:60, paddingHorizontal:32 },
  emptyTitle: { color:'#f0f0f0', fontSize:18, fontWeight:'800', marginBottom:8 },
  emptyText: { color:'#555', fontSize:13, textAlign:'center', lineHeight:20, marginBottom:24 },
  emptyBtn: { backgroundColor:'#c8f135', borderRadius:12, paddingHorizontal:20, paddingVertical:12 },
  emptyBtnText: { color:'#0d0d0f', fontWeight:'800', fontSize:14 },
  budgetCard: { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:16, padding:16, marginBottom:12 },
  budgetCardOver: { borderColor:'#ff4d6a', backgroundColor:'#1a0808' },
  budgetCardWarn: { borderColor:'#f5a623', backgroundColor:'#1a1408' },
  budgetTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
  budgetLeft: { flex:1 },
  budgetCat: { color:'#f0f0f0', fontSize:15, fontWeight:'700', marginBottom:2 },
  budgetStatus: { color:'#3bf5a0', fontSize:11, fontWeight:'600' },
  budgetActions: { flexDirection:'row', gap:2 },
  iconBtn: { padding:6 },
  budgetBarWrap: { backgroundColor:'rgba(255,255,255,0.06)', borderRadius:99, height:6, marginBottom:8, overflow:'hidden' },
  budgetBar: { height:'100%', borderRadius:99 },
  budgetBottom: { flexDirection:'row', justifyContent:'space-between' },
  budgetSpent: { color:'#f0f0f0', fontSize:13, fontWeight:'700' },
  budgetLimit: { color:'#555', fontSize:12 },
  proGate: { flex:1, alignItems:'center', justifyContent:'center', paddingHorizontal:40 },
  proGateEmoji: { fontSize:48, marginBottom:16 },
  proGateTitle: { color:'#f0f0f0', fontSize:22, fontWeight:'800', marginBottom:8 },
  proGateText: { color:'#555', fontSize:14, textAlign:'center', lineHeight:22, marginBottom:24 },
  proGateBtn: { backgroundColor:'#c8f135', borderRadius:12, paddingHorizontal:24, paddingVertical:12 },
  proGateBtnText: { color:'#0d0d0f', fontWeight:'800', fontSize:15 },
  modalOverlay: { flex:1, justifyContent:'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.8)' },
  modal: { backgroundColor:'#141416', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:44 },
  modalTitle: { color:'#f0f0f0', fontSize:20, fontWeight:'800', marginBottom:16 },
  modalLabel: { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:8 },
  catScroll: { marginBottom:14 },
  catPills: { flexDirection:'row', gap:6 },
  catPill: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:20, paddingHorizontal:12, paddingVertical:7 },
  catPillSelected: { borderColor:'#c8f135' },
  catPillText: { color:'#f0f0f0', fontSize:12 },
  input: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:10, padding:14, color:'#f0f0f0', fontSize:18, marginBottom:16 },
  modalActions: { flexDirection:'row', gap:10 },
  btnCancel: { flex:1, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:14, alignItems:'center' },
  btnCancelText: { color:'#f0f0f0', fontWeight:'700' },
  btnSave: { flex:2, backgroundColor:'#c8f135', borderRadius:12, padding:14, alignItems:'center' },
  btnSaveText: { color:'#0d0d0f', fontWeight:'800', fontSize:15 },
})
