"use client";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight, LockKeyhole } from "lucide-react";
import type { z } from "zod";
import {
  registrationSchema,
  teamFieldsSchema,
  type RegistrationInput,
} from "@/lib/validations/registration";
import { registerTeam, correctTeam, saveManagerDraft } from "@/app/actions/registration";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Notice } from "@/components/shared";
import type { Team } from "@/types/domain";
import type { RegistrationDraft } from "@/lib/validations/registration";
import { createDraftAutosave, type DraftSaveStatus } from "@/lib/registration/draft-autosave";
import { REGISTRATION_DEADLINE_PASSED } from "@/lib/registration/rules";
import {
  RegistrationCountdown,
  useRegistrationCountdown,
} from "@/components/registration/registration-countdown";

type Fields = keyof z.input<typeof teamFieldsSchema>;
const draftFields = new Set<string>([
  "team_name",
  "location",
  "manager_name",
  "phone",
  "whatsapp_number",
  "additional_information",
]);
const fields: {
  name: Fields;
  label: string;
  placeholder: string;
  autoComplete?: string;
  type?: string;
}[] = [
  {
    name: "team_name",
    label: "Team name",
    placeholder: "Your team’s name",
    autoComplete: "organization",
  },
  {
    name: "location",
    label: "Team location",
    placeholder: "Town or local government area",
    autoComplete: "address-level2",
  },
  {
    name: "manager_name",
    label: "Manager’s full name",
    placeholder: "First name and surname",
    autoComplete: "name",
  },
  {
    name: "phone",
    label: "Phone number",
    placeholder: "0803 123 4567",
    autoComplete: "tel",
    type: "tel",
  },
  { name: "whatsapp_number", label: "WhatsApp number", placeholder: "0803 123 4567", type: "tel" },
  {
    name: "email",
    label: "Account email",
    placeholder: "you@example.com",
    autoComplete: "email",
    type: "email",
  },
];
export function TeamForm({
  disabledReason,
  existing,
  verifiedEmail,
  draft,
  deadline = null,
  deadlineLabel = null,
}: {
  disabledReason?: string | null;
  existing?: { reference: string; team: Team };
  verifiedEmail?: string;
  draft?: RegistrationDraft;
  deadline?: string | null;
  deadlineLabel?: string | null;
}) {
  const router = useRouter();
  const submissionKey = useRef<string | null>(null);
  const submitting = useRef(false);
  const [feedback, setFeedback] = useState<{ error?: string; success?: string }>({});
  const remaining = useRegistrationCountdown(existing ? null : deadline);
  const currentDisabledReason = remaining?.expired ? REGISTRATION_DEADLINE_PASSED : disabledReason;
  const [draftStatus, setDraftStatus] = useState<DraftSaveStatus>(draft ? "saved" : "idle");
  const [autosave] = useState(() =>
    createDraftAutosave<RegistrationDraft>(async (value) => {
      const result = await saveManagerDraft(value);
      return !!result.success;
    }, setDraftStatus),
  );
  const schema = existing
    ? teamFieldsSchema.extend({
        accepted_rules: registrationSchema.shape.accepted_rules,
        website: registrationSchema.shape.website,
      })
    : registrationSchema;
  const form = useForm<RegistrationInput, unknown, z.output<typeof registrationSchema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      team_name: existing?.team.team_name ?? draft?.team_name ?? "",
      location: existing?.team.location ?? draft?.location ?? "",
      manager_name: existing?.team.manager_name ?? draft?.manager_name ?? "",
      phone: existing?.team.phone ?? draft?.phone ?? "",
      whatsapp_number: existing?.team.whatsapp_number ?? draft?.whatsapp_number ?? "",
      email: verifiedEmail ?? existing?.team.email ?? draft?.email ?? "",
      additional_information:
        existing?.team.additional_information ?? draft?.additional_information ?? "",
      accepted_rules: existing ? true : undefined,
      website: "",
    },
  });
  function draftValues(): RegistrationDraft {
    const values = form.getValues();
    return {
      team_name: values.team_name ?? "",
      location: values.location ?? "",
      manager_name: values.manager_name ?? "",
      phone: values.phone ?? "",
      whatsapp_number: values.whatsapp_number ?? "",
      email: verifiedEmail ?? "",
      additional_information: values.additional_information ?? "",
    };
  }
  function canSaveDraft() {
    return !!verifiedEmail && !existing;
  }
  async function submit(values: z.output<typeof registrationSchema>) {
    if (
      submitting.current ||
      currentDisabledReason ||
      (!existing && deadline && Date.now() >= Date.parse(deadline))
    )
      return;
    submitting.current = true;
    setFeedback({});
    try {
      if (existing) {
        setFeedback(await correctTeam(existing.reference, values));
        router.refresh();
        return;
      }
      await autosave.flush(draftValues());
      submissionKey.current ??= crypto.randomUUID();
      const result = await registerTeam(values, submissionKey.current);
      if (result.error) {
        setFeedback({ error: result.error });
        return;
      }
      if (result.reference) {
        autosave.stop();
        router.push(`/payment/${result.reference}`);
      }
    } catch {
      setFeedback({
        error:
          "Your submission could not be completed. Please try again; your entered details are still here.",
      });
    } finally {
      submitting.current = false;
    }
  }
  return (
    <form
      onSubmit={(event) =>
        void form.handleSubmit(submit, () => {
          if (canSaveDraft() && form.formState.isDirty) void autosave.flush(draftValues());
        })(event)
      }
      onChange={(event) => {
        if (canSaveDraft() && draftFields.has(event.target.getAttribute("name") ?? ""))
          autosave.schedule(draftValues());
      }}
      onBlurCapture={(event) => {
        if (canSaveDraft() && draftFields.has(event.target.getAttribute("name") ?? ""))
          void autosave.flush(draftValues());
      }}
      noValidate
      className="registration-form"
    >
      {currentDisabledReason && <Notice>{currentDisabledReason}</Notice>}
      {!existing && deadline && deadlineLabel && (
        <RegistrationCountdown
          deadline={deadline}
          deadlineLabel={deadlineLabel}
          remaining={remaining}
          compact
        />
      )}
      {feedback.error && <Notice tone="error">{feedback.error}</Notice>}
      {feedback.success && <Notice tone="success">{feedback.success}</Notice>}
      <div className="form-grid">
        <div className="form-divider" style={{ border: 0, padding: 0, margin: 0 }}>
          <h3>{existing ? "Correct your team details" : "First, your team."}</h3>
          <p className="hint">Required fields are marked with an asterisk.</p>
        </div>
        {fields.map((field, index) => (
          <div key={field.name} className={`field ${field.name === "manager_name" ? "full" : ""}`}>
            {index === 2 && (
              <div className="form-divider">
                <h3>Your team’s point of contact.</h3>
                <p className="hint">One manager can register one team.</p>
              </div>
            )}
            <label htmlFor={field.name}>
              {field.label}
              {(field.name !== "email" || !!verifiedEmail) && " *"}
            </label>
            <Input
              id={field.name}
              type={field.type ?? "text"}
              placeholder={field.placeholder}
              autoComplete={field.autoComplete}
              maxLength={field.name === "email" ? 254 : field.type === "tel" ? 24 : 120}
              readOnly={field.name === "email" && !!verifiedEmail}
              aria-invalid={!!form.formState.errors[field.name]}
              aria-describedby={
                form.formState.errors[field.name] ? `${field.name}-error` : undefined
              }
              {...form.register(field.name)}
            />
            {form.formState.errors[field.name] && (
              <span id={`${field.name}-error`} className="field-error">
                {form.formState.errors[field.name]?.message}
              </span>
            )}
            {field.name === "whatsapp_number" && (
              <button
                className="text-link"
                type="button"
                onClick={() => {
                  form.setValue("whatsapp_number", form.getValues("phone"), {
                    shouldValidate: true,
                  });
                  if (canSaveDraft()) void autosave.flush(draftValues());
                }}
              >
                Use my phone number
              </button>
            )}
          </div>
        ))}
        <div className="field full">
          <label htmlFor="additional_information">Anything else we should know? (optional)</label>
          <Textarea
            id="additional_information"
            placeholder="A short note for the organizer"
            maxLength={1000}
            {...form.register("additional_information")}
          />
          <span className="field-error">
            {form.formState.errors.additional_information?.message}
          </span>
        </div>
        {!existing && (
          <div className="field full">
            <p className="hint">
              Send your team logo directly to the organizer on WhatsApp. The chat link is on the
              payment page after you save these details.
            </p>
          </div>
        )}
        {!existing && (
          <div className="field full">
            <label className="checkbox-row">
              <input type="checkbox" {...form.register("accepted_rules")} />
              <span>
                I agree to the{" "}
                <Link href="/#rules" target="_blank">
                  registration rules and full-refund policy
                </Link>
                . I understand payment books a provisional place, and final approval follows
                physical screening.
              </span>
            </label>
            <span className="field-error">{form.formState.errors.accepted_rules?.message}</span>
          </div>
        )}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="website">Website</label>
          <input id="website" tabIndex={-1} autoComplete="off" {...form.register("website")} />
        </div>
      </div>
      <div className="form-actions">
        <Button
          type="submit"
          size="lg"
          disabled={!!currentDisabledReason || form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? "Saving your details…"
            : existing
              ? "Save corrections"
              : "Save & continue to payment"}
          <ArrowUpRight size={18} />
        </Button>
        {!existing && verifiedEmail && draftStatus !== "idle" && (
          <p className="draft-status" role="status" aria-live="polite">
            {draftStatus === "saving"
              ? "Saving progress..."
              : draftStatus === "saved"
                ? "Progress saved"
                : "Progress could not be saved."}
            {draftStatus === "error" && (
              <button
                type="button"
                className="text-link"
                onClick={() => void autosave.flush(draftValues())}
              >
                Retry
              </button>
            )}
          </p>
        )}
        <p className="hint">
          <LockKeyhole
            size={12}
            style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}
          />{" "}
          Your contact details are private and available to authorized organizers.
        </p>
      </div>
    </form>
  );
}
