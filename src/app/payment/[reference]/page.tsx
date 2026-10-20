import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { ownerRegistration } from "@/lib/registration/data";
import { operationalContact, paymentConfigured } from "@/lib/config/server";
import { privateLink, readAccess } from "@/lib/security";
import { whatsappLink, paymentMessage } from "@/lib/whatsapp";
import { money } from "@/lib/utils";
import { AccessRequired, PageIntro, Notice } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { CopyButton, SaveAccess } from "@/components/registration/private-tools";
export const metadata: Metadata = {
  title: "Payment instructions",
  robots: { index: false, follow: false },
};
export default async function PaymentPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  const row = await ownerRegistration(reference);
  if (!row) return <AccessRequired />;
  const contact = operationalContact();
  const ready = paymentConfigured();
  const token = (await readAccess(reference))!;
  const payment = row.payments[0];
  const message = paymentMessage({
    reference,
    team: row.teams.team_name,
    manager: row.teams.manager_name,
    fee: row.registration_fee,
  });
  const chat = whatsappLink(contact.whatsapp, message);
  const actionable =
    row.registration_status !== "rejected" && payment?.payment_status !== "confirmed";
  return (
    <div className="container page-space">
      <PageIntro
        eyebrow="PHASE 2 / PAYMENT"
        title={
          payment?.payment_status === "confirmed" ? "Payment received." : "Your next move: payment."
        }
        description={`Your registration for ${row.teams.team_name} has been saved. Reference: ${reference}.`}
      />
      <SaveAccess reference={reference} link={privateLink(reference, token)} />
      <div className="two-column">
        <section className="panel">
          <div className="state-heading">
            <h2>Bank transfer details</h2>
            <StatusBadge status={payment?.payment_status ?? "pending"} />
          </div>
          {payment?.payment_status === "confirmed" && (
            <Notice tone="success">
              Your payment has been verified. Check your registration status for screening and
              approval progress.
            </Notice>
          )}
          {row.registration_status === "rejected" && (
            <Notice>
              Your application has been closed. Please check your status page or contact the
              organizer before making any payment.
            </Notice>
          )}
          {!ready ? (
            <Notice>
              Payment details are being configured. Please contact the organizer before making a
              transfer.
            </Notice>
          ) : (
            <>
              <p className="small muted">
                {row.mode === "test"
                  ? "Testing registration fee"
                  : "Registration fee for your team"}
              </p>
              <div className="payment-amount">{money(row.registration_fee)}</div>
              <dl className="summary-list">
                <div>
                  <dt>Bank</dt>
                  <dd>{contact.bankName}</dd>
                </div>
                <div>
                  <dt>Account name</dt>
                  <dd>{contact.accountName}</dd>
                </div>
                <div>
                  <dt>Account number</dt>
                  <dd className="account-number">
                    <strong>{contact.accountNumber}</strong>
                    <CopyButton
                      value={contact.accountNumber}
                      label="Copy account"
                      errorMessage="Copy is unavailable. Select and copy the account number manually."
                    />
                  </dd>
                </div>
                <div>
                  <dt>Payment narration / reference</dt>
                  <dd>
                    {reference} — {row.teams.team_name}
                  </dd>
                </div>
              </dl>
              <p className="small muted" style={{ marginTop: 20 }}>
                Transfer the exact amount and verify the beneficiary name before paying. Where your
                bank allows it, include your registration reference in the transfer narration.
              </p>
            </>
          )}
          {actionable && (
            <>
              <hr style={{ border: 0, borderTop: "1px solid var(--border)", margin: "28px 0" }} />
              <h3>Send your receipt and team logo.</h3>
              <p className="muted small" style={{ marginBottom: 20 }}>
                After making your transfer, open the organizer’s WhatsApp chat. Attach your payment
                receipt or transaction screenshot and your team logo, then press Send. The button
                fills in your registration details; you attach the files yourself. Use this same
                reference if you need to resend anything.
              </p>
              {ready && chat ? (
                <>
                  <Button asChild size="lg">
                    <a href={chat} target="_blank" rel="noreferrer">
                      <MessageCircle size={18} /> Send receipt & logo on WhatsApp{" "}
                      <ArrowUpRight size={16} />
                    </a>
                  </Button>
                  <p className="hint" style={{ marginTop: 12 }}>
                    Choose the app or WhatsApp Web on the next page, then attach your receipt and
                    team logo and press Send.
                  </p>
                </>
              ) : (
                <Notice>The organizer’s WhatsApp contact is not available yet.</Notice>
              )}
            </>
          )}
        </section>
        <aside>
          <section className="panel">
            <h3>Your payment needs verification.</h3>
            <p className="small muted">
              Your payment is confirmed only when the organizer checks the bank account and clicks
              Payment received.
            </p>
            <p className="small muted">
              That provisionally books your place. Final approval follows physical screening of the
              team and players.
            </p>
            <Button asChild variant="outline" style={{ marginTop: 24 }}>
              <Link href={`/registration/${reference}`}>
                View registration status <ArrowUpRight size={16} />
              </Link>
            </Button>
          </section>
          <section className="panel">
            <h3>Full-refund policy</h3>
            <p className="small muted">
              If your paid team fails eligibility approval, the full registration fee you paid will
              be returned with no deductions. The organizer records refund progress on your private
              status page.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
