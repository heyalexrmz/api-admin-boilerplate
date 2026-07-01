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

  const firstNameId = useId();
  const lastNameId = useId();
  const workspaceId = useId();
  const slugPreview = slugify(name);

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state?.message && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor={firstNameId}>Nombre</Label>
          <Input
            id={firstNameId}
            name="firstName"
            type="text"
            autoComplete="given-name"
            autoFocus
            required
            maxLength={60}
            placeholder="Ada"
            aria-invalid={!!state?.errors?.firstName}
            className="h-10"
          />
          {state?.errors?.firstName?.[0] && (
            <p className="text-sm text-destructive">{state.errors.firstName[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor={lastNameId}>Apellido</Label>
          <Input
            id={lastNameId}
            name="lastName"
            type="text"
            autoComplete="family-name"
            required
            maxLength={60}
            placeholder="Lovelace"
            aria-invalid={!!state?.errors?.lastName}
            className="h-10"
          />
          {state?.errors?.lastName?.[0] && (
            <p className="text-sm text-destructive">{state.errors.lastName[0]}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={workspaceId}>Nombre del espacio de trabajo</Label>
        <Input
          id={workspaceId}
          name="name"
          type="text"
          autoComplete="organization"
          required
          minLength={2}
          maxLength={60}
          placeholder="Taxo Timbre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={!!state?.errors?.name}
          className="h-10"
        />
        {slugPreview && (
          <p className="text-xs text-muted-foreground">
            URL del espacio:{" "}
            <span className="font-medium text-foreground">taxotimbre.com/{slugPreview}</span>
          </p>
        )}
        {state?.errors?.name?.[0] && (
          <p className="text-sm text-destructive">{state.errors.name[0]}</p>
        )}
      </div>

      <SubmitButton label="Crear espacio" pendingLabel="Creando…" />
    </form>
  );
}
