import { useState, useEffect, useMemo } from 'react'
import { Scale, TrendingDown, RotateCcw, LogOut, Loader2 } from 'lucide-react'
import { supabase, listAllLogs, listLogsRange, saveWeightForDate, resetAllData } from '../lib/supabase'
import { SETTINGS } from '../lib/settings'
import TrendChart from './TrendChart'

const formatDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const addDays = (d, n) => {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

const dayTotals = (data) =>
  (data?.entries || []).reduce(
    (acc, e) => {
      if (e.type === 'food') acc.kcal += e.total_kcal || 0
      if (e.type === 'exercise') acc.burned += e.total_kcal_burned || 0
      return acc
    },
    { kcal: 0, burned: 0 }
  )

export default function Progress({ user }) {
  const [allLogs, setAllLogs] = useState([])
  const [loadingAll, setLoadingAll] = useState(true)
  const [weightInput, setWeightInput] = useState('')
  const [savingWeight, setSavingWeight] = useState(false)

  const today = new Date()
  const [rangeStart, setRangeStart] = useState(formatDateKey(addDays(today, -29)))
  const [rangeEnd, setRangeEnd] = useState(formatDateKey(today))
  const [rangeLogs, setRangeLogs] = useState([])
  const [loadingRange, setLoadingRange] = useState(true)

  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    loadRange()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeStart, rangeEnd])

  const loadAll = async () => {
    setLoadingAll(true)
    const logs = await listAllLogs(user.id)
    setAllLogs(logs)
    setLoadingAll(false)
  }

  const loadRange = async () => {
    if (!rangeStart || !rangeEnd || rangeStart > rangeEnd) return
    setLoadingRange(true)
    const logs = await listLogsRange(user.id, rangeStart, rangeEnd)
    setRangeLogs(logs)
    setLoadingRange(false)
  }

  const weightSeries = useMemo(
    () =>
      allLogs
        .filter((l) => typeof l.data?.weight_kg === 'number')
        .map((l) => ({ label: l.date, value: l.data.weight_kg })),
    [allLogs]
  )

  const latestWeight = weightSeries.length ? weightSeries[weightSeries.length - 1].value : null
  const firstWeight = weightSeries.length ? weightSeries[0].value : null
  const weightDelta = latestWeight != null && firstWeight != null ? latestWeight - firstWeight : null

  const netSeries = useMemo(
    () =>
      rangeLogs.map((l) => {
        const t = dayTotals(l.data)
        const net = t.kcal - t.burned
        return { label: l.date, value: net, deficit: SETTINGS.target_kcal - net }
      }),
    [rangeLogs]
  )

  const totalDeficit = netSeries.reduce((s, d) => s + d.deficit, 0)
  const avgDeficit = netSeries.length ? totalDeficit / netSeries.length : 0

  const handleSaveWeight = async () => {
    const val = parseFloat(weightInput)
    if (!val || val <= 0) return
    setSavingWeight(true)
    try {
      const todayKey = formatDateKey(new Date())
      await saveWeightForDate(user.id, todayKey, val)
      setWeightInput('')
      await loadAll()
    } catch (e) {
      console.error(e)
    } finally {
      setSavingWeight(false)
    }
  }

  const handleReset = async () => {
    setResetting(true)
    try {
      await resetAllData(user.id)
      window.location.reload()
    } catch (e) {
      console.error(e)
      setResetting(false)
    }
  }

  const setQuickRange = (days) => {
    setRangeStart(formatDateKey(addDays(new Date(), -(days - 1))))
    setRangeEnd(formatDateKey(new Date()))
  }

  const logout = () => supabase.auth.signOut()

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-[#9B8D7E] mb-0.5">PROGRESS</div>
          <h1 className="display text-2xl font-medium">진행 상황</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="text-[#9B8D7E] hover:text-[#B85C38]"
            title="데이터 초기화"
          >
            <RotateCcw size={16} />
          </button>
          <button onClick={logout} className="text-[#9B8D7E] hover:text-[#1F1B16]" title="로그아웃">
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* Weight card */}
      <div className="bg-white rounded-3xl border border-[#E8DFD0] p-6 sm:p-8 shadow-[0_1px_2px_rgba(31,27,22,0.04)]">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#6B5D4F] mb-4">
          <Scale size={12} className="text-[#B85C38]" /> 체중
        </div>

        <div className="flex items-end justify-between mb-5">
          <div>
            <div className="display text-4xl font-medium tabular leading-none">
              {latestWeight != null ? latestWeight.toFixed(1) : '–'}
              <span className="text-lg text-[#9B8D7E] ml-1 font-light">kg</span>
            </div>
            {weightDelta != null && (
              <div className={`text-xs mt-1.5 ${weightDelta <= 0 ? 'text-[#5C7A4A]' : 'text-[#B85C38]'}`}>
                {weightDelta > 0 ? '+' : ''}
                {weightDelta.toFixed(1)}kg · 시작 대비
              </div>
            )}
          </div>
          <div className="text-right text-xs text-[#9B8D7E]">
            목표 <span className="tabular font-medium text-[#6B5D4F]">{SETTINGS.goal_kg}kg</span>
          </div>
        </div>

        <div className="mb-5">
          {loadingAll ? (
            <div className="flex items-center justify-center" style={{ height: 100 }}>
              <Loader2 size={16} className="animate-spin text-[#9B8D7E]" />
            </div>
          ) : (
            <TrendChart data={weightSeries} color="#B85C38" height={100} referenceValue={SETTINGS.goal_kg} />
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={weightInput}
            onChange={(e) => setWeightInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); handleSaveWeight() }
            }}
            placeholder="오늘 체중 (kg)"
            className="flex-1 px-4 py-2.5 bg-[#FAF5EC] border border-[#E8DFD0] rounded-xl outline-none focus:border-[#B85C38] transition-colors text-sm"
          />
          <button
            onClick={handleSaveWeight}
            disabled={savingWeight || !weightInput}
            className="px-4 py-2.5 rounded-xl bg-[#1F1B16] text-[#FAF5EC] text-sm font-medium disabled:opacity-40 flex-shrink-0"
          >
            {savingWeight ? <Loader2 size={14} className="animate-spin" /> : '기록'}
          </button>
        </div>
      </div>

      {/* Net deficit card */}
      <div className="bg-white rounded-3xl border border-[#E8DFD0] p-6 sm:p-8 shadow-[0_1px_2px_rgba(31,27,22,0.04)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[#6B5D4F]">
            <TrendingDown size={12} className="text-[#5C7A4A]" /> 순 적자
          </div>
          <div className="flex items-center gap-1">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setQuickRange(d)}
                className="px-2 py-1 rounded-full bg-[#F4ECDC] text-[#6B5D4F] hover:bg-[#E8DFD0] text-[10px]"
              >
                {d}일
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <input
            type="date"
            value={rangeStart}
            max={rangeEnd}
            onChange={(e) => setRangeStart(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#FAF5EC] border border-[#E8DFD0] rounded-xl outline-none focus:border-[#B85C38] text-xs tabular"
          />
          <span className="text-[#9B8D7E] text-xs">–</span>
          <input
            type="date"
            value={rangeEnd}
            min={rangeStart}
            max={formatDateKey(new Date())}
            onChange={(e) => setRangeEnd(e.target.value)}
            className="flex-1 px-3 py-2 bg-[#FAF5EC] border border-[#E8DFD0] rounded-xl outline-none focus:border-[#B85C38] text-xs tabular"
          />
        </div>

        <div className="flex items-baseline justify-between mb-5 pb-5 border-b border-[#F0E8D8]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-[#9B8D7E] mb-1">총 순 적자</div>
            <div
              className={`display text-4xl font-medium tabular leading-none ${
                totalDeficit >= 0 ? 'text-[#5C7A4A]' : 'text-[#B85C38]'
              }`}
            >
              {Math.round(totalDeficit)}
              <span className="text-lg text-[#9B8D7E] ml-1 font-light">kcal</span>
            </div>
          </div>
          <div className="text-right text-xs text-[#9B8D7E]">
            일평균 <span className="tabular font-medium text-[#6B5D4F]">{Math.round(avgDeficit)}</span>kcal ·{' '}
            {netSeries.length}일
          </div>
        </div>

        {loadingRange ? (
          <div className="flex items-center justify-center" style={{ height: 120 }}>
            <Loader2 size={16} className="animate-spin text-[#9B8D7E]" />
          </div>
        ) : (
          <TrendChart data={netSeries} color="#5C7A4A" height={120} referenceValue={SETTINGS.target_kcal} />
        )}
        <div className="text-[10px] text-[#9B8D7E] text-center mt-2">
          점선 = 목표 섭취 {SETTINGS.target_kcal}kcal · 실선 = 순 섭취 (섭취−소모)
        </div>
      </div>

      {showResetConfirm && (
        <div
          className="fixed inset-0 bg-[#1F1B16]/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => !resetting && setShowResetConfirm(false)}
        >
          <div className="bg-[#FAF5EC] rounded-3xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="display text-lg font-medium mb-2">데이터 초기화</h2>
            <p className="text-sm text-[#6B5D4F] mb-6">
              모든 기록(음식, 운동, 체중, 대화)이 영구 삭제돼. 되돌릴 수 없어. 계속할까?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl border border-[#E8DFD0] text-sm font-medium text-[#6B5D4F]"
              >
                취소
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2.5 rounded-xl bg-[#B85C38] text-white text-sm font-medium flex items-center justify-center gap-1.5"
              >
                {resetting ? <Loader2 size={14} className="animate-spin" /> : '초기화'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
