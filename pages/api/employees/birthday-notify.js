import { supabaseAdmin } from '../../../lib/supabase'

// ── Birthday Notification — called by Vercel Cron daily at 9am ──────
// Sends a birthday reminder email to HR for any employee celebrating today.
// Secured with a CRON_SECRET so it cannot be triggered by random requests.

export default async function handler(req, res) {
  // Security: only allow cron calls with secret header or query param
  const secret = req.headers['x-cron-secret'] || req.query.secret
  if (secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  const HR_EMAIL       = process.env.HR_EMAIL || 'hr@gosolar.co.in'
  const FROM_EMAIL     = process.env.FROM_EMAIL || 'hrms@gosolar.co.in'

  if (!RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured' })
  }

  // Get today's date (month + day only for birthday matching)
  const today  = new Date()
  const todayM = today.getMonth() + 1
  const todayD = today.getDate()
  const todayStr = today.toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  // Fetch all active employees with DOB
  const { data: employees, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, emp_code, designation, department, date_of_birth')
    .eq('is_active', true)
    .not('date_of_birth', 'is', null)

  if (error) return res.status(500).json({ error: error.message })

  // Filter to today's birthdays
  const todayBirthdays = (employees || []).filter(emp => {
    const dob = new Date(emp.date_of_birth)
    return dob.getMonth() + 1 === todayM && dob.getDate() === todayD
  }).map(emp => {
    const dob = new Date(emp.date_of_birth)
    const age = today.getFullYear() - dob.getFullYear()
    return { ...emp, age }
  })

  // No birthdays today — skip silently
  if (todayBirthdays.length === 0) {
    return res.status(200).json({ sent: false, message: 'No birthdays today' })
  }

  // Build email HTML
  const employeeCards = todayBirthdays.map(emp => {
    const initials = emp.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    const colors   = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#F7DC6F','#BB8FCE']
    const color    = colors[emp.name.charCodeAt(0) % colors.length]

    return `
      <div style="background:#fff; border:1px solid #E4E7EC; border-radius:12px;
        padding:20px 24px; margin-bottom:12px; display:flex; align-items:center; gap:16px;">
        <div style="width:52px; height:52px; border-radius:50%;
          background:${color}; display:flex; align-items:center;
          justify-content:center; font-size:20px; font-weight:700;
          color:#fff; flex-shrink:0;">
          ${initials}
        </div>
        <div style="flex:1;">
          <div style="font-size:16px; font-weight:700; color:#1D2939; margin-bottom:2px;">
            ${emp.name}
          </div>
          <div style="font-size:13px; color:#667085;">
            ${emp.designation || ''}${emp.department ? ` · ${emp.department}` : ''}
            ${emp.emp_code ? ` · ${emp.emp_code}` : ''}
          </div>
        </div>
        <div style="text-align:right; flex-shrink:0;">
          <div style="font-size:28px; font-weight:800; color:${color}; line-height:1;">
            ${emp.age}
          </div>
          <div style="font-size:11px; color:#667085; font-weight:600;
            text-transform:uppercase; letter-spacing:0.05em;">
            years old
          </div>
        </div>
      </div>
    `
  }).join('')

  const plural   = todayBirthdays.length > 1
  const names    = todayBirthdays.map(e => e.name.split(' ')[0]).join(' & ')

  const emailHTML = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
    <body style="margin:0; padding:0; background:#F2F4F7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
      <div style="max-width:560px; margin:32px auto; background:#F2F4F7;">

        <!-- Header -->
        <div style="background:linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
          border-radius:16px 16px 0 0; padding:32px 32px 28px; text-align:center;">
          <div style="font-size:48px; margin-bottom:8px;">🎂</div>
          <div style="font-size:22px; font-weight:800; color:#fff; margin-bottom:6px;">
            Birthday ${plural ? 'Reminders' : 'Reminder'}!
          </div>
          <div style="font-size:14px; color:rgba(255,255,255,0.9);">
            ${names} ${plural ? 'are' : 'is'} celebrating ${plural ? 'their birthdays' : 'a birthday'} today
          </div>
        </div>

        <!-- Body -->
        <div style="background:#fff; padding:28px 32px;">
          <p style="font-size:14px; color:#344054; margin:0 0 20px; line-height:1.6;">
            Hi HR Team 👋<br><br>
            Just a quick reminder — the following employee${plural ? 's are' : ' is'} celebrating
            ${plural ? 'their birthdays' : 'a birthday'} today, <strong>${todayStr}</strong>.
            Don't forget to wish ${plural ? 'them' : 'them'} on behalf of Go Solar Solutions! 🎉
          </p>

          ${employeeCards}

          <div style="background:#FFF8F0; border:1px solid #FFD0B5; border-radius:10px;
            padding:14px 18px; margin-top:20px;">
            <p style="margin:0; font-size:13px; color:#B54708; line-height:1.6;">
              💡 <strong>Quick actions:</strong> Send a WhatsApp wish, share a cake, or 
              drop a message on the team group to make their day special!
            </p>
          </div>
        </div>

        <!-- Footer -->
        <div style="background:#F8F9FB; border-radius:0 0 16px 16px;
          padding:18px 32px; text-align:center; border-top:1px solid #E4E7EC;">
          <p style="margin:0; font-size:12px; color:#98A2B3; line-height:1.6;">
            This is an automated reminder from <strong>Go Solar HRMS</strong><br>
            Powered by Softsync Solutions
          </p>
        </div>

      </div>
    </body>
    </html>
  `

  // Send via Resend
  const resendRes = await fetch('https://api.resend.com/emails', {
    method : 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type' : 'application/json',
    },
    body: JSON.stringify({
      from   : `Go Solar HRMS <${FROM_EMAIL}>`,
      to     : [HR_EMAIL],
      subject: `🎂 Birthday Reminder — ${names} ${plural ? 'are' : 'is'} celebrating today!`,
      html   : emailHTML,
    }),
  })

  const resendData = await resendRes.json()

  if (!resendRes.ok) {
    console.error('Resend error:', resendData)
    return res.status(500).json({ error: 'Failed to send email', details: resendData })
  }

  return res.status(200).json({
    sent       : true,
    count      : todayBirthdays.length,
    employees  : todayBirthdays.map(e => e.name),
    email_id   : resendData.id,
  })
}
