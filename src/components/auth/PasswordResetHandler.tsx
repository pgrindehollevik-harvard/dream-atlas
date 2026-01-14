"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function PasswordResetHandler() {
  const router = useRouter();

  useEffect(() => {
    // Check for password reset tokens in URL hash or query params
    if (typeof window === "undefined") return;
    
    const hash = window.location.hash;
    const hashParams = new URLSearchParams(hash.substring(1));
    const urlParams = new URLSearchParams(window.location.search);
    
    const accessToken = hashParams.get("access_token") || urlParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || urlParams.get("refresh_token");
    const type = hashParams.get("type") || urlParams.get("type");
    
    // If we have recovery tokens, redirect to reset password page
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

