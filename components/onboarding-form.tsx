"use client";

import { useActionState, useId, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { createOrganization, type OnboardingState } from "@/app/actions/onboarding";
import { slugify } from "@/lib/slugify";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/submit-button";

export function OnboardingForm() {
  const [state, action] = useActionState<OnboardingState, FormData>(
    createOrganization,
    undefined
  );
  const [name, setName] = useState("");

  const nameId = useId();
  const slugPreview = slugify(name);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-2">
        <Label htmlFor={nameId}>Workspace name</Label>
        <Input
          id={nameId}
          name="name"
          type="text"
          autoComplete="organization"
          autoFocus
          required
          minLength={2}
          placeholder="Acme Inc."
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!state?.errors?.name}
          className="h-10"
        />
        {slugPreview && (
          <p className="text-xs text-muted-foreground">
            Workspace URL: <span className="font-medium text-foreground">acme.com/{slugPreview}</span>
          </p>
        )}
        {state?.errors?.name?.[0] && (
          <p className="text-sm text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      <SubmitButton label="Create workspace" pendingLabel="Creating…" />
    </form>
  );
}
