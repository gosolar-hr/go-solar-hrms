import { NextResponse } from 'next/server'

export function middleware(request) {
  const auth     = request.cookies.get('hrms_auth')?.value
  const role     = request.cookies.get('hrms_role')?.value
  const { pathname } = request.nextUrl

  const isLoginPage = pathname === '/login'
  const isApiAuth   = pathname.startsWith('/api/auth')
  const isStatic    = pathname.startsWith('/_next') || pathname.startsWith('/favicon')
  const isAMC       = pathname.startsWith('/amc') || pathname.startsWith('/api/amc')

  // Always allow static, login, auth
  if (isStatic || isLoginPage || isApiAuth) return NextResponse.next()

  // Not logged in → redirect to login
  if (!auth) return NextResponse.redirect(new URL('/login', request.url))

  // Technician — only allowed to access /amc routes
  if (role === 'tech' && !isAMC) {
    return NextResponse.redirect(new URL('/amc', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
