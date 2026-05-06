import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ── Client side — safe to use in pages/components
export const supabase = createClient(supabaseUrl, supabaseAnon)

// ── Server side only — only use in /api routes
// Safely handle missing key on client side
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnon

export const supabaseAdmin = createClient(supabaseUrl, serviceKey)
