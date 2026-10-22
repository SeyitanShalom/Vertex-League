import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowUpRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/motion/reveal";

// Centered layout and staggered floating motion adapted from Modern Hero Section
// by ravikatiyar162: https://21st.dev/@ravikatiyar162/components/modern-hero-section
const competitions = [
  { name: "Vertex Premier League", logo: "/VERTEX LOGO PNG.png" },
  { name: "Vertex Championship League", logo: "/CHAMPIONSHIP PNG.png" },
  { name: "Vertex FA Cup", logo: "/VERTEX FA CUP LOGO PNG.png" },
];

export function CompetitionHero() {
  return (
    <section className="hero" aria-labelledby="hero-title">
      <div className="container hero-inner">
        <div className="hero-copy">
          <Reveal className="eyebrow hero-eyebrow" distance={12}>
            <span className="status-dot" /> THE NEXT CHAPTER STARTS WITH YOUR TEAM
          </Reveal>
          <Reveal as="h1" id="hero-title" delay={0.06}>
            BRING YOUR TEAM.
            <br />
            <span>MAKE YOUR MARK.</span>
          </Reveal>
          <Reveal as="p" delay={0.12}>
            From the first whistle to the final word.
            <br />
            Step forward for Vertex League.
          </Reveal>
          <Reveal className="button-row" delay={0.18}>
            <Button asChild size="lg">
              <Link href="#rules">
                Register your team <ArrowUpRight size={20} />
              </Link>
            </Button>
            <Link className="text-link" href="#about">
              Explore the league <ArrowDown size={17} />
            </Link>
          </Reveal>
          <Reveal className="hero-footnote" delay={0.24} distance={12}>
            <ShieldCheck size={15} />
            <span>Payment books your place. Screening confirms your entry.</span>
          </Reveal>
        </div>
        <ul className="competition-logo-row" aria-label="Vertex competitions">
          {competitions.map((item, index) => (
            <Reveal
              as="li"
              key={item.name}
              className="competition-logo"
              delay={0.16 + index * 0.08}
            >
              <div className="competition-logo-float">
                <Image
                  src={item.logo}
                  alt={`${item.name} logo`}
                  width={3000}
                  height={3000}
                  sizes="(max-width: 560px) 29vw, (max-width: 1100px) 28vw, 320px"
                  loading="eager"
                />
              </div>
              <p className="competition-logo-name" aria-hidden="true">
                {item.name}
              </p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
