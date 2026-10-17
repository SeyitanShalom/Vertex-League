import { NextResponse } from "next/server";
import { getSettings, hasDatabase } from "@/lib/config/server";
export async function GET() {
  try {
    const ready = hasDatabase() && !!(await getSettings());
    return NextResponse.json(
      { status: ready ? "ready" : "setup_required" },
      { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ status: "unavailable" }, { status: 503 });
  }
}
