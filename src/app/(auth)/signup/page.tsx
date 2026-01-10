"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const supabase = createSupabaseBrowserClient();

      const {
        data: { user },
        error: signUpError
      } = await supabase.auth.signUp({
        email,
        password
      });

      if (signUpError || !user) {
        setError(signUpError?.message ?? "Could not sign up.");
        setLoading(false);
        return;
      }

      const { error: profileError } = await supabase.from("profiles").insert({
        id: user.id,
        username,
        display_name: displayName
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      router.push("/app");
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
      <div className="mb-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold">
          Start your dream atlas
        </h1>
        <p className="text-sm text-slate-400">
          One place to collect Midjourney renderings of your dreams and explore
          their patterns.
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
            autoComplete="new-password"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="displayName"
            className="text-xs font-medium text-slate-300"
          >
            Display name
          </label>
          <input
            id="displayName"
            type="text"
            required
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label
            htmlFor="username"
            className="text-xs font-medium text-slate-300"
          >
            Username (for your public URL)
          </label>
          <input
            id="username"
            type="text"
            required
            pattern="^[a-zA-Z0-9_-]{3,}$"
            title="At least 3 characters. Letters, numbers, dashes and underscores only."
            className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <p className="text-[10px] text-slate-500">
            This becomes your landing page at{" "}
            <span className="text-slate-300">/u/&lt;username&gt;</span>.
          </p>
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
          {loading ? "Creating your atlas..." : "Create account"}
        </button>
        <p className="pt-2 text-center text-xs text-slate-400">
          Already have dreams logged?{" "}
          <Link href="/login" className="text-dream-300 hover:text-dream-200">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}


