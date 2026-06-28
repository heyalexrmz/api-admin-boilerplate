import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

const protectedPrefixes = ["/dashboard", "/onboarding"];
const authRoutes = ["/", "/signup"];

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProtected = protectedPrefixes.some((p) => path === p || path.startsWith(p + "/"));
  const isAuthRoute = authRoutes.includes(path);
  if (!isProtected && !isAuthRoute) return NextResponse.next();

  const isAuthed = !!getSessionCookie(req);

  if (isProtected && !isAuthed) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  if (isAuthRoute && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
