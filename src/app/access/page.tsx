import type { Metadata } from "next";
import { AccessForm } from "@/components/registration/access-form";
import { PageIntro } from "@/components/shared";
import { operationalContact } from "@/lib/config/server";
import { whatsappLink } from "@/lib/whatsapp";
export const metadata: Metadata = {
  title: "Open your registration",
  robots: { index: false, follow: false },
};
export default function AccessPage() {
  const contact = operationalContact();
  return (
    <div className="container narrow page-space">
      <PageIntro
        eyebrow="YOUR TEAM / PRIVATE ACCESS"
        title="Pick up where you left off."
        description="Return to your payment instructions, make permitted corrections, and check screening and approval progress."
      />
      <AccessForm
        contactLink={whatsappLink(
          contact.whatsapp,
          "Hello, I need help recovering my Vertex League registration link.",
        )}
      />
    </div>
  );
}
