import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const from = body.from as string | undefined;
    const to = body.to as string | undefined;

    if (!from || !to) {
      return NextResponse.json(
        { error: "`from` and `to` (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }

    // Find the most recent summary for this period
    const { data: summary, error: summaryError } = await supabase
      .from("user_aggregate_summaries")
      .select("id, summary_text, created_at")
      .eq("user_id", user.id)
      .eq("period_start", from)
      .eq("period_end", to)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (summaryError) {
      return NextResponse.json(
        { error: summaryError.message },
        { status: 500 }
      );
    }

    if (!summary) {
      return NextResponse.json({
        summary: null
      });
    }

    return NextResponse.json({
      summary: summary.summary_text
    });
  } catch (error) {
    console.error("Load aggregate route error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Unexpected error", details: errorMessage },
      { status: 500 }
    );
  }
}

