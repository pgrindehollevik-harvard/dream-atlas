import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL
});

export async function POST(req: NextRequest) {
  try {
    console.log("Chat route called");
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      console.error("Unauthorized chat request");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const sessionId = body.sessionId as string | undefined;
    const from = body.from as string | undefined;
    const to = body.to as string | undefined;
    const userMessage = (body.message as string | undefined)?.trim();
    
    console.log("Chat request:", { sessionId, from, to, messageLength: userMessage?.length });

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
      .select("id, title, description, dream_date, visibility, image_url, thumbnail_url")
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

    // Filter dreams with images/videos, but only use Supabase URLs (skip Midjourney CDN URLs)
    // For videos, we'll extract the first frame and convert it to an image
    // Midjourney CDN blocks server-side requests, so we can't use them in chat
    const dreamsWithMedia = dreams?.filter((d) => {
      if (!d.image_url) return false;
      // Only use Supabase URLs - skip Midjourney CDN URLs
      return d.image_url.includes("supabase.co/storage/v1/object/public/dream-images");
    }) ?? [];
    
    // Process media: use thumbnail_url for videos, image_url for images
    // Videos should have thumbnail_url set when uploaded (client-side extraction)
    const processedMedia: Array<{ dream: typeof dreams[0]; imageUrl: string }> = [];
    
    for (const dream of dreamsWithMedia) {
      if (!dream.image_url) continue;
      
      // If we have a thumbnail_url, use it (for videos)
      // Otherwise use image_url (for images)
      const imageUrlToUse = dream.thumbnail_url || dream.image_url;
      processedMedia.push({ dream, imageUrl: imageUrlToUse });
    }
    
    const dreamsWithImages = processedMedia.map(p => p.dream);

    const systemPrompt = dreamsWithImages.length > 0
      ? "You are a dream-pattern guide. You see a list of someone's dreams over a period of time and chat with them about themes, emotions and symbols. IMPORTANT: When images or videos are provided with dreams, you can see and analyze them. Describe specific visual details you observe in the media (colors, objects, composition, mood, settings, people, animals, movement, etc.) and connect them to the dream themes. You never diagnose or give medical advice. You emphasise curiosity and gentle self-reflection. Keep your replies concise: at most 2 short paragraphs or 4–6 sentences total (around 120 words), focusing on the heart of the question rather than repeating the full context."
      : "You are a dream-pattern guide. You see a list of someone's dreams over a period of time and chat with them about themes, emotions and symbols. You never diagnose or give medical advice. You emphasise curiosity and gentle self-reflection. Keep your replies concise: at most 2 short paragraphs or 4–6 sentences total (around 120 words), focusing on the heart of the question rather than repeating the full context.";

    const contextLines =
      dreams?.map(
        (d) =>
          `- [${d.dream_date}] ${d.title}: ${
            d.description?.slice(0, 200) ?? "(no description)"
          }`
      ) ?? [];

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

    // Build content with images if available (only Supabase URLs)
    let userContextContent: string | (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[];

    if (dreamsWithImages.length > 0) {
      const contextParts: (
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      )[] = [
        {
          type: "text" as const,
          text: contextText
        }
      ];

      // Add images (videos converted to first frame) for dreams
      // Label them clearly so the AI knows which image belongs to which dream
      for (const processed of processedMedia) {
        contextParts.push({
          type: "text" as const,
          text: `[Image for the dream "${processed.dream.title}" from ${processed.dream.dream_date}:]`
        });
        contextParts.push({
          type: "image_url" as const,
          image_url: { url: processed.imageUrl }
        });
        contextParts.push({
          type: "text" as const,
          text: `[End of image for "${processed.dream.title}"]`
        });
      }
      userContextContent = contextParts;
    } else {
      userContextContent = contextText;
    }

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContextContent }
    ];

    for (const m of previousMessages ?? []) {
      messages.push({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content
      });
    }

    // Add the new user message
    // If we're using images, the content should be an array
    if (Array.isArray(userContextContent)) {
      messages.push({
        role: "user",
        content: [
          ...userContextContent,
          {
            type: "text" as const,
            text: [
              "Here is my new message or question about these dreams:",
              userMessage
            ].join("\n\n")
          }
        ]
      });
    } else {
      messages.push({
        role: "user",
        content: [
          {
            type: "text" as const,
            text: [
              userContextContent,
              "",
              "Here is my new message or question about these dreams:",
              userMessage
            ].join("\n\n")
          }
        ]
      });
    }

    console.log(`Sending to OpenAI: ${messages.length} messages, ${dreamsWithImages.length} media files`);
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7
      });
      console.log("OpenAI response received");
    } catch (openaiError: any) {
      // If OpenAI rejects videos, try again without media (text-only)
      if (openaiError?.message?.includes("unsupported") || openaiError?.message?.includes("image")) {
        console.warn("OpenAI rejected media, falling back to text-only chat:", openaiError.message);
        // Remove media from messages and retry with text-only
        const textOnlyMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
          { 
            role: "system", 
            content: "You are a dream-pattern guide. You see a list of someone's dreams over a period of time and chat with them about themes, emotions and symbols. You never diagnose or give medical advice. You emphasise curiosity and gentle self-reflection. Keep your replies concise: at most 2 short paragraphs or 4–6 sentences total (around 120 words), focusing on the heart of the question rather than repeating the full context."
          },
          {
            role: "user",
            content: contextText
          }
        ];
        
        // Add previous messages (text only)
        for (const m of previousMessages ?? []) {
          textOnlyMessages.push({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content
          });
        }
        
        // Add the new user message
        textOnlyMessages.push({
          role: "user",
          content: [
            contextText,
            "",
            "Here is my new message or question about these dreams:",
            userMessage
          ].join("\n\n")
        });
        
        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: textOnlyMessages,
          temperature: 0.7
        });
        console.log("OpenAI text-only response received");
      } else {
        // Re-throw if it's a different error
        throw openaiError;
      }
    }

    const assistantContent = completion.choices[0]?.message?.content;
    const assistantText =
      typeof assistantContent === "string"
        ? assistantContent
        : Array.isArray(assistantContent)
        ? (assistantContent as any[])
            .map((c) => ("text" in c ? c.text : ""))
            .join("\n")
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
    console.error("Chat route error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error("Error stack:", errorStack);
    return NextResponse.json(
      { error: "Unexpected error", details: errorMessage },
      { status: 500 }
    );
  }
}


