export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const email    = (req.body.email    || '').trim()
  const password = (req.body.password || '').trim()
  const role     = (req.body.role     || 'hr')

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'LiveLife@77'
  const TECH_PASSWORD  = process.env.TECH_PASSWORD  || 'Tech@321'
  const HR_EMAIL       = process.env.HR_EMAIL        || 'hr@gosolar.co.in'
  const TECH_EMAIL     = process.env.TECH_EMAIL      || 'tech@go-solar.co'

  if (role === 'hr') {
    if (email !== HR_EMAIL) {
      return res.status(401).json({ error: 'Invalid email address' })
    }
    if (password !== ADMIN_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect password' })
    }
    res.setHeader('Set-Cookie', [
      `hrms_auth=hr; HttpOnly; Path=/; SameSite=Strict`,
      `hrms_role=hr; Path=/; SameSite=Strict`,
    ])
    return res.status(200).json({ success: true, role: 'hr', redirect: '/' })
  }

  if (role === 'technician') {
    if (!email) {
      return res.status(401).json({ error: 'Email address is required' })
    }
    if (email !== TECH_EMAIL) {
      return res.status(401).json({ error: 'Invalid email address' })
    }
    if (password !== TECH_PASSWORD) {
      return res.status(401).json({ error: 'Incorrect password' })
    }
    res.setHeader('Set-Cookie', [
      `hrms_auth=tech; HttpOnly; Path=/; SameSite=Strict`,
      `hrms_role=tech; Path=/; SameSite=Strict`,
    ])
    return res.status(200).json({ success: true, role: 'technician', redirect: '/amc' })
  }

  return res.status(401).json({ error: 'Invalid credentials' })
}
