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
    const from = body.from as string | undefined;
    const to = body.to as string | undefined;

    if (!from || !to) {
      return NextResponse.json(
        { error: "`from` and `to` (YYYY-MM-DD) are required" },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const { data: dreams, error: dreamsError } = await supabase
      .from("dreams")
      .select("title, description, dream_date, visibility, image_url")
      .eq("user_id", user.id)
      .gte("dream_date", from)
      .lte("dream_date", to)
      .order("dream_date", { ascending: true });

    if (dreamsError) {
      return NextResponse.json(
        { error: dreamsError.message },
        { status: 500 }
      );
    }

    if (!dreams || dreams.length === 0) {
      return NextResponse.json(
        { error: "No dreams found in this period" },
        { status: 400 }
      );
    }

    const dreamBullets = dreams
      .map(
        (d) =>
          `- [${d.dream_date}] ${d.title}: ${
            d.description?.slice(0, 400) ?? "(no description)"
          }`
      )
      .join("\n");

    const prompt = [
      `You are helping someone explore patterns across several dreams.`,
      ``,
      `Here are their dreams between ${from} and ${to}:`,
      dreamBullets,
      ``,
      `Please:`,
      `1) Summarise recurring themes, settings, and emotional tones.`,
      `2) Point out 3–7 motifs that appear more than once.`,
      `3) Offer a short paragraph on how these might connect to waking life (without making diagnoses).`,
      `4) Finish with 2 or 3 reflection prompts they can journal on.`,
      ``,
      `IMPORTANT: Return your answer as a short HTML fragment, no <html> or <body> tags.`,
      `Use simple, clean structure:`,
      `- A <h3> "Themes" section with paragraphs.`,
      `- A <h3> "Motifs" section with a <ul><li> list of motifs.`,
      `- A <h3> "Reflection prompts" section with <ul><li> questions.`,
      `You may use <strong> and <em> for gentle emphasis, but avoid overly decorative markup.`,
      `Keep it under ~500 words, warm in tone, and easy to read.`
    ].join("\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You speak like a thoughtful dream guide, not a therapist. You emphasise curiosity and self-reflection."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7
    });

    const content = completion.choices[0]?.message?.content;
    const summaryText =
      typeof content === "string"
        ? content
        : Array.isArray(content)
        ? content.map((c) => ("text" in c ? c.text : "")).join("\n")
        : "";

    if (!summaryText) {
      return NextResponse.json(
        { error: "Could not generate summary" },
        { status: 500 }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from("user_aggregate_summaries")
      .insert({
        user_id: user.id,
        period_start: from,
        period_end: to,
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


