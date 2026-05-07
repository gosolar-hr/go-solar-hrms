import { supabaseAdmin } from '../../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { type, employee_id, extra } = req.body

  if (!type || !employee_id) {
    return res.status(400).json({ error: 'type and employee_id required' })
  }

  const { data: emp, error } = await supabaseAdmin
    .from('employees')
    .select('*')
    .eq('id', employee_id)
    .single()

  if (error || !emp) return res.status(404).json({ error: 'Employee not found' })

  // Dynamically import docx (server-side only)
  const {
    Document, Packer, Paragraph, TextRun, AlignmentType,
    HeadingLevel, BorderStyle, PageBreak, LevelFormat
  } = await import('docx')

  const CO = {
    name    : 'GO – SOLAR SOLUTIONS',
    full    : 'Warrington Renewsol Pvt. Ltd',
    addr1   : '1st Floor, Go Solar House, Plot no. 130, Behind APMC Police Station,',
    addr2   : 'Sector 19C, APMC Market 1, Vashi, Navi Mumbai, Maharashtra 400703',
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

  const letterhead = () => [
    new Paragraph({ children:[TR(CO.name, {bold:true, size:28})], alignment:AlignmentType.CENTER, spacing:{after:60} }),
    new Paragraph({ children:[TR(CO.full, {size:20})], alignment:AlignmentType.CENTER, spacing:{after:40} }),
    new Paragraph({ children:[TR(CO.addr1, {size:18})], alignment:AlignmentType.CENTER, spacing:{after:20} }),
    new Paragraph({ children:[TR(CO.addr2, {size:18})], alignment:AlignmentType.CENTER, spacing:{after:60} }),
    divider(), empty(),
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
      date             = new Date().toLocaleDateString('en-IN', {day:'2-digit',month:'2-digit',year:'numeric'}),
      address          = '',
      phone            = emp.phone || '',
      email            = emp.email || '',
      reportingTo      = CO.director,
      joiningDate      = emp.date_of_joining
        ? new Date(emp.date_of_joining).toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})
        : '',
      contractDuration = '2 years',
      responsibilities = [],
    } = extra || {}

    const sal   = emp.gender?.toLowerCase() === 'female' ? 'Ms.' : 'Mr.'
    const name  = emp.name || ''
    const desig = emp.designation || ''
    const salary = (
      (Number(emp.basic_salary)||0) + (Number(emp.hra)||0) +
      (Number(emp.cca)||0) + (Number(emp.conveyance)||0) +
      (Number(emp.allowances)||0)
    ).toLocaleString('en-IN')

    doc = new Document({
      numbering: NUMBERING, styles: DOC_STYLES,
      sections:[{ properties:{ page: PAGE }, children:[
        ...letterhead(),
        p([TR(`Date: ${date}`)]), empty(),
        p([TR('To,')]),
        p([TR(name.toUpperCase(), {bold:true})]),
        ...(address ? [p([TR(address)])] : []),
        ...(phone   ? [p([TR(`Mobile: ${phone}`)])] : []),
        ...(email   ? [p([TR(`Mail Id: ${email}`)])] : []),
        empty(),
        p([TR('Subject: Appointment Letter', {bold:true})]), empty(),
        p([TR(`Dear ${sal} ${name.split(' ')[0]},`)]), empty(),
        new Paragraph({ spacing:{after:120}, children:[
          TR('We are pleased to appoint you as '), TR(desig, {bold:true}),
          TR(' at GO–SOLAR Solutions. Your selection is based on your qualifications, experience, and suitability for the role.'),
        ]}),
        p([TR('We look forward to you joining us. Please sign the duplicate and attach a copy of your PAN Card/Aadhaar Card as acceptance.')]),
        empty(),
        p([TR('Congratulations!', {bold:true})], {align:AlignmentType.CENTER}),
        empty(), empty(),
        p([TR(CO.director, {bold:true})]), p([TR(CO.dirTitle)]), p([TR('GO– Solar Solutions', {bold:true})]),

        // ── ANNEXURE A ──
        new Paragraph({ children:[new PageBreak()], spacing:{after:0} }),
        new Paragraph({ children:[TR('ANNEXURE – A', {bold:true, size:24})], alignment:AlignmentType.CENTER, spacing:{after:120} }),
        new Paragraph({ children:[TR('TERMS & CONDITIONS OF EMPLOYMENT', {bold:true})], alignment:AlignmentType.CENTER, spacing:{after:240} }),

        h('1. Designation & Reporting:'),
        new Paragraph({ spacing:{after:120}, children:[TR('You are appointed as '), TR(desig, {bold:true}), TR(` reporting to ${reportingTo}. Your roles and responsibilities are detailed in Annexure B.`)]}),

        h('2. Contract Confirmation & Duration:'),
        p([TR(`Your contract confirmation date will be ${joiningDate}.`)]),
        p([TR(`The duration of your employment contract is ${contractDuration}.`)]),
        p([TR("If you resign during this contract period, you will be required to pay one month's salary as penalty, as per company policy.")]),

        h('3. Exclusivity of Employment:'),
        p([TR('You must devote your full working hours and efforts solely to GO–SOLAR. You are strictly prohibited from engaging in any job, business, freelancing, or consultancy with any other organization during employment.')]),

        h('4. Intellectual Property & Ownership of Work:'),
        p([TR('All customer details, pricing information, lead data, proposals, quotations, and business strategies accessed during your employment shall remain the exclusive property of GO–SOLAR.')]),
        p([TR('You are strictly prohibited from:')]),
        bullet('Sharing customer lists, lead data, pricing, or business strategies with any external party.'),
        bullet('Using company data or customer information for personal benefit or for any competitor.'),
        bullet('Disclosing commercial offers, margins, or internal processes without written approval.'),
        bullet('Storing or transferring company data to personal devices without authorization.'),
        p([TR('Any misuse or unauthorized sharing will be treated as a serious breach and may lead to immediate termination and legal action.')]),

        h('5. Data Privacy & Confidentiality:'),
        p([TR('GO–SOLAR follows a zero-tolerance policy towards data breaches. Upon exit, all company data must be handed over and permanently deleted from personal devices.')]),

        h('6. Dual Employment Restriction:'),
        p([TR('You shall not engage, directly or indirectly, with any other organization. Violation will result in immediate termination.')]),

        h('7. Notice Period & Termination:'),
        p([TR('The applicable notice period:')]),
        bullet('Up to 2 years of service: 1 month'),
        bullet('More than 2 years and up to 4 years: 2 months'),
        bullet('More than 4 years: 3 months'),
        p([TR('The company may terminate without notice in case of misconduct or breach of confidentiality.')]),

        h('8. Code of Conduct:'),
        p([TR('You are required to maintain professionalism, discipline, and respectful behaviour at all times.')]),

        h('9. Work Culture & Performance:'),
        p([TR('We value initiative, creativity, and dedication. Exceptional performance will be rewarded through company recognition programs.')]),

        h('10. Continuous Feedback & Improvement:'),
        p([TR('You will receive regular feedback from your Reporting Manager and are encouraged to seek clarification for continuous improvement.')]),

        h('11. Salary & Reimbursements:'),
        p([TR(`Your monthly salary will be INR ${salary}/-`)]),
        p([TR('Approved official expenses will be reimbursed on actuals, subject to valid bills.')]),

        h('12. Incentive Structure – Solar Power Plant (SPP):'),
        p([TR('In addition to salary, you will be eligible for incentives as follows:')]),
        bullet('1KW – 50KW: 2% of Invoice Value'),
        bullet('50KW – 250KW: 1.5% of Invoice Value'),
        bullet('250KW & above: 1% of Invoice Value'),
        p([TR('Incentives will be shared among members involved in closing the sale.')]),

        h('13. Company Property:'),
        p([TR('All company materials issued must be returned on your last working day. Any non-return may be recovered from final settlement.')]),

        h('14. Amendments:'),
        p([TR('GO–SOLAR reserves the right to modify terms of employment at any time. Updates shall be binding on all employees.')]),
        divider(),

        // ── ANNEXURE B ──
        new Paragraph({ children:[new PageBreak()], spacing:{after:0} }),
        new Paragraph({ children:[TR('ANNEXURE – B', {bold:true, size:24})], alignment:AlignmentType.CENTER, spacing:{after:120} }),
        new Paragraph({ children:[TR(`ROLES & RESPONSIBILITIES (${desig.toUpperCase()}):`, {bold:true})], alignment:AlignmentType.CENTER, spacing:{after:240} }),
        ...(responsibilities.length > 0
          ? responsibilities.map(r => bullet(r))
          : [p([TR('[ Job responsibilities to be filled in by HR Manager ]', {italics:true, color:'888888'})])]),
        divider(),

        // ── ANNEXURE C ──
        new Paragraph({ children:[new PageBreak()], spacing:{after:0} }),
        new Paragraph({ children:[TR('ANNEXURE – C', {bold:true, size:24})], alignment:AlignmentType.CENTER, spacing:{after:120} }),
        new Paragraph({ children:[TR('GENERAL TERMS & CONDITIONS', {bold:true})], alignment:AlignmentType.CENTER, spacing:{after:240} }),

        h('1. Probation Period:'),
        p([TR('Probation: 6 months')]),
        p([TR('Confirmation after successful performance review.')]),

        h('2. Working Hours:'),
        p([TR('09:30 AM to 6:30 PM')]),
        p([TR('Weekly Off: Sunday, 2nd Saturday, and 4th Saturday.')]),
        p([TR('Flexibility required during project deadlines.')]),

        h('3. Leave Policy:'),
        p([TR('Leave entitlement as per company leave policy. Prior approval mandatory except in emergencies.')]),

        h('4. Confidentiality & Non-Disclosure:'),
        p([TR('Strict confidentiality regarding company, client, and financial information must be maintained.')]),

        h('5. Professional Conduct:'),
        p([TR('Employees must maintain integrity, punctuality, discipline, and respectful behaviour.')]),

        h('6. Termination:'),
        p([TR('Same notice-period rules apply. Immediate termination possible for misconduct or breach of confidentiality.')]),

        h('7. Company Property:'),
        p([TR('All GO–SOLAR materials and equipment must be returned upon resignation/termination.')]),

        h('8. Amendments:'),
        p([TR('Company may revise policies anytime; updated rules will apply to all employees.')]),
        divider(), empty(),

        new Paragraph({ children:[TR('EMPLOYEE ACCEPTANCE:', {bold:true})], spacing:{before:240, after:120} }),
        p([TR('I hereby acknowledge that I have read, understood, and agreed to all terms and conditions of this Appointment Letter and its Annexures.')]),
        empty(), empty(),
        p([TR(`Name: ${sal} ${name}     Signature: __________________________`)]),
        p([TR(`Date: ${date}     Place: Vashi, Navi Mumbai`)]),
      ]}]
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
  const fname  = `${type}_letter_${emp.emp_code || 'employee'}_${Date.now()}.docx`

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', `attachment; filename="${fname}"`)
  res.send(buffer)
}
