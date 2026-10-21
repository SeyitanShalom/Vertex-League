"use client";

import { domAnimation, LazyMotion, MotionConfig, type Transition } from "motion/react";
import type { ReactNode } from "react";

export const motionTransition: Transition = { duration: 0.5, ease: [0.22, 1, 0.36, 1] };

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user" transition={motionTransition}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
