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
    
    // Check for direct tokens
    const accessToken = hashParams.get("access_token") || urlParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || urlParams.get("refresh_token");
    const type = hashParams.get("type") || urlParams.get("type");
    
    // If we have a PKCE code, try to exchange it for a session
    // Supabase password reset codes work even without explicit type parameter
    if (code) {
      console.log("Password reset code detected, exchanging for session...");
      const supabase = createSupabaseBrowserClient();
      supabase.auth.exchangeCodeForSession(code).then(({ data, error }) => {
        if (error) {
          console.error("Code exchange error:", error);
          // If code exchange fails, it might not be a valid reset code
          return;
        }
        if (data.session) {
          console.log("Code exchanged successfully, redirecting to reset password...");
          // Check if this is a recovery session by checking the user metadata or session type
          // For password reset, Supabase sets the session in recovery mode
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

