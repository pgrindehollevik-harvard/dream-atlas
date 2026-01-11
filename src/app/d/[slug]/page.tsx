import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DreamContent } from "@/components/dreams/DreamInterpretation";

type Props = {
  params: { slug: string };
};

export default async function DreamDetailPage({ params }: Props) {
  const supabase = createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  const { data: dream } = await supabase
    .from("dreams")
    .select(
      "id, slug, title, description, dream_date, visibility, image_url, created_at, user_id"
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!dream) {
    notFound();
  }

  const { data: summary } = await supabase
    .from("dream_summaries")
    .select("summary_text, created_at")
    .eq("dream_id", dream.id)
    .maybeSingle();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, display_name, is_public_profile")
    .eq("id", dream.user_id)
    .maybeSingle();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6">
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <Link
            href="/app"
            className="rounded-full border border-slate-700 px-3 py-1 hover:border-slate-500 hover:text-slate-100"
          >
            Back to atlas
          </Link>
        </div>
        {profile && profile.username && profile.is_public_profile && (
          <Link
            href={`/u/${profile.username}`}
            className="rounded-full border border-slate-700 px-3 py-1 text-[11px] hover:border-dream-400 hover:text-dream-300"
          >
            More dreams by {profile.display_name || profile.username}
          </Link>
        )}
      </div>
      <article className="overflow-hidden rounded-3xl border border-slate-800 bg-night-800/80 shadow-xl">
        {dream.image_url && (
          <div className="w-full bg-slate-900">
            <div className="mx-auto max-h-[80vh] max-w-4xl overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={dream.image_url}
                alt={dream.title}
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        )}
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                Dream entry
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-50">
                {dream.title}
              </h1>
            </div>
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
          <DreamContent
            dream={{
              id: dream.id,
              slug: dream.slug,
              title: dream.title,
              description: dream.description,
              dream_date: dream.dream_date,
              visibility: dream.visibility,
              image_url: dream.image_url
            }}
            isOwner={!!user && user.id === dream.user_id}
            initialSummary={summary ?? null}
          />
        </div>
      </article>
    </main>
  );
}


