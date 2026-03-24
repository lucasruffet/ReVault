import * as Linking from 'expo-linking'
import { useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native'
import { supabase } from '../supabase'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [loading, setLoading] = useState(false)

  // Registration steps: 'form' → 'otp' → done (logged in, password set)
  const [step, setStep] = useState<'form' | 'otp'>('form')
  const [code, setCode] = useState('')

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Error', 'Completá email y contraseña'); return }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) Alert.alert('Error', error.message)
    setLoading(false)
  }

  async function handleRegister() {
    if (!email || !password) { Alert.alert('Error', 'Completá email y contraseña'); return }
    if (password.length < 6) { Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres'); return }
    setLoading(true)
    // Use signInWithOtp to send a proper 6-digit OTP for email verification
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL('auth') },
    })
    if (error) Alert.alert('Error', error.message)
    else setStep('otp')
    setLoading(false)
  }

  async function handleVerifyOtp() {
    const cleanCode = code.trim()
    if (cleanCode.length < 6) { Alert.alert('Error', 'Ingresá el código completo'); return }
    setLoading(true)
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: cleanCode,
      type: 'email',
    })
    if (error) {
      Alert.alert('Código inválido', error.message)
      setLoading(false)
      return
    }
    // OTP verified → user is logged in → now set their password
    const { error: pwErr } = await supabase.auth.updateUser({ password })
    if (pwErr) Alert.alert('Cuenta creada', 'Verificado, pero no se pudo guardar la contraseña: ' + pwErr.message)
    // onAuthStateChange in _layout.tsx will redirect to /(tabs) automatically
    setLoading(false)
  }

  async function handleResendOtp() {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true, emailRedirectTo: Linking.createURL('auth') },
    })
    setLoading(false)
    if (error) Alert.alert('Error', error.message)
    else Alert.alert('Listo', 'Te reenviamos el código')
  }

  if (step === 'otp') {
    return (
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
        <Text style={styles.title}>Verificá tu email</Text>
        <Text style={styles.subtitle}>Revisá tu bandeja (y spam){'\n'}e ingresá el código de 6 dígitos</Text>
        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="00000000"
          placeholderTextColor="#333"
          value={code}
          onChangeText={setCode}
          autoCapitalize="none"
          keyboardType="number-pad"
          maxLength={8}
          autoFocus
        />
        <TouchableOpacity style={styles.btn} onPress={handleVerifyOtp} disabled={loading}>
          <Text style={styles.btnText}>{loading ? 'Verificando...' : 'Confirmar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
          <Text style={styles.toggle}>Reenviar código</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { setStep('form'); setCode('') }}>
          <Text style={[styles.toggle, { marginTop: 8 }]}>Volver</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    )
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.container}>
      <Text style={styles.title}>💰 Finanzas</Text>
      <Text style={styles.subtitle}>{isLogin ? 'Iniciá sesión' : 'Creá tu cuenta'}</Text>
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#555"
        value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Contraseña" placeholderTextColor="#555"
        value={password} onChangeText={setPassword} secureTextEntry />
      <TouchableOpacity style={styles.btn} onPress={isLogin ? handleLogin : handleRegister} disabled={loading}>
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
  subtitle: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 40, lineHeight: 22 },
  input: { backgroundColor: '#141416', borderWidth: 1, borderColor: '#2a2a30', borderRadius: 12, padding: 14, color: '#f0f0f0', fontSize: 16, marginBottom: 12 },
  codeInput: { fontSize: 32, fontWeight: '800', textAlign: 'center', letterSpacing: 12, color: '#c8f135' },
  btn: { backgroundColor: '#c8f135', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  btnText: { color: '#0d0d0f', fontWeight: '800', fontSize: 16 },
  toggle: { color: '#555', textAlign: 'center', marginTop: 20, fontSize: 14 },
})
