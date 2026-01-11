"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo =
        typeof window !== "undefined"
          ? `${window.location.origin}/reset-password`
          : undefined;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        redirectTo ? { redirectTo } : undefined
      );
      if (resetError) {
        setError(resetError.message);
      } else {
        setMessage(
          "If this email exists in Dream Atlas, you'll receive a reset link shortly."
        );
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
        <h1 className="mb-2 text-2xl font-semibold">Reset your password</h1>
        <p className="text-sm text-slate-400">
          Enter the email you use for Dream Atlas and we&apos;ll send you a
          link to create a new password.
        </p>
      </div>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-2xl border border-slate-800 bg-night-800/80 p-6 shadow-xl"
      >
        <div className="space-y-1">
          <label htmlFor="email" className="text-xs font-medium text-slate-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
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
          {loading ? "Sending reset link..." : "Send reset link"}
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


