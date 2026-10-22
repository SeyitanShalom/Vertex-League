import { NextResponse, type NextRequest } from "next/server";
import { authClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let destination = "/manager/sign-in?message=link-expired";

  if (tokenHash && (type === "email" || type === "recovery")) {
    const { error } = await (await authClient()).auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) destination = type === "recovery" ? "/manager/reset-password" : "/team";
  }

  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
