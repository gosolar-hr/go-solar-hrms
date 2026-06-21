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

  useEffect(() => {
    const roleCookie = document.cookie
      .split('; ')
      .find(c => c.startsWith('hrms_role='))
      ?.split('=')[1]
    const sessionCookie = document.cookie
      .split('; ')
      .find(c => c.startsWith('hrms_session='))
      ?.split('=')[1]
    if (sessionCookie) {
      router.replace(roleCookie === 'tech' ? '/amc' : '/')
    } else {
      setTimeout(() => setReady(true), 100)
    }
  }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!pw) return setError('Please enter your password')
    if (role === 'hr' && !email) return setError('Please enter your email')
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ email, password: pw, role }),
      })

      if (res.ok) {
        const data = await res.json()
        // Use window.location instead of router.push — ensures the cookie
        // is fully committed before the next page load hits middleware
        window.location.href = data.redirect || '/'
      } else {
        let errorMsg = 'Invalid credentials'
        try {
          const data = await res.json()
          errorMsg = data.error || errorMsg
        } catch (_) {
          errorMsg = `Server error (${res.status}). Please check your server logs/environment variables.`
        }
        setError(errorMsg)
        setLoading(false)
      }
    } catch (err) {
      setError(err.message || 'Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Sign In | Go Solar HRMS</title>
      </Head>

      <style suppressHydrationWarning>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #F8F9FB;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 460px;
        }

        /* ── LEFT ── */
        .left {
          background: #fff;
          border-right: 1px solid #E4E7EC;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px 56px;
          position: relative;
          overflow: hidden;
        }

        /* Dot grid */
        .left::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, #E4E7EC 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.5;
          pointer-events: none;
        }

        /* Orange top bar */
        .left::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #F97316, #EA6A05);
        }

        /* Soft glow */
        .glow {
          position: absolute;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(249,115,22,0.07) 0%, transparent 70%);
          top: -100px; right: -100px;
          pointer-events: none;
        }

        .left-inner { position: relative; z-index: 1; }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 64px;
        }
        .brand-icon {
          width: 48px;
          height: 48px;
          border-radius: 10px;
          object-fit: contain;
        }
        .brand-name { font-size: 15px; font-weight: 700; color: #101828; line-height: 1.2; }
        .brand-sub  { font-size: 11px; color: #98A2B3; margin-top: 2px; }

        .headline {
          font-size: 46px;
          font-weight: 700;
          color: #101828;
          line-height: 1.1;
          letter-spacing: -1.5px;
          margin-bottom: 16px;
        }
        .headline .accent { color: #F97316; }

        .tagline {
          font-size: 15px;
          color: #667085;
          line-height: 1.7;
          max-width: 400px;
          margin-bottom: 40px;
        }

        .features {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          max-width: 380px;
        }
        .feat {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: #F8F9FB;
          border: 1px solid #E4E7EC;
          border-radius: 8px;
          font-size: 12px;
          color: #475467;
          font-weight: 500;
          transition: all 0.15s;
        }
        .feat:hover {
          border-color: #FED7AA;
          background: #FFF4ED;
          color: #EA6A05;
        }

        .left-bottom { position: relative; z-index: 1; }
        .stats {
          display: flex;
          gap: 40px;
          padding-top: 28px;
          border-top: 1px solid #E4E7EC;
          margin-top: 48px;
        }
        .stat-n {
          font-size: 26px; font-weight: 700;
          color: #F97316;
          font-family: 'DM Mono', monospace;
        }
        .stat-l {
          font-size: 11px; color: #98A2B3;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* ── RIGHT ── */
        .right {
          background: #F8F9FB;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
        }

        .form-wrap {
          width: 100%;
          max-width: 360px;
          opacity: 0;
          transform: translateY(14px);
          transition: opacity 0.45s ease, transform 0.45s ease;
        }
        .form-wrap.ready { opacity: 1; transform: translateY(0); }

        /* Role tabs */
        .role-tabs {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px;
          background: #fff;
          border: 1px solid #E4E7EC;
          border-radius: 12px;
          padding: 5px;
          margin-bottom: 28px;
          box-shadow: 0 1px 3px rgba(16,24,40,0.06);
        }
        .role-tab {
          padding: 10px;
          border-radius: 8px;
          border: none;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.18s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          background: transparent;
          color: #98A2B3;
        }
        .role-tab:hover:not(.active) { color: #475467; }
        .role-tab.active {
          background: #F97316;
          color: #fff;
          box-shadow: 0 2px 8px rgba(249,115,22,0.3);
        }

        .form-card {
          background: #fff;
          border: 1px solid #E4E7EC;
          border-radius: 16px;
          padding: 32px 28px;
          box-shadow: 0 1px 3px rgba(16,24,40,0.08), 0 4px 16px rgba(16,24,40,0.04);
        }

        .form-title {
          font-size: 22px;
          font-weight: 700;
          color: #101828;
          letter-spacing: -0.4px;
          margin-bottom: 4px;
        }
        .form-sub {
          font-size: 13px;
          color: #667085;
          margin-bottom: 24px;
          line-height: 1.5;
        }

        .field { margin-bottom: 16px; }
        .field label {
          display: block;
          font-size: 11.5px;
          font-weight: 600;
          color: #344054;
          margin-bottom: 6px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .input-wrap { position: relative; }
        .input-icon {
          position: absolute;
          left: 12px; top: 50%;
          transform: translateY(-50%);
          color: #D0D5DD;
          pointer-events: none;
          display: flex;
        }
        .input-wrap input {
          width: 100%;
          height: 44px;
          padding: 0 44px 0 36px;
          border: 1.5px solid #E4E7EC;
          border-radius: 10px;
          font-size: 13.5px;
          font-family: 'DM Sans', sans-serif;
          color: #101828;
          background: #fff;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-wrap.no-icon input { padding-left: 14px; }
        .input-wrap input:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 4px rgba(249,115,22,0.1);
        }
        .input-wrap input::placeholder { color: #D0D5DD; }
        .eye-btn {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: #D0D5DD;
          display: flex; align-items: center;
          padding: 4px;
          transition: color 0.15s;
        }
        .eye-btn:hover { color: #F97316; }

        .error-box {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #FEF3F2;
          border: 1px solid #FECDCA;
          border-radius: 8px;
          font-size: 12.5px;
          color: #B42318;
          margin-top: 8px;
        }

        .submit-btn {
          width: 100%;
          height: 46px;
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
          box-shadow: 0 2px 8px rgba(249,115,22,0.25);
        }
        .submit-btn:hover:not(:disabled) {
          background: #EA6A05;
          box-shadow: 0 4px 16px rgba(249,115,22,0.35);
          transform: translateY(-1px);
        }
        .submit-btn:active  { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.65s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .form-footer {
          margin-top: 20px;
          padding-top: 16px;
          border-top: 1px solid #F2F4F7;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-dot {
          width: 7px; height: 7px;
          background: #12B76A;
          border-radius: 50%;
          flex-shrink: 0;
          box-shadow: 0 0 5px rgba(18,183,106,0.5);
          animation: blink 2.5s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .footer-text { font-size: 11.5px; color: #98A2B3; }

        .version {
          text-align: center;
          margin-top: 16px;
          font-size: 11.5px;
          color: #667085;
          font-family: 'DM Mono', monospace;
          font-weight: 500;
          letter-spacing: 0.03em;
        }

        @media (max-width: 768px) {
          .shell { grid-template-columns: 1fr; }
          .left  { display: none; }
          .right { background: #F8F9FB; min-height: 100vh; }
        }
      `}</style>

      <div className="shell">

        {/* LEFT */}
        <div className="left">
          <div className="glow" />
          <div className="left-inner">
            <div className="brand">
              <img
                src="/logo.jpg"
                className="brand-icon"
                alt="Go Solar Solutions"
              />
              <div>
                <div className="brand-name">Go Solar Solutions</div>
                <div className="brand-sub">Warrington Renewsol Pvt. Ltd</div>
              </div>
            </div>

            <div className="headline">
              HR & Payroll<br />
              for <span className="accent">Go Solar.</span>
            </div>
            <div className="tagline">
              Manage employees, process payroll, track attendance,
              stay compliant — and plan O&M operations.
              All in one clean internal tool.
            </div>

            <div className="features">
              {FEATURES.map(f => (
                <div className="feat" key={f.label}>
                  <span style={{ fontSize: 14 }}>{f.icon}</span>
                  {f.label}
                </div>
              ))}
            </div>
          </div>

          <div className="left-bottom">
            <div className="stats">
              <div><div className="stat-n">15</div><div className="stat-l">Employees</div></div>
              <div><div className="stat-n">PF</div><div className="stat-l">Compliant</div></div>
              <div><div className="stat-n">v1.0</div><div className="stat-l">Phase 3</div></div>
            </div>
          </div>
        </div>

        {/* RIGHT */}
        <div className="right">
          <div className={`form-wrap ${ready ? 'ready' : ''}`}>

            {/* Role tabs */}
            <div className="role-tabs">
              <button
                type="button"
                className={`role-tab ${role === 'hr' ? 'active' : ''}`}
                onClick={() => { setRole('hr'); setError(''); setEmail(''); setPw('') }}
              >
                🏢 HR Portal
              </button>
              <button
                type="button"
                className={`role-tab ${role === 'technician' ? 'active' : ''}`}
                onClick={() => { setRole('technician'); setError(''); setPw('') }}
              >
                🔧 Technician
              </button>
            </div>

            <div className="form-card">
              <div className="form-title">
                {role === 'hr' ? 'Welcome back' : 'Field Access'}
              </div>
              <div className="form-sub">
                {role === 'hr'
                  ? 'Sign in to access the full HRMS dashboard'
                  : 'Sign in to access O&M and AMC schedules'}
              </div>

              <form onSubmit={onSubmit}>
                <div className="field">
                  <label>Email Address</label>
                  <div className="input-wrap">
                    <span className="input-icon">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </span>
                    <input
                      type="email"
                      placeholder="Enter your email address"
                      value={email}
                      onChange={e => { setEmail(e.target.value); setError('') }}
                      autoFocus
                      id="email"
                      name="email"
                      autoComplete="email"
                    />
                  </div>
                </div>

                <div className="field">
                  <label>Password</label>
                  <div className={`input-wrap ${role === 'technician' ? 'no-icon' : ''}`}>
                    {role === 'hr' && (
                      <span className="input-icon">
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </span>
                    )}
                    <input
                      type={show ? 'text' : 'password'}
                      placeholder="Enter password"
                      value={pw}
                      onChange={e => { setPw(e.target.value); setError('') }}
                      autoFocus={role === 'technician'}
                      id="password"
                      name="password"
                      autoComplete="current-password"
                      style={role === 'technician' ? { paddingLeft: '14px' } : {}}
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
                <span className="footer-text">Secured · Active Session</span>
              </div>
            </div>

            <div className="version">
              <div style={{ marginBottom: 4, opacity: 0.6 }}>HRMS PHASE 3 · VERSION 1</div>
              <div style={{ color: '#101828', fontWeight: 600 }}>
                Powered by <span style={{ background: 'linear-gradient(135deg, #2563eb 0%, #00d2ff 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', fontWeight: 700, display: 'inline-block' }}>SoftSync Lab</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}
