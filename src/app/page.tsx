import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  ClipboardList,
  MoveUpRight,
  ShieldCheck,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { competition } from "@/lib/config/competition";
import { deploymentMode, getSettings, operationalContact } from "@/lib/config/server";
import { registrationAvailability } from "@/lib/registration/rules";
import { money, dateLabel } from "@/lib/utils";
const steps = [
  {
    number: "01",
    title: "Put your team forward.",
    text: "Save your team and manager’s details to open the payment phase. Keep your reference and private access link.",
  },
  {
    number: "02",
    title: "Make your move.",
    text: "Copy the bank details on your payment page and transfer the fee. Send your receipt and team logo to the organizer on WhatsApp.",
  },
  {
    number: "03",
    title: "Get your place booked.",
    text: "The organizer confirms your payment and provisionally books your team’s place.",
  },
  {
    number: "04",
    title: "Show up. Get cleared.",
    text: "Attend physical screening with your players. Final approval completes your entry.",
  },
];
export default async function Home() {
  const settings = await getSettings();
  const mode = deploymentMode();
  const contact = operationalContact();
  const unavailable = registrationAvailability(settings);
  const fee = settings?.registration_fee ?? (mode === "test" ? 100 : 34000);
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <div className="eyebrow hero-eyebrow">
              <span className="status-dot" /> THE NEXT CHAPTER STARTS WITH YOUR TEAM
            </div>
            <h1>
              BRING
              <br />
              YOUR TEAM.
              <br />
              <span>
                MAKE
                <br className="mobile-break" /> YOUR MARK.
              </span>
            </h1>
            <p>
              From the first whistle to the final word.
              <br />
              Step forward for Vertex League.
            </p>
            <div className="button-row">
              <Button asChild size="lg">
                <Link href="/register">
                  Register your team <ArrowUpRight size={20} />
                </Link>
              </Button>
              <Link className="text-link" href="#about">
                Explore the league <ArrowDown size={17} />
              </Link>
            </div>
            <div className="hero-footnote">
              <ShieldCheck size={15} />
              <span>Payment books your place. Screening confirms your entry.</span>
            </div>
          </div>
          <div className="hero-visual" aria-hidden="true">
            <div className="visual-top">
              <span>VERTEX / THE BEAUTIFUL GAME</span>
              <MoveUpRight size={22} />
            </div>
            <div className="pitch-scene">
              <svg viewBox="0 0 500 660" className="pitch-svg">
                <defs>
                  <pattern
                    id="pitch-stripes"
                    width="500"
                    height="110"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect width="500" height="55" fill="var(--pitch-stripe-one)" />
                    <rect y="55" width="500" height="55" fill="var(--pitch-stripe-two)" />
                  </pattern>
                </defs>
                <rect x="15" y="15" width="470" height="630" fill="url(#pitch-stripes)" />
                <g fill="none" stroke="var(--pitch-line)" strokeWidth="1.5" opacity=".55">
                  <rect x="38" y="38" width="424" height="584" />
                  <path d="M38 330H462" />
                  <circle cx="250" cy="330" r="69" />
                  <circle cx="250" cy="330" r="3" fill="var(--pitch-line)" />
                  <path d="M124 38V143H376V38M193 38V75H307V38M124 622V517H376V622M193 622V585H307V622" />
                  <path d="M194 143Q250 201 306 143M194 517Q250 459 306 517" />
                  <circle cx="250" cy="108" r="2" />
                  <circle cx="250" cy="552" r="2" />
                </g>
                <g fill="var(--accent)" stroke="var(--brand-primary)" strokeWidth="3">
                  <circle cx="152" cy="396" r="9" />
                  <circle cx="250" cy="450" r="9" />
                  <circle cx="345" cy="374" r="9" />
                  <circle cx="278" cy="280" r="11" />
                </g>
                <path
                  d="M152 396L250 450L345 374L278 280L210 210"
                  stroke="var(--accent)"
                  strokeWidth="2"
                  strokeDasharray="7 7"
                  fill="none"
                  opacity=".8"
                />
                <path
                  d="M211 228L210 210L228 218"
                  fill="none"
                  stroke="var(--accent)"
                  strokeWidth="3"
                />
              </svg>
              <div className="pitch-tag">
                <span className="tiny-label">YOUR NEXT MOVE</span>
                <strong>
                  STARTS HERE. <ArrowUpRight size={24} />
                </strong>
              </div>
            </div>
            <div className="visual-bottom">
              <span>PASSION. PURPOSE. FOOTBALL.</span>
              <span>VL / 01</span>
            </div>
          </div>
        </div>
      </section>
      <div className="facts-strip">
        <div className="container facts-grid">
          <div>
            <span className="tiny-label">
              {mode === "test" ? "TEST REGISTRATION FEE" : "TEAM REGISTRATION"}
            </span>
            <strong>
              {money(fee)} <span>/ team</span>
            </strong>
          </div>
          <div>
            <span className="tiny-label">THE PROCESS</span>
            <strong>Register. Pay. Get screened.</strong>
          </div>
          <div>
            <span className="tiny-label">YOUR ENTRY</span>
            <strong>Earned on eligibility.</strong>
          </div>
          {settings?.registration_deadline && (
            <div>
              <span className="tiny-label">REGISTRATION CLOSES</span>
              <strong>{dateLabel(settings.registration_deadline)}</strong>
            </div>
          )}
        </div>
      </div>
      <section id="about" className="section section-light">
        <div className="container">
          <div className="section-heading">
            <p className="eyebrow">01 / THE COMPETITION</p>
            <h2>
              Football is better
              <br />
              when you’re <span className="display-word">part of it.</span>
            </h2>
          </div>
          <div className="about-grid">
            <p className="about-lead">
              You bring the players.
              <br />
              We bring the next chapter.
            </p>
            <div>
              <p>
                Vertex League starts with teams ready to step forward. Register your side, complete
                your payment, and get ready for physical screening.
              </p>
              <p>
                Every team follows the same path: verified payment, in-person eligibility checks,
                and final approval from the organizer.
              </p>
              {contact.venue && (
                <p>
                  <strong>Competition venue:</strong> {contact.venue}
                </p>
              )}
              {contact.dates && (
                <p>
                  <strong>Competition dates:</strong> {contact.dates}
                </p>
              )}
              <Link className="text-link dark-link" href="#how-it-works">
                See how registration works <ArrowUpRight size={18} />
              </Link>
            </div>
          </div>
          <div className="principles">
            <div>
              <Trophy />
              <h3>Your team. Your opportunity.</h3>
              <p>A dedicated registration journey for every team ready to take part.</p>
            </div>
            <div>
              <ClipboardList />
              <h3>A clear path to entry.</h3>
              <p>Know what comes next, from your first submission to final clearance.</p>
            </div>
            <div>
              <ShieldCheck />
              <h3>Fairness comes first.</h3>
              <p>Physical screening checks team and player eligibility before approval.</p>
            </div>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="section">
        <div className="container">
          <div className="section-heading heading-row">
            <div>
              <p className="eyebrow">02 / FROM SIGN-UP TO KICK-OFF</p>
              <h2>
                Four steps.
                <br />
                <span className="display-word">One way in.</span>
              </h2>
            </div>
            <p className="section-aside">
              A straightforward process.
              <br />A reference you can follow all the way.
            </p>
          </div>
          <div className="steps-grid">
            {steps.map((step) => (
              <article key={step.number} className="step">
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section id="registration" className="section section-accent">
        <div className="container registration-callout">
          <div>
            <p className="eyebrow">03 / PUT YOUR NAME IN</p>
            <h2>
              Your team’s
              <br />
              <span className="display-word">next chapter.</span>
            </h2>
            <p>
              Have your team and manager’s details ready.
              <br />
              Player details are collected at physical screening.
            </p>
            <Button asChild variant="outline" size="lg">
              <Link href="/register">
                Start your registration <ArrowUpRight size={20} />
              </Link>
            </Button>
            <Link href="/access" className="returning-link">
              Already registered? Open your private link ↗
            </Link>
          </div>
          <div className="entry-card">
            <div className="entry-card-top">
              <span>TEAM ENTRY</span>
              <Badge>{mode === "test" ? "TEST MODE" : "VERTEX LEAGUE"}</Badge>
            </div>
            <div className="entry-price">
              {money(fee)}
              <span>per team</span>
            </div>
            <p>
              {mode === "test"
                ? "Testing fee. Live registration will be ₦34,000 per team."
                : "One registration fee for your team."}
            </p>
            <ul>
              <li>
                <Check size={17} /> A unique registration reference
              </li>
              <li>
                <Check size={17} /> Your private registration status page
              </li>
              <li>
                <Check size={17} /> Provisional booking after verified payment
              </li>
              <li>
                <Check size={17} /> Full refund if eligibility approval fails
              </li>
            </ul>
            {settings?.registration_deadline && (
              <p className="entry-deadline">
                Deadline: {dateLabel(settings.registration_deadline)}
              </p>
            )}
            {unavailable && <p className="small">{unavailable}</p>}
          </div>
        </div>
      </section>
      <section id="rules" className="section section-light">
        <div className="container rules-grid">
          <div>
            <p className="eyebrow">04 / BEFORE YOU REGISTER</p>
            <h2>
              A level
              <br />
              <span className="display-word">playing field.</span>
            </h2>
            <p className="muted">
              Read the requirements and refund policy before putting your team forward.
            </p>
          </div>
          <div className="rules-list">
            {competition.rules.concat(competition.eligibility).map((rule, i) => (
              <div key={rule}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <p>{rule}</p>
              </div>
            ))}
            {contact.screeningVenue && (
              <div>
                <span>↗</span>
                <p>Screening venue: {contact.screeningVenue}</p>
              </div>
            )}
            {contact.screeningDate && (
              <div>
                <span>↗</span>
                <p>Screening date: {contact.screeningDate}</p>
              </div>
            )}
          </div>
        </div>
      </section>
      <section id="faq" className="section">
        <div className="container faq-grid">
          <div>
            <p className="eyebrow">05 / GOOD TO KNOW</p>
            <h2>
              The questions.
              <br />
              <span className="display-word">The answers.</span>
            </h2>
            <p className="muted">Everything you need for your first step.</p>
          </div>
          <div className="faq-list">
            {competition.faq.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </div>
      </section>
      <section className="closing-strip">
        <div className="container">
          <h2>THE NEXT MOVE IS YOURS.</h2>
          <Link href="/register" aria-label="Register your team">
            <ArrowUpRight size={40} />
          </Link>
        </div>
      </section>
    </>
  );
}
