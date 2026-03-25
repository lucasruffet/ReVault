import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import AccountSelector from '../../components/AccountSelector'
import { useAccount } from '../../context/AccountContext'
import { supabase } from '../../supabase'

// xlsx, FileSystem and Sharing are required lazily inside exportToExcel to avoid
// crashing the app at startup — xlsx accesses Node.js globals not available in RN.

const CATS = {
  income: ['💼 Sueldo','💻 Freelance','📈 Inversiones','🎁 Otros'],
  expense: ['🏋️ Deporte','🎮 Ocio','💊 Medicina','🚗 Transporte','✈️ Viaje','🍔 Comida','🛍️ Ropa','🏠 Hogar','📱 Tech','💸 Otros'],
  investment: ['💰 BTC','💵 USD','📊 S&P500','🏦 CEDEARs','📈 Fondos','⏰ Plazo Fijo','💎 Otros']
}

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const FREE_TX_LIMIT = 50

export default function Movimientos() {
  const { currentAccount, plan } = useAccount()
  const [transactions, setTransactions] = useState<any[]>([])
  const [monthCount, setMonthCount] = useState(0)
  const [budgetWarnings, setBudgetWarnings] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [modalVisible, setModalVisible] = useState(false)
  const [modalType, setModalType] = useState<'income'|'expense'|'investment'>('income')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [selectedCat, setSelectedCat] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingId, setEditingId] = useState<string|null>(null)
  const [customCats, setCustomCats] = useState<string[]>([])
  const [showCustomInput, setShowCustomInput] = useState(false)
  const [customCatText, setCustomCatText] = useState('')
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  useFocusEffect(useCallback(() => { fetchTransactions() }, [currentMonth, currentYear, currentAccount]))
  useEffect(() => { fetchTransactions() }, [currentMonth, currentYear, currentAccount])

  async function fetchTransactions() {
    if (!currentAccount) { setTransactions([]); setBudgetWarnings([]); return }
    const start = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`
    const end = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-31`
    const { data } = await supabase.from('transactions').select('*')
      .eq('account_id', currentAccount.id)
      .gte('date', start).lte('date', end).order('date', { ascending: false })
    const txs = data || []
    setTransactions(txs)
    setMonthCount(txs.length)
    if (plan === 'pro') checkBudgets(txs)
  }

  async function checkBudgets(txs: any[]) {
    if (!currentAccount) return
    const { data: budgets } = await supabase.from('budgets')
      .select('*').eq('account_id', currentAccount.id)
    if (!budgets || budgets.length === 0) { setBudgetWarnings([]); return }

    // Sum expenses per category (strip emoji prefix for matching)
    const spent: Record<string, number> = {}
    txs.filter(t => t.type === 'expense').forEach(t => {
      const key = t.category
      spent[key] = (spent[key] || 0) + t.amount
    })

    const warnings: string[] = []
    budgets.forEach((b: any) => {
      const catSpent = spent[b.category] || 0
      const pct = catSpent / b.amount
      if (pct >= 1) {
        warnings.push(`🚨 ${b.category}: superaste el presupuesto ($${catSpent.toLocaleString('es-AR',{maximumFractionDigits:0})} / $${b.amount.toLocaleString('es-AR',{maximumFractionDigits:0})})`)
      } else if (pct >= 0.8) {
        warnings.push(`⚠️ ${b.category}: ${Math.round(pct*100)}% del presupuesto ($${catSpent.toLocaleString('es-AR',{maximumFractionDigits:0})} / $${b.amount.toLocaleString('es-AR',{maximumFractionDigits:0})})`)
      }
    })
    setBudgetWarnings(warnings)
  }

  async function exportToExcel() {
    if (plan !== 'pro') {
      Alert.alert('Plan Pro requerido', 'Exportar a Excel es una función exclusiva del plan Pro.')
      return
    }
    if (transactions.length === 0) {
      Alert.alert('Sin datos', 'No hay transacciones para exportar en este mes.')
      return
    }
    setExporting(true)
    try {
      // Dynamic requires — never import xlsx/FileSystem/Sharing at module level in RN
      const XLSX = require('xlsx')
      const FileSystem = require('expo-file-system/legacy')
      const Sharing = require('expo-sharing')

      const typeLabel = (t: string) => t === 'income' ? 'Ingreso' : t === 'expense' ? 'Gasto' : 'Inversión'
      const rows = transactions.map(t => ({
        Fecha: t.date,
        Descripción: t.name,
        Categoría: t.category.split(' ').slice(1).join(' ') || t.category,
        Tipo: typeLabel(t.type),
        Monto: t.type === 'income' ? t.amount : -t.amount,
      }))

      const totalIncome = transactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0)
      const totalExpense = transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0)
      const totalInvest = transactions.filter(t => t.type === 'investment').reduce((a, b) => a + b.amount, 0)

      const ws = XLSX.utils.json_to_sheet(rows)
      ws['!cols'] = [{ wch: 12 }, { wch: 28 }, { wch: 18 }, { wch: 12 }, { wch: 14 }]
      XLSX.utils.sheet_add_aoa(ws, [
        ['RESUMEN DEL MES'],
        ['Total ingresos', totalIncome],
        ['Total gastos', totalExpense],
        ['Total inversiones', totalInvest],
        ['Balance', totalIncome - totalExpense - totalInvest],
      ], { origin: `A${rows.length + 3}` })

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, `${MONTHS[currentMonth]} ${currentYear}`)

      const wbBase64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' })
      const fileName = `ReValue_${MONTHS[currentMonth]}_${currentYear}.xlsx`
      const filePath = FileSystem.cacheDirectory + fileName
      await FileSystem.writeAsStringAsync(filePath, wbBase64, { encoding: 'base64' })

      const canShare = await Sharing.isAvailableAsync()
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: `Exportar ${MONTHS[currentMonth]} ${currentYear}`,
          UTI: 'com.microsoft.excel.xlsx',
        })
      } else {
        Alert.alert('Archivo guardado', `Guardado en: ${filePath}`)
      }
    } catch (e: any) {
      Alert.alert('Error al exportar', e?.message || 'No se pudo generar el archivo')
    } finally {
      setExporting(false)
    }
  }

  async function saveTransaction() {
    if (!name.trim() || !amount || !selectedCat) { Alert.alert('Error', 'Completá todos los campos'); return }
    if (name.trim().length > 100) { Alert.alert('Error', 'La descripción no puede superar los 100 caracteres'); return }
    const parsedAmount = parseFloat(amount)
    if (!isFinite(parsedAmount) || parsedAmount <= 0) { Alert.alert('Error', 'Ingresá un monto válido mayor a 0'); return }
    if (parsedAmount > 999_999_999) { Alert.alert('Error', 'El monto es demasiado alto'); return }
    if (!currentAccount) { Alert.alert('Error', 'Seleccioná una cuenta primero'); return }

    if (!editingId && plan === 'free' && monthCount >= FREE_TX_LIMIT) {
      Alert.alert('Límite alcanzado', `El plan gratuito permite hasta ${FREE_TX_LIMIT} transacciones por mes. Mejorá a Pro para continuar.`)
      return
    }

    setLoading(true)
    if (editingId) {
      const { error } = await supabase.from('transactions')
        .update({ name: name.trim(), amount: parsedAmount, category: selectedCat, type: modalType })
        .eq('id', editingId)
      if (error) Alert.alert('Error', 'No se pudo guardar el movimiento')
      else { fetchTransactions(); closeModal() }
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      const d = new Date()
      const today = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
      const { error } = await supabase.from('transactions').insert({
        user_id: user?.id, account_id: currentAccount.id, type: modalType,
        name: name.trim(), amount: parsedAmount, category: selectedCat, date: today
      })
      if (error) Alert.alert('Error', 'No se pudo guardar el movimiento')
      else { fetchTransactions(); closeModal() }
    }
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

  function openModal(type: 'income'|'expense'|'investment') {
    if (!currentAccount) { Alert.alert('Error', 'Seleccioná una cuenta primero'); return }
    setEditingId(null)
    setModalType(type); setName(''); setAmount(''); setSelectedCat('')
    setCustomCats([]); setShowCustomInput(false); setCustomCatText('')
    setModalVisible(true)
  }

  function openEditModal(t: any) {
    setEditingId(t.id)
    setModalType(t.type)
    setName(t.name)
    setAmount(String(t.amount))
    setShowCustomInput(false); setCustomCatText('')
    const isCustom = !CATS[t.type as 'income'|'expense'|'investment'].includes(t.category)
    setCustomCats(isCustom ? [t.category] : [])
    setSelectedCat(t.category)
    setModalVisible(true)
  }

  function closeModal() { setEditingId(null); setModalVisible(false) }

  function confirmCustomCat() {
    const trimmed = customCatText.trim()
    if (!trimmed) { setShowCustomInput(false); return }
    const cat = '🏷️ ' + trimmed
    setCustomCats(prev => [...prev, cat])
    setSelectedCat(cat)
    setShowCustomInput(false)
    setCustomCatText('')
  }

  function changeMonth(dir: number) {
    let m = currentMonth + dir, y = currentYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setCurrentMonth(m); setCurrentYear(y)
  }

  const income = transactions.filter(t => t.type === 'income')
  const expense = transactions.filter(t => t.type === 'expense')
  const investment = transactions.filter(t => t.type === 'investment')
  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('es-AR', {maximumFractionDigits:0})
  const isAtLimit = plan === 'free' && monthCount >= FREE_TX_LIMIT

  const renderItem = (t: any, type: 'income'|'expense'|'investment') => (
    <View key={t.id} style={s.itemWrap}>
      <View style={s.item}>
        <Text style={s.itemEmoji}>{t.category.split(' ')[0]}</Text>
        <View style={s.itemInfo}>
          <Text style={s.itemName}>{t.name}</Text>
          <Text style={s.itemSub}>{t.category.split(' ').slice(1).join(' ')} · {t.date}</Text>
        </View>
        <Text style={[s.itemAmount, {color: type==='income'?'#3bf5a0':type==='investment'?'#00c2b8':'#ff4d6a'}]}>
          {type==='income'?'+':type==='investment'?'▲':'-'}{fmt(t.amount)}
        </Text>
        <TouchableOpacity style={s.editBtn} onPress={() => openEditModal(t)}>
          <Text style={s.editBtnText}>✏️</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.delBtn} onPress={() => deleteTransaction(t.id)}>
          <Text style={s.delBtnText}>×</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={s.arrow}>‹</Text></TouchableOpacity>
          <Text style={s.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><Text style={s.arrow}>›</Text></TouchableOpacity>
        </View>
        <View style={s.headerRight}>
          {plan === 'pro' && currentAccount && (
            <TouchableOpacity style={s.budgetBtn} onPress={() => router.push('/presupuesto')}>
              <Text style={s.budgetBtnText}>🎯</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[s.exportBtn, exporting && { opacity: 0.5 }]}
            onPress={exportToExcel}
            disabled={exporting}
          >
            <Text style={s.exportBtnText}>{exporting ? '...' : '📊'}</Text>
          </TouchableOpacity>
          <AccountSelector />
        </View>
      </View>

      {/* Free plan limit banner */}
      {isAtLimit && (
        <View style={s.limitBanner}>
          <Text style={s.limitBannerText}>Límite de {FREE_TX_LIMIT} transacciones alcanzado</Text>
          <TouchableOpacity><Text style={s.limitBannerUpgrade}>Mejorar a Pro</Text></TouchableOpacity>
        </View>
      )}

      {/* Budget warning banners (Pro only) */}
      {budgetWarnings.length > 0 && (
        <View style={s.warningContainer}>
          {budgetWarnings.map((w, i) => (
            <TouchableOpacity key={i} style={[s.warningBanner, w.startsWith('🚨') && s.warningBannerOver]}
              onPress={() => router.push('/presupuesto')}>
              <Text style={[s.warningText, w.startsWith('🚨') && s.warningTextOver]}>{w}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {!currentAccount ? (
        <View style={s.noAccount}>
          <Text style={s.noAccountText}>Creá una cuenta para empezar</Text>
        </View>
      ) : (
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

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Text style={s.sectionTitle}>INVERSIONES</Text>
              <TouchableOpacity style={[s.addBtn, {backgroundColor:'#00c2b8'}]} onPress={() => openModal('investment')}>
                <Text style={s.addBtnText}>+ Agregar</Text>
              </TouchableOpacity>
            </View>
            {investment.length === 0
              ? <Text style={s.empty}>Sin inversiones</Text>
              : investment.map(t => renderItem(t, 'investment'))
            }
          </View>
        </ScrollView>
      )}

      <Modal visible={modalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.modalOverlay}>
          <TouchableOpacity style={s.modalBg} onPress={closeModal} />
          <View style={s.modal}>
            <Text style={s.modalTitle}>
              {editingId
                ? (modalType === 'income' ? 'Editar ingreso' : modalType === 'expense' ? 'Editar gasto' : 'Editar inversión')
                : (modalType === 'income' ? 'Nuevo ingreso' : modalType === 'expense' ? 'Nuevo gasto' : 'Nueva inversión')}
            </Text>
            <TextInput style={s.input} placeholder="Descripción" placeholderTextColor="#555" value={name} onChangeText={setName} />
            <TextInput style={s.input} placeholder="Monto" placeholderTextColor="#555" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
            <Text style={s.catLabel}>CATEGORÍA</Text>
            <View style={s.pills}>
              {[...CATS[modalType], ...customCats].map(c => (
                <TouchableOpacity key={c} style={[s.pill, selectedCat===c && s.pillSelected]} onPress={() => setSelectedCat(c)}>
                  <Text style={[s.pillText, selectedCat===c && {color:'#c8f135'}]}>{c}</Text>
                </TouchableOpacity>
              ))}
              {showCustomInput ? (
                <View style={s.customCatRow}>
                  <TextInput
                    style={s.customCatInput}
                    placeholder="Nueva categoría..."
                    placeholderTextColor="#555"
                    value={customCatText}
                    onChangeText={setCustomCatText}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={confirmCustomCat}
                  />
                  <TouchableOpacity style={s.customCatConfirm} onPress={confirmCustomCat}>
                    <Text style={s.customCatConfirmText}>✓</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.pillAdd} onPress={() => setShowCustomInput(true)}>
                  <Text style={s.pillAddText}>+</Text>
                </TouchableOpacity>
              )}
            </View>
            <View style={s.modalActions}>
              <TouchableOpacity style={s.btnCancel} onPress={closeModal}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnConfirm, modalType==='expense' && {backgroundColor:'#ff4d6a'}, modalType==='investment' && {backgroundColor:'#00c2b8'}]}
                onPress={saveTransaction} disabled={loading}
              >
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
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:16, paddingTop:60 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:4 },
  headerRight: { flexDirection:'row', alignItems:'center', gap:8 },
  arrow: { color:'#f0f0f0', fontSize:28, paddingHorizontal:6 },
  monthTitle: { color:'#f0f0f0', fontSize:18, fontWeight:'800' },
  budgetBtn: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:20, width:34, height:34, alignItems:'center', justifyContent:'center' },
  budgetBtnText: { fontSize:16 },
  exportBtn: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:20, width:34, height:34, alignItems:'center', justifyContent:'center' },
  exportBtnText: { fontSize:16 },
  limitBanner: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#2a0a0a', borderBottomWidth:1, borderBottomColor:'#5a1818', paddingHorizontal:16, paddingVertical:8 },
  limitBannerText: { color:'#ff4d6a', fontSize:11 },
  limitBannerUpgrade: { color:'#c8f135', fontSize:11, fontWeight:'700' },
  warningContainer: { paddingHorizontal:16, paddingTop:8, gap:6 },
  warningBanner: { backgroundColor:'#1a1a0a', borderWidth:1, borderColor:'#f5a623', borderRadius:10, padding:10 },
  warningBannerOver: { backgroundColor:'#2a0a0a', borderColor:'#ff4d6a' },
  warningText: { color:'#f5a623', fontSize:12, fontWeight:'600' },
  warningTextOver: { color:'#ff4d6a' },
  noAccount: { flex:1, alignItems:'center', justifyContent:'center' },
  noAccountText: { color:'#555', fontSize:14 },
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
  editBtn: { marginLeft:8, padding:4 },
  editBtnText: { fontSize:14 },
  delBtn: { marginLeft:4, padding:4 },
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
  pillAdd: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  pillAddText: { color:'#555', fontSize:15, fontWeight:'700', lineHeight:16 },
  customCatRow: { flexDirection:'row', alignItems:'center', gap:6, width:'100%', marginTop:2 },
  customCatInput: { flex:1, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#c8f135', borderRadius:20, paddingHorizontal:12, paddingVertical:5, color:'#f0f0f0', fontSize:12 },
  customCatConfirm: { backgroundColor:'#c8f135', borderRadius:20, paddingHorizontal:10, paddingVertical:5 },
  customCatConfirmText: { color:'#0d0d0f', fontWeight:'800', fontSize:13 },
  modalActions: { flexDirection:'row', gap:10 },
  btnCancel: { flex:1, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:14, alignItems:'center' },
  btnCancelText: { color:'#f0f0f0', fontWeight:'700' },
  btnConfirm: { flex:2, backgroundColor:'#c8f135', borderRadius:12, padding:14, alignItems:'center' },
  btnConfirmText: { color:'#0d0d0f', fontWeight:'800', fontSize:15 },
})
