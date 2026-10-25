import { money } from "@/lib/utils";

export const TEAM_CORRECTION_FEE = 2000;
export const TEAM_CORRECTION_POLICY =
  `Changes or corrections to submitted team details cost an additional ${money(TEAM_CORRECTION_FEE)} per request. ` +
  "Contact the organizer on WhatsApp to arrange payment. Editing opens only after the organizer verifies payment and approves your request.";
