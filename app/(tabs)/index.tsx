import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import AdBanner from '../../components/AdBanner'
import AccountSelector from '../../components/AccountSelector'
import { useAccount } from '../../context/AccountContext'
import { supabase } from '../../supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const COLORS = ['#c8f135','#3bf5a0','#ff4d6a','#f5a623','#7c5cbf','#4ecdc4','#ff6b9d','#45b7d1','#f7dc6f','#a8e063']

function DonutChart({ vals, cats, total }: { vals: number[], cats: string[], total: number }) {
  const size = 120, cx = 60, cy = 60, R = 50, r = 28
  let startAngle = -Math.PI / 2
  const paths = vals.map((v, i) => {
    const angle = (v / total) * Math.PI * 2
    const x1 = cx + R * Math.cos(startAngle)
    const y1 = cy + R * Math.sin(startAngle)
    const x2 = cx + R * Math.cos(startAngle + angle)
    const y2 = cy + R * Math.sin(startAngle + angle)
    const large = angle > Math.PI ? 1 : 0
    const d = `M ${cx} ${cy} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`
    startAngle += angle
    return <Path key={cats[i]} d={d} fill={COLORS[i % COLORS.length]} />
  })
  return (
    <Svg width={size} height={size}>
      {paths}
      <Circle cx={cx} cy={cy} r={r} fill="#141416" />
    </Svg>
  )
}

