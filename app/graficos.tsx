import { router, useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg'
import { useAccount } from '../context/AccountContext'
import { supabase } from '../supabase'

const { width: SW } = Dimensions.get('window')
const CW = SW - 64 // chart inner width (card has 16px padding + 16px margin each side)

const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTHS_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CAT_COLORS   = ['#c8f135','#3bf5a0','#f5a623','#ff6b9d','#00c2b8']

type MonthData = { label: string; month: number; year: number; income: number; expense: number; savings: number; rate: number }
type CatData   = { label: string; amount: number; pct: number }
type Tip       = { title: string; value: string } | null

// ─── SVG Line Chart (multi-series) ───────────────────────────────────────────
function SvgLineChart({ series, labels, height = 180 }: {
  series: { data: number[]; color: string; label: string }[]
  labels: string[]
  height?: number
}) {
  const [tip, setTip] = useState<{x:number;y:number;label:string;value:string}|null>(null)
  const PAD = { top: 12, right: 16, bottom: 28, left: 44 }
  const W = CW
  const H = height
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const n = labels.length

  const allVals = series.flatMap(s => s.data)
  const maxVal = Math.max(...allVals, 1)

  const xPos = (i: number) => PAD.left + (i / (n - 1)) * innerW
  const yPos = (v: number) => PAD.top + innerH - (v / maxVal) * innerH

  const fmtK = (v: number) => v >= 1000000 ? `${(v/1000000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}k` : `${v.toFixed(0)}`
  const fmt  = (v: number) => '$' + Math.abs(v).toLocaleString('es-AR',{maximumFractionDigits:0})

  // Y-axis ticks
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: maxVal * t, y: yPos(maxVal * t) }))

  return (
    <View>
      <Svg width={W} height={H}>
        {/* Grid lines */}
        {ticks.map((t, i) => (
          <Line key={i} x1={PAD.left} y1={t.y} x2={W - PAD.right} y2={t.y} stroke="#2a2a30" strokeWidth="1" />
        ))}
        {/* Y-axis labels */}
        {ticks.map((t, i) => (
          <SvgText key={i} x={PAD.left - 4} y={t.y + 4} textAnchor="end" fontSize="9" fill="#555">${fmtK(t.val)}</SvgText>
        ))}
        {/* X-axis labels */}
        {labels.map((l, i) => (
          <SvgText key={i} x={xPos(i)} y={H - 6} textAnchor="middle" fontSize="10" fill="#666">{l}</SvgText>
        ))}
        {/* Lines and dots */}
        {series.map((s, si) => {
          const points = s.data.map((v, i) => ({ x: xPos(i), y: yPos(v), v }))
          // Build smooth path using bezier curves
          let d = `M ${points[0].x} ${points[0].y}`
          for (let i = 1; i < points.length; i++) {
            const prev = points[i-1]
            const curr = points[i]
            const cpX = (prev.x + curr.x) / 2
            d += ` C ${cpX} ${prev.y} ${cpX} ${curr.y} ${curr.x} ${curr.y}`
          }
          return (
            <Path key={si} d={d} stroke={s.color} strokeWidth="2.5" fill="none" />
          )
        })}
        {/* Interactive dots */}
        {series.map((s, si) =>
          s.data.map((v, i) => (
            <Circle
              key={`${si}-${i}`}
              cx={xPos(i)} cy={yPos(v)} r={6}
              fill="#141416" stroke={s.color} strokeWidth="2.5"
              onPress={() => setTip({ x: xPos(i), y: yPos(v), label: `${s.label} — ${labels[i]}`, value: fmt(v) })}
            />
          ))
        )}
        {/* Tooltip dot highlight */}
        {tip && <Circle cx={tip.x} cy={tip.y} r={9} fill="none" stroke="#c8f135" strokeWidth="1.5" />}
      </Svg>
      {tip && (
        <TouchableOpacity style={s.tip} onPress={() => setTip(null)}>
          <Text style={s.tipLabel}>{tip.label}</Text>
          <Text style={s.tipVal}>{tip.value}</Text>
          <Text style={s.tipClose}>Cerrar ×</Text>
        </TouchableOpacity>
      )}
    </View>
  )
}

