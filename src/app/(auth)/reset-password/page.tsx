"use client";

import { FormEvent, useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [hasTokens, setHasTokens] = useState(false);

  useEffect(() => {
    // Supabase sends tokens in the URL hash, not query params
    // Check both hash and query params for compatibility
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const hashParams = new URLSearchParams(hash.substring(1)); // Remove the #
    
    const accessToken = hashParams.get("access_token") || searchParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token") || searchParams.get("refresh_token");
    const type = hashParams.get("type") || searchParams.get("type");
    
    if (accessToken && refreshToken && type === "recovery") {
      setHasTokens(true);
      // Exchange the tokens for a session
      const supabase = createSupabaseBrowserClient();
      supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      }).then(({ error: sessionError }) => {
        if (sessionError) {
          setError("Invalid or expired reset link. Please request a new password reset.");
          setHasTokens(false);
        }
      });
    } else {
      setError("Invalid or expired reset link. Please request a new password reset.");
    }
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password
      });

      if (updateError) {
        setError(updateError.message);
      } else {
        setMessage("Password updated successfully! Redirecting...");
        setTimeout(() => {
          router.push("/app");
        }, 1500);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Set new password</h1>
        <p className="text-sm text-slate-400">
          Enter your new password below.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-night-800/80 p-6 shadow-xl"
      >
        <div className="space-y-1">
          <label htmlFor="password" className="text-xs font-medium text-slate-300">
            New Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={6}
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="confirmPassword" className="text-xs font-medium text-slate-300">
            Confirm Password
          </label>
          <input
            id="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={6}
          />
        </div>
        {error && (
          <p className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="text-xs text-emerald-400" role="status">
            {message}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || !password || !confirmPassword || !hasTokens}
          className="flex w-full items-center justify-center rounded-full bg-dream-500 px-4 py-2.5 text-sm font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Updating password..." : "Update password"}
        </button>
        <p className="pt-2 text-center text-xs text-slate-400">
          Remember your password?{" "}
          <Link href="/login" className="text-dream-300 hover:text-dream-200">
            Go back to login
          </Link>
        </p>
      </form>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-semibold">Set new password</h1>
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}

