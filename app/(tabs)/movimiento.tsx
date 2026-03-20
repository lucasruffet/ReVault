import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { supabase } from '../../supabase'

const CATS = {
  income: ['💼 Sueldo','💻 Freelance','📈 Inversiones','🎁 Otros'],
  expense: ['🏋️ Deporte','🎮 Ocio','💊 Medicina','🚗 Transporte','✈️ Viaje','🍔 Comida','🛍️ Ropa','🏠 Hogar','📱 Tech','💸 Otros']
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Movimientos() {
  const [transactions, setTransactions] = useState<any[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'income'|'expense'>('income')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [loading, setLoading] = useState(false)
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  useFocusEffect(useCallback(() => { fetchTransactions() }, [currentMonth, currentYear]))
  useEffect(() => { fetchTransactions() }, [currentMonth, currentYear])

  async function fetchTransactions() {
    const start = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`
    const end = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-31`
    const { data } = await supabase.from('transactions').select('*')
      .gte('date', start).lte('date', end).order('date', { ascending: false })
    setTransactions(data || [])
  }

  async function addTransaction() {
    if (!name || !amount || !selectedCat) { Alert.alert('Error', 'Completá todos los campos'); return }
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const today = new Date().toISOString().split('T')[0]
    const { error } = await supabase.from('transactions').insert({
      user_id: user?.id, type: modalType, name, amount: parseFloat(amount), category: selectedCat, date: today
    })
    if (error) Alert.alert('Error', error.message)
    else { fetchTransactions(); closeModal() }
    setLoading(false)
  }

  async function deleteTransaction(id: string) {
    Alert.alert('Eliminar', '¿Seguro que querés borrar este movimiento?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        await supabase.from('transactions').delete().eq('id', id)
        fetchTransactions()
      }}
    ])
  }

  function openModal(type: 'income'|'expense') {
    setModalType(type); setName(''); setAmount(''); setSelectedCat(''); setModalVisible(true)
  }
  function closeModal() { setModalVisible(false) }

  function changeMonth(dir: number) {
    let m = currentMonth + dir, y = currentYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setCurrentMonth(m); setCurrentYear(y)
  }

  const income = transactions.filter(t => t.type === 'income')
  const expense = transactions.filter(t => t.type === 'expense')
  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('es-AR', {maximumFractionDigits:0})

  const renderItem = (t: any, type: 'income'|'expense') => (
    <View key={t.id} style={s.itemWrap}>
      <View style={s.item}>
        <Text style={s.itemEmoji}>{t.category.split(' ')[0]}</Text>
        <View style={s.itemInfo}>
          <Text style={s.itemName}>{t.name}</Text>
          <Text style={s.itemSub}>{t.category.split(' ').slice(1).join(' ')} · {t.date}</Text>
        </View>
        <Text style={[s.itemAmount, {color: type==='income'?'#3bf5a0':'#ff4d6a'}]}>
          {type==='income'?'+':'-'}{fmt(t.amount)}
        </Text>
        <TouchableOpacity style={s.delBtn} onPress={() => deleteTransaction(t.id)}>
          <Text style={s.delBtnText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={s.arrow}>‹</Text></TouchableOpacity>
        <Text style={s.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
        <TouchableOpacity onPress={() => changeMonth(1)}><Text style={s.arrow}>›</Text></TouchableOpacity>
      </View>

      <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>INGRESOS</Text>
            <TouchableOpacity style={s.addBtn} onPress={() => openModal('income')}>
              <Text style={s.addBtnText}>+ Agregar</Text>
            </TouchableOpacity>
          </View>
          {income.length === 0
            ? <Text style={s.empty}>Sin ingresos</Text>
            : income.map(t => renderItem(t, 'income'))
          }
        </View>

        <View style={s.section}>
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>GASTOS</Text>
            <TouchableOpacity style={[s.addBtn, {backgroundColor:'#ff4d6a'}]} onPress={() => openModal('expense')}>
              <Text style={s.addBtnText}>+ Agregar</Text>
            </TouchableOpacity>
          </View>
          {expense.length === 0
            ? <Text style={s.empty}>Sin gastos</Text>
            : expense.map(t => renderItem(t, 'expense'))
          }
        </View>
      </ScrollView>

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBg} onPress={closeModal} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>{modalType === 'income' ? 'Nuevo ingreso' : 'Nuevo gasto'}</Text>
            <TextInput style={s.input} placeholder="Descripción" placeholderTextColor="#555" value={name} onChangeText={setName} />
            <TextInput style={s.input} placeholder="Monto" placeholderTextColor="#555" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <Text style={s.catLabel}>CATEGORÍA</Text>
            <View style={s.pills}>
              {CATS[modalType].map(c => (
                <TouchableOpacity key={c} style={[s.pill, selectedCat===c && s.pillSelected]} onPress={() => setSelectedCat(c)}>
                  <Text style={[s.pillText, selectedCat===c && {color:'#c8f135'}]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnCancel} onPress={closeModal}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btnConfirm, modalType==='expense' && {backgroundColor:'#ff4d6a'}]} onPress={addTransaction} disabled={loading}>
                <Text style={s.btnConfirmText}>{loading ? 'Guardando...' : 'Guardar'}</Text>
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
  arrow: { color:'#f0f0f0', fontSize:28, paddingHorizontal:10 },
  monthTitle: { color:'#f0f0f0', fontSize:22, fontWeight:'800' },
  scroll: { flex:1 },
  section: { padding:16, marginBottom:8 },
  sectionHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  sectionTitle: { color:'#555', fontSize:11, fontWeight:'700', letterSpacing:1.5 },
  addBtn: { backgroundColor:'#c8f135', borderRadius:8, paddingHorizontal:12, paddingVertical:6 },
  addBtnText: { color:'#0d0d0f', fontWeight:'700', fontSize:12 },
  itemWrap: { marginBottom:8 },
  item: { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:12, flexDirection:'row', alignItems:'center' },
  itemEmoji: { fontSize:20, width:36, textAlign:'center' },
  itemInfo: { flex:1, marginLeft:8 },
  itemName: { color:'#f0f0f0', fontWeight:'700', fontSize:14 },
  itemSub: { color:'#555', fontSize:11, marginTop:2 },
  itemAmount: { fontWeight:'700', fontSize:14 },
  delBtn: { marginLeft:8, padding:4 },
  delBtnText: { color:'#555', fontSize:22, fontWeight:'300' },
  empty: { color:'#333', fontSize:12, textAlign:'center', padding:20, borderWidth:1, borderColor:'#2a2a30', borderRadius:12, borderStyle:'dashed' },
  modalOverlay: { flex:1, justifyContent:'flex-end' },
  modalBg: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.8)' },
  modal: { backgroundColor:'#141416', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:40 },
  modalTitle: { color:'#f0f0f0', fontSize:20, fontWeight:'800', marginBottom:16 },
  input: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:10, padding:12, color:'#f0f0f0', fontSize:16, marginBottom:12 },
  catLabel: { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:8 },
  pills: { flexDirection:'row', flexWrap:'wrap', gap:6, marginBottom:16 },
  pill: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  pillSelected: { borderColor:'#c8f135' },
  pillText: { color:'#f0f0f0', fontSize:11 },
  modalActions: { flexDirection:'row', gap:10 },
  btnCancel: { flex:1, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:14, alignItems:'center' },
  btnCancelText: { color:'#f0f0f0', fontWeight:'700' },
  btnConfirm: { flex:2, backgroundColor:'#c8f135', borderRadius:12, padding:14, alignItems:'center' },
  btnConfirmText: { color:'#0d0d0f', fontWeight:'800', fontSize:15 },
})