import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'
import AccountSelector from '../../components/AccountSelector'
import { useAccount } from '../../context/AccountContext'
import { supabase } from '../../supabase'

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb']

export default function Calendario() {
  const { currentAccount } = useAccount()
  const [transactions, setTransactions] = useState<any[]>([])
  const [selectedDay, setSelectedDay] = useState<number|null>(null)
  const now = new Date()
  const [currentMonth, setCurrentMonth] = useState(now.getMonth())
  const [currentYear, setCurrentYear] = useState(now.getFullYear())

  useEffect(() => { fetchTransactions() }, [currentMonth, currentYear, currentAccount])
  useFocusEffect(useCallback(() => { fetchTransactions() }, [currentMonth, currentYear, currentAccount]))

  async function fetchTransactions() {
    if (!currentAccount) { setTransactions([]); return }
    const start = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-01`
    const end = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}-31`
    const { data } = await supabase.from('transactions').select('*')
      .eq('account_id', currentAccount.id)
      .gte('date', start).lte('date', end)
    setTransactions(data || [])
    setSelectedDay(null)
  }

  function changeMonth(dir: number) {
    let m = currentMonth + dir, y = currentYear
    if (m > 11) { m = 0; y++ } else if (m < 0) { m = 11; y-- }
    setCurrentMonth(m); setCurrentYear(y)
  }

  const fmt = (n: number) => '$' + Math.abs(n).toLocaleString('es-AR', {maximumFractionDigits:0})

  const daysWithData = new Set(transactions.map(t => parseInt(t.date.split('-')[2])))
  const firstDay = new Date(currentYear, currentMonth, 1).getDay()
  const daysInMonth = new Date(currentYear, currentMonth+1, 0).getDate()
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth

  const dayTransactions = selectedDay
    ? transactions.filter(t => parseInt(t.date.split('-')[2]) === selectedDay)
    : []

  const dayIncome = dayTransactions.filter(t => t.type === 'income').reduce((a,b) => a+b.amount, 0)
  const dayExpense = dayTransactions.filter(t => t.type === 'expense').reduce((a,b) => a+b.amount, 0)

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

      {!currentAccount ? (
        <View style={s.noAccount}>
          <Text style={s.noAccountText}>Seleccioná una cuenta para ver el calendario</Text>
        </View>
      ) : (
        <>
          <View style={s.calCard}>
            <View style={s.dayNames}>
              {DAYS.map(d => <Text key={d} style={s.dayName}>{d}</Text>)}
            </View>
            <View style={s.grid}>
              {Array(firstDay).fill(null).map((_, i) => <View key={`e${i}`} style={s.dayCell} />)}
              {Array(daysInMonth).fill(null).map((_, i) => {
                const day = i + 1
                const isToday = isCurrentMonth && today.getDate() === day
                const hasData = daysWithData.has(day)
                const isSelected = selectedDay === day
                return (
                  <TouchableOpacity
                    key={day}
                    style={[s.dayCell, isToday && s.today, isSelected && s.selected]}
                    onPress={() => setSelectedDay(isSelected ? null : day)}
                  >
                    <Text style={[s.dayNum, isToday && s.todayText, isSelected && s.selectedText]}>{day}</Text>
                    {hasData && <View style={[s.dot, isSelected && {backgroundColor:'#0d0d0f'}]} />}
                  </TouchableOpacity>
                )
              })}
            </View>
          </View>

          {selectedDay && (
            <ScrollView style={s.detail} showsVerticalScrollIndicator={false}>
              <View style={s.detailHeader}>
                <Text style={s.detailTitle}>{selectedDay} de {MONTHS[currentMonth]}</Text>
                <View style={s.detailTotals}>
                  {dayIncome > 0 && <Text style={s.detailIn}>+{fmt(dayIncome)}</Text>}
                  {dayExpense > 0 && <Text style={s.detailOut}>-{fmt(dayExpense)}</Text>}
                </View>
              </View>
              {dayTransactions.length === 0
                ? <Text style={s.empty}>Sin movimientos este día</Text>
                : dayTransactions.map(t => (
                  <View key={t.id} style={s.item}>
                    <Text style={s.itemEmoji}>{t.category.split(' ')[0]}</Text>
                    <View style={s.itemInfo}>
                      <Text style={s.itemName}>{t.name}</Text>
                      <Text style={s.itemSub}>{t.category.split(' ').slice(1).join(' ')}</Text>
                    </View>
                    <Text style={[s.itemAmount, t.type === 'income' ? {color:'#3bf5a0'} : {color:'#ff4d6a'}]}>
                      {t.type === 'income' ? '+' : '-'}{fmt(t.amount)}
                    </Text>
                  </View>
                ))
              }
            </ScrollView>
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex:1, backgroundColor:'#0d0d0f' },
  header: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', padding:20, paddingTop:60 },
  headerLeft: { flexDirection:'row', alignItems:'center', gap:4 },
  arrow: { color:'#f0f0f0', fontSize:28, paddingHorizontal:6 },
  monthTitle: { color:'#f0f0f0', fontSize:18, fontWeight:'800' },
  noAccount: { flex:1, alignItems:'center', justifyContent:'center' },
  noAccountText: { color:'#555', fontSize:14 },
  calCard: { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:16, margin:16, padding:12 },
  dayNames: { flexDirection:'row', marginBottom:8 },
  dayName: { flex:1, textAlign:'center', color:'#555', fontSize:10, fontWeight:'700' },
  grid: { flexDirection:'row', flexWrap:'wrap' },
  dayCell: { width:'14.28%', height:44, alignItems:'center', justifyContent:'center', borderRadius:8, position:'relative' },
  today: { backgroundColor:'rgba(200,241,53,0.12)' },
  selected: { backgroundColor:'#c8f135' },
  dayNum: { color:'#f0f0f0', fontSize:13, fontWeight:'600' },
  todayText: { color:'#c8f135' },
  selectedText: { color:'#0d0d0f', fontWeight:'800' },
  dot: { position:'absolute', bottom:3, width:4, height:4, borderRadius:2, backgroundColor:'#c8f135' },
  detail: { flex:1, padding:16 },
  detailHeader: { flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom:12 },
  detailTitle: { color:'#f0f0f0', fontSize:16, fontWeight:'800' },
  detailTotals: { flexDirection:'row', gap:10 },
  detailIn: { color:'#3bf5a0', fontSize:14, fontWeight:'700' },
  detailOut: { color:'#ff4d6a', fontSize:14, fontWeight:'700' },
  empty: { color:'#333', fontSize:12, textAlign:'center', padding:20 },
  item: { backgroundColor:'#141416', borderWidth:1, borderColor:'#2a2a30', borderRadius:12, padding:12, flexDirection:'row', alignItems:'center', marginBottom:8 },
  itemEmoji: { fontSize:20, width:36, textAlign:'center' },
  itemInfo: { flex:1, marginLeft:8 },
  itemName: { color:'#f0f0f0', fontWeight:'700', fontSize:14 },
  itemSub: { color:'#555', fontSize:11, marginTop:2 },
  itemAmount: { fontWeight:'700', fontSize:14 },
})