// ─── SVG Bar Chart (horizontal) ──────────────────────────────────────────────
function HorizBars({ items }: { items: CatData[] }) {
  const [tip, setTip] = useState<Tip>(null)
  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('es-AR',{maximumFractionDigits:0})

  return (
    <>
      {items.map((item, i) => (
        <TouchableOpacity key={item.label} style={s.catRow}
          onPress={() => setTip({ title: item.label, value: `${fmt(item.amount)}  ·  ${item.pct.toFixed(1)}%` })}>
          <View style={s.catMeta}>
            <Text style={s.catEmoji}>{item.label.split(' ')[0]}</Text>
            <Text style={s.catName} numberOfLines={1}>{item.label.split(' ').slice(1).join(' ')}</Text>
            <Text style={[s.catAmt, { color: CAT_COLORS[i] }]}>{fmt(item.amount)}</Text>
          </View>
          <View style={s.catBarBg}>
            <View style={[s.catBarFill, { width: `${item.pct}%`, backgroundColor: CAT_COLORS[i] }]} />
          </View>
        </TouchableOpacity>
      ))}
      {tip && (
        <TouchableOpacity style={s.tip} onPress={() => setTip(null)}>
          <Text style={s.tipLabel}>{tip.title}</Text>
          <Text style={s.tipVal}>{tip.value}</Text>
          <Text style={s.tipClose}>Cerrar ×</Text>
        </TouchableOpacity>
      )}
    </>
  )
}

