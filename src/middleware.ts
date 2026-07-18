import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  
  // Custom Admin Protection
  if (url.pathname.startsWith('/admin') && !url.pathname.startsWith('/admin/login')) {
    const adminAuth = request.cookies.get('admin_auth')?.value;
    if (adminAuth !== 'true') {
      url.pathname = '/admin/login';
      return NextResponse.redirect(url);
    }
  }

  return updateSession(request);
}
export const config = {
  matcher: [
    /*
     * All routes except: static files, image optimization, favicon.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
