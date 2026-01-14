import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function UserPublicPage({ params }: any) {
  const supabase = createSupabaseServerClient();
  
  // Next.js 15: params is now a Promise
  const { username } = await params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, is_public_profile")
    .eq("username", username)
    .maybeSingle();

  if (!profile || !profile.is_public_profile) {
    notFound();
  }

  const { data: dreams } = await supabase
    .from("dreams")
    .select(
      "id, slug, title, description, dream_date, visibility, image_url, created_at"
    )
    .eq("user_id", profile.id)
    .eq("visibility", "public")
    .order("dream_date", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8">
      <header className="mt-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Dream Atlas
          </p>
          <h1 className="text-2xl font-semibold text-slate-50">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-xs text-slate-400">@{profile.username}</p>
          {profile.bio && (
            <p className="mt-2 max-w-lg text-sm text-slate-300">
              {profile.bio}
            </p>
          )}
        </div>
        <Link
          href="/"
          className="self-start rounded-full border border-slate-700 px-4 py-2 text-xs text-slate-200 hover:border-dream-400 hover:text-dream-300"
        >
          Create your own atlas
        </Link>
      </header>
      <section className="space-y-3">
        <h2 className="text-sm font-medium text-slate-100">
          Public dreams
        </h2>
        {(!dreams || dreams.length === 0) && (
          <p className="text-xs text-slate-500">
            No public dreams yet.
          </p>
        )}
        <div className="grid gap-4 md:grid-cols-2">
          {dreams?.map((dream) => (
            <Link
              key={dream.id}
              href={`/d/${dream.slug}`}
              className="group overflow-hidden rounded-2xl border border-slate-800 bg-night-800/80 shadow-md transition hover:border-dream-400/60 hover:shadow-glow"
            >
              {dream.image_url && (
                <div className="w-full overflow-hidden bg-slate-900">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={dream.image_url}
                    alt={dream.title}
                    className="h-auto w-full object-contain transition duration-500 group-hover:scale-105"
                  />
                </div>
              )}
              <div className="space-y-1.5 p-4">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span>{dream.dream_date}</span>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] text-emerald-300">
                    public
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
          ))}
        </div>
      </section>
    </main>
  );
}


