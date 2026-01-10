"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const callback = searchParams.get("redirect") || "/app";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      });
      if (signInError) {
        setError(signInError.message);
      } else {
        router.push(callback);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">Welcome back to Dream Atlas</h1>
        <p className="text-sm text-slate-400">
          Log in to continue mapping your dreams in Midjourney.
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
        <div className="space-y-1">
          <label
            htmlFor="password"
            className="text-xs font-medium text-slate-300"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {error && (
          <p className="text-xs text-rose-400" role="alert">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-full bg-dream-500 px-4 py-2.5 text-sm font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? "Logging in..." : "Enter the atlas"}
        </button>
        <p className="pt-2 text-center text-xs text-slate-400">
          No account yet?{" "}
          <Link href="/signup" className="text-dream-300 hover:text-dream-200">
            Start a new atlas
          </Link>
        </p>
      </form>
    </main>
  );
}


