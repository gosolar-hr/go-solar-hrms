import { supabaseAdmin } from '../../../lib/supabase'
import { requireRole } from '../../../lib/requireAuth'

// Disable Next.js body parser — we handle raw bytes via formidable
export const config = { api: { bodyParser: false } }

// ── Strict size limits ──────────────────────────────────────────────
const MAX_IMAGE_BYTES = 2 * 1024 * 1024   // 2 MB  (JPEG / PNG / WebP)
const MAX_PDF_BYTES   = 5 * 1024 * 1024   // 5 MB  (PDF)
const MAX_FILES       = 5                  // per upload request

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

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Parse multipart form using native Node streams (no extra npm dep)
  const { visitId, files } = await parseMultipart(req)

  if (!visitId) return res.status(400).json({ error: 'visitId is required' })
  if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' })
  if (files.length > MAX_FILES) return res.status(400).json({ error: `Max ${MAX_FILES} files per upload` })

  const uploadedUrls = []

  for (const file of files) {
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

    const timestamp = Date.now()
    const safeName  = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80)
    const path      = `amc-visits/${visitId}/${timestamp}_${safeName}`

    const { error: upErr } = await supabaseAdmin.storage
      .from('amc-photos')
      .upload(path, file.buffer, {
        contentType : mime,
        cacheControl: '3600',
        upsert      : false,
      })

    if (upErr) return res.status(500).json({ error: `Upload failed: ${upErr.message}` })

    const { data: urlData } = supabaseAdmin.storage
      .from('amc-photos')
      .getPublicUrl(path)

    uploadedUrls.push({ name: file.name, url: urlData.publicUrl, type: cfg.ext, size: file.size })
  }

  // Append new URLs to the visit's photo_urls array
  const { data: current } = await supabaseAdmin
    .from('amc_visits')
    .select('photo_urls')
    .eq('id', visitId)
    .single()

  const existing  = Array.isArray(current?.photo_urls) ? current.photo_urls : []
  const combined  = [...existing, ...uploadedUrls]

  if (combined.length > 20) {
    return res.status(400).json({ error: 'Visit already has 20 photos. Delete some before uploading more.' })
  }

  const { error: dbErr } = await supabaseAdmin
    .from('amc_visits')
    .update({ photo_urls: combined })
    .eq('id', visitId)

  if (dbErr) return res.status(500).json({ error: dbErr.message })

  return res.status(200).json({ uploaded: uploadedUrls, total: combined.length })
}

// ── Lightweight multipart parser (no formidable needed) ─────────────
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
        const sepEnd = Buffer.from(`--${boundary}--`)
        const parts  = splitBuffer(body, sep)

        let visitId = null
        const files = []

        for (const part of parts) {
          if (part.length === 0) continue
          // Find blank line separating headers from body
          const crlfcrlf = part.indexOf('\r\n\r\n')
          if (crlfcrlf === -1) continue
          const headerStr = part.slice(0, crlfcrlf).toString()
          // Remove trailing \r\n from content
          let content = part.slice(crlfcrlf + 4)
          if (content.slice(-2).toString() === '\r\n') content = content.slice(0, -2)

          const dispMatch  = headerStr.match(/Content-Disposition:[^\r\n]*name="([^"]+)"/)
          const fileMatch  = headerStr.match(/filename="([^"]+)"/)
          const typeMatch  = headerStr.match(/Content-Type:\s*([^\r\n]+)/)

          if (!dispMatch) continue
          const fieldName = dispMatch[1]

          if (!fileMatch) {
            // Plain field
            if (fieldName === 'visitId') visitId = content.toString().trim()
          } else {
            files.push({
              name    : fileMatch[1],
              mimetype: typeMatch ? typeMatch[1].trim() : 'application/octet-stream',
              buffer  : content,
              size    : content.length,
            })
          }
        }

        resolve({ visitId, files })
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
    if (buf.slice(start, start + 2).toString() === '--') break  // end boundary
    if (buf.slice(start, start + 2).toString() === '\r\n') start += 2
  }
  return parts
}
