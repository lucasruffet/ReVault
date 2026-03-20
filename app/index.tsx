import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native'
import { supabase } from '../supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  async function handleAuth() {
    if (!email || !password) {
      Alert.alert('Error', 'Completá email y contraseña')
      return
    }
    setLoading(true)
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
        if (error) Alert.alert('Error login', error.message)
        else Alert.alert('OK', 'Sesión iniciada: ' + data.user?.email)
      } else {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password })
        if (error) Alert.alert('Error registro', error.message)
        else Alert.alert('Listo', 'Cuenta creada')
      }
    } catch (e: any) {
      Alert.alert('Excepción', e.message)
    }
    setLoading(false)
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Text style={styles.title}>💰 Finanzas</Text>
      <Text style={styles.subtitle}>{isLogin ? 'Iniciá sesión' : 'Creá tu cuenta'}</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#555"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#555"
        value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={handleAuth} disabled={loading}>
        <Text style={styles.btnText}>{loading ? 'Cargando...' : isLogin ? 'Entrar' : 'Registrarme'}</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
        <Text style={styles.toggle}>{isLogin ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Entrá'}</Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d0d0f', justifyContent: 'center', padding: 24 },
  title: { fontSize: 36, fontWeight: '800', color: '#c8f135', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 40 },
  input: { backgroundColor: '#141416', borderWidth: 1, borderColor: '#2a2a30', borderRadius: 12, padding: 14, color: '#f0f0f0', fontSize: 16, marginBottom: 12 },
  btn: { backgroundColor: '#c8f135', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0d0d0f', fontWeight: '800', fontSize: 16 },
  toggle: { color: '#555', textAlign: 'center', marginTop: 20, fontSize: 14 },
})