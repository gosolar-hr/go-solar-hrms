import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

export default function Login() {
  const router    = useRouter()
  const [pw,      setPw]      = useState('')
  const [error,   setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const [show,    setShow]    = useState(false)
  const [ready,   setReady]   = useState(false)

  useEffect(() => { setTimeout(() => setReady(true), 80) }, [])

  const onSubmit = async (e) => {
    e.preventDefault()
    if (!pw) return setError('Please enter your password')
    setLoading(true)
    setError('')
    const res  = await fetch('/api/auth/login', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ password: pw }),
    })
    if (res.ok) {
      router.push('/')
    } else {
      const data = await res.json()
      setError(data.error || 'Incorrect password')
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>HRMS Login | Go Solar Solutions</title>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </Head>
      <style suppressHydrationWarning>{`
        *, *::before, *::after { box-sizing: border-box; margin:0; padding:0; }

        body {
          font-family: 'DM Sans', sans-serif;
          background: #F8F9FB;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        .shell {
          min-height: 100vh;
          display: grid;
          grid-template-columns: 1fr 480px;
        }

        /* ── LEFT — brand panel ── */
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

        /* Subtle dot grid */
        .left::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, #E4E7EC 1px, transparent 1px);
          background-size: 28px 28px;
          opacity: 0.6;
          pointer-events: none;
        }

        /* Orange accent bar top */
        .left::after {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: #F97316;
        }

        .left-inner { position: relative; z-index: 1; }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 72px;
        }
        .brand-icon {
          width: 40px; height: 40px;
          background: #F97316;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 800; color: #fff;
        }
        .brand-name {
          font-size: 15px; font-weight: 700; color: #101828; line-height: 1.2;
        }
        .brand-sub {
          font-size: 11px; color: #98A2B3; margin-top: 2px;
        }

        .headline {
          font-size: 44px;
          font-weight: 700;
          color: #101828;
          line-height: 1.15;
          letter-spacing: -1.5px;
          margin-bottom: 16px;
        }
        .headline span { color: #F97316; }

        .tagline {
          font-size: 15px;
          color: #667085;
          line-height: 1.7;
          max-width: 400px;
        }

        /* Feature pills */
        .pills {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          margin-top: 40px;
        }
        .pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: #F8F9FB;
          border: 1px solid #E4E7EC;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 500;
          color: #475467;
        }
        .pill-dot {
          width: 6px; height: 6px;
          background: #F97316;
          border-radius: 50%;
        }

        /* Bottom strip */
        .left-bottom { position: relative; z-index: 1; }
        .stat-row {
          display: flex;
          gap: 40px;
          padding-top: 32px;
          border-top: 1px solid #E4E7EC;
        }
        .stat-num {
          font-size: 28px;
          font-weight: 700;
          color: #101828;
          font-family: 'DM Mono', monospace;
          letter-spacing: -0.5px;
        }
        .stat-lbl {
          font-size: 11px;
          color: #98A2B3;
          margin-top: 2px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }

        /* ── RIGHT — form panel ── */
        .right {
          background: #F8F9FB;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 40px;
        }

        .form-card {
          width: 100%;
          max-width: 360px;
          background: #fff;
          border: 1px solid #E4E7EC;
          border-radius: 16px;
          padding: 40px 36px;
          box-shadow: 0 1px 3px rgba(16,24,40,0.06), 0 1px 2px rgba(16,24,40,0.04);
          opacity: 0;
          transform: translateY(12px);
          transition: opacity 0.4s ease, transform 0.4s ease;
        }
        .form-card.ready {
          opacity: 1;
          transform: translateY(0);
        }

        .form-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #FFF4ED;
          border: 1px solid #FED7AA;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 600;
          color: #EA6A05;
          margin-bottom: 20px;
          text-transform: uppercase;
          letter-spacing: 0.06em;
        }
        .badge-dot {
          width: 6px; height: 6px;
          background: #F97316;
          border-radius: 50%;
        }

        .form-title {
          font-size: 24px;
          font-weight: 700;
          color: #101828;
          letter-spacing: -0.5px;
          margin-bottom: 6px;
        }
        .form-sub {
          font-size: 13.5px;
          color: #667085;
          margin-bottom: 32px;
          line-height: 1.5;
        }

        .field { margin-bottom: 20px; }
        .field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: #344054;
          margin-bottom: 6px;
        }
        .input-wrap { position: relative; }
        .input-wrap input {
          width: 100%;
          height: 44px;
          padding: 0 44px 0 14px;
          border: 1.5px solid #D0D5DD;
          border-radius: 10px;
          font-size: 14px;
          font-family: 'DM Sans', sans-serif;
          color: #101828;
          background: #fff;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .input-wrap input:focus {
          border-color: #F97316;
          box-shadow: 0 0 0 4px rgba(249,115,22,0.1);
        }
        .input-wrap input::placeholder { color: #98A2B3; }
        .eye-btn {
          position: absolute;
          right: 12px; top: 50%;
          transform: translateY(-50%);
          background: none; border: none;
          cursor: pointer; color: #98A2B3;
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
          margin-top: 12px;
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
          margin-top: 24px;
          transition: background 0.15s, transform 0.1s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .submit-btn:hover:not(:disabled) { background: #EA6A05; transform: translateY(-1px); }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .spinner {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.65s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .form-footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid #F2F4F7;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .status-dot {
          width: 7px; height: 7px;
          background: #12B76A;
          border-radius: 50%;
          animation: blink 2.5s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes blink {
          0%,100% { opacity: 1; }
          50%      { opacity: 0.3; }
        }
        .footer-text {
          font-size: 11.5px;
          color: #98A2B3;
        }

        .version {
          text-align: center;
          margin-top: 20px;
          font-size: 11px;
          color: #D0D5DD;
          font-family: 'DM Mono', monospace;
        }
      `}</style>

      <div className="shell">

        {/* LEFT PANEL */}
        <div className="left">
          <div className="left-inner">
            {/* Brand */}
            <div className="brand">
              <div className="brand-icon">G</div>
              <div>
                <div className="brand-name">Go Solar Solutions</div>
                <div className="brand-sub">Warrington Renewsol Pvt. Ltd</div>
              </div>
            </div>

            {/* Headline */}
            <div className="headline">
              HR & Payroll<br />
              for <span>Go Solar</span>
            </div>
            <div className="tagline">
              Manage employees, process payroll, track attendance,
              and stay compliant — all in one simple internal tool.
            </div>

            {/* Feature pills */}
            <div className="pills">
              {[
                'Employee Management',
                'Biometric Attendance',
                'Payroll Engine',
                'PF & ESIC Compliance',
                'Payslip Generation',
                'Salary Statement',
              ].map(p => (
                <div className="pill" key={p}>
                  <div className="pill-dot" />
                  {p}
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="left-bottom">
            <div className="stat-row">
              <div>
                <div className="stat-num">15</div>
                <div className="stat-lbl">Employees</div>
              </div>
              <div>
                <div className="stat-num">PF</div>
                <div className="stat-lbl">Compliant</div>
              </div>
              <div>
                <div className="stat-num">v1.0</div>
                <div className="stat-lbl">Phase 2</div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT PANEL — Login form */}
        <div className="right">
          <div>
            <div className={`form-card ${ready ? 'ready' : ''}`}>

              <div className="form-badge">
                <div className="badge-dot" />
                HR Portal
              </div>

              <div className="form-title">Welcome back</div>
              <div className="form-sub">
                Sign in to access the HRMS dashboard
              </div>

              <form onSubmit={onSubmit}>
                <div className="field">
                  <label>Admin Password</label>
                  <div className="input-wrap">
                    <input
                      type={show ? 'text' : 'password'}
                      placeholder="Enter your password"
                      value={pw}
                      onChange={e => { setPw(e.target.value); setError('') }}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="eye-btn"
                      onClick={() => setShow(s => !s)}
                    >
                      {show ? (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                        </svg>
                      ) : (
                        <svg width="16" height="16" fill="none" viewBox="0 0 24 24"
                          stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round"
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {error && (
                    <div className="error-box">
                      <svg width="14" height="14" fill="none" viewBox="0 0 24 24"
                        stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round"
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {error}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="submit-btn"
                  disabled={loading}
                >
                  {loading
                    ? <><div className="spinner" /> Signing in...</>
                    : 'Sign In →'
                  }
                </button>
              </form>

              <div className="form-footer">
                <div className="status-dot" />
                <span className="footer-text">
                  Secured · Session expires in 8 hours
                </span>
              </div>
            </div>

            <div className="version">HRMS · Phase 2 · v1.0</div>
          </div>
        </div>

      </div>
    </>
  )
}
