import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export function createSupabaseServerClient() {
  // Next 15's types mark cookies() as possibly async, but in the App Router
  // it's still safe to treat it as synchronous here. Cast to any to avoid
  // Promise typings interfering with @supabase/ssr's cookie helpers.
  const cookieStore = cookies() as any;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase env vars are not set");
  }

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: any[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            // In Server Components this is read-only; ignore errors there.
            cookieStore.set(name, value, options);
          });
        } catch {
          // no-op – we only need reads in Server Components
        }
      }
    }
  });
}


