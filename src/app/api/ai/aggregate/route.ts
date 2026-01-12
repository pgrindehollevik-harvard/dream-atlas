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
      .select("id, title, description, dream_date, visibility, image_url")
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

    // Build content with images for vision model
    const dreamsWithImages = dreams.filter((d) => d.image_url);
    const dreamsWithoutImages = dreams.filter((d) => !d.image_url);

    const userContentParts: (
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    )[] = [];

    // Add intro text
    userContentParts.push({
      type: "text" as const,
      text: [
        `You are helping someone explore patterns across several dreams.`,
        ``,
        `Here are their dreams between ${from} and ${to}:`,
        ``,
        ...dreams.map(
          (d) =>
            `- [${d.dream_date}] ${d.title}: ${
              d.description?.slice(0, 200) ?? "(no description)"
            }`
        ),
        ``,
        `Please analyze these dreams, taking into account both the text descriptions and the images (where provided).`,
        `Please:`,
        `1) Summarise recurring themes, settings, and emotional tones.`,
        `2) Point out 3–7 motifs that appear more than once.`,
        `3) Offer a short paragraph on how these might connect to waking life (without making diagnoses).`,
        `4) Finish with 2 or 3 reflection prompts they can journal on.`,
        ``,
        `IMPORTANT: Return your answer as a short HTML fragment, no <html> or <body> tags.`,
        `DO NOT wrap your response in markdown code blocks (no \`\`\`html or \`\`\`). Return ONLY the raw HTML.`,
        `Use simple, clean structure:`,
        `- A <h3> "Themes" section with paragraphs.`,
        `- A <h3> "Motifs" section with a <ul><li> list of motifs.`,
        `- A <h3> "Reflection prompts" section with <ul><li> questions.`,
        `You may use <strong> and <em> for gentle emphasis, but avoid overly decorative markup.`,
        `Keep it under ~500 words, warm in tone, and easy to read.`
      ].join("\n")
    });

    // Add images for dreams that have them
    // Convert Midjourney CDN URLs to Supabase storage URLs first
    // Note: Server-side image fetching from Midjourney CDN often fails due to blocking
    // If conversion fails, we'll skip images and use text-only analysis
    const convertedImageUrls: Record<string, string> = {};
    const validImages: Array<{ url: string; label: string }> = [];
    
    for (const dream of dreamsWithImages) {
      if (dream.image_url) {
        let imageUrlToUse: string | null = null;
        const isSupabaseUrl = dream.image_url.includes("supabase.co/storage/v1/object/public/dream-images");
        
        // If it's already a Supabase URL, use it directly
        if (isSupabaseUrl) {
          imageUrlToUse = dream.image_url;
        }
        // If it's already been converted, use the converted URL
        else if (convertedImageUrls[dream.image_url]) {
          imageUrlToUse = convertedImageUrls[dream.image_url];
        }
        // Try to convert Midjourney CDN URL (may fail due to server-side blocking)
        else {
          try {
            console.log("Attempting to convert Midjourney CDN URL for aggregate analysis:", dream.image_url);
            const imageResponse = await fetch(dream.image_url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                "Referer": "https://www.midjourney.com/",
                "Accept-Language": "en-US,en;q=0.9"
              },
              redirect: "follow"
            });
            
            if (imageResponse.ok) {
              const imageBlob = await imageResponse.blob();
              const contentType = imageBlob.type || "image/jpeg";
              
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
                
                imageUrlToUse = publicUrl;
                convertedImageUrls[dream.image_url] = publicUrl;
                console.log("Successfully converted to Supabase URL:", imageUrlToUse);
                
                // Update the dream's image_url in the database
                if (dream.id) {
                  await supabase
                    .from("dreams")
                    .update({ image_url: publicUrl })
                    .eq("id", dream.id);
                }
              } else {
                console.warn("Failed to upload converted image, skipping:", uploadError.message);
              }
            } else {
              console.warn("Failed to fetch image from CDN (likely blocked), skipping:", imageResponse.status);
            }
          } catch (convertError) {
            console.warn("Error converting image (likely server-side blocking), skipping:", convertError instanceof Error ? convertError.message : String(convertError));
            // Skip this image - continue with others
          }
        }
        
        // Only add images that we successfully have a URL for
        if (imageUrlToUse) {
          validImages.push({
            url: imageUrlToUse,
            label: `[Image for: ${dream.dream_date} - ${dream.title}]`
          });
        }
      }
    }
    
    // Add valid images to content
    for (const img of validImages) {
      userContentParts.push({
        type: "image_url" as const,
        image_url: { url: img.url }
      });
      userContentParts.push({
        type: "text" as const,
        text: img.label
      });
    }

    let completion;
    try {
      console.log(`Generating aggregate summary: ${dreams.length} dreams, ${validImages.length} images`);
      // Try with vision model if we have successfully converted images
      if (validImages.length > 0) {
        console.log("Using vision model with images");
        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You speak like a thoughtful dream guide, not a therapist. You emphasise curiosity and self-reflection. When analyzing dream images, describe specific visual elements you see (colors, objects, composition, mood, settings) and connect them to the themes and patterns across the dreams."
            },
            {
              role: "user",
              content: userContentParts
            }
          ],
          temperature: 0.7
        });
      } else {
        // Text-only if no images
        console.log("Using text-only model (no images)");
        const textPrompt = [
          `You are helping someone explore patterns across several dreams.`,
          ``,
          `Here are their dreams between ${from} and ${to}:`,
          ...dreams.map(
            (d) =>
              `- [${d.dream_date}] ${d.title}: ${
                d.description?.slice(0, 400) ?? "(no description)"
              }`
          ),
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

        completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "You speak like a thoughtful dream guide, not a therapist. You emphasise curiosity and self-reflection. When analyzing dream images, describe specific visual elements you see (colors, objects, composition, mood, settings) and connect them to the themes and patterns across the dreams."
            },
            { role: "user", content: textPrompt }
          ],
          temperature: 0.7
        });
      }
    } catch (visionError) {
      console.error("Vision model error, falling back to text-only:", visionError);
      // Fallback to text-only if vision model fails
      const textPrompt = [
        `You are helping someone explore patterns across several dreams.`,
        ``,
        `Here are their dreams between ${from} and ${to}:`,
        ...dreams.map(
          (d) =>
            `- [${d.dream_date}] ${d.title}: ${
              d.description?.slice(0, 400) ?? "(no description)"
            }`
        ),
        ``,
        `Please:`,
        `1) Summarise recurring themes, settings, and emotional tones.`,
        `2) Point out 3–7 motifs that appear more than once.`,
        `3) Offer a short paragraph on how these might connect to waking life (without making diagnoses).`,
        `4) Finish with 2 or 3 reflection prompts they can journal on.`,
        ``,
        `IMPORTANT: Return your answer as a short HTML fragment, no <html> or <body> tags.`,
        `DO NOT wrap your response in markdown code blocks (no \`\`\`html or \`\`\`). Return ONLY the raw HTML.`,
        `Use simple, clean structure:`,
        `- A <h3> "Themes" section with paragraphs.`,
        `- A <h3> "Motifs" section with a <ul><li> list of motifs.`,
        `- A <h3> "Reflection prompts" section with <ul><li> questions.`,
        `You may use <strong> and <em> for gentle emphasis, but avoid overly decorative markup.`,
        `Keep it under ~500 words, warm in tone, and easy to read.`
      ].join("\n");

      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You speak like a thoughtful dream guide, not a therapist. You emphasise curiosity and self-reflection."
          },
          { role: "user", content: textPrompt }
        ],
        temperature: 0.7
      });
    }

    const content = completion.choices[0]?.message?.content;
    let summaryText =
      typeof content === "string"
        ? content
        : Array.isArray(content)
        ? (content as any[])
            .map((c) => ("text" in c ? c.text : ""))
            .join("\n")
        : "";

    // Strip markdown code fences if present
    if (summaryText) {
      summaryText = summaryText
        .replace(/^```html\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    if (!summaryText) {
      return NextResponse.json(
        { error: "Could not generate summary" },
        { status: 500 }
      );
    }

    console.log("Saving aggregate summary to database...");
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
      console.error("Database insert error:", insertError);
      return NextResponse.json(
        { error: insertError.message, code: insertError.code },
        { status: 500 }
      );
    }
    
    console.log("Aggregate summary generated successfully");

    return NextResponse.json({
      summary: inserted?.summary_text,
      createdAt: inserted?.created_at
    });
    } catch (error) {
      console.error("Aggregate route error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error("Error stack:", errorStack);
      return NextResponse.json(
        { error: "Unexpected error", details: errorMessage },
        { status: 500 }
      );
    }
}


