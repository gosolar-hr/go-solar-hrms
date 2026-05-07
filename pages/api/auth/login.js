export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { email, password, role = 'hr' } = req.body

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'gosolar@2026'
  const TECH_PASSWORD  = process.env.TECH_PASSWORD  || 'gosolar@2026'
  const HR_EMAIL       = process.env.HR_EMAIL        || 'hr@gosolar.co.in'
  const TECH_EMAIL     = process.env.TECH_EMAIL      || 'technician@gosolar.co.in'

  if (role === 'hr') {
    // HR login — email + password
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
    // Technician login — password only
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
