import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { Alert, Image, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native'
import AccountSelector from '../../components/AccountSelector'
import { useAccount } from '../../context/AccountContext'
import { supabase } from '../../supabase'

export default function Perfil() {
  const { accounts, currentAccount, setCurrentAccount, plan, refreshPlan } = useAccount()
  const [profile, setProfile] = useState<any>(null)
  const [editName, setEditName] = useState('')
  const [showEditName, setShowEditName] = useState(false)
  const [uploading, setUploading] = useState(false)

  useFocusEffect(useCallback(() => { fetchProfile(); refreshPlan() }, []))
  useEffect(() => { fetchProfile() }, [])

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
    setProfile(data)
    setEditName(data?.name || '')
  }

  async function saveName() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('profiles').update({ name: editName }).eq('id', user.id)
    fetchProfile()
    setShowEditName(false)
  }

  async function pickAndUploadPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') { Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería'); return }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'] as any,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    })
    if (result.canceled) return
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return   // setUploading handled by finally
      const asset = result.assets[0]
      if (!asset.base64) { Alert.alert('Error', 'No se pudo leer la imagen'); return }
      const ext = 'jpg'
      const mimeType = 'image/jpeg'
      const path = `${user.id}/avatar.${ext}`
      // Decode base64 to binary for Supabase Storage — avoids fetch+blob freezing in RN
      const byteChars = atob(asset.base64)
      const byteArr = new Uint8Array(byteChars.length)
      for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i)
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, byteArr, { upsert: true, contentType: mimeType })
      if (upErr) { Alert.alert('Error al subir', upErr.message); return }
      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = urlData.publicUrl + '?t=' + Date.now()
      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', user.id)
      fetchProfile()
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'No se pudo subir la imagen')
    } finally {
      setUploading(false)
    }
  }

  async function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Seguro que querés salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: async () => { await supabase.auth.signOut() }}
    ])
  }

  const isPro = plan === 'pro'

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Perfil</Text>
        <AccountSelector />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* Avatar */}
        <View style={s.avatarSection}>
          <TouchableOpacity style={s.avatarWrap} onPress={pickAndUploadPhoto} disabled={uploading}>
            {profile?.avatar_url
              ? <Image key={profile.avatar_url} source={{ uri: profile.avatar_url }} style={s.avatar} />
              : <View style={s.avatarPlaceholder}><Text style={s.avatarInitial}>{(profile?.name || profile?.email || '?')[0].toUpperCase()}</Text></View>
            }
            <View style={s.avatarBadge}><Text style={s.avatarBadgeText}>{uploading ? '...' : '📷'}</Text></View>
          </TouchableOpacity>

          {showEditName ? (
            <View style={s.nameEditRow}>
              <TextInput
                style={s.nameInput}
                value={editName}
                onChangeText={setEditName}
                autoFocus
                placeholder="Tu nombre"
                placeholderTextColor="#555"
              />
              <TouchableOpacity style={s.nameSaveBtn} onPress={saveName}>
                <Text style={s.nameSaveBtnText}>✓</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity onPress={() => setShowEditName(true)}>
              <Text style={s.profileName}>{profile?.name || 'Sin nombre'} ✏️</Text>
            </TouchableOpacity>
          )}
          <Text style={s.profileEmail}>{profile?.email}</Text>
        </View>

        {/* Plan */}
        <View style={[s.planCard, isPro && s.planCardPro]}>
          <View style={s.planRow}>
            <View>
              <Text style={s.planLabel}>PLAN ACTUAL</Text>
              <Text style={[s.planName, isPro && s.planNamePro]}>{isPro ? '⭐ Pro' : '🆓 Gratuito'}</Text>
            </View>
            {!isPro && (
              <TouchableOpacity style={s.upgradeBtn} onPress={() => Alert.alert('Próximamente', 'El upgrade a Pro estará disponible pronto.')}>
                <Text style={s.upgradeBtnText}>Mejorar</Text>
              </TouchableOpacity>
            )}
          </View>
          {!isPro && (
            <View style={s.planLimits}>
              <Text style={s.planLimitItem}>• Máx. 50 transacciones por mes</Text>
              <Text style={s.planLimitItem}>• Solo 1 mes de historial visible</Text>
              <Text style={s.planLimitItem}>• Solo 1 cuenta</Text>
              <Text style={s.planLimitItem}>• Gráfico básico</Text>
            </View>
          )}
          {isPro && (
            <View style={s.planLimits}>
              <Text style={[s.planLimitItem, { color: '#c8f135' }]}>✓ Transacciones ilimitadas</Text>
              <Text style={[s.planLimitItem, { color: '#c8f135' }]}>✓ Historial completo</Text>
              <Text style={[s.planLimitItem, { color: '#c8f135' }]}>✓ Gráficos avanzados</Text>
              <Text style={[s.planLimitItem, { color: '#c8f135' }]}>✓ Múltiples cuentas</Text>
              <Text style={[s.planLimitItem, { color: '#c8f135' }]}>✓ Exportar a Excel/PDF</Text>
              <Text style={[s.planLimitItem, { color: '#c8f135' }]}>✓ Notificaciones de presupuesto</Text>
            </View>
          )}
        </View>

        {/* Accounts */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>MIS CUENTAS</Text>
          {accounts.length === 0
            ? <Text style={s.empty}>Sin cuentas — creá una desde el selector</Text>
            : accounts.map(acc => (
              <TouchableOpacity key={acc.id} style={[s.accItem, currentAccount?.id === acc.id && { borderColor: acc.color }]}
                onPress={() => setCurrentAccount(acc)}>
                <Text style={s.accIcon}>{acc.icon}</Text>
                <Text style={[s.accName, { color: acc.color }]}>{acc.name}</Text>
                {currentAccount?.id === acc.id && <Text style={[s.accCheck, { color: acc.color }]}>✓</Text>}
              </TouchableOpacity>
            ))
          }
        </View>

        {/* Logout */}
        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0d0d0f' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, paddingTop:60 },
  headerTitle: { color:'#f0f0f0', fontSize:22, fontWeight:'800' },
  scroll: { padding:16, paddingBottom:40 },
  avatarSection: { alignItems:'center', marginBottom:24 },
  avatarWrap: { position:'relative', marginBottom:12 },
  avatar: { width:90, height:90, borderRadius:45 },
  avatarPlaceholder: { width:90, height:90, borderRadius:45, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', alignItems:'center', justifyContent:'center' },
  avatarInitial: { color:'#c8f135', fontSize:36, fontWeight:'800' },
  avatarBadge: { position:'absolute', bottom:0, right:0, backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:4 },
  avatarBadgeText: { fontSize:14 },
  profileName: { color:'#f0f0f0', fontSize:20, fontWeight:'800', marginBottom:4, textAlign:'center' },
  profileEmail: { color:'#555', fontSize:13, textAlign:'center' },
  nameEditRow: { flexDirection:'row', gap:8, alignItems:'center', marginBottom:4 },
  nameInput: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#c8f135', borderRadius:10, padding:10, color:'#f0f0f0', fontSize:16, minWidth:180 },
  nameSaveBtn: { backgroundColor:'#c8f135', borderRadius:10, padding:10 },
  nameSaveBtnText: { color:'#0d0d0f', fontWeight:'800', fontSize:16 },
  planCard: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#2a2a30', borderRadius:16, padding:16, marginBottom:20 },
  planCardPro: { backgroundColor:'#1a2810', borderColor:'#3a5a18' },
  planRow: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
  planLabel: { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:4 },
  planName: { color:'#f0f0f0', fontSize:22, fontWeight:'800' },
  planNamePro: { color:'#c8f135' },
  upgradeBtn: { backgroundColor:'#c8f135', borderRadius:10, paddingHorizontal:14, paddingVertical:8 },
  upgradeBtnText: { color:'#0d0d0f', fontWeight:'800', fontSize:13 },
  planLimits: { gap:4 },
  planLimitItem: { color:'#888', fontSize:12 },
  section: { marginBottom:20 },
  sectionTitle: { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:10 },
  accItem: { flexDirection:'row', alignItems:'center', backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:12, marginBottom:8, gap:10 },
  accIcon: { fontSize:18 },
  accName: { flex:1, fontSize:14, fontWeight:'700' },
  accCheck: { fontSize:16, fontWeight:'800' },
  empty: { color:'#333', fontSize:12, textAlign:'center', padding:20 },
  logoutBtn: { backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#ff4d6a', borderRadius:12, padding:14, alignItems:'center', marginTop:8 },
  logoutText: { color:'#ff4d6a', fontWeight:'700', fontSize:15 },
})
