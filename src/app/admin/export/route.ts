import { NextResponse, type NextRequest } from "next/server";
import { adminIdentity } from "@/lib/auth";
import { deploymentMode } from "@/lib/config/server";
import { filterSchema, type AdminListRow } from "@/lib/admin";
import { csv } from "@/lib/csv";
export async function GET(request: NextRequest) {
  const admin = await adminIdentity();
  if (!admin) return new NextResponse("Unauthorized", { status: 401 });
  const f = filterSchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const mode = deploymentMode();
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(
        encoder.encode(
          csv([
            [
              "Reference",
              "Team",
              "Manager",
              "Phone",
              "Submitted",
              "Fee (NGN)",
              "Payment",
              "Registration",
              "Refund",
            ],
          ]) + "\r\n",
        ),
      );
      try {
        for (let page = 1; page <= 10000; page++) {
          if (request.signal.aborted) break;
          const { data, error } = await admin.client.rpc("admin_list_registrations", {
            p_mode: mode,
            p_search: f.q,
            p_payment: f.payment,
            p_status: f.status,
            p_page: page,
            p_from: f.from || null,
            p_to: f.to || null,
          });
          if (error) throw new Error("Export unavailable");
          const list = data as { rows: AdminListRow[]; total: number };
          if (!list.rows.length) break;
          const text = csv(
            list.rows.map((r) => [
              r.registration_reference,
              r.team_name,
              r.manager_name,
              r.phone,
              r.submitted_at,
              r.registration_fee,
              r.payment_status,
              r.registration_status,
              r.refund_status,
            ]),
          ).slice(1);
          controller.enqueue(encoder.encode(text + "\r\n"));
          if (page * 20 >= list.total) break;
        }
        controller.close();
      } catch {
        controller.error(new Error("Export could not be completed. Please retry."));
      }
    },
  });
  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vertex-${mode}-registrations.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
