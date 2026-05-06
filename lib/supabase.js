import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  || ''
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

// Client-safe — NEXT_PUBLIC_ vars available everywhere
export const supabase = createClient(url, anon)

// Server-only — use ONLY in pages/api/**
// On client side falls back to anon key safely
export const supabaseAdmin = createClient(
  url,
  process.env.SUPABASE_SERVICE_ROLE_KEY || anon
)
