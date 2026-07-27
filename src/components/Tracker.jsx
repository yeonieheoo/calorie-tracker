import { useState, useEffect, useRef } from 'react'
import {
  Send, ChevronLeft, ChevronRight, Loader2, Camera, X,
  Flame, Activity, Apple, Trash2, LogOut,
} from 'lucide-react'
import { supabase, getLog, setLog } from '../lib/supabase'
import { SETTINGS } from '../lib/settings'
import { resizeImage } from '../lib/image'
import Progress from './Progress'

const formatDateKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const formatDisplayDate = (d) => {
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${days[d.getDay()]}요일`
}

const formatTime = (iso) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const isSameDay = (d1, d2) => d1.toDateString() === d2.toDateString()

export default function Tracker({ user }) {
  const [activeTab, setActiveTab] = useState('log') // 'log' | 'progress'

  const [entries, setEntries] = useState([])
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [viewDate, setViewDate] = useState(new Date())
  const [initialized, setInitialized] = useState(false)
  const [pendingPhoto, setPendingPhoto] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const messagesEndRef = useRef(null)
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  const currentKey = formatDateKey(viewDate)
  const isToday = isSameDay(viewDate, new Date())

  useEffect(() => { loadEntries() }, [viewDate])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  const welcomeMessage = () => ({
    id: 'welcome',
    role: 'assistant',
    content: isToday
      ? `안녕 Yeonie 👋 ${formatDisplayDate(viewDate)} 시작! 뭐 먹거나 운동한 거 편하게 적어줘. 사진도 올릴 수 있어 📷`
      : `${formatDisplayDate(viewDate)} 기록이 없네.`,
  })

  const loadEntries = async () => {
    try {
      const data = await getLog(user.id, currentKey)
      if (data) {
        setEntries(data.entries || [])
        setMessages(data.messages?.length ? data.messages : [welcomeMessage()])
      } else {
        setEntries([])
        setMessages([welcomeMessage()])
      }
    } catch (e) {
      setEntries([])
      setMessages([welcomeMessage()])
    } finally {
      setInitialized(true)
    }
  }

  const saveData = async (newEntries, newMessages) => {
    try {
      const existing = await getLog(user.id, currentKey)
      await setLog(user.id, currentKey, {
        ...(existing || {}),
        entries: newEntries,
        messages: newMessages,
        date: currentKey,
      })
    } catch (e) {
      console.error('Save failed:', e)
    }
  }

  const totals = entries.reduce((acc, e) => {
    if (e.type === 'food') {
      acc.kcal += e.total_kcal || 0
      acc.protein += e.total_protein || 0
      acc.fat += e.total_fat || 0
      acc.carbs += e.total_carbs || 0
    } else if (e.type === 'exercise') {
      acc.burned += e.total_kcal_burned || 0
      acc.exercise_min += e.total_duration || 0
    }
    return acc
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0, burned: 0, exercise_min: 0 })

  const netKcal = totals.kcal - totals.burned
  const remaining = SETTINGS.target_kcal - netKcal
  const consumedProgress = Math.min(100, (totals.kcal / SETTINGS.target_kcal) * 100)
  const proteinProgress = Math.min(100, (totals.protein / SETTINGS.target_protein) * 100)

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoLoading(true)
    try {
      const resized = await resizeImage(file)
      setPendingPhoto(resized)
    } catch (err) {
      console.error('Photo resize failed:', err)
    } finally {
      setPhotoLoading(false)
    }
  }

  const handleSubmit = async () => {
    if ((!input.trim() && !pendingPhoto) || loading) return
    if (!isToday) {
      setMessages([...messages, {
        id: Date.now().toString(),
        role: 'assistant',
        content: '⚠️ 오늘로 돌아가서 기록해줘. 과거 기록은 보기만 가능해.',
      }])
      return
    }

    const userInput = input.trim()
    const photo = pendingPhoto
    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      image: photo?.dataUrl || null,
      timestamp: new Date().toISOString(),
    }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
    setPendingPhoto(null)
    setLoading(true)

    try {
      const summary = `섭취 ${totals.kcal}kcal · 소모 ${totals.burned}kcal · 단백질 ${totals.protein}g · 잔여 ${remaining}kcal`

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: userInput,
          summary,
          imageBase64: photo?.base64 || null,
          imageMediaType: photo?.mediaType || null,
        }),
      })

      if (!res.ok) throw new Error('API failed')
      const data = await res.json()
      const text = (data.text || '').trim()
      const cleaned = text.replace(/```json|```/g, '').trim()

      let parsed
      try { parsed = JSON.parse(cleaned) }
      catch {
        const match = cleaned.match(/\{[\s\S]*\}/)
        if (match) parsed = JSON.parse(match[0])
        else throw new Error('parse')
      }

      let newEntries = entries
      let newEntry = null

      if (parsed.type === 'food' && parsed.food_items?.length) {
        const totalKcal = parsed.food_items.reduce((s, i) => s + (i.kcal || 0), 0)
        const totalProtein = parsed.food_items.reduce((s, i) => s + (i.protein || 0), 0)
        const totalFat = parsed.food_items.reduce((s, i) => s + (i.fat || 0), 0)
        const totalCarbs = parsed.food_items.reduce((s, i) => s + (i.carbs || 0), 0)
        newEntry = {
          id: Date.now().toString(),
          type: 'food',
          meal: parsed.meal,
          items: parsed.food_items,
          total_kcal: totalKcal,
          total_protein: totalProtein,
          total_fat: totalFat,
          total_carbs: totalCarbs,
          raw_input: userInput,
          image: photo?.dataUrl || null,
          timestamp: new Date().toISOString(),
        }
        newEntries = [...entries, newEntry]
        setEntries(newEntries)
      } else if (parsed.type === 'exercise' && parsed.exercise_items?.length) {
        const totalBurned = parsed.exercise_items.reduce((s, i) => s + (i.kcal_burned || 0), 0)
        const totalDuration = parsed.exercise_items.reduce((s, i) => s + (i.duration_min || 0), 0)
        newEntry = {
          id: Date.now().toString(),
          type: 'exercise',
          items: parsed.exercise_items,
          total_kcal_burned: totalBurned,
          total_duration: totalDuration,
          raw_input: userInput,
          image: photo?.dataUrl || null,
          timestamp: new Date().toISOString(),
        }
        newEntries = [...entries, newEntry]
        setEntries(newEntries)
      } else if (parsed.type === 'delete' && entries.length > 0) {
        newEntries = entries.slice(0, -1)
        setEntries(newEntries)
      }

      const updatedTotals = newEntries.reduce((acc, e) => {
        if (e.type === 'food') {
          acc.kcal += e.total_kcal || 0
          acc.protein += e.total_protein || 0
        } else if (e.type === 'exercise') {
          acc.burned += e.total_kcal_burned || 0
        }
        return acc
      }, { kcal: 0, protein: 0, burned: 0 })
      const updatedRemaining = SETTINGS.target_kcal - (updatedTotals.kcal - updatedTotals.burned)

      let extraSummary = ''
      if (parsed.type === 'food' || parsed.type === 'exercise') {
        extraSummary = `\n\n— 잔여 **${updatedRemaining}kcal** · 단백질 ${updatedTotals.protein}/${SETTINGS.target_protein}g`
      }

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: (parsed.response || '기록했어.') + extraSummary,
        entry: newEntry,
        timestamp: new Date().toISOString(),
      }
      const finalMessages = [...newMessages, assistantMsg]
      setMessages(finalMessages)
      await saveData(newEntries, finalMessages)
    } catch (e) {
      console.error(e)
      setMessages([...newMessages, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '미안, 잠깐 문제 생겼어. 다시 한 번 적어줄래?',
      }])
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  const deleteEntry = async (entryId) => {
    const newEntries = entries.filter((e) => e.id !== entryId)
    setEntries(newEntries)
    await saveData(newEntries, messages)
  }

  const changeDate = (offset) => {
    const d = new Date(viewDate)
    d.setDate(d.getDate() + offset)
    if (d > new Date()) return
    setViewDate(d)
  }

  const mealLabel = (m) => ({ breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }[m] || '')

  const renderMessageContent = (content) => {
    const parts = content.split(/(\*\*[^*]+\*\*)/g)
    return parts.map((p, i) =>
      p.startsWith('**') && p.endsWith('**')
        ? <strong key={i} className="font-semibold text-[#1F1B16]">{p.slice(2, -2)}</strong>
        : <span key={i}>{p}</span>
    )
  }

  const logout = () => supabase.auth.signOut()

  return (
    <div className="min-h-screen bg-[#FAF5EC] text-[#1F1B16]">
      <div className={`grain max-w-2xl mx-auto px-4 sm:px-6 pt-6 ${activeTab === 'log' ? 'pb-32' : 'pb-10'}`}>
        <div className="flex gap-1 bg-[#F0E8D8] rounded-full p-1 mb-6">
          <button
            onClick={() => setActiveTab('log')}
            className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'log' ? 'bg-white shadow-sm text-[#1F1B16]' : 'text-[#6B5D4F]'
            }`}
          >
            기록
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 py-2 rounded-full text-sm font-medium transition-colors ${
              activeTab === 'progress' ? 'bg-white shadow-sm text-[#1F1B16]' : 'text-[#6B5D4F]'
            }`}
          >
            진행
          </button>
        </div>

        {activeTab === 'progress' ? (
          <Progress user={user} />
        ) : (
          <>
            <header className="flex items-center justify-between mb-6">
              <button
                onClick={() => changeDate(-1)}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F0E8D8] text-[#6B5D4F]"
              ><ChevronLeft size={18} /></button>
              <div className="text-center flex-1">
                <div className="text-xs uppercase tracking-[0.2em] text-[#9B8D7E] mb-0.5">
                  {isToday ? 'TODAY' : ''}
                </div>
                <h1 className="display text-2xl font-medium">{formatDisplayDate(viewDate)}</h1>
              </div>
              <button
                onClick={() => changeDate(1)}
                disabled={isToday}
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F0E8D8] text-[#6B5D4F] disabled:opacity-30"
              ><ChevronRight size={18} /></button>
            </header>

            <div className="bg-white rounded-3xl border border-[#E8DFD0] p-6 sm:p-8 mb-6 shadow-[0_1px_2px_rgba(31,27,22,0.04)]">
              <div className="flex items-baseline justify-between mb-6 pb-6 border-b border-[#F0E8D8]">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9B8D7E] mb-1">잔여 칼로리</div>
                  <div className="display text-5xl sm:text-6xl font-medium tabular leading-none">
                    {remaining > 0 ? remaining : 0}
                    <span className="text-2xl text-[#9B8D7E] ml-1 font-light">kcal</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-[#9B8D7E] mb-1">목표</div>
                  <div className="display text-xl font-medium tabular text-[#6B5D4F]">{SETTINGS.target_kcal}</div>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs uppercase tracking-wider text-[#6B5D4F] flex items-center gap-1.5">
                      <Apple size={11} className="text-[#B85C38]" /> 섭취
                    </span>
                    <span className="text-sm tabular">
                      <span className="display font-medium text-[#1F1B16]">{totals.kcal}</span>
                      <span className="text-[#9B8D7E]"> / {SETTINGS.target_kcal}</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#F4ECDC] rounded-full overflow-hidden">
                    <div className="h-full bg-[#B85C38] transition-all duration-500 rounded-full" style={{ width: `${consumedProgress}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs uppercase tracking-wider text-[#6B5D4F] flex items-center gap-1.5">
                      <Flame size={11} className="text-[#5C7A4A]" /> 소모
                    </span>
                    <span className="text-sm tabular">
                      <span className="display font-medium text-[#1F1B16]">{totals.burned}</span>
                      <span className="text-[#9B8D7E]"> kcal · {totals.exercise_min}분</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#F4ECDC] rounded-full overflow-hidden">
                    <div className="h-full bg-[#5C7A4A] transition-all duration-500 rounded-full" style={{ width: `${Math.min(100, (totals.burned / 400) * 100)}%` }} />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-baseline mb-1.5">
                    <span className="text-xs uppercase tracking-wider text-[#6B5D4F]">단백질</span>
                    <span className="text-sm tabular">
                      <span className="display font-medium text-[#1F1B16]">{totals.protein.toFixed(0)}</span>
                      <span className="text-[#9B8D7E]"> / {SETTINGS.target_protein}g</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#F4ECDC] rounded-full overflow-hidden">
                    <div className="h-full bg-[#C9A961] transition-all duration-500 rounded-full" style={{ width: `${proteinProgress}%` }} />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-[#F0E8D8]">
                <div className="flex gap-4 text-xs">
                  <div>
                    <div className="text-[#9B8D7E] uppercase tracking-wider text-[10px]">탄수</div>
                    <div className="display tabular font-medium">{totals.carbs.toFixed(0)}g</div>
                  </div>
                  <div>
                    <div className="text-[#9B8D7E] uppercase tracking-wider text-[10px]">지방</div>
                    <div className="display tabular font-medium">{totals.fat.toFixed(0)}g</div>
                  </div>
                  <div>
                    <div className="text-[#9B8D7E] uppercase tracking-wider text-[10px]">순</div>
                    <div className="display tabular font-medium">{netKcal}</div>
                  </div>
                </div>
                <button onClick={logout} className="text-[#9B8D7E] hover:text-[#1F1B16]" title="로그아웃">
                  <LogOut size={13} />
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {initialized && messages.map((msg) => (
                <div key={msg.id} className={`msg-enter flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] ${msg.role === 'user' ? 'order-2' : ''}`}>
                    {msg.role === 'user' ? (
                      <div className="flex flex-col items-end gap-1.5">
                        {msg.image && (
                          <img src={msg.image} alt="첨부 사진" className="max-w-[200px] rounded-2xl border border-[#E8DFD0]" />
                        )}
                        {msg.content && (
                          <div className="bg-[#1F1B16] text-[#FAF5EC] rounded-2xl rounded-br-md px-4 py-2.5 text-sm">{msg.content}</div>
                        )}
                      </div>
                    ) : (
                      <div>
                        <div className="bg-white border border-[#E8DFD0] rounded-2xl rounded-bl-md px-4 py-3 text-sm leading-relaxed whitespace-pre-line">
                          {renderMessageContent(msg.content)}
                        </div>
                        {msg.entry && (
                          <div className={`mt-2 rounded-xl px-3.5 py-2.5 text-xs border ${
                            msg.entry.type === 'food' ? 'bg-[#FDF6F0] border-[#E8D5C5]' : 'bg-[#F4F6F0] border-[#D5DDC8]'
                          }`}>
                            {msg.entry.image && (
                              <img src={msg.entry.image} alt="음식/운동 사진" className="w-full h-32 object-cover rounded-lg mb-2.5" />
                            )}
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1.5">
                                  {msg.entry.type === 'food' ? (
                                    <><Apple size={11} className="text-[#B85C38]" />
                                      <span className="uppercase tracking-wider text-[10px] text-[#6B5D4F]">{mealLabel(msg.entry.meal)}</span></>
                                  ) : (
                                    <><Activity size={11} className="text-[#5C7A4A]" />
                                      <span className="uppercase tracking-wider text-[10px] text-[#6B5D4F]">운동</span></>
                                  )}
                                  <span className="text-[10px] text-[#9B8D7E]">{formatTime(msg.entry.timestamp)}</span>
                                </div>
                                <div className="space-y-0.5">
                                  {msg.entry.type === 'food'
                                    ? msg.entry.items.map((item, i) => (
                                        <div key={i} className="flex justify-between tabular">
                                          <span className="text-[#1F1B16]">{item.name}{item.amount && ` · ${item.amount}`}</span>
                                          <span className="text-[#6B5D4F]">{item.kcal} kcal</span>
                                        </div>
                                      ))
                                    : msg.entry.items.map((item, i) => (
                                        <div key={i} className="flex justify-between tabular">
                                          <span className="text-[#1F1B16]">{item.name} · {item.duration_min}분</span>
                                          <span className="text-[#6B5D4F]">−{item.kcal_burned} kcal</span>
                                        </div>
                                      ))}
                                </div>
                                <div className="flex justify-between mt-1.5 pt-1.5 border-t border-[#E8DFD0] tabular">
                                  <span className="text-[#6B5D4F]">소계</span>
                                  <span className="display font-medium text-[#1F1B16]">
                                    {msg.entry.type === 'food' ? `${msg.entry.total_kcal} kcal` : `−${msg.entry.total_kcal_burned} kcal`}
                                  </span>
                                </div>
                              </div>
                              <button onClick={() => deleteEntry(msg.entry.id)} className="text-[#9B8D7E] hover:text-[#B85C38] flex-shrink-0">
                                <Trash2 size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex justify-start msg-enter">
                  <div className="bg-white border border-[#E8DFD0] rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 bg-[#9B8D7E] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-1.5 h-1.5 bg-[#9B8D7E] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-1.5 h-1.5 bg-[#9B8D7E] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </>
        )}
      </div>

      {activeTab === 'log' && (
        <div className="fixed bottom-0 left-0 right-0 bg-gradient-to-t from-[#FAF5EC] via-[#FAF5EC] to-transparent pt-6 pb-4 px-4" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <div className="max-w-2xl mx-auto">
            {pendingPhoto && (
              <div className="flex items-center gap-2 mb-2 bg-white border border-[#E8DFD0] rounded-2xl px-3 py-2 w-fit">
                <img src={pendingPhoto.dataUrl} alt="미리보기" className="w-10 h-10 rounded-lg object-cover" />
                <span className="text-xs text-[#6B5D4F]">사진 첨부됨</span>
                <button onClick={() => setPendingPhoto(null)} className="text-[#9B8D7E] hover:text-[#B85C38]">
                  <X size={14} />
                </button>
              </div>
            )}
            <div className="flex gap-2 bg-white border border-[#E8DFD0] rounded-2xl px-4 py-2 shadow-[0_1px_3px_rgba(31,27,22,0.06)] focus-within:border-[#B85C38] transition-colors">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={loading || !isToday || photoLoading}
                className="w-9 h-9 flex items-center justify-center rounded-xl text-[#6B5D4F] hover:bg-[#F0E8D8] disabled:opacity-40 flex-shrink-0"
                title="사진 추가"
              >
                {photoLoading ? <Loader2 size={15} className="animate-spin" /> : <Camera size={17} />}
              </button>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
                }}
                placeholder={isToday ? (pendingPhoto ? '사진 설명 (선택)' : '예: 점심에 닭가슴살 150g, 현미밥 반공기') : '오늘로 돌아가서 기록해'}
                disabled={loading || !isToday}
                className="flex-1 bg-transparent outline-none text-base placeholder:text-[#9B8D7E] disabled:opacity-50"
              />
              <button
                onClick={handleSubmit}
                disabled={loading || (!input.trim() && !pendingPhoto) || !isToday}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-[#1F1B16] text-[#FAF5EC] disabled:bg-[#E8DFD0] disabled:text-[#9B8D7E] flex-shrink-0"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
