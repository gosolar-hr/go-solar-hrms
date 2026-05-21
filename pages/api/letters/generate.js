import { supabaseAdmin } from '../../../lib/supabase'
import fs from 'fs'
import path from 'path'
import { requireRole } from '../../../lib/requireAuth'

export default async function handler(req, res) {
  const session = await requireRole(req, res, ['hr'])
  if (!session) return
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, employee_id, extra } = req.body

  if (!type) {
    return res.status(400).json({ error: 'type required' })
  }

  let emp = null

  if (type !== 'appointment') {
    if (!employee_id) {
      return res.status(400).json({ error: 'employee_id required' })
    }

    const { data, error } = await supabaseAdmin
      .from('employees')
      .select('*')
      .eq('id', employee_id)
      .single()

    if (error || !data) return res.status(404).json({ error: 'Employee not found' })
    emp = data
  }

  // Dynamically import docx (server-side only)
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    HeadingLevel, BorderStyle, PageBreak, LevelFormat, ImageRun
  } = await import('docx')

  const CO = {
    title: 'Appointment Letter with GO-SOLAR',
    brand: 'A Brand By Warrington Renewsol Pvt. Ltd',
    contact: 'www.gosolar.co.in | +91 899 99 33 899 | sales@gosolar.co.in',
    address: '1st Floor, Go Solar House, Plot No.130, APMC Market, Vashi, Navi Mumbai- 400 705',
    director: 'Usman Begawala',
    dirTitle: 'Director',
  }

  const TR = (text, opts={}) => new TextRun({ text, font:'Arial', size:22, ...opts })
  const p  = (children, opts={}) => new Paragraph({
    children: Array.isArray(children) ? children : [children],
    spacing : { after: 120, ...(opts.spacing||{}) },
    alignment: opts.align || AlignmentType.LEFT, ...opts,
  })
  const empty   = () => new Paragraph({ children:[TR('')], spacing:{ after:80 } })
  const divider = () => new Paragraph({
    children:[TR('')],
    border:{ bottom:{ style:BorderStyle.SINGLE, size:4, color:'101828' } },
    spacing:{ after:120 }
  })
  const h = (text) => new Paragraph({ children:[TR(text, {bold:true})], spacing:{ before:200, after:120 } })
  const bullet = (text) => new Paragraph({
    numbering:{ reference:'bullets', level:0 },
    children:[TR(text)], spacing:{ after:80 }
  })

  let logoData;
  try {
    const logoPath = path.join(process.cwd(), 'public', 'logo.jpg');
    logoData = fs.readFileSync(logoPath);
  } catch (e) {
    console.error("Logo not found", e);
  }

  const letterhead = () => [
    new Paragraph({
      children: [TR(CO.title, { bold: true, size: 24 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [TR(CO.brand, { size: 20 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
    }),
    new Paragraph({
      children: [TR(CO.contact, { size: 18 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 },
    }),
    new Paragraph({
      children: [TR(CO.address, { size: 18 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
    }),
  ]

  const NUMBERING = {
    config:[{ reference:'bullets',
      levels:[{ level:0, format:LevelFormat.BULLET, text:'•', alignment:AlignmentType.LEFT,
        style:{ paragraph:{ indent:{ left:720, hanging:360 } } } }]
    }]
  }
  const DOC_STYLES = { default:{ document:{ run:{ font:'Arial', size:22 } } } }
  const PAGE = { size:{ width:11906, height:16838 }, margin:{ top:1000, right:1000, bottom:1000, left:1000 } }

  let doc

  // ───────────────────────────────────────────────
  // APPOINTMENT LETTER
  // ───────────────────────────────────────────────
  if (type === 'appointment') {
    const {
      date = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      candidateName = '',
      salutation = 'Mr.',
      address = '',
      phone = '',
      email = '',
      designation = '',
      reportingTo = CO.director,
      joiningDate = '',
      contractDuration = '2 years',
      salary = '',
      responsibilities = [],
      acceptanceText = 'I hereby acknowledge that I have read, understood, and agreed to all terms and conditions of this Appointment Letter and its Annexures.',
      acceptanceName = candidateName,
      acceptanceDate = date,
      acceptancePlace = 'Vashi, Navi Mumbai',
    } = extra || {}

    if (!candidateName) {
      return res.status(400).json({ error: 'candidateName required' })
    }

    const firstName = candidateName.trim().split(' ')[0]
    const salaryText = salary ? `INR ${salary}/-` : 'INR __________/-'

    doc = new Document({
      numbering: NUMBERING,
      styles: DOC_STYLES,
      sections: [{
        properties: { page: PAGE },
        children: [
          ...letterhead(),

          p([TR(`Date: ${date}`)]),
          empty(),

          p([TR('To,')]),
          p([TR(candidateName.toUpperCase(), { bold: true })]),
          ...(address ? address.split('\n').map(line => p([TR(line)])) : []),
          ...(phone ? [p([TR(`Mobile: ${phone}`)])] : []),
          ...(email ? [p([TR(`Mail Id: ${email}`)])] : []),
          empty(),

          p([TR('Subject: Appointment Letter', { bold: true })]),
          empty(),

          p([TR(`Dear ${salutation} ${firstName},`)]),

          p([TR(`We are pleased to appoint you as ${designation} at GO-SOLAR Solutions.`)]),
          p([TR('Your selection is based on your qualifications, experience, and suitability for the role.')]),
          p([TR('Your appointment will be governed by the terms and conditions mentioned in this letter and the attached Annexures.')]),
          empty(),
          p([TR('Your appointment will be governed by the terms and conditions presented in the Annexure A.')]),
          empty(),
          p([TR('We look forward to you joining us. Please do not hesitate to call us for any information you may need.')]),
          p([TR('Also, please sign the duplicate of this offer and attach a copy of your PAN Card/Aadhaar Card as your acceptance and forward the same to us.')]),
          empty(),

          p([TR('Congratulations!')]),
          empty(),
          empty(),

          p([TR(CO.director)]),
          p([TR(CO.dirTitle)]),
          p([TR('GO- Solar Solutions')]),

          new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }),

          ...letterhead(),
          new Paragraph({ children: [TR('ANNEXURE - A', { bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
          new Paragraph({ children: [TR('TERMS & CONDITIONS OF EMPLOYMENT', { bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 240 } }),

          h('1. Designation & Reporting:'),
          p([TR(`You are appointed as ${designation} reporting to ${reportingTo}.`)]),
          p([TR('Your roles and responsibilities are detailed in Annexure B.')]),

          h('2. Contract Confirmation & Duration:'),
          p([TR(`Your contract confirmation date will be ${joiningDate}.`)]),
          p([TR(`The duration of your employment contract is ${contractDuration}.`)]),
          p([TR("If you resign during this contract period, you will be required to pay one month's salary as penalty, as per company policy.")]),

          h('3. Exclusivity of Employment:'),
          p([TR('You must devote your full working hours and efforts solely to GO-SOLAR.')]),
          p([TR('You are strictly prohibited from engaging in any job, business, freelancing, or consultancy with any other organization during employment.')]),

          h('4. Intellectual Property & Ownership of Work:'),
          p([TR('All customer details, pricing information, lead data, proposals, quotations, commercial terms, and business strategies accessed during your employment shall remain the exclusive property of GO-SOLAR.')]),
          p([TR('You are strictly prohibited from:')]),
          bullet('Sharing customer lists, lead data, pricing, proposals, or business strategies with any external individual or organization.'),
          bullet('Using company data or customer information for personal benefit or for any competitor.'),
          bullet('Disclosing commercial offers, margins, internal processes, or business models without written approval from management.'),
          bullet('Storing or transferring company/customer data to personal devices, WhatsApp groups, emails, or social media without authorization.'),
          p([TR('Any misuse, leakage, or unauthorized sharing of sales data or customer information will be treated as a serious breach of confidentiality and may lead to immediate termination and legal action as per company policy.')]),

          h('5. Data Privacy & Confidentiality:'),
          p([TR('GO-SOLAR follows a zero-tolerance policy towards data breaches.')]),
          p([TR('You must protect all client, customer, technical, and company data accessed during employment.')]),
          p([TR('Upon exit, all company data stored on your personal devices must be handed over and permanently deleted.')]),

          h('6. Dual Employment Restriction:'),
          p([TR('You shall not engage, directly or indirectly, with any other organization in any form.')]),
          p([TR('Violation will result in immediate termination and financial liabilities as assessed by the company.')]),

          h('7. Notice Period & Termination:'),
          p([TR('The applicable notice period will be:')]),
          bullet('Up to 2 years of service: 1 month'),
          bullet('More than 2 years and up to 4 years: 2 months'),
          bullet('More than 4 years: 3 months'),
          p([TR('Either party may terminate employment by giving the applicable notice period or salary in lieu.')]),
          p([TR('The company may terminate employment without notice in case of misconduct, policy violation, or breach of confidentiality.')]),

          h('8. Code of Conduct:'),
          p([TR('You are required to maintain professionalism, discipline, and respectful behaviour with colleagues, reporting managers, clients, and customers at all times.')]),

          h('9. Work Culture & Performance:'),
          p([TR('We value employees who show initiative, creativity, dedication, and a willingness to go beyond routine tasks.')]),
          p([TR('Exceptional performance will be rewarded through company recognition programs.')]),

          h('10. Continuous Feedback & Improvement:'),
          p([TR('You will receive regular feedback from your Reporting Manager.')]),
          p([TR('You are encouraged to seek clarification and provide feedback for continuous improvement.')]),

          h('11. Salary & Reimbursements:'),
          p([TR(`Your monthly salary will be ${salaryText}`)]),
          p([TR('Approved official expenses (travel, calls, site visits, etc.) will be reimbursed on actuals, subject to valid bills.')]),

          h('12. Incentive Structure - Solar Power Plant (SPP):'),
          p([TR('In addition to salary, you will be eligible for incentives as follows:')]),
          bullet('1KW - 50KW: 2% of Invoice Value'),
          bullet('50KW - 250KW: 1.5% of Invoice Value'),
          bullet('250KW & above: 1% of Invoice Value'),
          p([TR('Incentives will be shared among members involved in closing the sale.')]),

          h('13. Company Property:'),
          p([TR('All company documents, tools, equipment, devices, or materials issued to you must be returned on your last working day.')]),
          p([TR('Any loss or non-return may be recovered from your final settlement.')]),

          h('14. Amendments:'),
          p([TR('GO-SOLAR reserves the right to modify, update, or amend policies and terms of employment at any time.')]),
          p([TR('Such updates shall be binding on all employees.')]),
          divider(),

          new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }),

          ...letterhead(),
          new Paragraph({ children: [TR('ANNEXURE - B', { bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
          new Paragraph({ children: [TR(`ROLES & RESPONSIBILITIES (${designation}):`, { bold: true })], spacing: { after: 200 } }),

          ...(responsibilities.length
            ? responsibilities.map((item, index) => p([TR(`${index + 1}. ${item}`)]))
            : [p([TR('1. Roles and responsibilities to be updated by HR.')])]),

          divider(),

          new Paragraph({ children: [new PageBreak()], spacing: { after: 0 } }),

          ...letterhead(),
          new Paragraph({ children: [TR('ANNEXURE - C', { bold: true, size: 24 })], alignment: AlignmentType.CENTER, spacing: { after: 160 } }),
          new Paragraph({ children: [TR('GENERAL TERMS & CONDITIONS', { bold: true })], alignment: AlignmentType.CENTER, spacing: { after: 240 } }),

          h('1. Probation Period:'),
          bullet('Probation: 6 months'),
          bullet('Confirmation after successful performance review.'),

          h('2. Working Hours:'),
          bullet('09:30 AM to 6:30 PM'),
          bullet('Weekly Off: Sunday, 2nd Saturday, and 4th Saturday.'),
          bullet('Flexibility required during project deadlines.'),

          h('3. Leave Policy:'),
          bullet('Leave entitlement as per company leave policy.'),
          bullet('Prior approval mandatory except in emergencies.'),

          h('4. Confidentiality & Non-Disclosure:'),
          p([TR('Strict confidentiality regarding company, client, and financial information must be maintained.')]),

          h('5. Professional Conduct:'),
          p([TR('Employees must maintain integrity, punctuality, discipline, and respectful behaviour.')]),

          h('6. Termination:'),
          p([TR('Same notice-period rule applies as mentioned above.')]),
          p([TR('Immediate termination possible for misconduct or breach of confidentiality.')]),

          h('7. Company Property:'),
          p([TR('All GO-SOLAR materials and equipment must be returned upon resignation/termination.')]),

          h('8. Amendments:'),
          p([TR('Company may revise policies anytime; updated rules will apply to all employees.')]),

          empty(),
          new Paragraph({ children: [TR('EMPLOYEE ACCEPTANCE:', { bold: true })], spacing: { before: 240, after: 120 } }),
          p([TR(acceptanceText)]),
          empty(),
          p([TR(`Name: ${salutation} ${acceptanceName}               Signature: __________________________`)]),
          empty(),
          p([TR(`Date: ${acceptanceDate}        Place: ${acceptancePlace}`)]),
        ],
      }],
    })
  }

  // ───────────────────────────────────────────────
  // PERFORMANCE WARNING LETTER
  // ───────────────────────────────────────────────
  else if (type === 'warning') {
    const {
      date           = new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'2-digit',year:'numeric'}),
      warningLevel   = '1st',
      incidentDate   = '',
      incidentDetail = '',
      expectedAction = '',
      hrManager      = CO.director,
    } = extra || {}

    const sal  = emp.gender?.toLowerCase() === 'female' ? 'Ms.' : 'Mr.'
    const name = emp.name || ''
    const desig = emp.designation || ''

    doc = new Document({
      styles: DOC_STYLES,
      sections:[{ properties:{ page: PAGE }, children:[
        ...letterhead(),
        p([TR(`Date: ${date}`)]), empty(),
        p([TR('To,')]),
        p([TR(name.toUpperCase(), {bold:true})]),
        p([TR(desig)]),
        p([TR(`Employee Code: ${emp.emp_code || ''}`)]),
        p([TR(`Department: ${emp.department || ''}`)]),
        empty(),
        new Paragraph({
          children:[TR(`Subject: ${warningLevel} Performance Warning Letter`, {bold:true, size:24})],
          spacing:{after:200}
        }),
        empty(),
        p([TR(`Dear ${sal} ${name.split(' ')[0]},`)]),
        empty(),
        new Paragraph({ spacing:{after:120}, children:[
          TR('This letter serves as a '), TR(`${warningLevel} Warning`, {bold:true}),
          TR(' regarding your conduct/performance as an employee of GO–SOLAR Solutions.')
        ]}),
        empty(),
        h('Incident / Issue Details:'),
        ...(incidentDate ? [p([TR(`Date of Incident: ${incidentDate}`)])] : []),
        p([TR(incidentDetail || '[ Describe the incident or performance issue in detail ]')]),
        empty(),
        h('Impact:'),
        p([TR('The above behaviour/performance is in violation of company policy and is unacceptable. Such conduct adversely affects team productivity, client relationships, and the overall work environment.')]),
        empty(),
        h('Expected Corrective Action:'),
        p([TR(expectedAction || '[ Describe the specific improvement expected from the employee ]')]),
        empty(),
        h('Consequences:'),
        new Paragraph({ spacing:{after:120}, children:[
          TR('Please note that failure to demonstrate immediate and sustained improvement may result in '),
          TR('further disciplinary action, including termination of employment', {bold:true}),
          TR(', as per the company\'s HR policy and the Maharashtra Shops & Establishments Act, 1948.'),
        ]}),
        empty(),
        p([TR('This letter will be placed on your permanent employment record.')]),
        p([TR('You are requested to acknowledge receipt of this letter by signing below.')]),
        empty(), empty(),
        p([TR('Yours sincerely,')]),
        empty(), empty(),
        p([TR(hrManager, {bold:true})]),
        p([TR(CO.dirTitle)]),
        p([TR('GO– Solar Solutions', {bold:true})]),
        divider(), empty(),

        h('EMPLOYEE ACKNOWLEDGEMENT:'),
        p([TR('I acknowledge that I have received and read this warning letter and understand its contents.')]),
        empty(), empty(),
        p([TR(`Employee Name: ${sal} ${name}`)]),
        empty(),
        p([TR('Signature: _________________________     Date: _______________')]),
        empty(),
        p([TR('Place: Vashi, Navi Mumbai')]),
      ]}]
    })
  } else {
    return res.status(400).json({ error: 'Invalid letter type. Use appointment or warning.' })
  }

  // Stream the docx
  const buffer = await Packer.toBuffer(doc)
  const fname  = `${type}_letter_${emp?.emp_code || 'employee'}_${Date.now()}.docx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.send(buffer)
}
