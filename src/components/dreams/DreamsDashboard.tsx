"use client";

import { useState, useEffect, useRef } from "react";
import type { SessionUser } from "@/types/auth";
import type { Dream, DreamVisibility } from "@/types/dreams";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { format } from "date-fns";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

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
  // Store aggregate summaries per time period
  const [aggregateSummaries, setAggregateSummaries] = useState<Record<RangePreset, string | null>>({
    today: null,
    "7d": null,
    "30d": null,
    all: null
  });
  const [aggregateLoading, setAggregateLoading] = useState(false);
  const [aggregateError, setAggregateError] = useState<string | null>(null);
  
  // Get current summary for the selected period
  const aggregateSummary = aggregateSummaries[rangePreset];
  const [patternsOpen, setPatternsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Store separate chat state for each time period
  const [chatSessions, setChatSessions] = useState<Record<RangePreset, { sessionId: string | null; messages: ChatMessage[] }>>({
    today: { sessionId: null, messages: [] },
    "7d": { sessionId: null, messages: [] },
    "30d": { sessionId: null, messages: [] },
    all: { sessionId: null, messages: [] }
  });
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [chatError, setChatError] = useState<string | null>(null);
  const chatTextareaRef = useRef<HTMLTextAreaElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  // Get current chat state for the selected period
  const currentChat = chatSessions[rangePreset];
  const chatSessionId = currentChat.sessionId;
  const chatMessages = currentChat.messages;

  // Auto-resize textarea
  useEffect(() => {
    const textarea = chatTextareaRef.current;
    if (textarea) {
      textarea.style.height = "44px";
      const scrollHeight = textarea.scrollHeight;
      if (scrollHeight > 44) {
        textarea.style.height = `${Math.min(scrollHeight, 120)}px`;
      }
    }
  }, [chatInput]);

  // Auto-scroll chat messages to bottom
  useEffect(() => {
    const messagesContainer = chatMessagesRef.current;
    if (messagesContainer) {
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }, [chatMessages, chatSending]);

  // Load chat and summary when switching time periods (if modal is open)
  useEffect(() => {
    if (patternsOpen) {
      void loadPreviousSummary();
      void loadPreviousChat();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangePreset]);

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
      
      // If imageUrl is a Midjourney CDN link, convert it to Supabase storage first
      // Do this client-side since Midjourney CDN blocks server requests
      let finalImageUrl = imageUrl || null;
      if (imageUrl && imageUrl.trim() && !imageUrl.includes("supabase.co/storage/v1/object/public/dream-images")) {
        try {
          console.log("Converting Midjourney CDN URL to Supabase storage (client-side):", imageUrl.trim());
          
          // Fetch the image in the browser (can access CDN)
          const imageResponse = await fetch(imageUrl.trim(), {
            mode: "cors",
            credentials: "omit"
          });
          
          if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
          }
          
          const imageBlob = await imageResponse.blob();
          const contentType = imageBlob.type || "image/jpeg";
          
          // Determine file extension
          let ext = "jpg";
          if (contentType.includes("png")) ext = "png";
          else if (contentType.includes("webp")) ext = "webp";
          else if (contentType.includes("gif")) ext = "gif";
          
          // Create a File object
          const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
          const filePath = `${user.id}/${fileName}`;
          const file = new File([imageBlob], fileName, { type: contentType });
          
          // Upload to Supabase storage
          const { error: uploadError } = await supabase.storage
            .from("dream-images")
            .upload(filePath, file, {
              cacheControl: "31536000",
              upsert: false
            });
          
          if (uploadError) {
            throw new Error(`Upload failed: ${uploadError.message}`);
          }
          
          // Get the public URL
          const {
            data: { publicUrl }
          } = supabase.storage.from("dream-images").getPublicUrl(filePath);
          
          finalImageUrl = publicUrl;
          console.log("Successfully converted image to Supabase storage:", finalImageUrl);
        } catch (importError) {
          console.error("Image import failed:", importError);
          setError(`Image conversion failed: ${importError instanceof Error ? importError.message : String(importError)}. Please try downloading the image and uploading it directly, or use a different image URL.`);
          setSubmitting(false);
          return; // Don't save the dream if image conversion fails
        }
      }

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
          image_url: finalImageUrl,
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

  async function loadPreviousChat() {
    try {
      const { from, to } = getRangeDates(rangePreset);
      const res = await fetch("/api/ai/chat/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to })
      });
      const json = await res.json();
      if (res.ok && json.sessionId && json.messages && json.messages.length > 0) {
        // Update chat state for the current period
        setChatSessions((prev) => ({
          ...prev,
          [rangePreset]: {
            sessionId: json.sessionId,
            messages: json.messages
          }
        }));
      } else {
        // No previous chat found - ensure state is cleared for this period
        setChatSessions((prev) => ({
          ...prev,
          [rangePreset]: {
            sessionId: null,
            messages: []
          }
        }));
      }
    } catch (err) {
      console.error("Error loading previous chat:", err);
      // Silently fail - it's okay if we can't load previous chats
    }
  }

  async function loadPreviousSummary() {
    try {
      const { from, to } = getRangeDates(rangePreset);
      const res = await fetch("/api/ai/aggregate/load", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to })
      });
      const json = await res.json();
      if (res.ok && json.summary) {
        // Update summary state for the current period
        setAggregateSummaries((prev) => ({
          ...prev,
          [rangePreset]: json.summary
        }));
      } else {
        // No previous summary found - clear for this period
        setAggregateSummaries((prev) => ({
          ...prev,
          [rangePreset]: null
        }));
      }
    } catch (err) {
      console.error("Error loading previous summary:", err);
      // Silently fail - it's okay if we can't load previous summaries
    }
  }

  async function handleGenerateAggregate() {
    setAggregateError(null);
    setAggregateLoading(true);
    // Don't reset chat - we want to keep separate chats per period
    setChatError(null);
    try {
      const { from, to } = getRangeDates(rangePreset);

      const res = await fetch("/api/ai/aggregate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to })
      });
      const json = await res.json();
      if (!res.ok) {
        console.error("Aggregate API error:", json);
        // Show the actual error message if available
        const errorMsg = json.details || json.error || "Could not generate themes.";
        setAggregateError(errorMsg);
      } else {
        // Store summary for the current period
        setAggregateSummaries((prev) => ({
          ...prev,
          [rangePreset]: json.summary as string
        }));
        // Load previous chat for this period after themes are generated
        await loadPreviousChat();
      }
    } catch (err) {
      console.error("Aggregate fetch error:", err);
      const errorMsg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setAggregateError(errorMsg);
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
    setChatError(null);
    
    // Add user message immediately for better UX
    const userMessageId = `user-${Date.now()}`;
    setChatSessions((prev) => ({
      ...prev,
      [rangePreset]: {
        ...prev[rangePreset],
        messages: [
          ...prev[rangePreset].messages,
          { id: userMessageId, role: "user", content: message }
        ]
      }
    }));
    setChatInput("");
    
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
        console.error("Chat API error:", json);
        const errorMsg = json.details || json.error || "Could not send message. Please try again.";
        setChatError(errorMsg);
        // Remove the user message if there was an error
        setChatSessions((prev) => ({
          ...prev,
          [rangePreset]: {
            ...prev[rangePreset],
            messages: prev[rangePreset].messages.filter((m) => m.id !== userMessageId)
          }
        }));
      } else {
        const assistantMessage = json.assistantMessage as string;
        // Update chat state for the current period
        setChatSessions((prev) => ({
          ...prev,
          [rangePreset]: {
            sessionId: json.sessionId as string,
            messages: [
              ...prev[rangePreset].messages,
              { role: "assistant", content: assistantMessage }
            ]
          }
        }));
      }
    } catch (err) {
      console.error("Chat fetch error:", err);
      const errorMsg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setChatError(errorMsg);
      // Remove the user message if there was an error
      setChatSessions((prev) => ({
        ...prev,
        [rangePreset]: {
          ...prev[rangePreset],
          messages: prev[rangePreset].messages.filter((m) => m.id !== userMessageId)
        }
      }));
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
          <Link
            href="/app/profile"
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-slate-600 hover:text-slate-100"
          >
            Your profile
          </Link>
          <button
            type="button"
            onClick={() => setPatternsOpen(true)}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-dream-400 hover:text-dream-300"
          >
            Explore dream patterns
          </button>
          <button
            type="button"
            onClick={async () => {
              const supabase = createSupabaseBrowserClient();
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="rounded-full border border-slate-700 px-4 py-2 text-xs font-medium text-slate-200 hover:border-rose-400 hover:text-rose-200"
          >
            Log out
          </button>
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
                    <div className="relative">
                      <select
                        value={visibility}
                        onChange={(e) =>
                          setVisibility(e.target.value as DreamVisibility)
                        }
                        className="w-full appearance-none rounded-lg border border-slate-700 bg-night-900 px-2 py-1.5 pr-7 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
                      >
                        {visibilities.map((v) => (
                          <option key={v.value} value={v.value}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    </div>
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
              <div className="mt-3">
                {/* Themes Summary with Integrated Chat */}
                <div className="rounded-2xl border border-slate-800 bg-night-900/80">
                  {/* Summary Content */}
                  <div className="max-h-[300px] overflow-y-auto p-4 text-[11px] leading-relaxed text-slate-200">
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

                  {/* Chat Section - Integrated into the same container */}
                  {aggregateSummary && (
                    <>
                      {/* Divider */}
                      {chatMessages.length > 0 && (
                        <div className="border-t border-slate-800"></div>
                      )}
                      
                  {/* Chat Messages */}
                  <div ref={chatMessagesRef} className="max-h-[400px] overflow-y-auto p-4">
                    {chatMessages.length === 0 ? (
                      <div className="flex items-center justify-center py-4">
                        <p className="text-xs text-slate-400">
                          Ask a question about these themes to start a conversation
                        </p>
                      </div>
                    ) : (
                      <>
                        {chatMessages.length > 0 && chatSessionId && (
                          <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                            <p className="text-[10px] text-slate-500">
                              Continuing previous conversation
                            </p>
                            <button
                              type="button"
                              onClick={() => {
                                // Reset chat for the current period only
                                setChatSessions((prev) => ({
                                  ...prev,
                                  [rangePreset]: {
                                    sessionId: null,
                                    messages: []
                                  }
                                }));
                                setChatInput("");
                              }}
                              className="text-[10px] text-slate-400 hover:text-slate-200"
                            >
                              Start new
                            </button>
                          </div>
                        )}
                        <div className="space-y-4">
                          {chatMessages.map((m, idx) => (
                            <div
                              key={`${m.role}-${idx}`}
                              className={`flex gap-3 ${
                                m.role === "user" ? "justify-end" : "justify-start"
                              }`}
                            >
                              {m.role === "assistant" && (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dream-500/20 text-[10px] text-dream-300">
                                  AI
                                </div>
                              )}
                              <div
                                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                                  m.role === "user"
                                    ? "bg-dream-500/20 text-dream-100"
                                    : "bg-slate-800/60 text-slate-100"
                                }`}
                              >
                                <div className="whitespace-pre-wrap">{m.content}</div>
                              </div>
                              {m.role === "user" && (
                                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-700 text-[10px] text-slate-300">
                                  You
                                </div>
                              )}
                            </div>
                          ))}
                          {chatSending && (
                            <div className="flex gap-3 justify-start">
                              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-dream-500/20 text-[10px] text-dream-300">
                                AI
                              </div>
                              <div className="rounded-2xl bg-slate-800/60 px-4 py-2.5">
                                <div className="flex gap-1">
                                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]"></div>
                                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]"></div>
                                  <div className="h-2 w-2 animate-bounce rounded-full bg-slate-400"></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                      {/* Chat Input */}
                      <div className="border-t border-slate-800 p-4">
                        {chatError && (
                          <p className="mb-2 text-[11px] text-rose-400" role="alert">
                            {chatError}
                          </p>
                        )}
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            if (!chatSending && chatInput.trim()) {
                              void handleSendChat();
                            }
                          }}
                          className="flex gap-2"
                        >
                          <textarea
                            ref={chatTextareaRef}
                            value={chatInput}
                            onChange={(e) => {
                              setChatInput(e.target.value);
                              setChatError(null);
                              // Auto-resize
                              e.target.style.height = "44px";
                              const scrollHeight = e.target.scrollHeight;
                              if (scrollHeight > 44) {
                                e.target.style.height = `${Math.min(scrollHeight, 120)}px`;
                              }
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (!chatSending && chatInput.trim()) {
                                  void handleSendChat();
                                }
                              }
                            }}
                            rows={1}
                            className="flex-1 resize-none rounded-xl border border-slate-700 bg-night-900 px-4 py-2.5 text-sm text-slate-100 outline-none ring-dream-500/40 placeholder:text-slate-500 focus:border-dream-400 focus:ring-2"
                            placeholder="Ask about these themes..."
                            style={{ minHeight: "44px", maxHeight: "120px" }}
                          />
                          <button
                            type="submit"
                            disabled={chatSending || !chatInput.trim()}
                            className="flex shrink-0 items-center justify-center rounded-xl bg-dream-500 px-4 py-2.5 text-sm font-medium text-night-900 shadow-glow transition hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {chatSending ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-night-900 border-t-transparent"></div>
                            ) : (
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                                />
                              </svg>
                            )}
                          </button>
                        </form>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}


