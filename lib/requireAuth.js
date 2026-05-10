import { verifyJWT } from './auth'

/**
 * API route guard to verify JWT and roles
 * @param {import('next').NextApiRequest} req 
 * @param {import('next').NextApiResponse} res 
 * @param {string[]} allowedRoles 
 */
export async function requireRole(req, res, allowedRoles = []) {
  const token = req.cookies.hrms_session

  if (!token) {
    res.status(401).json({ error: 'Authentication required' })
    return null
  }

  const payload = await verifyJWT(token)
  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired session' })
    return null
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
    res.status(403).json({ error: 'Access forbidden' })
    return null
  }

  return payload
}
