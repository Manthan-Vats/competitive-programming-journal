import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // Placeholder mode: until real Supabase keys are set, auth can't work.
  // B21 - FAIL CLOSED in production: a misconfigured prod deploy must NOT silently
  // expose /admin. In development we still allow the skip so the UI can be previewed
  // before keys exist.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const isPlaceholderEnv =
    !supabaseUrl || supabaseUrl.includes("your-supabase-project");
  if (isPlaceholderEnv) {
    if (process.env.NODE_ENV === "production") {
      const isAdminPage = request.nextUrl.pathname.startsWith("/admin");
      if (isAdminPage) {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginPage = request.nextUrl.pathname === "/login";
  const isAdminPage = request.nextUrl.pathname.startsWith("/admin");

  if (isAdminPage && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isLoginPage && user) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
