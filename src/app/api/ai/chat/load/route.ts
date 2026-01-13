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

    // Find the most recent session for this period
    const { data: session, error: sessionError } = await supabase
      .from("dream_chat_sessions")
      .select("id, period_start, period_end, created_at")
      .eq("user_id", user.id)
      .eq("period_start", from)
      .eq("period_end", to)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (sessionError) {
      return NextResponse.json(
        { error: sessionError.message },
        { status: 500 }
      );
    }

    if (!session) {
      return NextResponse.json({
        sessionId: null,
        messages: []
      });
    }

    // Load messages for this session
    const { data: messages, error: messagesError } = await supabase
      .from("dream_chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: session.id,
      messages: (messages ?? []).map((m) => ({
        role: m.role,
        content: m.content
      }))
    });
  } catch (error) {
    console.error("Load chat route error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Unexpected error", details: errorMessage },
      { status: 500 }
    );
  }
}

