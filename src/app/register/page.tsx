import type { Metadata } from "next";
import { TeamForm } from "@/components/registration/team-form";
import { PageIntro } from "@/components/shared";
import { getSettings, paymentConfigured, deploymentMode } from "@/lib/config/server";
import { registrationAvailability } from "@/lib/registration/rules";
import { money, dateLabel } from "@/lib/utils";
export const metadata: Metadata = { title: "Register your team" };
export default async function RegisterPage() {
  const settings = await getSettings();
  const disabledReason =
    registrationAvailability(settings) ||
    (!paymentConfigured()
      ? "The organizer is setting up payment and contact details. Registration will open once these are ready."
      : null);
  const fee = settings?.registration_fee ?? (deploymentMode() === "test" ? 100 : 34000);
  return (
    <div className="container page-space">
      <PageIntro
        eyebrow="PHASE 1 / TEAM REGISTRATION"
        title="It starts with your team."
        description="Tell us about your side, then click Save & continue to payment. We’ll save your registration and open your payment page with the bank details."
      />
      <div className="two-column">
        <section className="panel">
          <TeamForm disabledReason={disabledReason} />
        </section>
        <aside>
          <section className="panel">
            <p className="eyebrow">YOUR TEAM ENTRY</p>
            <h2>
              One team.
              <br />
              One next chapter.
            </h2>
            <dl className="summary-list">
              <div>
                <dt>{deploymentMode() === "test" ? "Testing fee" : "Registration fee"}</dt>
                <dd className="big">{money(fee)}</dd>
              </div>
              <div>
                <dt>Payment method</dt>
                <dd>Bank transfer</dd>
              </div>
              {settings?.registration_deadline && (
                <div>
                  <dt>Registration deadline</dt>
                  <dd>{dateLabel(settings.registration_deadline)}</dd>
                </div>
              )}
              <div>
                <dt>Final clearance</dt>
                <dd>Physical team & player screening</dd>
              </div>
            </dl>
          </section>
          <section className="panel">
            <h3>What happens next?</h3>
            <ol className="numbered-list">
              <li>Save your team details to open the payment phase.</li>
              <li>Keep your reference and private access link.</li>
              <li>Copy the bank details and transfer the registration fee.</li>
              <li>Send your receipt and team logo in the organizer’s WhatsApp chat.</li>
              <li>Wait for payment confirmation, then attend physical screening.</li>
            </ol>
            <p className="small muted">
              Paid teams that fail eligibility approval receive a full refund.
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
