import { supabase } from './supabase'
import { getExchangeRate } from './exchangeRate'

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
    destination: tx.destination || null,
    is_recurring: tx.isRecurring || false,
  }
  
  const records = []
  
  if (tx.paymentMethod === 'Crédito' && tx.installments > 1) {
    // === INSTALLMENTS (cuotas) ===
    const groupId = crypto.randomUUID()
    const installmentAmount = Math.round((tx.amount / tx.installments) * 100) / 100
    
    for (let i = 0; i < tx.installments; i++) {
      const installDate = new Date(baseDate)
      installDate.setMonth(installDate.getMonth() + i)
      const dateStr = installDate.toISOString().slice(0, 10)
      
      // Only assign exchange rate if date is today or past
      const today = new Date().toISOString().slice(0, 10)
      let instRate = null
      let amountUsd = null
      
      if (dateStr <= today) {
        instRate = await getExchangeRate(dateStr)
        if (instRate) {
          amountUsd = tx.currency === 'ARS'
            ? Math.round((installmentAmount / instRate) * 100) / 100
            : installmentAmount
        }
      }
      
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
      const today = new Date().toISOString().slice(0, 10)
      let recRate = null
      let amountUsd = null
      
      if (dateStr <= today) {
        recRate = await getExchangeRate(dateStr)
        if (recRate) {
          amountUsd = tx.currency === 'ARS'
            ? Math.round((tx.amount / recRate) * 100) / 100
            : tx.amount
        }
      }
      
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
export async function getRecentTransactions(userId, limit = 3) {
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