export default function Resumen() {
  const { currentAccount, plan } = useAccount()
  const [transactions, setTransactions] = useState<any[]>([])
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  useEffect(() => { fetchAll() }, [currentMonth, currentYear, currentAccount])
  useFocusEffect(useCallback(() => { fetchAll() }, [currentMonth, currentYear, currentAccount]))

  async function fetchAll() {
    let q = supabase.from('transactions').select('*').order('date', { ascending: true })
    if (currentAccount) q = q.eq('account_id', currentAccount.id)
    const { data } = await q
    setTransactions(data || [])
  }

  function changeMonth(dir: number) {
    // Free plan: can't go back more than 1 month
    if (plan === 'free' && dir === -1) {
      const minYear = now.getFullYear()
      const minMonth = now.getMonth() - 1
      const targetMonth = currentMonth - 1 < 0 ? 11 : currentMonth - 1
      const targetYear = currentMonth - 1 < 0 ? currentYear - 1 : currentYear
      if (targetYear < minYear || (targetYear === minYear && targetMonth < (minMonth < 0 ? 11 : minMonth))) return
    }
    let m = currentMonth + dir, y = currentYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setCurrentMonth(m); setCurrentYear(y)
  }

  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('es-AR', {maximumFractionDigits:0})

  // Free plan: only show current month + previous month
  const visibleTransactions = plan === 'free'
    ? transactions.filter(t => {
        const [y, m] = t.date.split('-').map(Number)
        const txDate = new Date(y, m-1, 1)
        const limit = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        return txDate >= limit
      })
    : transactions

  const carryOver = visibleTransactions.filter(t => {
    const [y, m] = t.date.split('-').map(Number)
    return new Date(y, m-1, 1) < new Date(currentYear, currentMonth, 1)
  }).reduce((acc, t) => acc + (t.type === 'income' ? t.amount : t.type === 'expense' ? -t.amount : t.type === 'investment' ? -t.amount : 0), 0)

  const monthTx = visibleTransactions.filter(t => {
    const [y, m] = t.date.split('-').map(Number)
    return y === currentYear && m-1 === currentMonth
  })

  const totalIn = monthTx.filter(t => t.type === 'income').reduce((a,b) => a+b.amount, 0)
  const totalOut = monthTx.filter(t => t.type === 'expense').reduce((a,b) => a+b.amount, 0)
  const totalInvested = monthTx.filter(t => t.type === 'investment').reduce((a,b) => a+b.amount, 0)
  const balance = carryOver + totalIn - totalOut - totalInvested
  const saved = totalIn - totalOut
  const savedPct = totalIn > 0 ? Math.max(0, Math.min(100, (saved/totalIn)*100)) : 0

  const expenseMap: any = {}
  monthTx.filter(t => t.type === 'expense').forEach(t => {
    const cat = t.category.split(' ').slice(1).join(' ') || t.category
    expenseMap[cat] = (expenseMap[cat] || 0) + t.amount
  })
  const cats = Object.keys(expenseMap)
  const vals = cats.map(c => expenseMap[c])
  const total = vals.reduce((a,b) => a+b, 0)

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <TouchableOpacity onPress={() => changeMonth(-1)}><Text style={s.arrow}>‹</Text></TouchableOpacity>
          <Text style={s.monthTitle}>{MONTHS[currentMonth]} {currentYear}</Text>
          <TouchableOpacity onPress={() => changeMonth(1)}><Text style={s.arrow}>›</Text></TouchableOpacity>
        </View>
        <AccountSelector />
      </View>

      {plan === 'free' && (
        <View style={s.freeBanner}>
          <Text style={s.freeBannerText}>Plan Gratuito — historial limitado a 1 mes</Text>
          <TouchableOpacity><Text style={s.freeBannerUpgrade}>Mejorar</Text></TouchableOpacity>
        </View>
      )}

      {!currentAccount ? (
        <View style={s.noAccount}>
          <Text style={s.noAccountText}>Creá una cuenta para empezar</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={s.balanceCard}>
            <Text style={s.balanceLabel}>SALDO DEL MES</Text>
            <Text style={[s.balanceAmount, balance < 0 && {color:'#ff4d6a'}]}>{fmt(balance)}</Text>
            <View style={s.balanceRow}>
              <View style={s.balanceMini}>
                <View style={[s.dot, {backgroundColor:'#5b9cf6'}]} />
                <Text style={s.balanceMiniText}>{(carryOver >= 0 ? '' : '-') + fmt(carryOver)} arrastrado</Text>
              </View>
              <View style={s.balanceMini}>
                <View style={[s.dot, {backgroundColor:'#3bf5a0'}]} />
                <Text style={s.balanceMiniText}>{fmt(totalIn)} entrada</Text>
              </View>
              <View style={s.balanceMini}>
                <View style={[s.dot, {backgroundColor:'#ff4d6a'}]} />
                <Text style={s.balanceMiniText}>{fmt(totalOut)} gastos</Text>
              </View>
              {totalInvested > 0 && (
                <View style={s.investedPill}>
                  <Text style={s.investedPillText}>{fmt(totalInvested)} invertido</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.savingsCard}>
            <View style={s.savingsTop}>
              <View>
                <Text style={s.savingsLabel}>AHORRO DEL MES</Text>
                <Text style={[s.savingsAmount, saved < 0 && {color:'#ff4d6a'}]}>
                  {saved >= 0 ? '+' : '-'}{fmt(saved)}
                </Text>
              </View>
              <View style={s.savingsPct}>
                <Text style={s.savingsPctText}>{savedPct.toFixed(0)}%</Text>
              </View>
            </View>
            <View style={s.barWrap}>
              <View style={[s.bar, {width: `${savedPct}%`}]} />
            </View>
          </View>

          <View style={s.chartCard}>
            <Text style={s.chartTitle}>DISTRIBUCIÓN DE GASTOS</Text>
            {cats.length === 0
              ? <Text style={s.empty}>Agregá gastos para ver el gráfico</Text>
              : <View style={s.chartWrap}>
                  <DonutChart vals={vals} cats={cats} total={total} />
                  <View style={s.legend}>
                    {cats.map((cat, i) => (
                      <View key={cat} style={s.legendItem}>
                        <View style={[s.legendDot, {backgroundColor: COLORS[i % COLORS.length]}]} />
                        <Text style={s.legendName}>{cat}</Text>
                        <Text style={s.legendPct}>{Math.round(vals[i]/total*100)}%</Text>
                      </View>
                    ))}
                  </View>
                </View>
            }
          </View>

          <View style={s.section}>
            <Text style={s.sectionTitle}>ÚLTIMOS MOVIMIENTOS</Text>
            {monthTx.length === 0
              ? <Text style={s.empty}>Sin movimientos este mes</Text>
              : [...monthTx].reverse().slice(0,5).map(t => (
                <View key={t.id} style={s.item}>
                  <Text style={s.itemEmoji}>{t.category.split(' ')[0]}</Text>
                  <View style={s.itemInfo}>
                    <Text style={s.itemName}>{t.name}</Text>
                    <Text style={s.itemSub}>{t.date}</Text>
                  </View>
                  <Text style={[s.itemAmount, t.type === 'income' ? {color:'#3bf5a0'} : t.type === 'investment' ? {color:'#00c2b8'} : {color:'#ff4d6a'}]}>
                    {t.type === 'income' ? '+' : t.type === 'investment' ? '▲' : '-'}{fmt(t.amount)}
                  </Text>
                </View>
              ))
            }
          </View>

          {/* Advanced charts button */}
          <TouchableOpacity style={s.chartsBtn} onPress={() => router.push('/graficos')}>
            <Text style={s.chartsBtnIcon}>📊</Text>
            <View style={s.chartsBtnText}>
              <Text style={s.chartsBtnTitle}>Ver gráficos avanzados</Text>
              <Text style={s.chartsBtnSub}>Evolución, categorías, comparativas y más</Text>
            </View>
            {plan !== 'pro' && <View style={s.proBadge}><Text style={s.proBadgeText}>PRO</Text></View>}
            <Text style={s.chartsBtnArrow}>›</Text>
          </TouchableOpacity>

          <View style={{height:24}}/>
        </ScrollView>
      )}
      <AdBanner />
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0d0d0f' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, paddingTop:60 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:4 },
  arrow: { color:'#f0f0f0', fontSize:28, paddingHorizontal:6 },
  monthTitle: { color:'#f0f0f0', fontSize:18, fontWeight:'800' },
  freeBanner: { flexDirection:'row', alignItems:'center', justifyContent:'space-between', backgroundColor:'#1a1a0a', borderBottomWidth:1, borderBottomColor:'#3a3a18', paddingHorizontal:16, paddingVertical:8 },
  freeBannerText: { color:'#aaa', fontSize:11 },
  freeBannerUpgrade: { color:'#c8f135', fontSize:11, fontWeight:'700' },
  noAccount: { flex:1, alignItems:'center', justifyContent:'center' },
  noAccountText: { color:'#555', fontSize:14 },
  balanceCard: { margin:16, marginTop:8, backgroundColor:'#1a2810', borderWidth:1, borderColor:'#3a5a18', borderRadius:16, padding:20 },
  balanceLabel: { color:'rgba(200,241,53,0.5)', fontSize:10, fontWeight:'700', letterSpacing:2, marginBottom:6 },
  balanceAmount: { color:'#c8f135', fontSize:40, fontWeight:'800', letterSpacing:-2, marginBottom:14 },
  balanceRow: { flexDirection:'row', flexWrap:'wrap', gap:10 },
  balanceMini: { flexDirection:'row', alignItems:'center', gap:5 },
  dot: { width:7, height:7, borderRadius:99 },
  balanceMiniText: { color:'#888', fontSize:11 },
  savingsCard: { marginHorizontal:16, marginBottom:12, backgroundColor:'#0d1a2a', borderWidth:1, borderColor:'#1a3a5a', borderRadius:16, padding:18 },
  savingsTop: { flexDirection:'row', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 },
  savingsLabel: { color:'rgba(91,156,246,0.6)', fontSize:10, fontWeight:'700', letterSpacing:2, marginBottom:4 },
  savingsAmount: { color:'#5b9cf6', fontSize:26, fontWeight:'800', letterSpacing:-1 },
  savingsPct: { backgroundColor:'rgba(91,156,246,0.15)', borderWidth:1, borderColor:'rgba(91,156,246,0.3)', borderRadius:20, paddingHorizontal:10, paddingVertical:4 },
  savingsPctText: { color:'#5b9cf6', fontSize:12, fontWeight:'700' },
  barWrap: { backgroundColor:'rgba(255,255,255,0.06)', borderRadius:99, height:5, overflow:'hidden' },
  bar: { height:'100%', borderRadius:99, backgroundColor:'#5b9cf6' },
  chartCard: { marginHorizontal:16, marginBottom:12, backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:16, padding:16 },
  chartTitle: { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:14 },
  chartWrap: { flexDirection:'row', alignItems:'center', gap:16 },
  legend: { flex:1, gap:6 },
  legendItem: { flexDirection:'row', alignItems:'center', gap:6 },
  legendDot: { width:8, height:8, borderRadius:3 },
  legendName: { flex:1, color:'#f0f0f0', fontSize:11, fontWeight:'600' },
  legendPct: { color:'#555', fontSize:10 },
  section: { marginHorizontal:16, marginBottom:20 },
  sectionTitle: { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:10 },
  item: { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:12, flexDirection:'row', alignItems:'center', marginBottom:8 },
  itemEmoji: { fontSize:18, width:32, textAlign:'center' },
  itemInfo: { flex:1, marginLeft:8 },
  itemName: { color:'#f0f0f0', fontWeight:'700', fontSize:13 },
  itemSub: { color:'#555', fontSize:10, marginTop:2 },
  itemAmount: { fontWeight:'700', fontSize:13 },
  empty: { color:'#333', fontSize:12, textAlign:'center', padding:20 },
  investedPill: { backgroundColor:'rgba(0,194,184,0.15)', borderWidth:1, borderColor:'rgba(0,194,184,0.4)', borderRadius:99, paddingHorizontal:8, paddingVertical:2 },
  investedPillText: { color:'#00c2b8', fontSize:11, fontWeight:'700' },
  chartsBtn: { marginHorizontal:16, marginBottom:8, backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:14, padding:14, flexDirection:'row', alignItems:'center', gap:12 },
  chartsBtnIcon: { fontSize:24 },
  chartsBtnText: { flex:1 },
  chartsBtnTitle: { color:'#f0f0f0', fontSize:14, fontWeight:'700' },
  chartsBtnSub: { color:'#555', fontSize:11, marginTop:2 },
  chartsBtnArrow: { color:'#555', fontSize:22 },
  proBadge: { backgroundColor:'rgba(200,241,53,0.12)', borderWidth:1, borderColor:'rgba(200,241,53,0.3)', borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  proBadgeText: { color:'#c8f135', fontSize:9, fontWeight:'800', letterSpacing:1 },
})
