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
      dream.image_url ? `` : ``,
      dream.image_url ? `NOTE: There is an image associated with this dream. When analyzing, describe specific visual elements you see in the image (colors, objects, composition, mood, setting) and connect them to the dream's themes and symbols.` : ``,
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

    const userContentParts: (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[] = [
      {
        type: "text" as const,
        text: basePrompt
      }
    ];

    let usedImage = false;
    let imageError: string | null = null;
    let content: OpenAI.Chat.Completions.ChatCompletionMessage["content"] | undefined = undefined;

    if (dream.image_url) {
      // Check if it's a Supabase storage URL (should work) or external CDN (might fail)
      const isSupabaseUrl = dream.image_url.includes("supabase.co/storage/v1/object/public/dream-images");
      
      userContentParts.push({
        type: "image_url" as const,
        image_url: {
          url: dream.image_url
        }
      });

      try {
        console.log("Attempting vision model with image URL:", dream.image_url);
        const completionWithImage = await openai.chat.completions.create({
          model: "gpt-4o-mini", // Use vision-capable model
          messages: [
            {
              role: "system",
              content:
                "You specialise in dreams and symbolic imagery. You avoid medical or diagnostic language and keep things exploratory. When analyzing a dream image, describe specific visual elements you see (colors, objects, composition, mood) and connect them to the dream's themes."
            },
            {
              role: "user",
              content: userContentParts
            }
          ],
          temperature: 0.7
        });
        content = completionWithImage.choices[0]?.message?.content;
        usedImage = true;
        console.log("Vision model succeeded, used image:", usedImage);
      } catch (visionError) {
        // Log the error for debugging
        imageError = String(visionError);
        console.error("Vision model error:", visionError);
        console.error("Error details:", JSON.stringify(visionError, null, 2));
        
        // If it's not a Supabase URL, try to convert it first
        if (!isSupabaseUrl) {
          try {
            // Download and convert the image
            const imageResponse = await fetch(dream.image_url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (compatible; DreamAtlas/1.0)"
              }
            });
            
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob();
              const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
              
              let ext = "jpg";
              if (contentType.includes("png")) ext = "png";
              else if (contentType.includes("webp")) ext = "webp";
              else if (contentType.includes("gif")) ext = "gif";
              
              const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
              const filePath = `${user.id}/${fileName}`;
              const file = new File([imageBlob], fileName, { type: contentType });
              
              const { error: uploadError } = await supabase.storage
                .from("dream-images")
                .upload(filePath, file, {
                  cacheControl: "31536000",
                  upsert: false
                });
              
              if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                  .from("dream-images")
                  .getPublicUrl(filePath);
                
                // Retry with the converted URL
                const retryContentParts: (
                  | { type: "text"; text: string }
                  | { type: "image_url"; image_url: { url: string } }
                )[] = [
                  {
                    type: "text" as const,
                    text: basePrompt
                  },
                  {
                    type: "image_url" as const,
                    image_url: {
                      url: publicUrl
                    }
                  }
                ];
                
                console.log("Retrying with converted Supabase URL:", publicUrl);
                const retryCompletion = await openai.chat.completions.create({
                  model: "gpt-4o-mini", // Use vision-capable model
                  messages: [
                    {
                      role: "system",
                      content:
                        "You specialise in dreams and symbolic imagery. You avoid medical or diagnostic language and keep things exploratory. When analyzing a dream image, describe specific visual elements you see (colors, objects, composition, mood) and connect them to the dream's themes."
                    },
                    {
                      role: "user",
                      content: retryContentParts
                    }
                  ],
                  temperature: 0.7
                });
                content = retryCompletion.choices[0]?.message?.content;
                usedImage = true;
                
                // Update the dream's image_url to the stored version
                await supabase
                  .from("dreams")
                  .update({ image_url: publicUrl })
                  .eq("id", dream.id);
              }
            }
          } catch (importError) {
            // Fall back to text-only
            console.error("Image import and retry failed:", importError);
          }
        }
        
        // If we still don't have content, fall back to text-only
        if (!content) {
          console.log("Falling back to text-only interpretation");
          const textOnlyCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
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
      }
    } else {
      // No image, use text-only
      console.log("No image URL, using text-only interpretation");
      const textOnlyCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
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
      createdAt: inserted?.created_at,
      usedImage: usedImage,
      imageError: imageError
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(error) },
      { status: 500 }
    );
  }
}


