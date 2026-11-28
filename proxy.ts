import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { mcpResourceUrl } from "@/lib/mcp-config";

const protectedPrefixes = ["/dashboard", "/onboarding"];
const authPages = ["/", "/signup"];

export default async function proxy(req: NextRequest) {
  const resource = new URL(mcpResourceUrl());
  const path = req.nextUrl.pathname;
  if (path === "/" && resource.pathname === "/" && req.headers.get("host") === resource.host) {
    const target = req.nextUrl.clone();
    target.pathname = "/api/mcp";
    return NextResponse.rewrite(target);
  }
  const isProtected = protectedPrefixes.some((p) => path === p || path.startsWith(p + "/"));
  const isAuthPage = authPages.includes(path);
  if (!isProtected && !isAuthPage) return NextResponse.next();

  const isAuthed = !!getSessionCookie(req);

  if (isAuthPage && isAuthed) {
    return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
  }

  if (isProtected && !isAuthed) {
    return NextResponse.redirect(new URL("/", req.nextUrl));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico)$).*)"],
};
