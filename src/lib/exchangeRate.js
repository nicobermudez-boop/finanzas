import { supabase } from './supabase'

// Fetch MEP rate for a specific date
// 1. Check if we have it cached in exchange_rates table
// 2. If not, fetch from API and cache it
// 3. For weekends/holidays, falls back to most recent available rate

export async function getExchangeRate(date) {
  const dateStr = typeof date === 'string' ? date : date.toISOString().slice(0, 10)
  
  // 1. Check cache first - get rate for this date or most recent before it
  const { data: cached } = await supabase
    .from('exchange_rates')
    .select('rate, date')
    .lte('date', dateStr)
    .order('date', { ascending: false })
    .limit(1)
    .single()
  
  // If we have a rate from this exact date, return it
  if (cached && cached.date === dateStr) {
    return cached.rate
  }
  
  // 2. Try to fetch today's rate from API (only if date is today or recent)
  const today = new Date().toISOString().slice(0, 10)
  if (dateStr >= today) {
    try {
      const rate = await fetchMEPFromAPI()
      if (rate) {
        // Cache it
        await supabase.from('exchange_rates').upsert({
          date: today,
          rate,
          source: 'api'
        }, { onConflict: 'date' })
        
        if (dateStr === today) return rate
      }
    } catch (e) {
      console.warn('Failed to fetch MEP rate:', e)
    }
  }
  
  // 3. Fallback: return most recent cached rate
  if (cached) return cached.rate
  
  return null
}

// Fetch current MEP rate from dolarapi.com
async function fetchMEPFromAPI() {
  try {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), 5000)
    const res = await fetch('https://dolarapi.com/v1/dolares/bolsa', { signal: controller.signal })
    clearTimeout(id)
    if (!res.ok) throw new Error('API error')
    const data = await res.json()
    // Use average of compra and venta (promedio del día)
    const rate = (data.compra + data.venta) / 2
    return Math.round(rate * 100) / 100
  } catch {
    return null
  }
}

// Get the latest available rate (for display in header)
export async function getLatestRate() {
  // Try API first for freshest data
  try {
    const rate = await fetchMEPFromAPI()
    if (rate) return rate
  } catch { /* API unavailable, fall through to DB */ }

  // Fallback to DB
  const { data } = await supabase
    .from('exchange_rates')
    .select('rate')
    .order('date', { ascending: false })
    .limit(1)
    .single()
  
  return data?.rate || null
}
