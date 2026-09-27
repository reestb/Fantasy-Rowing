import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = ["/sign-in", "/sign-up", "/auth/callback", "/api/admin/access"].includes(pathname);
  const isApiRoute = pathname.startsWith("/api/");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    if (isPublicRoute || isApiRoute) return NextResponse.next({ request });
    return redirectToSignUp(request);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !isPublicRoute) {
    if (isApiRoute) return NextResponse.json({ error: "Create an account or sign in to continue." }, { status: 401 });
    return redirectToSignUp(request, response);
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    const requestedNext = request.nextUrl.searchParams.get("next") ?? "/";
    const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//") ? requestedNext : "/";
    const redirectResponse = NextResponse.redirect(new URL(next, request.url));
    response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
    return redirectResponse;
  }

  if (pathname === "/admin") response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}

function redirectToSignUp(request: NextRequest, response?: NextResponse) {
  const destination = request.nextUrl.clone();
  destination.pathname = "/sign-up";
  destination.search = "";
  destination.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const redirectResponse = NextResponse.redirect(destination);
  response?.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};