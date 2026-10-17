import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CircleCheck, Circle, ArrowUpRight } from "lucide-react";
import { ownerRegistration } from "@/lib/registration/data";
import { getSettings, operationalContact } from "@/lib/config/server";
import { canEdit } from "@/lib/registration/rules";
import { privateLink, readAccess } from "@/lib/security";
import { whatsappLink } from "@/lib/whatsapp";
import { money, dateLabel } from "@/lib/utils";
import { AccessRequired, PageIntro, Notice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SaveAccess, RefreshStatus } from "@/components/registration/private-tools";
import { TeamForm } from "@/components/registration/team-form";
export const metadata: Metadata = {
  title: "Your registration",
  robots: { index: false, follow: false },
};
export default async function RegistrationPage({
  params,
}: {
  params: Promise<{ reference: string }>;
}) {
  const { reference } = await params;
  const row = await ownerRegistration(reference);
  if (!row) return <AccessRequired />;
  const settings = await getSettings();
  const token = (await readAccess(reference))!;
  const contact = operationalContact();
  const payment = row.payments[0];
  const editable = canEdit(row.registration_status, settings?.registration_deadline ?? null);
  const chat = whatsappLink(
    contact.whatsapp,
    `Hello, I need help with my Vertex League registration.\nReference: ${reference}\nTeam: ${row.teams.team_name}`,
  );
  const logoChat = whatsappLink(
    contact.whatsapp,
    `Hello, I am sending my team logo for Vertex League.\nReference: ${reference}\nTeam: ${row.teams.team_name}`,
  );
  const logoUrl = row.teams.logo_path ? `/api/logo/${reference}` : undefined;
  const statusText =
    row.refund_status === "refunded"
      ? "Your full registration fee has been refunded."
      : row.refund_status === "pending"
        ? "Your team was not approved. Your full registration fee is due back; the organizer will arrange the refund."
        : row.registration_status === "approved"
          ? "Congratulations! Your team passed physical screening and is approved for Vertex League."
          : row.registration_status === "correction_required"
            ? "The organizer has requested corrections. Review the instructions below and update your team details."
            : row.registration_status === "rejected"
              ? "Your registration requires attention. Please contact the organizer for details."
              : payment?.payment_status === "confirmed"
                ? "Your payment has been verified and your place is provisionally booked. Final approval follows physical screening."
                : payment?.payment_status === "rejected"
                  ? "Your payment could not be verified. Please contact the organizer and resubmit proof using your existing reference."
                  : "Your registration has been received. Complete your bank transfer, then send your receipt and team logo to the organizer on WhatsApp.";
  return (
    <div className="container page-space">
      <PageIntro
        eyebrow={`YOUR REGISTRATION / ${reference}`}
        title={row.teams.team_name}
        description={`Submitted ${dateLabel(row.submitted_at)}. Follow your team’s progress here.`}
      />
      <SaveAccess reference={reference} link={privateLink(reference, token)} />
      <Notice
        tone={
          row.registration_status === "approved" || row.refund_status === "refunded"
            ? "success"
            : "info"
        }
      >
        {statusText}
      </Notice>
      {row.public_message && <Notice>{row.public_message}</Notice>}
      <div className="two-column">
        <div>
          <section className="panel">
            <div className="state-heading">
              <h2>Your registration journey</h2>
              <RefreshStatus />
            </div>
            <div className="button-row">
              <span className="small">
                Payment <StatusBadge status={payment?.payment_status ?? "pending"} />
              </span>
              <span className="small">
                Registration <StatusBadge status={row.registration_status} />
              </span>
            </div>
            <ol className="status-timeline">
              {[
                { label: "Team details saved", done: true },
                {
                  label: "Payment received — place provisionally booked",
                  done: payment?.payment_status === "confirmed",
                },
                { label: "Physical screening passed", done: !!row.screening_passed_at },
                { label: "Final entry approved", done: row.registration_status === "approved" },
              ].map((step) => (
                <li className={step.done ? "done" : ""} key={step.label}>
                  {step.done ? <CircleCheck size={20} /> : <Circle size={20} />}
                  <span>{step.label}</span>
                </li>
              ))}
            </ol>
            {payment?.payment_status !== "confirmed" && row.registration_status !== "rejected" && (
              <Button asChild>
                <Link href={`/payment/${reference}`}>
                  View payment instructions <ArrowUpRight size={16} />
                </Link>
              </Button>
            )}
            {chat && (
              <Button asChild variant="outline" style={{ marginTop: 12, marginLeft: 8 }}>
                <a href={chat} target="_blank" rel="noreferrer">
                  Contact organizer <ArrowUpRight size={16} />
                </a>
              </Button>
            )}
          </section>
          {row.refund_status !== "none" && (
            <section className="panel">
              <h3>Full refund</h3>
              <StatusBadge
                status={row.refund_status === "pending" ? "refund_pending" : "refunded"}
              />
              <dl className="summary-list">
                <div>
                  <dt>Full amount</dt>
                  <dd>{money(row.registration_fee)}</dd>
                </div>
                {row.refunds[0] && (
                  <>
                    <div>
                      <dt>Returned on</dt>
                      <dd>{dateLabel(row.refunds[0].refunded_at)}</dd>
                    </div>
                    <div>
                      <dt>Transfer reference</dt>
                      <dd>{row.refunds[0].transfer_reference}</dd>
                    </div>
                  </>
                )}
              </dl>
            </section>
          )}
          {editable ? (
            <section className="panel">
              <TeamForm existing={{ reference, team: row.teams }} />
            </section>
          ) : (
            <section className="panel">
              <h3>Need to correct your details?</h3>
              <p className="small muted">
                Contact the organizer using this registration reference. The organizer can enable
                corrections when appropriate.
              </p>
            </section>
          )}
        </div>
        <aside>
          <section className="panel">
            <h3>Team details</h3>
            {logoUrl && (
              <Image
                unoptimized
                width={90}
                height={90}
                className="logo-preview"
                src={logoUrl}
                alt={`${row.teams.team_name} badge`}
                referrerPolicy="no-referrer"
              />
            )}
            <dl className="summary-list">
              <div>
                <dt>Manager</dt>
                <dd>{row.teams.manager_name}</dd>
              </div>
              <div>
                <dt>Team location</dt>
                <dd>{row.teams.location}</dd>
              </div>
              <div>
                <dt>Fee assigned at registration</dt>
                <dd>{money(row.registration_fee)}</dd>
              </div>
              <div>
                <dt>Screening</dt>
                <dd>Player details are collected physically at the screening venue.</dd>
              </div>
              {contact.screeningVenue && (
                <div>
                  <dt>Screening venue</dt>
                  <dd>{contact.screeningVenue}</dd>
                </div>
              )}
              {contact.screeningDate && (
                <div>
                  <dt>Screening date</dt>
                  <dd>{contact.screeningDate}</dd>
                </div>
              )}
            </dl>
          </section>
          <section className="panel">
            <h3>Your team logo</h3>
            <p className="small muted">
              Send your team logo directly to the organizer on WhatsApp, along with your
              registration reference. You can use the same chat to send a replacement.
            </p>
            {logoChat && (
              <Button asChild variant="outline" style={{ marginTop: 20 }}>
                <a href={logoChat} target="_blank" rel="noreferrer">
                  Send team logo on WhatsApp <ArrowUpRight size={16} />
                </a>
              </Button>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