// ─── Month comparison ─────────────────────────────────────────────────────────
function MonthComparison({ cur, prev }: { cur: MonthData; prev: MonthData }) {
  const fmtK = (n: number) => {
    const a = Math.abs(n)
    return a >= 1000000 ? `$${(a/1000000).toFixed(1)}M` : a >= 1000 ? `$${(a/1000).toFixed(0)}k` : `$${a.toFixed(0)}`
  }
  const rows = [
    { label:'Ingresos', color:'#3bf5a0', cur: cur.income,  prev: prev.income,  higherIsGood: true  },
    { label:'Gastos',   color:'#ff4d6a', cur: cur.expense, prev: prev.expense, higherIsGood: false },
    { label:'Ahorro',   color:'#5b9cf6', cur: cur.savings, prev: prev.savings, higherIsGood: true  },
  ]
  return (
    <>
      <View style={s.compHead}>
        <View style={{ width: 90 }} />
        <Text style={[s.compHeadLabel, { color:'#555' }]}>{prev.label}</Text>
        <Text style={[s.compHeadLabel, { color:'#f0f0f0' }]}>{cur.label}</Text>
        <Text style={s.compHeadLabel}>Δ</Text>
      </View>
      {rows.map(r => {
        const delta  = r.cur - r.prev
        const isGood = delta === 0 ? null : (r.higherIsGood ? delta > 0 : delta < 0)
        const dColor = delta === 0 ? '#555' : isGood ? '#3bf5a0' : '#ff4d6a'
        const maxV   = Math.max(r.cur, r.prev, 1)
        return (
          <View key={r.label} style={s.compRow}>
            <View style={s.compLabelCol}>
              <View style={[s.compDot, { backgroundColor: r.color }]} />
              <Text style={s.compLabel}>{r.label}</Text>
            </View>
            <View style={s.compBarCol}>
              <View style={s.compBarBg}>
                <View style={[s.compBarFill, { width: `${(r.prev/maxV)*100}%`, backgroundColor:'#333' }]} />
              </View>
              <Text style={s.compBarVal}>{fmtK(r.prev)}</Text>
            </View>
            <View style={s.compBarCol}>
              <View style={s.compBarBg}>
                <View style={[s.compBarFill, { width: `${(r.cur/maxV)*100}%`, backgroundColor: r.color }]} />
              </View>
              <Text style={[s.compBarVal, { color: r.color }]}>{fmtK(r.cur)}</Text>
            </View>
            <Text style={[s.compDelta, { color: dColor }]}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '–'}{delta !== 0 ? fmtK(Math.abs(delta)) : ''}
            </Text>
          </View>
        )
      })}
    </>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function Graficos() {
  const { currentAccount, plan } = useAccount()
  const [loading, setLoading]   = useState(true)
  const [months, setMonths]     = useState<MonthData[]>([])
  const [cats, setCats]         = useState<CatData[]>([])

  useFocusEffect(useCallback(() => { load() }, [currentAccount]))
  useEffect(() => { load() }, [currentAccount])

  async function load() {
    if (!currentAccount) { setLoading(false); return }
    setLoading(true)
    const now   = new Date()
    const start = new Date(now.getFullYear(), now.getMonth() - 5, 1)
    const s0    = `${start.getFullYear()}-${String(start.getMonth()+1).padStart(2,'0')}-01`
    const { data } = await supabase.from('transactions').select('*')
      .eq('account_id', currentAccount.id).gte('date', s0).order('date', { ascending: true })
    const txs = data || []

    const result: MonthData[] = []
    for (let i = 5; i >= 0; i--) {
      const d  = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const y  = d.getFullYear(), m = d.getMonth()
      const mt = txs.filter(t => { const [ty,tm]=t.date.split('-').map(Number); return ty===y&&tm-1===m })
      const income  = mt.filter(t=>t.type==='income').reduce((a,b)=>a+b.amount,0)
      const expense = mt.filter(t=>t.type==='expense').reduce((a,b)=>a+b.amount,0)
      const savings = income - expense
      const rate    = income > 0 ? Math.max(0, Math.min(100, (savings/income)*100)) : 0
      result.push({ label: MONTHS_SHORT[m], month: m, year: y, income, expense, savings, rate })
    }
    setMonths(result)

    const curTxs  = txs.filter(t => { const [ty,tm]=t.date.split('-').map(Number); return ty===now.getFullYear()&&tm-1===now.getMonth() })
    const catMap: Record<string,number> = {}
    curTxs.filter(t=>t.type==='expense').forEach(t => { catMap[t.category]=(catMap[t.category]||0)+t.amount })
    const total = Object.values(catMap).reduce((a,b)=>a+b,0)
    setCats(Object.entries(catMap).sort((a,b)=>b[1]-a[1]).slice(0,5)
      .map(([label,amount])=>({ label, amount, pct: total>0?(amount/total)*100:0 })))
    setLoading(false)
  }

  const hasData = months.some(m=>m.income>0||m.expense>0)
  const cur     = months[months.length-1]
  const prev    = months[months.length-2]
  const now     = new Date()

  if (loading) return <View style={[s.container,s.center]}><ActivityIndicator color="#c8f135" size="large" /></View>

  // FREE: blurred preview
  if (plan !== 'pro') {
    return (
      <View style={s.container}>
        <Header />
        <View style={{ flex:1 }}>
          <View style={{ opacity: 0.1, margin:16 }} pointerEvents="none">
            <View style={s.card}>
              <Text style={s.cardTitle}>EVOLUCIÓN MENSUAL</Text>
              {hasData && (
                <SvgLineChart
                  labels={months.map(m=>m.label)}
                  series={[
                    { data: months.map(m=>m.income),  color:'#3bf5a0', label:'Ingresos' },
                    { data: months.map(m=>m.expense), color:'#ff4d6a', label:'Gastos'   },
                  ]}
                />
              )}
            </View>
          </View>
          <View style={s.upgradeOverlay}>
            <Text style={s.upgradeIcon}>📊</Text>
            <Text style={s.upgradeTitle}>Gráficos Avanzados</Text>
            <Text style={s.upgradeDesc}>Evolución mensual, desglose por categoría,{'\n'}comparativa mensual y tasa de ahorro.</Text>
            <View style={s.featureList}>
              {['📈 Evolución 6 meses','🍰 Top 5 categorías','⚖️ Comparativa mensual','💹 Tasa de ahorro'].map(f=>(
                <Text key={f} style={s.featureItem}>{f}</Text>
              ))}
            </View>
            <TouchableOpacity style={s.upgradeBtn} onPress={()=>Alert.alert('Próximamente','El upgrade a Pro estará disponible pronto.')}>
              <Text style={s.upgradeBtnText}>⭐ Mejorar a Pro</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    )
  }

  // PRO: all charts
  return (
    <View style={s.container}>
      <Header />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* Chart 1 — Monthly evolution */}
        <View style={s.card}>
          <Text style={s.cardTitle}>EVOLUCIÓN MENSUAL</Text>
          <View style={s.legendRow}>
            {[['#3bf5a0','Ingresos'],['#ff4d6a','Gastos'],['#5b9cf6','Ahorro']].map(([c,l])=>(
              <View key={l} style={s.legendItem}>
                <View style={[s.legendDot,{backgroundColor:c as string}]}/>
                <Text style={s.legendLabel}>{l}</Text>
              </View>
            ))}
          </View>
          {hasData
            ? <SvgLineChart
                labels={months.map(m=>m.label)}
                series={[
                  { data: months.map(m=>m.income),  color:'#3bf5a0', label:'Ingresos' },
                  { data: months.map(m=>m.expense), color:'#ff4d6a', label:'Gastos'   },
                  { data: months.map(m=>Math.max(0,m.savings)), color:'#5b9cf6', label:'Ahorro' },
                ]}
              />
            : <Text style={s.empty}>Sin datos aún</Text>
          }
        </View>

        {/* Chart 2 — Top categories */}
        <View style={s.card}>
          <Text style={s.cardTitle}>TOP GASTOS — {MONTHS_FULL[cur?.month ?? now.getMonth()].toUpperCase()}</Text>
          {cats.length === 0
            ? <Text style={s.empty}>Sin gastos este mes</Text>
            : <HorizBars items={cats} />
          }
        </View>

        {/* Chart 3 — Month comparison */}
        {cur && prev && (
          <View style={s.card}>
            <Text style={s.cardTitle}>ESTE MES VS MES ANTERIOR</Text>
            <MonthComparison cur={cur} prev={prev} />
          </View>
        )}

        {/* Chart 4 — Savings rate trend */}
        <View style={s.card}>
          <Text style={s.cardTitle}>TASA DE AHORRO — ÚLTIMOS 6 MESES</Text>
          {hasData ? (
            <>
              <SvgLineChart
                labels={months.map(m=>m.label)}
                series={[{ data: months.map(m=>Math.round(m.rate)), color:'#5b9cf6', label:'Ahorro %' }]}
                height={140}
              />
              <View style={s.rateRow}>
                {[
                  { label:'PROMEDIO', value:`${(months.reduce((a,m)=>a+m.rate,0)/months.length).toFixed(1)}%`, color:'#f0f0f0' },
                  { label:'MÁXIMO',   value:`${Math.max(...months.map(m=>m.rate)).toFixed(1)}%`, color:'#3bf5a0' },
                  { label:'ESTE MES', value:`${(cur?.rate??0).toFixed(1)}%`, color:'#5b9cf6' },
                ].map(st=>(
                  <View key={st.label} style={s.rateStat}>
                    <Text style={s.rateStatLabel}>{st.label}</Text>
                    <Text style={[s.rateStatVal,{color:st.color}]}>{st.value}</Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={s.empty}>Sin datos aún</Text>
          )}
        </View>

        <View style={{height:32}}/>
      </ScrollView>
    </View>
  )
}

function Header() {
  return (
    <View style={s.header}>
      <TouchableOpacity onPress={()=>router.back()} style={s.backBtn}>
        <Text style={s.backBtnText}>‹ Volver</Text>
      </TouchableOpacity>
      <Text style={s.headerTitle}>Gráficos avanzados</Text>
      <View style={{width:70}}/>
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex:1, backgroundColor:'#0d0d0f' },
  center:      { justifyContent:'center', alignItems:'center' },
  header:      { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, paddingTop:60 },
  headerTitle: { color:'#f0f0f0', fontSize:18, fontWeight:'800' },
  backBtn:     { width:70 },
  backBtnText: { color:'#c8f135', fontSize:16, fontWeight:'700' },
  scroll:      { paddingHorizontal:16, paddingTop:4 },
  card:        { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:16, padding:16, marginBottom:16 },
  cardTitle:   { color:'#555', fontSize:10, fontWeight:'700', letterSpacing:1.5, marginBottom:12 },
  empty:       { color:'#333', fontSize:12, textAlign:'center', padding:24 },
  legendRow:   { flexDirection:'row', gap:14, marginBottom:8 },
  legendItem:  { flexDirection:'row', alignItems:'center', gap:5 },
  legendDot:   { width:8, height:8, borderRadius:4 },
  legendLabel: { color:'#888', fontSize:11 },
  // Tooltip
  tip:         { marginTop:10, backgroundColor:'#1a1a1e', borderWidth:1, borderColor:'#c8f135', borderRadius:10, padding:12, alignItems:'center' },
  tipLabel:    { color:'#888', fontSize:11, marginBottom:2 },
  tipVal:      { color:'#c8f135', fontSize:20, fontWeight:'800' },
  tipClose:    { color:'#555', fontSize:11, marginTop:6 },
  // Category bars
  catRow:      { marginBottom:12 },
  catMeta:     { flexDirection:'row', alignItems:'center', gap:6, marginBottom:5 },
  catEmoji:    { fontSize:16, width:26 },
  catName:     { flex:1, color:'#f0f0f0', fontSize:13, fontWeight:'600' },
  catAmt:      { fontSize:13, fontWeight:'800' },
  catBarBg:    { backgroundColor:'rgba(255,255,255,0.06)', borderRadius:99, height:7, overflow:'hidden' },
  catBarFill:  { height:'100%', borderRadius:99 },
  // Comparison
  compHead:      { flexDirection:'row', alignItems:'center', marginBottom:10 },
  compHeadLabel: { flex:1, fontSize:10, fontWeight:'700', textAlign:'center', color:'#555' },
  compRow:       { flexDirection:'row', alignItems:'center', marginBottom:12 },
  compLabelCol:  { width:90, flexDirection:'row', alignItems:'center', gap:5 },
  compDot:       { width:7, height:7, borderRadius:4 },
  compLabel:     { color:'#f0f0f0', fontSize:11, fontWeight:'600' },
  compBarCol:    { flex:1, alignItems:'center', gap:3 },
  compBarBg:     { width:'90%', backgroundColor:'rgba(255,255,255,0.06)', borderRadius:99, height:6, overflow:'hidden' },
  compBarFill:   { height:'100%', borderRadius:99 },
  compBarVal:    { color:'#888', fontSize:10 },
  compDelta:     { width:56, fontSize:10, fontWeight:'700', textAlign:'right' },
  // Rate stats
  rateRow:       { flexDirection:'row', marginTop:12, paddingTop:12, borderTopWidth:1, borderTopColor:'#2a2a30' },
  rateStat:      { flex:1, alignItems:'center' },
  rateStatLabel: { color:'#555', fontSize:9, fontWeight:'700', letterSpacing:1.5, marginBottom:4 },
  rateStatVal:   { fontSize:18, fontWeight:'800' },
  // Free upgrade overlay
  upgradeOverlay: { position:'absolute', top:0, left:0, right:0, bottom:0, alignItems:'center', justifyContent:'center', padding:32 },
  upgradeIcon:    { fontSize:48, marginBottom:12 },
  upgradeTitle:   { color:'#f0f0f0', fontSize:22, fontWeight:'800', marginBottom:8, textAlign:'center' },
  upgradeDesc:    { color:'#666', fontSize:13, textAlign:'center', lineHeight:20, marginBottom:16 },
  featureList:    { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:14, marginBottom:20, width:'100%' },
  featureItem:    { color:'#888', fontSize:13, paddingVertical:3 },
  upgradeBtn:     { backgroundColor:'#c8f135', borderRadius:12, paddingHorizontal:28, paddingVertical:14 },
  upgradeBtnText: { color:'#0d0d0f', fontWeight:'800', fontSize:15 },
})
