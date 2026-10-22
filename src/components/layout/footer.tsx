import Link from "next/link";
import { Brand } from "@/components/layout/header";
import { ArrowUpRight } from "lucide-react";
import { operationalContact } from "@/lib/config/server";
import { whatsappLink } from "@/lib/whatsapp";
export function Footer() {
  const contact = operationalContact();
  const chat = whatsappLink(contact.whatsapp, "Hello, I have a question about Vertex League.");
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>
              Bring your team.
              <br />
              Make your mark.
            </p>
          </div>
          <div className="footer-links">
            <Link href="/register">
              Team registration <ArrowUpRight size={14} />
            </Link>
            <Link href="/manager/sign-in">
              Your registration <ArrowUpRight size={14} />
            </Link>
            <Link href="/#rules">
              Rules & refund policy <ArrowUpRight size={14} />
            </Link>
            {chat && (
              <a href={chat} target="_blank" rel="noreferrer">
                Contact the organizer <ArrowUpRight size={14} />
              </a>
            )}
            {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Vertex League. All rights reserved.</span>
          <Link href="/admin/login">Organizer sign-in</Link>
        </div>
      </div>
    </footer>
  );
}
