import React, { useState } from 'react'
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { useAccount } from '../context/AccountContext'
import { supabase } from '../supabase'

function alertProFeature() {
  Alert.alert('Función Pro', 'Tener múltiples cuentas requiere el plan Pro.', [{ text: 'Entendido' }])
}

const ACCOUNT_ICONS = ['💼','🏠','🎯','🚀','💡','🎓','🏋️','🎮','🌍','💰','🏦','📊']
const ACCOUNT_COLORS = ['#c8f135','#3bf5a0','#ff4d6a','#00c2b8','#5b9cf6','#f5a623','#7c5cbf','#ff6b9d','#4ecdc4','#a8e063']

export default function AccountSelector() {
  const { accounts, currentAccount, setCurrentAccount, refreshAccounts, plan } = useAccount()
  const [showPicker, setShowPicker] = useState(false)
  const [showCreate, setShowCreate] = useState(false)
  const [editingAccount, setEditingAccount] = useState<any>(null)
  const [newName, setNewName] = useState('')
  const [newIcon, setNewIcon] = useState('💼')
  const [newColor, setNewColor] = useState('#c8f135')
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setEditingAccount(null)
    setNewName('')
    setNewIcon('💼')
    setNewColor('#c8f135')
    // Close picker first, then open create — never show both at the same time
    setShowPicker(false)
    setShowCreate(true)
  }

  function openEdit(acc: any) {
    setEditingAccount(acc)
    setNewName(acc.name)
    setNewIcon(acc.icon)
    setNewColor(acc.color)
    setShowPicker(false)
    setShowCreate(true)
  }

  async function saveAccount() {
    if (!newName.trim()) { Alert.alert('Error', 'Ingresá un nombre'); return }
    setSaving(true)
    try {
      if (editingAccount) {
        const { error } = await supabase.from('accounts')
          .update({ name: newName.trim(), icon: newIcon, color: newColor })
          .eq('id', editingAccount.id)
        if (error) { Alert.alert('Error', error.message); return }
      } else {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { Alert.alert('Error', 'No hay sesión activa'); return }
        const { data: newAcc, error } = await supabase.from('accounts').insert({
          user_id: user.id, name: newName.trim(), icon: newIcon, color: newColor
        }).select().single()
        if (error) { Alert.alert('Error', error.message); return }
        // If this is the first account, migrate existing transactions with no account
        if (accounts.length === 0 && newAcc) {
          await supabase.from('transactions')
            .update({ account_id: newAcc.id })
            .eq('user_id', user.id)
            .is('account_id', null)
        }
      }
      await refreshAccounts()
      setShowCreate(false)
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Ocurrió un error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteAccount(acc: any) {
    if (accounts.length === 1) { Alert.alert('Error', 'Necesitás al menos una cuenta'); return }
    Alert.alert('Eliminar cuenta', `¿Eliminar "${acc.name}"? Las transacciones quedarán sin cuenta.`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
        try {
          await supabase.from('accounts').delete().eq('id', acc.id)
          await refreshAccounts()
        } catch (e: any) {
          Alert.alert('Error', e?.message || 'No se pudo eliminar')
        }
      }}
    ])
  }

  // Picker modal and Create modal are SIBLINGS (never nested).
  // Nested Modals cause freezes/crashes on iOS and Android.
  return (
    <>
      {accounts.length === 0 ? (
        <TouchableOpacity style={s.selectorEmpty} onPress={plan === 'free' ? alertProFeature : openCreate}>
          <Text style={s.selectorEmptyText}>+ Nueva cuenta</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          style={[s.selector, { borderColor: currentAccount?.color || '#c8f135' }]}
          onPress={() => plan === 'free' ? alertProFeature() : setShowPicker(true)}
        >
          <Text style={s.selectorIcon}>{currentAccount?.icon}</Text>
          <Text style={[s.selectorName, { color: currentAccount?.color || '#f0f0f0' }]} numberOfLines={1}>
            {currentAccount?.name}
          </Text>
          {plan === 'free'
            ? <Text style={s.selectorLock}>🔒</Text>
            : <Text style={s.selectorChevron}>⌄</Text>
          }
        </TouchableOpacity>
      )}

      {/* Picker sheet — lists accounts */}
      <Modal visible={showPicker} animationType="slide" transparent onRequestClose={() => setShowPicker(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBg} onPress={() => setShowPicker(false)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>Mis cuentas</Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 300 }}>
              {accounts.map(acc => (
                <View key={acc.id} style={s.accRow}>
                  <TouchableOpacity
                    style={[s.accBtn, currentAccount?.id === acc.id && { borderColor: acc.color }]}
                    onPress={() => { setCurrentAccount(acc); setShowPicker(false) }}
                  >
                    <Text style={s.accIcon}>{acc.icon}</Text>
                    <Text style={[s.accName, { color: acc.color }]}>{acc.name}</Text>
                    {currentAccount?.id === acc.id && <Text style={[s.accCheck, { color: acc.color }]}>✓</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={s.accEdit} onPress={() => openEdit(acc)}>
                    <Text style={s.accEditText}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.accEdit} onPress={() => deleteAccount(acc)}>
                    <Text style={[s.accEditText, { color: '#ff4d6a', fontSize: 22 }]}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            <TouchableOpacity style={s.newBtn} onPress={plan === 'free' ? alertProFeature : openCreate}>
              <Text style={s.newBtnText}>+ Nueva cuenta</Text>
              {plan === 'free' && <Text style={s.newBtnPro}>PRO</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Create/Edit sheet — separate sibling modal, never nested */}
      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={s.overlay}>
          <TouchableOpacity style={s.overlayBg} onPress={() => setShowCreate(false)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{editingAccount ? 'Editar cuenta' : 'Nueva cuenta'}</Text>
            <TextInput
              style={s.input}
              placeholder="Nombre de la cuenta"
              placeholderTextColor="#555"
              value={newName}
              onChangeText={setNewName}
            />
            <Text style={s.label}>ÍCONO</Text>
            <View style={s.iconGrid}>
              {ACCOUNT_ICONS.map(ic => (
                <TouchableOpacity
                  key={ic}
                  style={[s.iconBtn, newIcon === ic && { borderColor: newColor }]}
                  onPress={() => setNewIcon(ic)}
                >
                  <Text style={s.iconText}>{ic}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.label}>COLOR</Text>
            <View style={s.colorRow}>
              {ACCOUNT_COLORS.map(c => (
                <TouchableOpacity
                  key={c}
                  style={[s.colorBtn, { backgroundColor: c }, newColor === c && s.colorSelected]}
                  onPress={() => setNewColor(c)}
                />
              ))}
            </View>
            <View style={s.preview}>
              <Text style={s.previewIcon}>{newIcon}</Text>
              <Text style={[s.previewName, { color: newColor }]}>{newName || 'Mi cuenta'}</Text>
            </View>
            <View style={s.actions}>
              <TouchableOpacity style={s.btnCancel} onPress={() => setShowCreate(false)}>
                <Text style={s.btnCancelText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.btnSave, { backgroundColor: newColor }]}
                onPress={saveAccount}
                disabled={saving}
              >
                <Text style={s.btnSaveText}>{saving ? 'Guardando...' : 'Guardar'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

const s = StyleSheet.create({
  selector: { flexDirection:'row', alignItems:'center', backgroundColor:'#1a1a1e', borderWidth:1, borderRadius:20, paddingHorizontal:12, paddingVertical:6, gap:6, maxWidth:160 },
  selectorIcon: { fontSize:14 },
  selectorName: { fontSize:13, fontWeight:'700', flex:1 },
  selectorChevron: { color:'#555', fontSize:12 },
  selectorLock: { fontSize:10 },
  selectorEmpty: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:20, paddingHorizontal:14, paddingVertical:7 },
  selectorEmptyText: { color:'#c8f135', fontSize:12, fontWeight:'700' },
  overlay: { flex:1, justifyContent:'flex-end' },
  overlayBg: { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.8)' },
  sheet: { backgroundColor:'#141416', borderTopLeftRadius:24, borderTopRightRadius:24, padding:24, paddingBottom:44 },
  sheetTitle: { color:'#f0f0f0', fontSize:18, fontWeight:'800', marginBottom:16 },
  accRow: { flexDirection:'row', alignItems:'center', marginBottom:8, gap:6 },
  accBtn: { flex:1, flexDirection:'row', alignItems:'center', backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:12, gap:10 },
  accIcon: { fontSize:18 },
  accName: { flex:1, fontSize:14, fontWeight:'700' },
  accCheck: { fontSize:16, fontWeight:'800' },
  accEdit: { padding:8 },
  accEditText: { fontSize:18, color:'#555' },
  newBtn: { marginTop:12, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:14, flexDirection:'row', alignItems:'center', justifyContent:'center', gap:8 },
  newBtnText: { color:'#c8f135', fontWeight:'700', fontSize:14 },
  newBtnPro: { color:'#c8f135', fontSize:9, fontWeight:'800', letterSpacing:1, backgroundColor:'rgba(200,241,53,0.12)', borderWidth:1, borderColor:'rgba(200,241,53,0.3)', borderRadius:6, paddingHorizontal:5, paddingVertical:1 },
  input: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:10, padding:12, color:'#f0f0f0', fontSize:16, marginBottom:14 },
  label: { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:8 },
  iconGrid: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 },
  iconBtn: { width:44, height:44, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:10, alignItems:'center', justifyContent:'center' },
  iconText: { fontSize:20 },
  colorRow: { flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:14 },
  colorBtn: { width:30, height:30, borderRadius:15 },
  colorSelected: { borderWidth:3, borderColor:'#fff' },
  preview: { flexDirection:'row', alignItems:'center', backgroundColor:'#1a1a1e', borderRadius:12, padding:12, marginBottom:16, gap:8 },
  previewIcon: { fontSize:20 },
  previewName: { fontSize:15, fontWeight:'800' },
  actions: { flexDirection:'row', gap:10 },
  btnCancel: { flex:1, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:14, alignItems:'center' },
  btnCancelText: { color:'#f0f0f0', fontWeight:'700' },
  btnSave: { flex:2, borderRadius:12, padding:14, alignItems:'center' },
  btnSaveText: { color:'#0d0d0f', fontWeight:'800', fontSize:15 },
})
