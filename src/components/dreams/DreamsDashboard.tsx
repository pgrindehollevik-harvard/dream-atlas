"use client";

import { useState } from "react";
import type { SessionUser } from "@/types/auth";
import type { Dream, DreamVisibility } from "@/types/dreams";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import Link from "next/link";

type Props = {
  user: SessionUser;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    bio: string | null;
    is_public_profile: boolean;
  } | null;
  initialDreams: Dream[];
};

const visibilities = [
  { value: "private", label: "Private" },
  { value: "public", label: "Public" }
] as const;

type RangePreset = "today" | "7d" | "30d" | "all";

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
};

export function DreamsDashboard({ user, profile, initialDreams }: Props) {
  const [dreams, setDreams] = useState<Dream[]>(initialDreams);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [visibility, setVisibility] = useState<DreamVisibility>("private");
  const [imageUrl, setImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rangePreset, setRangePreset] = useState<RangePreset>("30d");
  const [aggregateSummary, setAggregateSummary] = useState<string | null>(null);
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [aggregateError, setAggregateError] = useState<string | null>(null);
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [chatSessionId, setChatSessionId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);

  function getRangeDates(preset: RangePreset) {
    const today = new Date();
    const to = format(today, "yyyy-MM-dd");
    let fromDate = today;

    if (preset === "7d") {
      fromDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    } else if (preset === "30d") {
      fromDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    } else if (preset === "all") {
      fromDate = new Date(1970, 0, 1);
    }

    const from = format(fromDate, "yyyy-MM-dd");
    return { from, to };
  }

  async function handleCreateDream() {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const slugBase = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)+/g, "");
      const slug = `${slugBase || "dream"}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const { data, error: insertError } = await supabase
        .from("dreams")
        .insert({
          user_id: user.id,
          title,
          description,
          dream_date: date,
          visibility,
          image_url: imageUrl || null,
          slug
        })
        .select(
          "id, slug, title, description, dream_date, visibility, image_url, created_at"
        )
        .single();

      if (insertError) {
        setError(insertError.message);
      } else if (data) {
        setDreams((prev) => [data as Dream, ...prev]);
        setTitle("");
        setDescription("");
        setImageUrl("");
        setVisibility("private");
      }
    } catch (e) {
      setError("Could not save dream. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGenerateAggregate() {
    setAggregateError(null);
    setAggregateLoading(true);
    try {
      const { from, to } = getRangeDates(rangePreset);

      const res = await fetch("/api/ai/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to })
      });
      const json = await res.json();
      if (!res.ok) {
        setAggregateError(json.error || "Could not generate themes.");
      } else {
        setAggregateSummary(json.summary as string);
      }
    } catch {
      setAggregateError("Something went wrong. Please try again.");
    } finally {
      setAggregateLoading(false);
    }
  }

  async function handleDeleteDream(id: string) {
    if (!window.confirm("Delete this dream permanently? This cannot be undone.")) {
      return;
    }
    setDeletingId(id);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: deleteError } = await supabase
        .from("dreams")
        .delete()
        .eq("id", id);
      if (deleteError) {
        // eslint-disable-next-line no-alert
        alert(deleteError.message);
      } else {
        setDreams((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // eslint-disable-next-line no-alert
      alert("Could not delete dream. Please try again.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSendChat() {
    const message = chatInput.trim();
    if (!message) return;
    setChatSending(true);
    try {
      const { from, to } = getRangeDates(rangePreset);
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: chatSessionId,
          from,
          to,
          message
        })
      });
      const json = await res.json();
      if (!res.ok) {
        // eslint-disable-next-line no-alert
        alert(json.error || "Could not send message.");
      } else {
        setChatSessionId(json.sessionId as string);
        const assistantMessage = json.assistantMessage as string;
        setChatMessages((prev) => [
          ...prev,
          { role: "user", content: message },
          { role: "assistant", content: assistantMessage }
        ]);
        setChatInput("");
      }
    } catch {
      // eslint-disable-next-line no-alert
      alert("Something went wrong.");
    } finally {
      setChatSending(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col gap-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Dream Atlas
          </p>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            {profile?.display_name || user.email?.split("@")[0] || "Your atlas"}
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {profile?.is_public_profile && profile.username
              ? (
                  <>
                    Public page:{" "}
                    <Link
                      href={`/u/${profile.username}`}
                      className="text-dream-300 hover:text-dream-200"
                    >
                      /u/{profile.username}
                    </Link>
                  </>
                )
              : "Your dreams are private unless you make them public."}
          </p>
        </div>
        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            type="button"
            onClick={() => setPatternsOpen(true)}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-dream-400 hover:text-dream-300"
          >
            Explore dream patterns
          </button>
          <form action="/logout" method="post">
            <button
              type="submit"
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-rose-400 hover:text-rose-200"
            >
              Log out
            </button>
          </form>
        </div>
      </header>

      <section className="rounded-3xl border border-slate-800 bg-night-800/70 p-5 shadow-xl">
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setLogOpen((prev) => !prev)}
            className="flex w-full items-center justify-between text-left"
          >
            <h2 className="text-sm font-medium text-slate-100">
              Log last night&apos;s dream
            </h2>
            <span className="text-[10px] text-slate-400">
              {logOpen ? "Hide" : "Show"}
            </span>
          </button>
          {logOpen && (
            <div className="grid gap-3 md:grid-cols-[minmax(0,1.2fr),minmax(0,0.8fr)]">
              <div className="space-y-3">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Title – e.g. 'Endless escalators under the ocean'"
                  className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
                />
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what you remember. Scenes, people, sounds, feelings, recurring symbols…"
                  rows={5}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
                />
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                      Date
                    </label>
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full rounded-lg border border-slate-700 bg-night-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                      Visibility
                    </label>
                    <select
                      value={visibility}
                      onChange={(e) =>
                        setVisibility(e.target.value as DreamVisibility)
                      }
                      className="w-full rounded-lg border border-slate-700 bg-night-900 px-2 py-1.5 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
                    >
                      {visibilities.map((v) => (
                        <option key={v.value} value={v.value}>
                          {v.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1 text-xs">
                  <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Midjourney image URL
                  </label>
                  <p className="text-[10px] text-slate-500">
                    Paste or upload an image.
                  </p>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://cdn.midjourney.com/..."
                    className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-1.5 text-xs text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
                  />
                  <div className="pt-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 text-[10px] text-slate-400">
                      <span className="rounded-full bg-night-900 px-2 py-1 text-[10px] ring-1 ring-slate-700">
                        or upload image
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          setUploading(true);
                          setError(null);
                          try {
                            const supabase = createSupabaseBrowserClient();
                            const fileExt = file.name.split(".").pop();
                            const filePath = `${user.id}/${Date.now()}-${Math.random()
                              .toString(36)
                              .slice(2, 8)}.${fileExt}`;
                            const { error: uploadError } = await supabase.storage
                              .from("dream-images")
                              .upload(filePath, file, {
                                cacheControl: "31536000",
                                upsert: false
                              });
                            if (uploadError) {
                              setError(uploadError.message);
                            } else {
                              const {
                                data: { publicUrl }
                              } = supabase.storage
                                .from("dream-images")
                                .getPublicUrl(filePath);
                              setImageUrl(publicUrl);
                            }
                          } catch {
                            setError("Could not upload image. Please try again.");
                          } finally {
                            setUploading(false);
                          }
                        }}
                      />
                    </label>
                    {uploading && (
                      <p className="mt-1 text-[10px] text-slate-400">
                        Uploading image…
                      </p>
                    )}
                  </div>
                </div>
                {error && (
                  <p className="text-[11px] text-rose-400" role="alert">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  disabled={submitting || !title.trim()}
                  onClick={handleCreateDream}
                  className="mt-1 flex w-full items-center justify-center rounded-full bg-dream-500 px-4 py-2 text-xs font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? "Saving dream…" : "Save dream to atlas"}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-slate-100">
            Your dream timeline
          </h2>
          <p className="text-[11px] text-slate-500">
            {dreams.length === 0
              ? "No entries yet."
              : `${dreams.length} dream${dreams.length === 1 ? "" : "s"} logged`}
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {dreams.map((dream) => (
            <div
              key={dream.id}
              className="group overflow-hidden rounded-2xl border border-slate-800 bg-night-800/80 shadow-md transition hover:border-dream-400/60 hover:shadow-glow"
            >
              <Link href={`/d/${dream.slug}`} className="block">
                {dream.image_url && (
                  <div className="h-40 w-full overflow-hidden bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={dream.image_url}
                      alt={dream.title}
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                    />
                  </div>
                )}
                <div className="space-y-1.5 p-4">
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>
                      {dream.dream_date
                        ? format(new Date(dream.dream_date), "dd MMM yyyy")
                        : ""}
                    </span>
                    <span
                      className={
                        dream.visibility === "public"
                          ? "rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300"
                          : dream.visibility === "unlisted"
                          ? "rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] text-sky-300"
                          : "rounded-full bg-slate-500/15 px-2 py-0.5 text-[10px] text-slate-300"
                      }
                    >
                      {dream.visibility}
                    </span>
                  </div>
                  <h3 className="text-sm font-medium text-slate-50">
                    {dream.title}
                  </h3>
                  {dream.description && (
                    <p className="line-clamp-3 text-xs text-slate-400">
                      {dream.description}
                    </p>
                  )}
                </div>
              </Link>
              <div className="flex items-center justify-between gap-2 px-4 pb-4 text-[11px]">
                <Link
                  href={`/d/${dream.slug}`}
                  className="rounded-full border border-slate-700 px-2.5 py-1 text-[10px] text-slate-200 hover:border-dream-400 hover:text-dream-300"
                >
                  Open
                </Link>
                <button
                  type="button"
                  onClick={() => handleDeleteDream(dream.id)}
                  disabled={deletingId === dream.id}
                  className="rounded-full border border-slate-800 px-2.5 py-1 text-[10px] text-slate-400 hover:border-rose-500/70 hover:text-rose-300 disabled:opacity-60"
                >
                  {deletingId === dream.id ? "Deleting…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {patternsOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 px-4">
          <div className="relative w-full max-w-4xl rounded-3xl border border-slate-800 bg-night-900/95 p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
                  Dream patterns
                </p>
                <h2 className="text-sm font-medium text-slate-100">
                  Let the AI walk through a slice of your dreams
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPatternsOpen(false)}
                className="rounded-full border border-slate-700 px-3 py-1 text-[11px] text-slate-300 hover:border-slate-400 hover:text-slate-100"
              >
                Close
              </button>
            </div>
            <div className="space-y-3 text-xs">
              <p className="text-slate-400">
                Choose a window of nights. The AI will look at all your entries
                in that period and describe recurring themes, symbols, and
                emotional tones in plain language.
              </p>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "today", label: "Today" },
                  { id: "7d", label: "Last 7 days" },
                  { id: "30d", label: "Last 30 days" },
                  { id: "all", label: "All time" }
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setRangePreset(preset.id as RangePreset)}
                    className={
                      "rounded-full border px-3 py-1 text-[11px] transition " +
                      (rangePreset === preset.id
                        ? "border-dream-400 bg-dream-500/20 text-dream-200"
                        : "border-slate-700 bg-night-900 text-slate-300 hover:border-slate-500")
                    }
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              {aggregateError && (
                <p className="text-[11px] text-rose-400" role="alert">
                  {aggregateError}
                </p>
              )}
              <button
                type="button"
                onClick={handleGenerateAggregate}
                disabled={aggregateLoading}
                className="mt-1 flex w-full items-center justify-center rounded-full bg-dream-500 px-3 py-1.5 text-[11px] font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {aggregateLoading
                  ? "Listening to your dreams…"
                  : "Generate themes for this period"}
              </button>
              <div className="mt-3 flex gap-4">
                <div className="max-h-[420px] flex-1 overflow-y-auto rounded-2xl border border-slate-800 bg-night-900/80 p-4 text-[11px] leading-relaxed text-slate-200">
                  {aggregateSummary ? (
                    <div
                      className="space-y-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-100 [&_h4]:text-[11px] [&_h4]:font-semibold [&_h4]:text-slate-200 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1"
                      // summary is generated HTML from our own backend prompt
                      dangerouslySetInnerHTML={{ __html: aggregateSummary }}
                    />
                  ) : (
                    "Once you have a few nights logged, try a 7–30 day window. The more you feed it, the more interesting the themes become."
                  )}
                </div>
                <div className="max-h-[420px] w-72 shrink-0 rounded-2xl border border-slate-800 bg-night-900/80 p-3 text-[11px] text-slate-200">
                  <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
                    Ask the guide
                  </div>
                  <div className="mb-2 flex max-h-64 flex-col gap-2 overflow-y-auto">
                    {chatMessages.length === 0 ? (
                      <p className="text-[11px] text-slate-500">
                        After reading the themes, ask a follow‑up like{" "}
                        <span className="text-slate-300">
                          “What do these dreams say about how I relate to
                          change?”
                        </span>
                        .
                      </p>
                    ) : (
                      chatMessages.map((m, idx) => (
                        <div
                          key={`${m.role}-${idx}`}
                          className={
                            m.role === "user"
                              ? "ml-auto max-w-[90%] rounded-2xl bg-dream-500/20 px-2.5 py-1.5 text-[11px] text-dream-100"
                              : "mr-auto max-w-[90%] rounded-2xl bg-slate-800/80 px-2.5 py-1.5 text-[11px] text-slate-100"
                          }
                        >
                          {m.content}
                        </div>
                      ))
                    )}
                  </div>
                  <form
                    className="mt-2 space-y-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!chatSending) {
                        void handleSendChat();
                      }
                    }}
                  >
                    <textarea
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      rows={3}
                      className="w-full resize-none rounded-lg border border-slate-700 bg-night-900 px-2 py-1.5 text-[11px] text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
                      placeholder="Ask something about these patterns…"
                    />
                    <button
                      type="submit"
                      disabled={chatSending || !chatInput.trim()}
                      className="w-full rounded-full bg-slate-100 px-3 py-1.5 text-[11px] font-medium text-night-900 hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {chatSending ? "Thinking…" : "Ask"}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


