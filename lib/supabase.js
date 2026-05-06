import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL       || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  || ''

// Single client instance — used everywhere on client side
export const supabase = createClient(url, anon)

// Server side — uses service role key in API routes
// On client side reuses the same supabase instance to avoid duplicate warning
export const supabaseAdmin =
  typeof window === 'undefined'
    ? createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY || anon)
    : supabase  // ← reuse existing client on browser
