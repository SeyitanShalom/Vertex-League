"use client";

import { m, useReducedMotion } from "motion/react";
import type { HTMLAttributes, ReactNode } from "react";
import { motionTransition } from "@/components/motion/motion-provider";

const elements = { div: m.div, article: m.article, li: m.li, h1: m.h1, p: m.p };

type RevealProps = Pick<HTMLAttributes<HTMLElement>, "className" | "id" | "aria-hidden"> & {
  children: ReactNode;
  as?: keyof typeof elements;
  delay?: number;
  distance?: number;
};

export function Reveal({
  children,
  as = "div",
  className,
  delay = 0,
  distance = 24,
  ...props
}: RevealProps) {
  const reducedMotion = useReducedMotion();
  const Element = elements[as];

  return (
    <Element
      {...props}
      className={`motion-reveal${className ? ` ${className}` : ""}`}
      // Render content in its visible state; animate only when it enters the viewport.
      initial={false}
      whileInView={reducedMotion ? undefined : { opacity: [0, 1], y: [distance, 0] }}
      viewport={{ once: true, amount: "some", margin: "0px 0px 40px 0px" }}
      transition={{ ...motionTransition, delay }}
    >
      {children}
    </Element>
  );
}
