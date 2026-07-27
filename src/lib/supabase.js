import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
})

// Storage helpers
export async function getLog(userId, dateKey) {
  const { data, error } = await supabase
    .from('logs')
    .select('data')
    .eq('user_id', userId)
    .eq('date', dateKey)
    .maybeSingle()
  if (error) {
    console.error('getLog error:', error)
    return null
  }
  return data?.data || null
}

export async function setLog(userId, dateKey, data) {
  const { error } = await supabase
    .from('logs')
    .upsert({
      user_id: userId,
      date: dateKey,
      data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,date' })
  if (error) {
    console.error('setLog error:', error)
    throw error
  }
}

export async function listLogs(userId, limit = 14) {
  const { data, error } = await supabase
    .from('logs')
    .select('date, data')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(limit)
  if (error) {
    console.error('listLogs error:', error)
    return []
  }
  return data || []
}

// All logs, oldest → newest (used for the weight trend, which should span
// every date the user ever logged a weight, not just a recent window).
export async function listAllLogs(userId) {
  const { data, error } = await supabase
    .from('logs')
    .select('date, data')
    .eq('user_id', userId)
    .order('date', { ascending: true })
  if (error) {
    console.error('listAllLogs error:', error)
    return []
  }
  return data || []
}

// Logs within an inclusive date range, oldest → newest. Powers the 순 적자
// (net deficit) summary + trend graph on the 진행 tab.
export async function listLogsRange(userId, startDate, endDate) {
  const { data, error } = await supabase
    .from('logs')
    .select('date, data')
    .eq('user_id', userId)
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
  if (error) {
    console.error('listLogsRange error:', error)
    return []
  }
  return data || []
}

// Saves just the weight for a given date without clobbering that day's
// food/exercise entries or chat messages.
export async function saveWeightForDate(userId, dateKey, weightKg) {
  const existing = await getLog(userId, dateKey)
  const newData = {
    entries: [],
    messages: [],
    ...(existing || {}),
    date: dateKey,
    weight_kg: weightKg,
  }
  await setLog(userId, dateKey, newData)
}

// Permanently deletes every log (food, exercise, weight, chat history) for
// this user. Used by the "데이터 초기화" reset flow.
export async function resetAllData(userId) {
  const { error } = await supabase.from('logs').delete().eq('user_id', userId)
  if (error) {
    console.error('resetAllData error:', error)
    throw error
  }
}
