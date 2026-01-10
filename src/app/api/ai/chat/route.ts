import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

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
    const sessionId = body.sessionId as string | undefined;
    const from = body.from as string | undefined;
    const to = body.to as string | undefined;
    const userMessage = (body.message as string | undefined)?.trim();

    if (!userMessage) {
      return NextResponse.json(
        { error: "message is required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    let effectiveFrom = from;
    let effectiveTo = to;
    let activeSessionId = sessionId;

    if (activeSessionId) {
      const { data: existingSession, error: sessionError } = await supabase
        .from("dream_chat_sessions")
        .select("id, period_start, period_end")
        .eq("id", activeSessionId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (sessionError || !existingSession) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      effectiveFrom = existingSession.period_start ?? undefined;
      effectiveTo = existingSession.period_end ?? undefined;
    } else {
      if (!from || !to) {
        return NextResponse.json(
          { error: "`from` and `to` (YYYY-MM-DD) are required for a new chat" },
          { status: 400 }
        );
      }

      const { data: newSession, error: newSessionError } = await supabase
        .from("dream_chat_sessions")
        .insert({
          user_id: user.id,
          period_start: from,
          period_end: to
        })
        .select("id, period_start, period_end")
        .single();

      if (newSessionError || !newSession) {
        return NextResponse.json(
          { error: newSessionError?.message ?? "Could not create session" },
          { status: 500 }
        );
      }

      activeSessionId = newSession.id;
      effectiveFrom = newSession.period_start ?? undefined;
      effectiveTo = newSession.period_end ?? undefined;
    }

    const { data: dreams, error: dreamsError } = await supabase
      .from("dreams")
      .select("title, description, dream_date, visibility, image_url")
      .eq("user_id", user.id)
      .gte("dream_date", effectiveFrom as string)
      .lte("dream_date", effectiveTo as string)
      .order("dream_date", { ascending: true });

    if (dreamsError) {
      return NextResponse.json(
        { error: dreamsError.message },
        { status: 500 }
      );
    }

    const { data: previousMessages, error: messagesError } = await supabase
      .from("dream_chat_messages")
      .select("id, role, content, created_at")
      .eq("session_id", activeSessionId)
      .order("created_at", { ascending: true });

    if (messagesError) {
      return NextResponse.json(
        { error: messagesError.message },
        { status: 500 }
      );
    }

    const contextLines =
      dreams?.map(
        (d) =>
          `- [${d.dream_date}] ${d.title}: ${
            d.description?.slice(0, 200) ?? "(no description)"
          }`
      ) ?? [];

    const systemPrompt =
      "You are a dream-pattern guide. You see a list of someone's dreams over a period of time and chat with them about themes, emotions and symbols. You never diagnose or give medical advice. You emphasise curiosity and gentle self-reflection. Keep your replies concise: at most 2 short paragraphs or 4–6 sentences total (around 120 words), focusing on the heart of the question rather than repeating the full context.";

    const contextText = [
      `The user is exploring patterns across their dreams.`,
      effectiveFrom && effectiveTo
        ? `The period is from ${effectiveFrom} to ${effectiveTo}.`
        : null,
      `Here is a compact list of their dreams in this window:`,
      contextLines.join("\n")
    ]
      .filter(Boolean)
      .join("\n");

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: contextText }
    ];

    for (const m of previousMessages ?? []) {
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      });
    }

    messages.push({
      role: "user",
      content: [
        {
          type: "text",
          text: [
            "Here is my new message or question about these dreams:",
            userMessage
          ].join("\n\n")
        }
      ]
    });

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages,
      temperature: 0.7
    });

    const assistantContent = completion.choices[0]?.message?.content;
    const assistantText =
      typeof assistantContent === "string"
        ? assistantContent
        : Array.isArray(assistantContent)
        ? assistantContent.map((c) => ("text" in c ? c.text : "")).join("\n")
        : "";

    if (!assistantText) {
      return NextResponse.json(
        { error: "No response from model" },
        { status: 500 }
      );
    }

    const { error: insertMessagesError } = await supabase
      .from("dream_chat_messages")
      .insert([
        {
          session_id: activeSessionId,
          role: "user",
          content: userMessage
        },
        {
          session_id: activeSessionId,
          role: "assistant",
          content: assistantText
        }
      ]);

    if (insertMessagesError) {
      return NextResponse.json(
        { error: insertMessagesError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      sessionId: activeSessionId,
      assistantMessage: assistantText
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(error) },
      { status: 500 }
    );
  }
}


