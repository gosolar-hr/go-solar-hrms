const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function check() {
  const { data, error } = await supabase
    .from('amc_sites')
    .select('*, amc_visits(id, scheduled_date, status)')
    .eq('is_active', true)
  
  if (error) {
    console.error('Error:', error)
  } else {
    console.log('AMC Sites with Visits:', JSON.stringify(data, null, 2))
  }
}

check()
