import { supabase } from './supabase'
import { getExchangeRate } from './exchangeRate'

// Pure function: calculates the preview rows without touching the DB.
// Returns { type: 'simple'|'installments'|'recurring', items: [{ date, amount, number }] }
export function previewTransaction(tx) {
  const baseDate = new Date(tx.date + 'T12:00:00')

  if (tx.paymentMethod === 'Crédito' && tx.installments > 1) {
    const installmentAmount = Math.round((tx.amount / tx.installments) * 100) / 100
    return {
      type: 'installments',
      items: Array.from({ length: tx.installments }, (_, i) => {
        const d = new Date(baseDate)
        d.setMonth(d.getMonth() + i)
        return { date: d.toISOString().slice(0, 10), amount: installmentAmount, number: i + 1 }
      }),
    }
  }

  if (tx.isRecurring && tx.recurrenceFrequency && tx.recurrencePeriods > 1) {
    return {
      type: 'recurring',
      items: Array.from({ length: tx.recurrencePeriods }, (_, i) => {
        const d = new Date(baseDate)
        switch (tx.recurrenceFrequency) {
          case 'monthly': d.setMonth(d.getMonth() + i); break
          case 'weekly': d.setDate(d.getDate() + i * 7); break
          case 'biweekly': d.setDate(d.getDate() + i * 14); break
          case 'yearly': d.setFullYear(d.getFullYear() + i); break
        }
        return { date: d.toISOString().slice(0, 10), amount: tx.amount, number: i + 1 }
      }),
    }
  }

  return {
    type: 'simple',
    items: [{ date: tx.date, amount: tx.amount, number: 1 }],
  }
}

// Create a transaction (handles installments + recurrence)
export async function createTransaction(tx, userId) {
  const baseDate = new Date(tx.date + 'T12:00:00')
  
  // Get exchange rate for the transaction date
  const rate = await getExchangeRate(tx.date)
  
  const base = {
    user_id: userId,
    type: tx.type,
    currency: tx.currency,
    category_id: tx.categoryId || null,
    subcategory_id: tx.subcategoryId || null,
    concept_id: tx.conceptId || null,
    income_concept: tx.incomeConcept || null,
    income_subtype: tx.incomeSubtype || null,
    description: tx.description || null,
    payment_method: tx.paymentMethod || null,
    person: tx.person,
    person_id: tx.personId || null,
    destination: tx.destination || null,
    is_recurring: tx.isRecurring || false,
  }
  
  const records = []
  const today = new Date().toISOString().slice(0, 10)

  // Resolve exchange rate + USD amount for a given date and amount
  async function resolveUsd(dateStr, amount) {
    if (dateStr > today) return { rate: null, amountUsd: null }
    const r = await getExchangeRate(dateStr)
    if (!r) return { rate: null, amountUsd: null }
    const amountUsd = tx.currency === 'ARS'
      ? Math.round((amount / r) * 100) / 100
      : amount
    return { rate: r, amountUsd }
  }

  if (tx.paymentMethod === 'Crédito' && tx.installments > 1) {
    // === INSTALLMENTS (cuotas) ===
    const groupId = crypto.randomUUID()
    const installmentAmount = Math.round((tx.amount / tx.installments) * 100) / 100

    for (let i = 0; i < tx.installments; i++) {
      const installDate = new Date(baseDate)
      installDate.setMonth(installDate.getMonth() + i)
      const dateStr = installDate.toISOString().slice(0, 10)
      const { rate: instRate, amountUsd } = await resolveUsd(dateStr, installmentAmount)

      records.push({
        ...base,
        date: dateStr,
        amount: installmentAmount,
        installments: tx.installments,
        installment_number: i + 1,
        installment_group_id: groupId,
        exchange_rate: instRate,
        amount_usd: amountUsd,
      })
    }
  } else if (tx.isRecurring && tx.recurrenceFrequency && tx.recurrencePeriods > 1) {
    // === RECURRENCE ===
    const recId = crypto.randomUUID()

    for (let i = 0; i < tx.recurrencePeriods; i++) {
      const recDate = new Date(baseDate)

      switch (tx.recurrenceFrequency) {
        case 'monthly': recDate.setMonth(recDate.getMonth() + i); break
        case 'weekly': recDate.setDate(recDate.getDate() + (i * 7)); break
        case 'biweekly': recDate.setDate(recDate.getDate() + (i * 14)); break
        case 'yearly': recDate.setFullYear(recDate.getFullYear() + i); break
      }

      const dateStr = recDate.toISOString().slice(0, 10)
      const { rate: recRate, amountUsd } = await resolveUsd(dateStr, tx.amount)

      records.push({
        ...base,
        date: dateStr,
        amount: tx.amount,
        installments: 1,
        installment_number: 1,
        recurrence_id: recId,
        recurrence_frequency: tx.recurrenceFrequency,
        recurrence_total_periods: tx.recurrencePeriods,
        recurrence_current_period: i + 1,
        exchange_rate: recRate,
        amount_usd: amountUsd,
      })
    }
  } else {
    // === SIMPLE TRANSACTION ===
    let amountUsd = null
    if (rate) {
      amountUsd = tx.currency === 'ARS'
        ? Math.round((tx.amount / rate) * 100) / 100
        : tx.amount
    }
    
    records.push({
      ...base,
      date: tx.date,
      amount: tx.amount,
      installments: 1,
      installment_number: 1,
      exchange_rate: rate,
      amount_usd: amountUsd,
    })
  }
  
  // Insert all records
  const { data, error } = await supabase
    .from('transactions')
    .insert(records)
    .select()
  
  if (error) throw error
  return data
}

// Get recent transactions
export async function getRecentTransactions(userId, limit = 15) {
  const { data, error } = await supabase
    .from('transactions')
    .select(`
      *,
      categories(name, icon),
      concepts(name)
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return data
}
