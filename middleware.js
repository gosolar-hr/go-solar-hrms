import { NextResponse } from 'next/server'

export function middleware(request) {
  const auth        = request.cookies.get('hrms_auth')?.value
  const { pathname } = request.nextUrl

  const isLoginPage = pathname === '/login'
  const isApiAuth   = pathname.startsWith('/api/auth')
  const isStatic    = pathname.startsWith('/_next') ||
                      pathname.startsWith('/favicon')

  if (isStatic || isLoginPage || isApiAuth) {
    return NextResponse.next()
  }

  if (!auth) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
