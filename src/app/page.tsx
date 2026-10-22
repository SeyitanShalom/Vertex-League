import Link from "next/link";
import { ArrowDown, ArrowUpRight, Check, ClipboardList, ShieldCheck, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CompetitionHero } from "@/components/home/competition-hero";
import { Reveal } from "@/components/motion/reveal";
import { competition } from "@/lib/config/competition";
import { deploymentMode, getSettings, operationalContact } from "@/lib/config/server";
import { registrationAvailability } from "@/lib/registration/rules";
import { money, dateLabel } from "@/lib/utils";
const steps = [
  {
    number: "01",
    title: "Put your team forward.",
    text: "Create an account with your email, then save your team and manager details to open the payment phase. Return to your team page at any time.",
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
      <CompetitionHero />
      <div className="facts-strip">
        <Reveal className="container facts-grid" distance={16}>
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
        </Reveal>
      </div>
      <section id="about" className="section section-light">
        <div className="container">
          <Reveal className="section-heading">
            <p className="eyebrow">01 / THE COMPETITION</p>
            <h2>
              Football is better
              <br />
              when you’re <span className="display-word">part of it.</span>
            </h2>
          </Reveal>
          <div className="about-grid">
            <Reveal as="p" className="about-lead">
              You bring the players.
              <br />
              We bring the next chapter.
            </Reveal>
            <Reveal delay={0.08}>
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
            </Reveal>
          </div>
          <div className="principles">
            <Reveal>
              <Trophy />
              <h3>Your team. Your opportunity.</h3>
              <p>A dedicated registration journey for every team ready to take part.</p>
            </Reveal>
            <Reveal delay={0.08}>
              <ClipboardList />
              <h3>A clear path to entry.</h3>
              <p>Know what comes next, from your first submission to final clearance.</p>
            </Reveal>
            <Reveal delay={0.16}>
              <ShieldCheck />
              <h3>Fairness comes first.</h3>
              <p>Physical screening checks team and player eligibility before approval.</p>
            </Reveal>
          </div>
        </div>
      </section>
      <section id="how-it-works" className="section">
        <div className="container">
          <Reveal className="section-heading heading-row">
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
          </Reveal>
          <div className="steps-grid">
            {steps.map((step, index) => (
              <Reveal as="article" key={step.number} className="step" delay={index * 0.08}>
                <span className="step-number">{step.number}</span>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <section id="rules" className="section section-light">
        <div className="container rules-grid">
          <Reveal>
            <p className="eyebrow">03 / BEFORE YOU REGISTER</p>
            <h2>
              A level
              <br />
              <span className="display-word">playing field.</span>
            </h2>
            <p className="muted">
              Read the requirements and refund policy before putting your team forward.
            </p>
          </Reveal>
          <Reveal className="rules-list" delay={0.08}>
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
            <Button asChild size="lg" className="rules-next">
              <Link href="#registration">
                Continue to team entry <ArrowDown size={20} />
              </Link>
            </Button>
          </Reveal>
        </div>
      </section>
      <section id="registration" className="section section-accent">
        <div className="container registration-callout">
          <Reveal>
            <p className="eyebrow">04 / PUT YOUR NAME IN</p>
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
            <Link href="/manager/sign-in" className="returning-link">
              Already registered? Sign in to your team ↗
            </Link>
          </Reveal>
          <Reveal className="entry-card" delay={0.1}>
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
          </Reveal>
        </div>
      </section>
      <section id="faq" className="section">
        <div className="container faq-grid">
          <Reveal>
            <p className="eyebrow">05 / GOOD TO KNOW</p>
            <h2>
              The questions.
              <br />
              <span className="display-word">The answers.</span>
            </h2>
            <p className="muted">Everything you need for your first step.</p>
          </Reveal>
          <Reveal className="faq-list" delay={0.08}>
            {competition.faq.map((item) => (
              <details key={item.question}>
                <summary>
                  {item.question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </Reveal>
        </div>
      </section>
      <section className="closing-strip">
        <Reveal className="container" distance={16}>
          <h2>THE NEXT MOVE IS YOURS.</h2>
          <Link href="#rules" aria-label="Register your team">
            <ArrowUpRight size={40} />
          </Link>
        </Reveal>
      </section>
    </>
  );
}
