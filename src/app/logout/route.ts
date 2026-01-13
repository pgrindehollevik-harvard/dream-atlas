import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseServerClient();
  await supabase.auth.signOut();
  
  // Get the origin from the request headers
  const origin = req.headers.get("origin") || req.headers.get("referer") || "http://localhost:3000";
  const baseUrl = new URL(origin).origin;
  
  return NextResponse.redirect(new URL("/", baseUrl));
}


