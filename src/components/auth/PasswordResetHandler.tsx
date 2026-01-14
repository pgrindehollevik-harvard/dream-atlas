"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PasswordResetHandler() {
  const router = useRouter();

  useEffect(() => {
    // Check for password reset tokens in URL hash, query params, or PKCE code
    if (typeof window === "undefined") return;
    
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.substring(1));
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for PKCE code (Supabase uses this for password reset)
    const code = urlParams.get("code");
    const type = hashParams.get("type") || urlParams.get("type");
    
    // Check for direct tokens
    const accessToken = hashParams.get("access_token") || urlParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || urlParams.get("refresh_token");
    
    // If we have a PKCE code, exchange it for a session
    if (code && type === "recovery") {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error("Code exchange error:", error);
          return;
        }
        if (data.session) {
          // Redirect to reset password page - the session is now set in cookies
          router.push("/reset-password");
        }
      });
      return;
    }
    
    // If we have direct recovery tokens, redirect to reset password page
    if (accessToken && refreshToken && type === "recovery") {
      // Preserve the tokens in the URL when redirecting
      const tokenParams = new URLSearchParams({
        access_token: accessToken,
        refresh_token: refreshToken,
        type: type
      });
      router.push(`/reset-password?${tokenParams.toString()}${hash ? `#${hash.substring(1)}` : ""}`);
    }
  }, [router]);

  return null;
}

