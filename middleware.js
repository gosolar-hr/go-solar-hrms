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
  if (isStatic || isLoginPage || isApiAuth) return NextResponse.next()

  // Not logged in → redirect to login
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    // Verify Signed JWT (Critical #1)
    const { payload } = await jwtVerify(token, secret)
    const role = payload.role

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

    return NextResponse.next()
  } catch (err) {
    // Invalid token → redirect to login
    return NextResponse.redirect(new URL('/login', request.url))
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
