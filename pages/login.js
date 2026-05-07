import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const FEATURES = [
  { icon: '👥', label: 'Employee Management' },
  { icon: '📅', label: 'Biometric Attendance' },
  { icon: '💰', label: 'Payroll Engine' },
  { icon: '📋', label: 'PF & ESIC Compliance' },
  { icon: '🏗️', label: 'O&M / AMC Tracking' },
  { icon: '📄', label: 'Letter Generation' },
]

export default function Login() {
  const router    = useRouter()
  const [email,   setEmail]   = useState('')
  const [pw,      setPw]      = useState('')
  const [role,    setRole]    = useState('hr')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [show,    setShow]    = useState(false)
  const [ready,   setReady]   = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTimeout(() => setReady(true), 100)
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!pw) return setError('Please enter your password')
    if (role === 'hr' && !email) return setError('Please enter your email')
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/login', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ email, password: pw, role }),
    })

    if (res.ok) {
      const data = await res.json()
      router.push(data.redirect || '/')
    } else {
      const data = await res.json()
      setError(data.error || 'Invalid credentials')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sign In | Go Solar HRMS</title>
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </Head>

      <style suppressHydrationWarning>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #0A0E14;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        /* ── SHELL ── */
        .shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 460px;
        }

        /* ── LEFT ── */
        .left {
          position: relative;
          overflow: hidden;
          background: #0A0E14;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 56px;
        }

        /* Animated grid background */
        .left::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image:
            linear-gradient(rgba(249,115,22,0.06) 1px, transparent 1px),
            linear-gradient(90deg, rgba(249,115,22,0.06) 1px, transparent 1px);
          background-size: 48px 48px;
          animation: gridMove 20s linear infinite;
        }

        @keyframes gridMove {
          from { background-position: 0 0; }
          to   { background-position: 48px 48px; }
        }

        /* Glow orbs */
        .orb1, .orb2 {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          pointer-events: none;
        }
        .orb1 {
          width: 400px; height: 400px;
          background: radial-gradient(circle, rgba(249,115,22,0.18) 0%, transparent 70%);
          top: -100px; left: -100px;
          animation: orbFloat 8s ease-in-out infinite;
        }
        .orb2 {
          width: 300px; height: 300px;
          background: radial-gradient(circle, rgba(249,115,22,0.10) 0%, transparent 70%);
          bottom: 50px; right: -50px;
          animation: orbFloat 10s ease-in-out infinite reverse;
        }
        @keyframes orbFloat {
          0%,100% { transform: translate(0, 0); }
          50%      { transform: translate(30px, 20px); }
        }

        .left-inner { position: relative; z-index: 1; }

        /* Brand */
        .brand { display: flex; align-items: center; gap: 14px; margin-bottom: 80px; }
        .brand-icon {
          width: 44px; height: 44px;
          background: linear-gradient(135deg, #F97316, #EA6A05);
          border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif;
          font-size: 20px; font-weight: 800; color: #fff;
          box-shadow: 0 0 20px rgba(249,115,22,0.4);
        }
        .brand-text { line-height: 1.2; }
        .brand-name { font-family: 'Syne', sans-serif; font-size: 15px; font-weight: 700; color: #F3F4F6; }
        .brand-sub  { font-size: 11px; color: #4B5563; margin-top: 2px; }

        /* Headline */
        .headline {
          font-family: 'Syne', sans-serif;
          font-size: 52px;
          font-weight: 800;
          color: #F9FAFB;
          line-height: 1.08;
          letter-spacing: -2px;
          margin-bottom: 20px;
        }
        .headline .accent { color: #F97316; }
        .headline .dim    { color: #374151; }

        .tagline {
          font-size: 15px;
          color: #6B7280;
          line-height: 1.75;
          max-width: 420px;
          margin-bottom: 44px;
        }

        /* Feature grid */
        .features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          max-width: 400px;
        }
        .feat {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 14px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 8px;
          font-size: 12px;
          color: #9CA3AF;
          transition: all 0.2s;
        }
        .feat:hover {
          background: rgba(249,115,22,0.08);
          border-color: rgba(249,115,22,0.25);
          color: #F97316;
        }
        .feat-icon { font-size: 14px; }

        /* Bottom stats */
        .left-bottom { position: relative; z-index: 1; }
        .stats {
          display: flex;
          gap: 40px;
          padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.08);
          margin-top: 56px;
        }
        .stat-n { font-family: 'DM Mono', monospace; font-size: 26px; font-weight: 500; color: #F97316; }
        .stat-l { font-size: 11px; color: #4B5563; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.07em; }

        /* ── RIGHT ── */
        .right {
          background: #0F1419;
          border-left: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
          position: relative;
        }
        .right::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(249,115,22,0.06) 0%, transparent 60%);
          pointer-events: none;
        }

        .form-wrap {
          width: 100%;
          max-width: 360px;
          position: relative;
          z-index: 1;
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .form-wrap.ready { opacity: 1; transform: translateY(0); }

        /* Role switcher */
        .role-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 12px;
          padding: 5px;
          margin-bottom: 32px;
        }
        .role-tab {
          padding: 10px;
          border-radius: 8px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .role-tab.inactive {
          background: transparent;
          color: #4B5563;
        }
        .role-tab.inactive:hover { color: #9CA3AF; }
        .role-tab.active {
          background: #F97316;
          color: #fff;
          box-shadow: 0 0 16px rgba(249,115,22,0.35);
        }

        /* Header */
        .form-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 700;
          color: #F9FAFB;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .form-sub {
          font-size: 13px;
          color: #4B5563;
          margin-bottom: 28px;
          line-height: 1.5;
        }

        /* Fields */
        .field { margin-bottom: 16px; }
        .field label {
          display: block;
          font-size: 11.5px;
          font-weight: 600;
          color: #6B7280;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .input-wrap { position: relative; }
        .input-wrap input {
          width: 100%;
          height: 46px;
          padding: 0 46px 0 14px;
          background: rgba(255,255,255,0.04);
          border: 1.5px solid rgba(255,255,255,0.10);
          border-radius: 10px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #F3F4F6;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
        }
        .input-wrap input:focus {
          background: rgba(249,115,22,0.05);
          border-color: #F97316;
          box-shadow: 0 0 0 4px rgba(249,115,22,0.12);
        }
        .input-wrap input::placeholder { color: #374151; }
        .input-icon {
          position: absolute;
          left: 14px; top: 50%;
          transform: translateY(-50%);
          color: #374151;
          pointer-events: none;
        }
        .input-wrap .input-icon + input { padding-left: 40px; }
        .eye-btn {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: #374151;
          display: flex; align-items: center;
          padding: 4px;
          transition: color 0.15s;
        }
        .eye-btn:hover { color: #F97316; }

        /* Error */
        .error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: rgba(240,68,56,0.08);
          border: 1px solid rgba(240,68,56,0.25);
          border-radius: 8px;
          font-size: 12.5px;
          color: #F87171;
          margin-top: 4px;
        }

        /* Submit */
        .submit-btn {
          width: 100%;
          height: 48px;
          background: #F97316;
          color: #fff;
          border: none;
          border-radius: 10px;
          font-size: 14px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          margin-top: 20px;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 0 0 rgba(249,115,22,0);
        }
        .submit-btn:hover:not(:disabled) {
          background: #EA6A05;
          box-shadow: 0 0 24px rgba(249,115,22,0.35);
          transform: translateY(-1px);
        }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.65s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Footer */
        .form-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-dot {
          width: 7px; height: 7px;
          background: #10B981;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(16,185,129,0.6);
          animation: blink 2.5s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .footer-text { font-size: 11.5px; color: #374151; }

        .version {
          text-align: center;
          margin-top: 20px;
          font-size: 11px;
          color: #1F2937;
          font-family: 'DM Mono', monospace;
        }

        @media (max-width: 768px) {
          .shell { grid-template-columns: 1fr; }
          .left  { display: none; }
          .right { background: #0A0E14; }
        }
      `}</style>

      <div className="shell">
        {/* LEFT */}
        <div className="left">
          <div className="orb1" /><div className="orb2" />
          <div className="left-inner">
            <div className="brand">
              <div className="brand-icon">G</div>
              <div className="brand-text">
                <div className="brand-name">Go Solar Solutions</div>
                <div className="brand-sub">Warrington Renewsol Pvt. Ltd</div>
              </div>
            </div>
            <div className="headline">
              HR & Payroll<br />
              <span className="accent">Reimagined</span><br />
              <span className="dim">for Solar.</span>
            </div>
            <div className="tagline">
              Manage employees, process payroll, track attendance,
              stay compliant — and now, plan O&M operations.
              All in one clean internal tool.
            </div>
            <div className="features">
              {FEATURES.map(f => (
                <div className="feat" key={f.label}>
                  <span className="feat-icon">{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>
          <div className="left-bottom">
            <div className="stats">
              <div><div className="stat-n">15</div><div className="stat-l">Employees</div></div>
              <div><div className="stat-n">PF</div><div className="stat-l">Compliant</div></div>
              <div><div className="stat-n">v2.0</div><div className="stat-l">Phase 2</div></div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="right">
          <div className={`form-wrap ${ready ? 'ready' : ''}`}>

            {/* Role switcher */}
            <div className="role-tabs">
              <button
                type="button"
                className={`role-tab ${role === 'hr' ? 'active' : 'inactive'}`}
                onClick={() => { setRole('hr'); setError(''); setEmail(''); setPw('') }}
              >
                🏢 HR Portal
              </button>
              <button
                type="button"
                className={`role-tab ${role === 'technician' ? 'active' : 'inactive'}`}
                onClick={() => { setRole('technician'); setError(''); setEmail(''); setPw('') }}
              >
                🔧 Technician
              </button>
            </div>

            <div className="form-title">
              {role === 'hr' ? 'Welcome back' : 'Field Access'}
            </div>
            <div className="form-sub">
              {role === 'hr'
                ? 'Sign in to access the full HRMS dashboard'
                : 'Sign in to access O&M and AMC schedules'}
            </div>

            <form onSubmit={onSubmit}>
              {/* Email — shown for HR only */}
              {role === 'hr' && (
                <div className="field">
                  <label>Email Address</label>
                  <div className="input-wrap">
                    <span className="input-icon">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      placeholder="hr@gosolar.co.in"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      autoFocus={role === 'hr'}
                      style={{ paddingLeft: '40px' }}
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div className="field">
                <label>Password</label>
                <div className="input-wrap">
                  <input
                    type={show ? 'text' : 'password'}
                    placeholder={role === 'hr' ? 'Your HR password' : 'Technician password'}
                    value={pw}
                    onChange={e => { setPw(e.target.value); setError('') }}
                    autoFocus={role === 'technician'}
                  />
                  <button type="button" className="eye-btn" onClick={() => setShow(s => !s)}>
                    {show ? (
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {error && (
                  <div className="error-box">
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                )}
              </div>

              <button type="submit" className="submit-btn" disabled={loading}>
                {loading
                  ? <><div className="spinner" /> Signing in...</>
                  : role === 'hr' ? 'Access HR Dashboard →' : 'Access Field Portal →'
                }
              </button>
            </form>

            <div className="form-footer">
              <div className="status-dot" />
              <span className="footer-text">Secured · Session expires in 8 hours</span>
            </div>
          </div>
          <div className="version">HRMS · Phase 2 · v2.0 · Made by Softsync Solutions</div>
        </div>
      </div>
    </>
  )
}
