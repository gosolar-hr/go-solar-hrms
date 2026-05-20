import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

// Disable Next.js body parser — we handle raw bytes via custom multipart parser
export const config = { api: { bodyParser: false } }

const MAX_IMAGE_BYTES = 2 * 1024 * 1024   // 2 MB  (JPEG / PNG / WebP)
const MAX_PDF_BYTES   = 5 * 1024 * 1024   // 5 MB  (PDF)

const ALLOWED_MIME = {
  'image/jpeg'      : { ext: 'jpg',  max: MAX_IMAGE_BYTES },
  'image/jpg'       : { ext: 'jpg',  max: MAX_IMAGE_BYTES },
  'image/png'       : { ext: 'png',  max: MAX_IMAGE_BYTES },
  'image/webp'      : { ext: 'webp', max: MAX_IMAGE_BYTES },
  'application/pdf' : { ext: 'pdf',  max: MAX_PDF_BYTES   },
}

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr', 'tech'])
  if (!session) return

  // ── DELETE Route ───────────────────────────────────────────────────
  if (req.method === 'DELETE') {
    const { employeeId, docType } = req.body
    if (!employeeId || !docType) {
      return res.status(400).json({ error: 'employeeId and docType are required' })
    }
    if (docType !== 'aadhaar' && docType !== 'pan') {
      return res.status(400).json({ error: 'Invalid docType. Must be aadhaar or pan.' })
    }

    const column = docType === 'aadhaar' ? 'aadhaar_url' : 'pan_url'

    // Get current URL to delete from storage if needed
    const { data: current } = await supabaseAdmin
      .from('employees')
      .select(column)
      .eq('id', employeeId)
      .single()

    const currentUrl = current?.[column]

    // Update DB to null
    const { error: dbErr } = await supabaseAdmin
      .from('employees')
      .update({ [column]: null })
      .eq('id', employeeId)

    if (dbErr) return res.status(500).json({ error: dbErr.message })

    // If there was a storage URL, delete the file from storage
    if (currentUrl) {
      try {
        const bucketName = 'employee-docs'
        const urlParts = currentUrl.split(`/${bucketName}/`)
        if (urlParts.length > 1) {
          const storagePath = decodeURIComponent(urlParts[1])
          await supabaseAdmin.storage.from(bucketName).remove([storagePath])
        }
      } catch (e) {
        console.error('Failed to remove file from storage:', e)
      }
    }

    return res.status(200).json({ success: true })
  }

  // ── POST Route ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    try {
      const { employeeId, docType, files } = await parseMultipart(req)

      if (!employeeId) return res.status(400).json({ error: 'employeeId is required' })
      if (!docType) return res.status(400).json({ error: 'docType is required' })
      if (docType !== 'aadhaar' && docType !== 'pan') {
        return res.status(400).json({ error: 'Invalid docType. Must be aadhaar or pan.' })
      }
      if (!files || files.length === 0) return res.status(400).json({ error: 'No file provided' })

      const file = files[0] // only one file per upload
      const mime = (file.mimetype || '').toLowerCase()
      const cfg  = ALLOWED_MIME[mime]

      if (!cfg) {
        return res.status(400).json({
          error: `File type "${mime}" is not allowed. Only JPEG, PNG, WebP images and PDF documents are accepted.`
        })
      }

      if (file.size > cfg.max) {
        const limitMB = (cfg.max / 1024 / 1024).toFixed(0)
        return res.status(400).json({
          error: `"${file.name}" exceeds the ${limitMB} MB limit for ${cfg.ext.toUpperCase()} files. Please compress it before uploading.`
        })
      }

      // Check if employee exists
      const { data: emp, error: empErr } = await supabaseAdmin
        .from('employees')
        .select('id')
        .eq('id', employeeId)
        .single()

      if (empErr || !emp) {
        return res.status(404).json({ error: 'Employee not found' })
      }

      const timestamp = Date.now()
      const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
      const storagePath = `${employeeId}/${docType}_${timestamp}_${safeName}`
      const bucketName = 'employee-docs'

      const { error: upErr } = await supabaseAdmin.storage
        .from(bucketName)
        .upload(storagePath, file.buffer, {
          contentType : mime,
          cacheControl: '3600',
          upsert      : false,
        })

      if (upErr) {
        return res.status(500).json({ error: `Upload failed: ${upErr.message}. Make sure the "${bucketName}" storage bucket is created in Supabase.` })
      }

      const { data: urlData } = supabaseAdmin.storage
        .from(bucketName)
        .getPublicUrl(storagePath)

      const column = docType === 'aadhaar' ? 'aadhaar_url' : 'pan_url'

      // Update employee record
      const { error: dbErr } = await supabaseAdmin
        .from('employees')
        .update({ [column]: urlData.publicUrl })
        .eq('id', employeeId)

      if (dbErr) return res.status(500).json({ error: dbErr.message })

      return res.status(200).json({ url: urlData.publicUrl })
    } catch (parseErr) {
      return res.status(400).json({ error: `Failed to parse file: ${parseErr.message}` })
    }
  }

  return res.status(405).json({ error: 'Method not allowed' })
}

// ── Lightweight multipart parser ───────────────────────────────────
function parseMultipart(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', c => chunks.push(c))
    req.on('end', () => {
      try {
        const body     = Buffer.concat(chunks)
        const ct       = req.headers['content-type'] || ''
        const boundary = ct.split('boundary=')[1]?.trim()
        if (!boundary) return reject(new Error('No boundary in Content-Type'))

        const sep    = Buffer.from(`--${boundary}`)
        const parts  = splitBuffer(body, sep)

        let employeeId = null
        let docType = null
        const files = []

        for (const part of parts) {
          if (part.length === 0) continue
          const crlfcrlf = part.indexOf('\r\n\r\n')
          if (crlfcrlf === -1) continue
          const headerStr = part.slice(0, crlfcrlf).toString()
          let content = part.slice(crlfcrlf + 4)
          if (content.slice(-2).toString() === '\r\n') content = content.slice(0, -2)

          const dispMatch  = headerStr.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/)
          const fileMatch  = headerStr.match(/filename="([^"]+)"/)
          const typeMatch  = headerStr.match(/Content-Type:\s*([^\r\n]+)/)

          if (!dispMatch) continue
          const fieldName = dispMatch[1]

          if (!fileMatch) {
            if (fieldName === 'employeeId') employeeId = content.toString().trim()
            if (fieldName === 'docType') docType = content.toString().trim()
          } else {
            files.push({
              name    : fileMatch[1],
              mimetype: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
              buffer  : content,
              size    : content.length,
            })
          }
        }

        resolve({ employeeId, docType, files })
      } catch (e) { reject(e) }
    })
    req.on('error', reject)
  })
}

function splitBuffer(buf, sep) {
  const parts = []
  let start   = 0
  while (true) {
    const idx = buf.indexOf(sep, start)
    if (idx === -1) break
    if (idx > start) parts.push(buf.slice(start, idx))
    start = idx + sep.length
    if (buf.slice(start, start + 2).toString() === '--') break
    if (buf.slice(start, start + 2).toString() === '\r\n') start += 2
  }
  return parts
}
