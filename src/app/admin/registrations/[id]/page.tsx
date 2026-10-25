import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { deploymentMode } from "@/lib/config/server";
import { registrationColumns } from "@/lib/registration/data";
import { RegistrationActions } from "@/components/admin/registration-actions";
import { DeleteTestRegistration } from "@/components/admin/delete-test-registration";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared";
import { dateLabel, money, humanize } from "@/lib/utils";
import { whatsappLink } from "@/lib/whatsapp";
import type { Registration } from "@/types/domain";
export const metadata: Metadata = {
  title: "Review registration",
  robots: { index: false, follow: false },
};
export default async function AdminDetail({ params }: { params: Promise<{ id: string }> }) {
  const { client } = await requireAdmin();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const { data, error } = await client
    .from("registrations")
    .select(`${registrationColumns},admin_notes`)
    .eq("id", id)
    .eq("mode", deploymentMode())
    .maybeSingle();
  if (error)
    return (
      <div className="container page-space">
        <Notice tone="error">
          Unable to load this registration. Please refresh or check the database setup.
        </Notice>
      </div>
    );
  if (!data) notFound();
  const row = data as unknown as Registration;
  const payment = row.payments[0];
  const { data: audit, error: auditError } = await client
    .from("admin_audit_logs")
    .select("id,action,admin_id,reason,created_at,new_value")
    .eq("registration_id", id)
    .order("created_at", { ascending: false })
    .limit(50);
  const chat = whatsappLink(
    row.teams.whatsapp_number,
    `Hello ${row.teams.manager_name}, this is the Vertex League organizer regarding ${row.teams.team_name}.\nRegistration reference: ${row.registration_reference}`,
  );
  return (
    <div className="container page-space">
      <Link className="back-link" href="/admin">
        <ArrowLeft size={15} /> Back to registrations
      </Link>
      <div className="dashboard-head">
        <div>
          <p className="eyebrow">{row.registration_reference}</p>
          <h1>{row.teams.team_name}</h1>
        </div>
        {chat && (
          <Button asChild variant="outline">
            <a href={chat} target="_blank" rel="noreferrer">
              <MessageCircle size={17} /> Manager’s WhatsApp
            </a>
          </Button>
        )}
      </div>
      <div className="detail-grid">
        <div>
          <section className="panel">
            <div className="state-heading">
              <h2>Registration details</h2>
              <StatusBadge status={row.registration_status} />
            </div>
            <dl className="detail-data">
              {[
                ["Manager", row.teams.manager_name],
                ["Phone", row.teams.phone],
                ["WhatsApp", row.teams.whatsapp_number],
                ["Email", row.teams.email || "Not provided"],
                ["Location", row.teams.location],
                ["Submitted", dateLabel(row.submitted_at)],
                ["Expected fee", money(row.registration_fee)],
                ["Payment", humanize(payment?.payment_status ?? "pending")],
                ["Refund", humanize(row.refund_status)],
                [
                  "Physical screening",
                  row.screening_passed_at
                    ? `Passed ${dateLabel(row.screening_passed_at)}`
                    : "Awaiting clearance",
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
              {row.teams.additional_information && (
                <div className="full">
                  <dt>Additional information</dt>
                  <dd>{row.teams.additional_information}</dd>
                </div>
              )}
              {row.teams.logo_path && (
                <div className="full">
                  <dt>Team badge</dt>
                  <dd>
                    <Image
                      unoptimized
                      width={90}
                      height={90}
                      className="logo-preview"
                      src={`/api/logo/${row.registration_reference}`}
                      alt={`${row.teams.team_name} badge`}
                    />
                  </dd>
                </div>
              )}
            </dl>
          </section>
          <section className="panel">
            <h3>Action history</h3>
            {auditError && (
              <Notice tone="error">
                The history could not load. Refresh before making further changes.
              </Notice>
            )}
            <p className="hint">Most recent 50 events. Full history is retained in the database.</p>
            <ul className="audit-list">
              {audit?.map((entry) => (
                <li key={entry.id}>
                  <strong>{humanize(entry.action)}</strong>
                  <small>
                    {dateLabel(entry.created_at)} ·{" "}
                    {entry.admin_id
                      ? `Admin ${entry.admin_id.slice(0, 8)}`
                      : "Team manager / submission"}
                  </small>
                  {entry.reason && <p>{entry.reason}</p>}
                  {entry.action === "request_correction" &&
                    entry.new_value?.correction_fee_amount && (
                      <p className="small muted">
                        Correction fee verified: {money(entry.new_value.correction_fee_amount)}. One
                        correction submission approved.
                      </p>
                    )}
                </li>
              ))}
            </ul>
          </section>
        </div>
        <aside>
          <section className="panel">
            <h3>Organizer actions</h3>
            <p className="hint" style={{ marginBottom: 22 }}>
              Payment received provisionally books a place. Approve only after the team and players
              pass physical screening after the registration deadline. Verify the separate ₦2,000
              correction fee before approving edit access.
            </p>
            <RegistrationActions
              id={id}
              payment={payment?.payment_status ?? "pending"}
              status={row.registration_status}
              refund={row.refund_status}
              notes={row.admin_notes}
              hasManagerAccount={!!row.manager_user_id}
              correctionApprovedAt={row.correction_approved_at}
            />
            {deploymentMode() === "test" && (
              <div className="record-delete-detail">
                <DeleteTestRegistration
                  id={id}
                  reference={row.registration_reference}
                  mode={row.mode}
                  payment={payment?.payment_status ?? "pending"}
                  status={row.registration_status}
                  refund={row.refund_status}
                  redirectOnSuccess
                />
              </div>
            )}
          </section>
          <section className="panel">
            <h3>Internal notes</h3>
            <p className="small muted" style={{ whiteSpace: "pre-wrap" }}>
              {row.admin_notes || "No internal notes yet."}
            </p>
          </section>
          {row.refunds && (
            <section className="panel">
              <h3>Refund completed</h3>
              <p>{money(row.refunds.amount)}</p>
              <p className="small muted">
                {dateLabel(row.refunds.refunded_at)}
                <br />
                {row.refunds.transfer_reference}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
