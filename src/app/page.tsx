import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="flex flex-1 flex-col justify-between gap-10">
      <section className="mt-10 grid gap-10 md:grid-cols-[1.1fr,0.9fr] md:items-center">
        <div>
          <p className="mb-4 text-xs uppercase tracking-[0.3em] text-slate-400">
            Midjourney Images x Dreams
          </p>
          <h1 className="mb-6 text-4xl font-semibold tracking-tight md:text-6xl">
            Turn last night&apos;s dreams into a{" "}
            <span className="bg-gradient-to-r from-dream-300 via-dream-500 to-sky-400 bg-clip-text text-transparent">
              living atlas
            </span>
            .
          </h1>
          <p className="mb-8 max-w-xl text-sm leading-relaxed text-slate-300 md:text-base">
            Capture your dreams as Midjourney images, layer in your own words,
            and let an AI companion trace the patterns, symbols, and recurring
            worlds you keep visiting in sleep.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-dream-500 px-6 py-2.5 text-sm font-medium text-night-900 shadow-glow transition hover:bg-dream-400"
            >
              Start logging your dreams
            </Link>
            <Link
              href="/login"
              className="rounded-full border border-slate-700 px-5 py-2.5 text-sm font-medium text-slate-100 transition hover:border-dream-400 hover:text-dream-300"
            >
              I already have an atlas
            </Link>
          </div>
        </div>
        <div className="relative h-80 overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-night-800 via-night-700 to-night-900 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_10%_0,rgba(155,140,255,0.25),transparent_55%),radial-gradient(circle_at_90%_100%,rgba(56,189,248,0.25),transparent_55%)]" />
          <div className="relative flex h-full flex-col justify-between p-6">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                Tonight&apos;s entry
              </span>
              <span className="rounded-full bg-black/40 px-3 py-1 text-[10px] text-slate-300 ring-1 ring-white/10 backdrop-blur">
                Private by default · Share when you&apos;re ready
              </span>
            </div>
            <div className="space-y-3">
              <div className="h-32 rounded-2xl bg-gradient-to-tr from-slate-900 via-indigo-800 to-sky-700 opacity-80" />
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[11px] text-slate-300">
                  <span>Recurring motifs</span>
                  <span className="text-dream-300">generated over time</span>
                </div>
                <p className="text-xs leading-relaxed text-slate-200">
                  Oceans, falling, unfamiliar cities, searching for someone,
                  time loops, doorways that never open.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="mb-6 flex flex-col gap-3 text-xs text-slate-400 md:flex-row md:items-center md:justify-between">
        <p>
          Built for people who already speak to their subconscious in
          Midjourney prompts.
        </p>
        <div className="flex flex-wrap gap-3">
          <span className="rounded-full border border-slate-800 px-3 py-1">
            Image + text timeline
          </span>
          <span className="rounded-full border border-slate-800 px-3 py-1">
            Private or public dream pages
          </span>
          <span className="rounded-full border border-slate-800 px-3 py-1">
            AI patterns + summaries
          </span>
        </div>
      </section>
    </main>
  );
}


