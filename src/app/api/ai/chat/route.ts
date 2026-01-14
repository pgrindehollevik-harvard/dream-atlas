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

    // Filter dreams with images only (videos not supported in chat by OpenAI vision API)
    // Only use Supabase URLs (skip Midjourney CDN URLs)
    // Check actual file content, not just extension (videos may have .jpg extension)
    // Midjourney CDN blocks server-side requests, so we can't use them in chat
    const dreamsWithImages: typeof dreams = [];
    
    if (dreams) {
      for (const dream of dreams) {
        if (!dream.image_url) continue;
        // Only use Supabase URLs - skip Midjourney CDN URLs
        if (!dream.image_url.includes("supabase.co/storage/v1/object/public/dream-images")) {
          continue;
        }
        
        // Check if it's actually a video by checking file content
        // Videos may have .jpg extension but contain video data
        try {
          const response = await fetch(dream.image_url, { 
            method: "GET",
            headers: { "Range": "bytes=0-12" } // Only fetch first 12 bytes to check file signature
          });
          
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            const bytes = new Uint8Array(buffer);
            
            // Check for video file signatures
            // MP4: starts with ftyp (bytes 4-7) and contains isom, mp41, etc.
            // WebM: starts with 1A 45 DF A3
            // AVI: starts with RIFF...AVI 
            const isMP4 = bytes.length >= 12 && 
              String.fromCharCode(bytes[4], bytes[5], bytes[6], bytes[7]) === "ftyp" &&
              (String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).includes("isom") ||
               String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]).includes("mp41"));
            const isWebM = bytes.length >= 4 && bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3;
            const isAVI = bytes.length >= 12 &&
              String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]) === "RIFF" &&
              String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]) === "AVI ";
            
            if (isMP4 || isWebM || isAVI) {
              console.log(`Skipping video file in chat (detected by file signature): ${dream.image_url}`);
              continue;
            }
            
            // Also check content-type header as fallback
            const contentType = response.headers.get("content-type") || "";
            if (contentType.startsWith("video/")) {
              console.log(`Skipping video file in chat (content-type: ${contentType}): ${dream.image_url}`);
              continue;
            }
          }
          
          dreamsWithImages.push(dream);
        } catch (checkError) {
          // If we can't check, skip it to be safe
          console.warn(`Could not verify file type for ${dream.image_url}, skipping:`, checkError);
          continue;
        }
      }
    }

    const systemPrompt = dreamsWithImages.length > 0
      ? "You are a dream-pattern guide. You see a list of someone's dreams over a period of time and chat with them about themes, emotions and symbols. IMPORTANT: When images are provided with dreams, you can see and analyze them. Describe specific visual details you observe in the images (colors, objects, composition, mood, settings, people, animals, etc.) and connect them to the dream themes. You never diagnose or give medical advice. You emphasise curiosity and gentle self-reflection. Keep your replies concise: at most 2 short paragraphs or 4–6 sentences total (around 120 words), focusing on the heart of the question rather than repeating the full context."
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

      // Add images for dreams that have Supabase URLs (videos are filtered out above)
      // Label them clearly so the AI knows which image belongs to which dream
      for (const dream of dreamsWithImages) {
        if (dream.image_url) {
          contextParts.push({
            type: "text" as const,
            text: `[Image for the dream "${dream.title}" from ${dream.dream_date}:]`
          });
          contextParts.push({
            type: "image_url" as const,
            image_url: { url: dream.image_url }
          });
          contextParts.push({
            type: "text" as const,
            text: `[End of image for "${dream.title}"]`
          });
        }
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

    console.log(`Sending to OpenAI: ${messages.length} messages, ${dreamsWithImages.length} images`);
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7
    });
    console.log("OpenAI response received");

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


