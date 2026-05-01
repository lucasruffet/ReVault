import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AdBanner from '../../components/AdBanner'
import AccountSelector from '../../components/AccountSelector'
import { useAccount } from '../../context/AccountContext'
import { supabase } from '../../supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Ahorro() {
  const { currentAccount, plan } = useAccount()
  const [monthlyData, setMonthlyData] = useState<any[]>([])

  useFocusEffect(useCallback(() => { fetchData() }, [currentAccount]))
  useEffect(() => { fetchData() }, [currentAccount])

  async function fetchData() {
    if (!currentAccount) { setMonthlyData([]); return }
    let q = supabase.from('transactions').select('*').eq('account_id', currentAccount.id).order('date', { ascending: true })
    const { data } = await q
    if (!data) return

    const now = new Date()
    const filteredData = plan === 'free'
      ? data.filter((t: any) => {
          const [y, m] = t.date.split('-').map(Number)
          const txDate = new Date(y, m-1, 1)
          const limit = new Date(now.getFullYear(), now.getMonth() - 1, 1)
          return txDate >= limit
        })
      : data

    const grouped: any = {}
    filteredData.forEach((t: any) => {
      const [y, m] = t.date.split('-')
      const key = `${y}-${m}`
      if (!grouped[key]) grouped[key] = { year: y, month: parseInt(m)-1, income: 0, expense: 0, investment: 0 }
      if (t.type === 'income') grouped[key].income += t.amount
      else if (t.type === 'expense') grouped[key].expense += t.amount
      else if (t.type === 'investment') grouped[key].investment += t.amount
    })
    let accum = 0
    const result = Object.values(grouped).map((d: any) => {
      const saved = d.income - d.expense
      accum += saved
      const pct = d.income > 0 ? Math.max(0, Math.min(100, (saved / d.income) * 100)) : 0
      return { ...d, saved, accum, pct }
    })
    setMonthlyData(result.reverse())
  }

  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('es-AR', {maximumFractionDigits:0})
  const totalAccum = monthlyData.length > 0 ? monthlyData[0].accum : 0
  const totalInvested = monthlyData.reduce((sum, d) => sum + (d.investment || 0), 0)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View>
          <Text style={s.label}>AHORRO ACUMULADO</Text>
          <Text style={[s.total, totalAccum < 0 && {color:'#ff4d6a'}]}>{totalAccum >= 0 ? '' : '-'}{fmt(totalAccum)}</Text>
        </View>
        <AccountSelector />
      </View>

      {plan === 'free' && (
        <View style={s.freeBanner}>
          <Text style={s.freeBannerText}>Historial limitado a 1 mes (plan gratuito)</Text>
          <TouchableOpacity><Text style={s.freeBannerUpgrade}>Mejorar</Text></TouchableOpacity>
        </View>
      )}

      {!currentAccount ? (
        <View style={s.noAccount}>
          <Text style={s.noAccountText}>Seleccioná una cuenta para ver el ahorro</Text>
        </View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {monthlyData.length === 0
            ? <Text style={s.empty}>Sin datos aún — agregá movimientos</Text>
            : monthlyData.map((d, i) => (
              <View key={i} style={s.card}>
                <View style={s.cardHeader}>
                  <Text style={s.cardMonth}>{MONTHS[d.month]} {d.year}</Text>
                  <Text style={[s.cardSaved, d.saved < 0 && {color:'#ff4d6a'}]}>
                    {d.saved >= 0 ? '+' : '-'}{fmt(d.saved)}
                  </Text>
                </View>
                <View style={s.barWrap}>
                  <View style={[s.bar, {width: `${d.pct}%`}]} />
                </View>
                <View style={s.cardFooter}>
                  <Text style={s.cardSub}>Ingresó {fmt(d.income)} · Gastó {fmt(d.expense)}{d.investment > 0 ? ` · Invirtió ${fmt(d.investment)}` : ''}</Text>
                  <Text style={s.cardPct}>{d.pct.toFixed(0)}%</Text>
                </View>
                <View style={s.accumRow}>
                  <Text style={s.accumLabel}>Acumulado</Text>
                  <Text style={[s.accumVal, d.accum < 0 && {color:'#ff4d6a'}]}>
                    {d.accum >= 0 ? '+' : '-'}{fmt(d.accum)}
                  </Text>
                </View>
              </View>
            ))
          }

          {totalInvested > 0 && (
            <View style={s.investSection}>
              <Text style={s.investLabel}>TOTAL INVERTIDO</Text>
              <Text style={s.investTotal}>{fmt(totalInvested)}</Text>
              {monthlyData.filter(d => d.investment > 0).map((d, i) => (
                <View key={i} style={s.investRow}>
                  <Text style={s.investMonth}>{MONTHS[d.month]} {d.year}</Text>
                  <Text style={s.investAmt}>{fmt(d.investment)}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}
      <AdBanner />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0d0d0f' },
  header: { padding:24, paddingTop:60, borderBottomWidth:1, borderBottomColor:'#2a2a30', flexDirection:'row', justifyContent:'space-between', alignItems:'flex-end' },
  label: { color:'#555', fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:6 },
  total: { color:'#5b9cf6', fontSize:38, fontWeight:'800', letterSpacing:-1 },
  freeBanner: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#1a1a0a', borderBottomWidth:1, borderBottomColor:'#3a3a18', paddingHorizontal:16, paddingVertical:8 },
  freeBannerText: { color:'#aaa', fontSize:11 },
  freeBannerUpgrade: { color:'#c8f135', fontSize:11, fontWeight:'700' },
  noAccount: { flex:1, alignItems:'center', justifyContent:'center' },
  noAccountText: { color:'#555', fontSize:14 },
  scroll: { flex:1, padding:16 },
  empty: { color:'#333', fontSize:12, textAlign:'center', padding:40 },
  card: { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:16, padding:16, marginBottom:12 },
  cardHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:10 },
  cardMonth: { color:'#f0f0f0', fontSize:16, fontWeight:'800' },
  cardSaved: { color:'#3bf5a0', fontSize:16, fontWeight:'800' },
  barWrap: { backgroundColor:'rgba(255,255,255,0.06)', borderRadius:99, height:5, marginBottom:8, overflow:'hidden' },
  bar: { height:'100%', borderRadius:99, backgroundColor:'#5b9cf6' },
  cardFooter: { flexDirection:'row', justifyContent:'space-between' },
  cardSub: { color:'#555', fontSize:11 },
  cardPct: { color:'#5b9cf6', fontSize:11, fontWeight:'700' },
  accumRow: { flexDirection:'row', justifyContent:'space-between', marginTop:10, paddingTop:10, borderTopWidth:1, borderTopColor:'#2a2a30' },
  accumLabel: { color:'#555', fontSize:12 },
  accumVal: { color:'#3bf5a0', fontSize:12, fontWeight:'700' },
  investSection: { backgroundColor:'#0a1f1e', borderWidth:1, borderColor:'#00c2b8', borderRadius:16, padding:16, marginBottom:24 },
  investLabel: { color:'rgba(0,194,184,0.6)', fontSize:11, fontWeight:'700', letterSpacing:1.5, marginBottom:6 },
  investTotal: { color:'#00c2b8', fontSize:32, fontWeight:'800', letterSpacing:-1, marginBottom:12 },
  investRow: { flexDirection:'row', justifyContent:'space-between', paddingVertical:6, borderTopWidth:1, borderTopColor:'rgba(0,194,184,0.15)' },
  investMonth: { color:'#888', fontSize:13 },
  investAmt: { color:'#00c2b8', fontSize:13, fontWeight:'700' },
})
