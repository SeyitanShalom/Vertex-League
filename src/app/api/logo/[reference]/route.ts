import { NextResponse } from "next/server";
import { ownerRegistration } from "@/lib/registration/data";
import { adminIdentity } from "@/lib/auth";
import { serviceClient } from "@/lib/supabase/service";
import { deploymentMode } from "@/lib/config/server";
import { referenceSchema } from "@/lib/validations/registration";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ reference: string }> },
) {
  const { reference } = await params;
  if (!referenceSchema.safeParse(reference).success) return new NextResponse(null, { status: 404 });
  const owner = await ownerRegistration(reference);
  let path = owner?.teams.logo_path;
  if (!owner) {
    const admin = await adminIdentity();
    if (!admin) return new NextResponse(null, { status: 404 });
    const { data } = await admin.client
      .from("registrations")
      .select("teams(logo_path)")
      .eq("registration_reference", reference)
      .eq("mode", deploymentMode())
      .maybeSingle();
    path = (data?.teams as unknown as { logo_path: string | null } | null)?.logo_path;
  }
  if (!path) return new NextResponse(null, { status: 404 });
  const { data, error } = await serviceClient().storage.from("team-logos").download(path);
  if (error || !data) return new NextResponse(null, { status: 404 });
  return new NextResponse(data, {
    headers: {
      "Content-Type": data.type,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
