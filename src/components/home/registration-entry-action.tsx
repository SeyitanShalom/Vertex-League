"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { REGISTRATION_DEADLINE_PASSED } from "@/lib/registration/rules";
import {
  RegistrationCountdown,
  useRegistrationCountdown,
} from "@/components/registration/registration-countdown";

export function RegistrationEntryAction({
  deadline,
  deadlineLabel,
  registrationEnabled,
  unavailable,
}: {
  deadline: string | null;
  deadlineLabel: string | null;
  registrationEnabled: boolean;
  unavailable: string | null;
}) {
  const remaining = useRegistrationCountdown(deadline);
  const expired = remaining?.expired ?? unavailable === REGISTRATION_DEADLINE_PASSED;
  const disabled = !!unavailable || expired;
  return (
    <>
      {registrationEnabled && deadline && deadlineLabel && (
        <RegistrationCountdown
          deadline={deadline}
          deadlineLabel={deadlineLabel}
          remaining={remaining}
        />
      )}
      {disabled ? (
        <Button variant="outline" size="lg" disabled>
          {expired ? "Registration closed" : "Registration unavailable"}
        </Button>
      ) : (
        <Button asChild variant="outline" size="lg">
          <Link href="/register">
            Start your registration <ArrowUpRight size={20} />
          </Link>
        </Button>
      )}
    </>
  );
}

export function RegistrationHeroAction({
  deadline,
  unavailable,
}: {
  deadline: string | null;
  unavailable: string | null;
}) {
  const remaining = useRegistrationCountdown(deadline);
  const expired = remaining?.expired ?? unavailable === REGISTRATION_DEADLINE_PASSED;
  return unavailable || expired ? (
    <Button size="lg" disabled>
      {expired ? "Registration closed" : "Registration unavailable"}
    </Button>
  ) : (
    <Button asChild size="lg">
      <Link href="#rules">
        Register your team <ArrowUpRight size={20} />
      </Link>
    </Button>
  );
}
