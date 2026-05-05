import { NextResponse } from 'next/server'

export function middleware(req) {
  const auth = req.cookies.get('hrms_auth')?.value

  const isLoginPage  = req.nextUrl.pathname === '/login'
  const isApiAuth    = req.nextUrl.pathname.startsWith('/api/auth')

  // Allow login page and auth APIs through
  if (isLoginPage || isApiAuth) return NextResponse.next()

  // Not authenticated → redirect to login
  if (!auth) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
