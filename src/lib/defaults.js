import { supabase } from './supabase'

const DEFAULT_EXPENSE_CATEGORIES = [
  {
    name: 'Transporte', icon: '🚗', sort_order: 1,
    subcategories: [
      { name: 'Combustible', concepts: ['YPF', 'Shell', 'Axion'] },
      { name: 'Transporte público', concepts: ['SUBE'] },
      { name: 'Estacionamiento', concepts: [] },
      { name: 'Peajes', concepts: [] },
      { name: 'Mantenimiento auto', concepts: [] },
    ],
  },
  {
    name: 'Viajes', icon: '✈️', sort_order: 2,
    subcategories: [
      { name: 'Alojamiento', concepts: [] },
      { name: 'Pasajes', concepts: [] },
      { name: 'Actividades', concepts: [] },
    ],
  },
  {
    name: 'Vivienda', icon: '🏠', sort_order: 3,
    subcategories: [
      { name: 'Alquiler', concepts: [] },
      { name: 'Expensas', concepts: [] },
      { name: 'Servicios', concepts: ['Luz', 'Gas', 'Agua', 'Internet', 'Teléfono'] },
    ],
  },
  {
    name: 'Regalos', icon: '🎁', sort_order: 4,
    subcategories: [
      { name: 'Regalos', concepts: [] },
    ],
  },
  {
    name: 'Hogar y equipamiento', icon: '🛋️', sort_order: 5,
    subcategories: [
      { name: 'Electrodomésticos', concepts: [] },
      { name: 'Muebles', concepts: [] },
      { name: 'Limpieza', concepts: [] },
      { name: 'Mantenimiento', concepts: [] },
    ],
  },
  {
    name: 'Indumentaria y cuidado personal', icon: '👕', sort_order: 6,
    subcategories: [
      { name: 'Ropa', concepts: [] },
      { name: 'Calzado', concepts: [] },
      { name: 'Cuidado personal', concepts: [] },
    ],
  },
  {
    name: 'Salud', icon: '🏥', sort_order: 7,
    subcategories: [
      { name: 'Diagnóstico y tratamiento', concepts: [] },
      { name: 'Obra social', concepts: ['Obra social'] },
    ],
  },
  {
    name: 'Esparcimiento', icon: '🎬', sort_order: 8,
    subcategories: [
      { name: 'Streaming', concepts: ['Netflix', 'Spotify', 'Disney+', 'HBO Max'] },
      { name: 'Salidas', concepts: [] },
      { name: 'Deportes', concepts: [] },
    ],
  },
  {
    name: 'Educación', icon: '📚', sort_order: 9,
    subcategories: [
      { name: 'Escuela', concepts: [] },
    ],
  },
  {
    name: 'Compras', icon: '🛒', sort_order: 10,
    subcategories: [
      { name: 'Supermercado', concepts: [] },
      { name: 'Compras varias', concepts: [] },
    ],
  },
]

const DEFAULT_INCOME_CATEGORIES = [
  {
    name: 'Ingresos', icon: '💰', sort_order: 1,
    subcategories: [
      { name: 'Ingresos', concepts: ['Sueldo', 'Rentas', 'Servicios', 'Otros'] },
    ],
  },
]

const DEFAULT_PERSONS = ['Personal', 'Empresa']

/**
 * Seed default categories, subcategories, concepts, and persons for a new user.
 * Idempotent: skips if user already has any categories.
 * @param {string} userId
 * @returns {Promise<boolean>} true if seeded, false if skipped
 */
export async function seedDefaults(userId) {
  const { data: existing, error: checkErr } = await supabase
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .limit(1)

  if (checkErr) throw new Error('Error checking existing categories: ' + checkErr.message)
  if (existing && existing.length > 0) return false

  const allCategories = [
    ...DEFAULT_EXPENSE_CATEGORIES.map(c => ({ ...c, type: 'expense' })),
    ...DEFAULT_INCOME_CATEGORIES.map(c => ({ ...c, type: 'income' })),
  ]

  for (const catDef of allCategories) {
    const { data: cat, error: catErr } = await supabase
      .from('categories')
      .insert({ name: catDef.name, type: catDef.type, icon: catDef.icon, sort_order: catDef.sort_order, user_id: userId })
      .select('id')
      .single()

    if (catErr) throw new Error(`Error creating category ${catDef.name}: ${catErr.message}`)

    for (const subDef of catDef.subcategories) {
      const { data: sub, error: subErr } = await supabase
        .from('subcategories')
        .insert({ name: subDef.name, category_id: cat.id, user_id: userId })
        .select('id')
        .single()

      if (subErr) throw new Error(`Error creating subcategory ${subDef.name}: ${subErr.message}`)

      if (subDef.concepts.length > 0) {
        const conceptRows = subDef.concepts.map(name => ({ name, subcategory_id: sub.id, user_id: userId }))
        const { error: conErr } = await supabase.from('concepts').insert(conceptRows)
        if (conErr) throw new Error(`Error creating concepts for ${subDef.name}: ${conErr.message}`)
      }
    }
  }

  if (DEFAULT_PERSONS.length > 0) {
    const personRows = DEFAULT_PERSONS.map(name => ({ name, user_id: userId }))
    const { error: pErr } = await supabase.from('persons').insert(personRows)
    if (pErr) throw new Error(`Error creating default persons: ${pErr.message}`)
  }

  return true
}
