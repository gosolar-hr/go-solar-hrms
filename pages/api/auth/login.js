export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { password } = req.body

  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'gosolar@2026'

  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' })
  }

  // Set secure httpOnly cookie — expires in 8 hours
  res.setHeader('Set-Cookie',
    `hrms_auth=1; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict`
  )

  return res.status(200).json({ success: true })
}
