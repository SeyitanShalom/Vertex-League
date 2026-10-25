import { money } from "@/lib/utils";
import { TEAM_CORRECTION_FEE } from "@/lib/registration/corrections";
export function whatsappLink(number: string, message: string) {
  const digits = number.replace(/[+\s()-]/g, "");
  if (!/^[1-9]\d{7,14}$/.test(digits)) return null;
  // Wait for the user's choice instead of automatically opening the desktop protocol.
  return `https://api.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(message)}&autoload=0`;
}
export function paymentMessage(input: {
  reference: string;
  team: string;
  manager: string;
  fee: number | string;
}) {
  return `Hello, I have made payment for my Vertex League registration.\n\nRegistration Reference: ${input.reference}\nTeam Name: ${input.team}\nTeam Manager: ${input.manager}\nRegistration Fee: ${money(input.fee)}\n\nI am sending my payment receipt and team logo in this chat.\n\nKindly verify the transfer and confirm receipt of payment. Thank you.`;
}
export function correctionMessage(input: { reference: string; team: string }) {
  return `Hello, I need to correct my Vertex League team details.\n\nRegistration Reference: ${input.reference}\nTeam Name: ${input.team}\n\nI understand that each correction request costs an additional ${money(TEAM_CORRECTION_FEE)} and editing is enabled only after payment verification and your approval. Please let me know how to arrange the correction and payment.`;
}
