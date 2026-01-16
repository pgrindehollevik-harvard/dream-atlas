import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import React from "react";
import { renderToBuffer, Document, Page, Text, View, Image, StyleSheet } from "@react-pdf/renderer";

// Mark this route as dynamic to allow React rendering
export const dynamic = "force-dynamic";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: "#ffffff",
    fontFamily: "Helvetica"
  },
  title: {
    fontSize: 24,
    marginBottom: 10,
    fontWeight: "bold",
    color: "#1a1a1a"
  },
  subtitle: {
    fontSize: 12,
    marginBottom: 30,
    color: "#666666"
  },
  dreamContainer: {
    marginBottom: 30,
    pageBreakInside: "avoid"
  },
  dreamHeader: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottom: "1px solid #e0e0e0"
  },
  dreamDate: {
    fontSize: 10,
    color: "#666666",
    marginBottom: 4
  },
  dreamTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1a1a1a",
    marginBottom: 8
  },
  dreamImage: {
    width: "100%",
    maxHeight: 300,
    objectFit: "cover",
    marginBottom: 12,
    borderRadius: 4
  },
  dreamDescription: {
    fontSize: 11,
    color: "#333333",
    lineHeight: 1.6,
    marginTop: 8
  },
  pageNumber: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 10,
    color: "#999999"
  }
});

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

    // Create PDF document directly in the route
    const pdfDocument = React.createElement(
      Document,
      {},
      dreams.map((dream, index) => {
        // Use thumbnail_url for videos, image_url for images
        const imageUrl = dream.thumbnail_url || dream.image_url;
        
        // Format date
        let formattedDate = dream.dream_date;
        try {
          const date = new Date(dream.dream_date);
          formattedDate = date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric"
          });
        } catch (err) {
          // Use original date string if formatting fails
        }

        const pageChildren: React.ReactNode[] = [];
        
        // Add title page content if first page
        if (index === 0) {
          pageChildren.push(
            React.createElement(Text, { key: "title", style: styles.title }, `${userName}'s Dream Journal`),
            React.createElement(Text, { key: "subtitle", style: styles.subtitle }, `${dreams.length} Dreams in ${totalDays} Days`)
          );
        }
        
        // Dream container
        const dreamChildren: React.ReactNode[] = [
          React.createElement(View, { key: "header", style: styles.dreamHeader },
            React.createElement(Text, { style: styles.dreamDate }, formattedDate),
            React.createElement(Text, { style: styles.dreamTitle }, dream.title || "")
          )
        ];
        
        // Add image if available
        if (imageUrl && typeof imageUrl === "string") {
          dreamChildren.push(
            React.createElement(Image, { key: "image", src: imageUrl, style: styles.dreamImage })
          );
        }
        
        // Add description if available
        if (dream.description) {
          dreamChildren.push(
            React.createElement(Text, { key: "description", style: styles.dreamDescription }, dream.description)
          );
        }
        
        pageChildren.push(
          React.createElement(View, { key: "dream", style: styles.dreamContainer }, dreamChildren),
          React.createElement(Text, {
            key: "pagenum",
            style: styles.pageNumber,
            render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `${pageNumber} / ${totalPages}`,
            fixed: true
          })
        );

        return React.createElement(
          Page,
          { key: dream.id, size: "A4", style: styles.page },
          ...pageChildren
        );
      })
    );

    // Render to buffer
    const buffer = await renderToBuffer(pdfDocument);

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
