import { NextResponse } from 'next/server'

export function middleware(request) {
  const auth     = request.cookies.get('hrms_auth')?.value
  const role     = request.cookies.get('hrms_role')?.value
  const { pathname } = request.nextUrl

  const isLoginPage = pathname === '/login'
  const isApiAuth   = pathname.startsWith('/api/auth')
  const isStatic    = pathname.startsWith('/_next') || pathname.startsWith('/favicon')

  // Always allow
  if (isStatic || isLoginPage || isApiAuth) return NextResponse.next()

  // Not logged in → redirect to login
  if (!auth) return NextResponse.redirect(new URL('/login', request.url))

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
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
