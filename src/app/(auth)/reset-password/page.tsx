"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const code = searchParams.get("code");

    async function prepareSession() {
      const supabase = createSupabaseBrowserClient();

      if (code) {
        // PKCE-style recovery link with ?code=...
        const { error: exchangeError } =
          await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
        } else {
          setSessionReady(true);
        }
      } else {
        // Legacy flow where Supabase has already set the session via #access_token
        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) {
          setError("Recovery session is missing or has expired.");
        } else {
          setSessionReady(true);
        }
      }
    }

    void prepareSession();
  }, [searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!sessionReady) {
      setError("Auth session missing – try the reset link again from your email.");
      return;
    }

    if (password.length < 8) {
      setError("Password should be at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
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
        setMessage("Your password has been updated. You can now log in.");
        setTimeout(() => {
          router.push("/login?reset=1");
        }, 1200);
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
        <h1 className="mb-2 text-2xl font-semibold">Set a new password</h1>
        <p className="text-sm text-slate-400">
          Choose a new password for your Dream Atlas account.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-night-800/80 p-6 shadow-xl"
      >
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="text-xs font-medium text-slate-300"
          >
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="confirm"
            className="text-xs font-medium text-slate-300"
          >
            Confirm password
          </label>
          <input
            id="confirm"
            type="password"
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          disabled={loading}
          className="flex w-full items-center justify-center rounded-full bg-dream-500 px-4 py-2.5 text-sm font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Updating password..." : "Update password"}
        </button>
        <p className="pt-2 text-center text-xs text-slate-400">
          Changed your mind?{" "}
          <Link href="/login" className="text-dream-300 hover:text-dream-200">
            Back to login
          </Link>
        </p>
      </form>
    </main>
  );
}


