export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    `hrms_auth=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict`,
    `hrms_role=; Path=/; Max-Age=0; SameSite=Strict`,
  ])
  res.status(200).json({ success: true })
}
