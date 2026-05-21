import { signJWT } from '../../../lib/auth'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const email    = (req.body.email    || '').trim()
  const password = (req.body.password || '').trim()
  const role     = (req.body.role     || 'hr')

  // SECURE: No hardcoded fallbacks
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD
  const TECH_PASSWORD  = process.env.TECH_PASSWORD
  const HR_EMAIL       = process.env.HR_EMAIL   || 'hr@gosolar.co.in'
  const TECH_EMAIL     = process.env.TECH_EMAIL || 'tech@go-solar.co'

  let authenticated = false
  let userRole      = ''
  let redirect      = '/'

  if (role === 'hr') {
    if (!ADMIN_PASSWORD) {
      console.error('[AUTH ERROR] ADMIN_PASSWORD environment variable is not configured on the server.')
    }
    if (email === HR_EMAIL && password === ADMIN_PASSWORD) {
      authenticated = true
      userRole      = 'hr'
      redirect      = '/'
    }
  } else if (role === 'technician') {
    if (!TECH_PASSWORD) {
      console.error('[AUTH ERROR] TECH_PASSWORD environment variable is not configured on the server.')
    }
    if (email === TECH_EMAIL && password === TECH_PASSWORD) {
      authenticated = true
      userRole      = 'tech'
      redirect      = '/amc'
    }
  }

  if (!authenticated) {
    // SECURE: Generic error message (High #13)
    return res.status(401).json({ error: 'Invalid email or password' })
  }

  // Issue Signed JWT (Critical #1)
  const token  = await signJWT({ email, role: userRole })
  const isProd = process.env.NODE_ENV === 'production'
  const MAX_AGE = 8 * 60 * 60  // 8 hours — matches JWT expiry

  res.setHeader('Set-Cookie', [
    `hrms_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
    `hrms_role=${userRole}; Path=/; SameSite=Strict; Max-Age=${MAX_AGE}; ${isProd ? 'Secure;' : ''}`,
  ])
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')

  return res.status(200).json({ success: true, role: userRole, redirect })
}
