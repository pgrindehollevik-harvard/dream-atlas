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
    const imageUrl = body.imageUrl as string | undefined;

    if (!imageUrl || !imageUrl.trim()) {
      return NextResponse.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    // Check if it's already a Supabase storage URL
    if (imageUrl.includes("supabase.co/storage/v1/object/public/dream-images")) {
      return NextResponse.json({ storedUrl: imageUrl });
    }

    // Download the image from the CDN
    let imageResponse: Response;
    try {
      imageResponse = await fetch(imageUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; DreamAtlas/1.0)"
        }
      });
    } catch (fetchError) {
      return NextResponse.json(
        { error: "Could not fetch image from URL" },
        { status: 400 }
      );
    }

    if (!imageResponse.ok) {
      return NextResponse.json(
        { error: "Image URL returned an error" },
        { status: 400 }
      );
    }

    const imageBlob = await imageResponse.blob();
    const contentType = imageResponse.headers.get("content-type") || "image/jpeg";
    
    // Determine file extension from content type
    let ext = "jpg";
    if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("webp")) ext = "webp";
    else if (contentType.includes("gif")) ext = "gif";

    // Create a File object from the blob
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = `${user.id}/${fileName}`;
    const file = new File([imageBlob], fileName, { type: contentType });

    // Upload to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("dream-images")
      .upload(filePath, file, {
        cacheControl: "31536000",
        upsert: false
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    // Get the public URL
    const {
      data: { publicUrl }
    } = supabase.storage.from("dream-images").getPublicUrl(filePath);

    return NextResponse.json({ storedUrl: publicUrl });
  } catch (error) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(error) },
      { status: 500 }
    );
  }
}

