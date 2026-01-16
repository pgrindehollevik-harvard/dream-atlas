import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createDreamJournalPDF } from "@/lib/pdf/create-dream-journal";

// Mark this route as dynamic to allow React rendering
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const supabase = createSupabaseServerClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user profile for name
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle();

    // Get all dreams
    const { data: dreams, error: dreamsError } = await supabase
      .from("dreams")
      .select("id, title, description, dream_date, image_url, thumbnail_url")
      .eq("user_id", user.id)
      .order("dream_date", { ascending: false });

    if (dreamsError) {
      return NextResponse.json(
        { error: dreamsError.message },
        { status: 500 }
      );
    }

    if (!dreams || dreams.length === 0) {
      return NextResponse.json(
        { error: "No dreams found to export" },
        { status: 400 }
      );
    }

    // Calculate total days
    const dates = dreams.map((d) => new Date(d.dream_date).getTime());
    const minDate = Math.min(...dates);
    const maxDate = Math.max(...dates);
    const totalDays = Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1;

    const userName = profile?.display_name || user.email?.split("@")[0] || "User";

    // Create PDF document
    const pdfDocument = createDreamJournalPDF(dreams, userName, totalDays);

    // Render to buffer
    let buffer: Buffer;
    try {
      buffer = await renderToBuffer(pdfDocument);
    } catch (renderError) {
      console.error("PDF render error:", renderError);
      // Try to get more details about the error
      const errorDetails = renderError instanceof Error 
        ? renderError.message 
        : String(renderError);
      throw new Error(`PDF rendering failed: ${errorDetails}`);
    }

    // Return PDF - convert Buffer to Uint8Array for NextResponse
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dream-journal-${new Date().toISOString().split("T")[0]}.pdf"`,
        "Content-Length": buffer.length.toString()
      }
    });
  } catch (error) {
    console.error("PDF export error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Full error details:", errorMessage);
    return NextResponse.json(
      { 
        error: "Failed to generate PDF", 
        details: errorMessage 
      },
      { status: 500 }
    );
  }
}

