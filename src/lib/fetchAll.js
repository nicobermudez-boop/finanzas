import { supabase } from './supabase'

/**
 * Fetch all rows from a Supabase query, paginating in batches of 1000.
 * @param {string} table - Table name
 * @param {object} opts - { select, eq, gte, order, orderAsc }
 * @returns {Promise<Array>}
 */
export async function fetchAllTransactions(userId, opts = {}) {
  const PAGE = 1000
  let all = []
  let from = 0
  let hasMore = true

  while (hasMore) {
    let q = supabase.from('transactions').select(opts.select || '*')
    if (userId) q = q.eq('user_id', userId)
    if (opts.eq) opts.eq.forEach(([col, val]) => { q = q.eq(col, val) })
    if (opts.gte) opts.gte.forEach(([col, val]) => { q = q.gte(col, val) })
    q = q.order(opts.orderCol || 'created_at', { ascending: opts.orderAsc ?? false })
    q = q.range(from, from + PAGE - 1)

    const { data, error } = await q
    if (error) { console.error('fetchAll error:', error); break }
    all = all.concat(data || [])
    hasMore = (data || []).length === PAGE
    from += PAGE
  }

  return all
}
