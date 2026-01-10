import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DreamsDashboard } from "@/components/dreams/DreamsDashboard";

export default async function AppPage() {
  const supabase = createSupabaseServerClient();

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/app");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const { data: dreams } = await supabase
    .from("dreams")
    .select(
      "id, slug, title, description, dream_date, visibility, image_url, created_at"
    )
    .eq("user_id", user.id)
    .order("dream_date", { ascending: false });

  return (
    <DreamsDashboard
      user={user}
      profile={profile ?? null}
      initialDreams={dreams ?? []}
    />
  );
}


