import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 認証が必要なパス
const protectedPaths = ["/dashboard", "/medications", "/settings", "/calendar"]

// 認証済みユーザーがアクセスできないパス
const authPaths = ["/login", "/register", "/forgot-password"]

export function middleware(request: NextRequest) {
  // ミドルウェアを一時的に無効化して、クライアントサイドでの認証チェックに任せる
  return NextResponse.next()

  /* 以下のコードは一時的にコメントアウト
  const { pathname } = request.nextUrl
  const token = request.cookies.get("auth-token")?.value
  const isAuthenticated = !!token

  // 認証が必要なパスに未認証でアクセスした場合
  if (protectedPaths.some((path) => pathname.startsWith(path)) && !isAuthenticated) {
    const url = new URL("/login", request.url)
    url.searchParams.set("callbackUrl", encodeURI(pathname))
    return NextResponse.redirect(url)
  }

  // 認証済みユーザーが認証ページにアクセスした場合
  if (authPaths.some((path) => pathname === path) && isAuthenticated) {
    return NextResponse.redirect(new URL("/dashboard", request.url))
  }

  return NextResponse.next()
  */
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
}

