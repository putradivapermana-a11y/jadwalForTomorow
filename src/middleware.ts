import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // If no auth token and trying to access protected paths, one might redirect.
  // For now, we simply ensure public static assets like manifest.webmanifest 
  // are never intercepted by returning NextResponse.next() here.
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - manifest.webmanifest (PWA manifest)
     * - sw.js, workbox-* (Service worker)
     * - icons/.* (PWA icons)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|workbox-.*|icons/.*).*)",
  ],
};