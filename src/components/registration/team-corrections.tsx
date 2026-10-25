import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared";
import { TeamForm } from "@/components/registration/team-form";
import { canEdit } from "@/lib/registration/rules";
import { TEAM_CORRECTION_FEE, TEAM_CORRECTION_POLICY } from "@/lib/registration/corrections";
import { correctionMessage, whatsappLink } from "@/lib/whatsapp";
import { money } from "@/lib/utils";
import type { RegistrationStatus, Team } from "@/types/domain";

export function TeamCorrections({
  reference,
  team,
  status,
  correctionApprovedAt,
  whatsapp,
  verifiedEmail,
}: {
  reference: string;
  team: Team;
  status: RegistrationStatus;
  correctionApprovedAt: string | null;
  whatsapp: string;
  verifiedEmail?: string;
}) {
  const editable = canEdit(status, correctionApprovedAt);
  const chat = whatsappLink(whatsapp, correctionMessage({ reference, team: team.team_name }));

  return (
    <section className="panel">
      <h3>Editing and correcting team details</h3>
      {editable ? (
        <>
          <Notice tone="success">
            The organizer has verified your additional {money(TEAM_CORRECTION_FEE)} payment and
            approved one correction submission. Saving locks your details again. Further corrections
            require another payment and approval.
          </Notice>
          <TeamForm existing={{ reference, team }} verifiedEmail={verifiedEmail} />
        </>
      ) : (
        <p className="small muted">{TEAM_CORRECTION_POLICY}</p>
      )}
      {chat ? (
        <Button asChild variant="outline" style={{ marginTop: 20 }}>
          <a href={chat} target="_blank" rel="noreferrer">
            Contact the organizer <ArrowUpRight size={16} />
          </a>
        </Button>
      ) : (
        <p className="hint" style={{ marginTop: 20 }}>
          The organizer’s WhatsApp contact is being set up.
        </p>
      )}
    </section>
  );
}
