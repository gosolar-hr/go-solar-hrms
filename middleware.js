import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-for-development-only'
)

export async function middleware(request) {
  const token = request.cookies.get('hrms_session')?.value
  const { pathname } = request.nextUrl

  const isLoginPage = pathname === '/login'
  const isApiAuth   = pathname.startsWith('/api/auth')
  const isStatic    = pathname.startsWith('/_next') || pathname.startsWith('/favicon')

  // Always allow static files, login page, and login API
  if (isStatic || isApiAuth) return NextResponse.next()

  // Not logged in → redirect to login
  if (!token) {
    if (isLoginPage) return NextResponse.next()
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    return res
  }

  try {
    const { payload } = await jwtVerify(token, secret)
    const role = payload.role

    // If logged in and visiting login page → redirect to dashboard
    if (isLoginPage) {
      return NextResponse.redirect(new URL(role === 'tech' ? '/amc' : '/', request.url))
    }

    // HR-only pages and APIs — technician cannot access
    const isHROnly =
      pathname === '/' ||
      pathname.startsWith('/employees') ||
      pathname.startsWith('/attendance') ||
      pathname.startsWith('/payroll') ||
      pathname.startsWith('/salary-statement') ||
      pathname.startsWith('/letters') ||
      pathname.startsWith('/payslip') ||
      pathname.startsWith('/api/attendance') ||
      pathname.startsWith('/api/payroll') ||
      pathname.startsWith('/api/letters') ||
      pathname.startsWith('/api/loans') ||
      pathname.startsWith('/api/advances') ||
      pathname.startsWith('/api/holidays')

    // Technician tries to access HR-only page → redirect to AMC
    if (role === 'tech' && isHROnly) {
      return NextResponse.redirect(new URL('/amc', request.url))
    }

    // Add no-cache headers to every protected page response
    // This prevents the browser back button from serving stale cached pages
    const response = NextResponse.next()
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    return response

  } catch (err) {
    // Invalid or expired token → clear cookies and redirect to login
    const res = NextResponse.redirect(new URL('/login', request.url))
    res.cookies.set('hrms_session', '', { maxAge: 0, path: '/' })
    res.cookies.set('hrms_role',    '', { maxAge: 0, path: '/' })
    res.headers.set('Cache-Control', 'no-store')
    return res
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
