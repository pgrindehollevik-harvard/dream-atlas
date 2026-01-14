 "use client";

import { useState } from "react";
import type { DreamVisibility } from "@/types/dreams";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Summary = {
  summary_text: string;
  created_at: string;
};

type InterpretationProps = {
  dreamId: string;
  initialSummary: Summary | null;
};

export function DreamInterpretation({
  dreamId,
  initialSummary
}: InterpretationProps) {
  const [summary, setSummary] = useState<Summary | null>(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dreamId })
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Could not generate interpretation.");
        return;
      }
      setSummary({
        summary_text: json.summary as string,
        created_at: json.createdAt as string
      });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const buttonLabel = summary
    ? loading
      ? "Regenerating…"
      : "Regenerate"
    : loading
    ? "Generating…"
    : "Quick generate";

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-dashed border-slate-700 bg-night-900/70 p-4 text-xs text-slate-300">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-medium text-slate-200">
          AI interpretation
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={loading}
          className="rounded-full border border-slate-600 px-3 py-1 text-[10px] text-slate-100 hover:border-dream-400 hover:text-dream-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {buttonLabel}
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-rose-400" role="alert">
          {error}
        </p>
      )}
      {summary ? (
        <div className="space-y-2 text-xs leading-relaxed text-slate-200">
          <div
            className="[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-slate-100 [&_h4]:text-[11px] [&_h4]:font-semibold [&_h4]:text-slate-200 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1"
            // summary is generated HTML from our own backend prompt
            dangerouslySetInnerHTML={{ __html: summary.summary_text }}
          />
          <p className="pt-1 text-[10px] text-slate-500">
            Generated on{" "}
            {new Date(summary.created_at).toISOString().slice(0, 16).replace("T", " ")}
            . This is speculative and for reflection only.
          </p>
        </div>
      ) : (
        <p className="text-[11px] text-slate-400">
          No interpretation yet. Use the quick generate button above for a
          lightweight take on this single dream; the deeper patterns still live
          in your Dream patterns panel.
        </p>
      )}
    </div>
  );
}

type DreamForContent = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  dream_date: string;
  visibility: DreamVisibility;
  image_url: string | null;
};

type DreamContentProps = {
  dream: DreamForContent;
  isOwner: boolean;
  initialSummary: Summary | null;
};

export function DreamContent({
  dream,
  isOwner,
  initialSummary
}: DreamContentProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(dream.title);
  const [description, setDescription] = useState(dream.description ?? "");
  const [date, setDate] = useState(dream.dream_date);
  const [visibility, setVisibility] = useState<DreamVisibility>(
    dream.visibility
  );
  const [imageUrl, setImageUrl] = useState(dream.image_url ?? "");
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from("dreams")
        .update({
          title,
          description,
          dream_date: date,
          visibility,
          image_url: imageUrl || null
        })
        .eq("id", dream.id);
      if (updateError) {
        setError(updateError.message);
      } else {
        setEditing(false);
      }
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyLink() {
    try {
      const url = `${window.location.origin}/d/${dream.slug}`;
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // ignore
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 text-[11px] text-slate-400">
        {dream.dream_date && <span>{dream.dream_date}</span>}
        <div className="flex items-center gap-2">
          {dream.visibility === "public" && (
            <button
              type="button"
              onClick={handleCopyLink}
              className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-100 hover:border-dream-400 hover:text-dream-200"
            >
              {copied ? "Link copied" : "Copy public link"}
            </button>
          )}
          {isOwner && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-100 hover:border-slate-500 hover:text-slate-50"
            >
              {editing ? "Cancel" : "Edit"}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="space-y-3 text-xs">
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-1.5 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Date
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-1.5 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as DreamVisibility)}
              className="w-full appearance-none rounded-lg border border-slate-700 bg-night-900 px-3 py-1.5 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
            >
              <option value="private">Private</option>
              <option value="public">Public</option>
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-2 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
              Image URL
            </label>
            <input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-night-900 px-3 py-1.5 text-xs text-slate-100 outline-none ring-dream-500/40 focus:border-dream-400 focus:ring-2"
              placeholder="https://cdn.midjourney.com/..."
            />
          </div>
          {error && (
            <p className="text-[11px] text-rose-400" role="alert">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="rounded-full border border-slate-700 px-3 py-1 text-[10px] text-slate-200 hover:border-slate-500 hover:text-slate-50 disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-full bg-dream-500 px-3 py-1 text-[10px] font-medium text-night-900 shadow-glow hover:bg-dream-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      ) : (
        <>
          {dream.description && (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
              {dream.description}
            </p>
          )}
          <DreamInterpretation dreamId={dream.id} initialSummary={initialSummary} />
        </>
      )}
    </div>
  );
}



