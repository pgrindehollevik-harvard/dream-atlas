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
    const dreamId = body.dreamId as string | undefined;

    if (!dreamId) {
      return NextResponse.json(
        { error: "dreamId is required" },
        { status: 400 }
      );
    }

    const { data: dream, error: dreamError } = await supabase
      .from("dreams")
      .select(
        "id, user_id, title, description, dream_date, visibility, image_url"
      )
      .eq("id", dreamId)
      .single();

    if (dreamError || !dream) {
      return NextResponse.json({ error: "Dream not found" }, { status: 404 });
    }

    if (dream.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const basePrompt = [
      `You are an oneirology-inspired AI that helps someone explore their recurring motifs in dreams.`,
      ``,
      `Dream title: ${dream.title}`,
      `Dream date: ${dream.dream_date}`,
      ``,
      `Dream description:`,
      dream.description || "(no description provided)",
      ``,
      `1) Give a short, poetic summary in 2–3 sentences.`,
      `2) Name 3–5 key symbols or motifs and what they might represent psychologically.`,
      `3) Suggest 1 gentle reflection question the dreamer could ask themselves.`,
      ``,
      `IMPORTANT: Return your answer as a small HTML fragment (no <html> or <body> tags).`,
      `Structure it with:`,
      `- A <h3> title like "What this dream is circling around".`,
      `- A couple of <p> paragraphs for the narrative summary.`,
      `- A <h4> "Symbols" heading followed by a <ul><li> list of motifs.`,
      `- A <h4> "A question to sit with" heading with one <p> reflective question.`,
      `You may use <strong> and <em> for gentle emphasis, but keep the tone grounded and non-prescriptive.`
    ]
      .filter(Boolean)
      .join("\n");

    const userContentParts: any[] = [
      {
        type: "text",
        text: basePrompt
      }
    ];

    if (dream.image_url) {
      userContentParts.push({
        type: "image_url",
        image_url: {
          url: dream.image_url
        }
      });
    }

    let content: OpenAI.Chat.Completions.ChatCompletionMessage["content"];

    try {
      const completionWithImage = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You specialise in dreams and symbolic imagery. You avoid medical or diagnostic language and keep things exploratory."
          },
          {
            role: "user",
            content: userContentParts
          }
        ],
        temperature: 0.7
      });
      content = completionWithImage.choices[0]?.message?.content;
    } catch (visionError) {
      // Some external image hosts (like Midjourney CDN) may block direct fetching.
      // If that happens, fall back to a text-only interpretation.
      const textOnlyCompletion = await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "You specialise in dreams and symbolic imagery. You avoid medical or diagnostic language and keep things exploratory."
          },
          {
            role: "user",
            content: basePrompt
          }
        ],
        temperature: 0.7
      });
      content = textOnlyCompletion.choices[0]?.message?.content;
    }

    const summaryText =
      typeof content === "string"
        ? content
        : Array.isArray(content)
        ? (content as any[])
            .map((c) => ("text" in c ? c.text : ""))
            .join("\n")
        : "";

    if (!summaryText) {
      return NextResponse.json(
        { error: "Could not generate summary" },
        { status: 500 }
      );
    }

    await supabase.from("dream_summaries").delete().eq("dream_id", dream.id);

    const { data: inserted, error: insertError } = await supabase
      .from("dream_summaries")
      .insert({
        dream_id: dream.id,
        summary_text: summaryText
      })
      .select("id, summary_text, created_at")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      summary: inserted?.summary_text,
      createdAt: inserted?.created_at
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(error) },
      { status: 500 }
    );
  }
}


