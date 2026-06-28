"use server";

import { and, desc, eq, isNull } from "drizzle-orm";

import { apiKey } from "@/lib/db/schema";
import { db } from "@/lib/db";
import { requireActiveOrganization } from "@/app/lib/auth";
import {
  computeExpiry,
  generateApiKeySecret,
  hashSecret,
  maskSecret,
} from "@/lib/api-keys";
import {
  CreateApiKeyFormSchema,
  RenameApiKeyFormSchema,
  type ApiKey,
  type ApiKeyScope,
  type ApiKeyStatus,
  type CreateApiKeyState,
  type NewApiKey,
  type RenameApiKeyState,
  type RotatedApiKey,
} from "@/app/lib/definitions";

type ApiKeyRow = typeof apiKey.$inferSelect;

function toApiKey(row: ApiKeyRow): ApiKey {
  const now = new Date();
  let status: ApiKeyStatus = "active";
  if (row.revokedAt && row.revokedAt <= now) {
    status = "revoked";
  } else if (row.expiresAt && row.expiresAt <= now) {
    status = "expired";
  }

  return {
    id: row.id,
    name: row.name,
    preview: row.preview,
    scopes: row.scopes as ApiKeyScope[],
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    lastRotatedAt: row.lastRotatedAt ? row.lastRotatedAt.toISOString() : null,
    status,
  };
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const { organization } = await requireActiveOrganization();
  const rows = await db
    .select()
    .from(apiKey)
    .where(eq(apiKey.organizationId, organization.id))
    .orderBy(desc(apiKey.createdAt));
  return rows.map(toApiKey);
}

export async function createApiKey(
  prevState: CreateApiKeyState,
  formData: FormData
): Promise<CreateApiKeyState> {
  const { user, organization } = await requireActiveOrganization();

  const validated = CreateApiKeyFormSchema.safeParse({
    name: formData.get("name"),
    scopes: formData.getAll("scopes"),
    expiry: formData.get("expiry"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const { name, scopes, expiry } = validated.data;
  const secret = generateApiKeySecret();
  const expiresAt = computeExpiry(expiry);

  const [row] = await db
    .insert(apiKey)
    .values({
      organizationId: organization.id,
      createdByUserId: user.id,
      name,
      hash: hashSecret(secret),
      preview: maskSecret(secret),
      scopes,
      expiresAt,
    })
    .returning();

  if (!row) {
    return { message: "Could not create the API key. Try again." };
  }

  const newKey: NewApiKey = {
    id: row.id,
    name,
    secret,
    scopes: scopes as ApiKeyScope[],
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: null,
    lastRotatedAt: null,
  };

  return { key: newKey };
}

export async function revokeApiKey(
  id: string
): Promise<{ success: true } | { error: string }> {
  const { organization } = await requireActiveOrganization();

  if (!id) return { error: "Missing key id." };

  const [row] = await db
    .update(apiKey)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(apiKey.id, id),
        eq(apiKey.organizationId, organization.id),
        isNull(apiKey.revokedAt)
      )
    )
    .returning({ id: apiKey.id });

  if (!row) return { error: "Key not found or already revoked." };

  return { success: true };
}

export async function renameApiKey(
  prevState: RenameApiKeyState,
  formData: FormData
): Promise<RenameApiKeyState> {
  const { organization } = await requireActiveOrganization();

  const id = String(formData.get("id") ?? "");
  if (!id) return { message: "Missing key id." };

  const validated = RenameApiKeyFormSchema.safeParse({
    name: formData.get("name"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const [row] = await db
    .update(apiKey)
    .set({ name: validated.data.name })
    .where(and(eq(apiKey.id, id), eq(apiKey.organizationId, organization.id)))
    .returning({ name: apiKey.name });

  if (!row) return { message: "Key not found." };

  return { name: row.name };
}

export async function rotateApiKey(
  id: string
): Promise<{ key: RotatedApiKey } | { error: string }> {
  const { organization } = await requireActiveOrganization();

  if (!id) return { error: "Missing key id." };

  const secret = generateApiKeySecret();
  const now = new Date();

  const [row] = await db
    .update(apiKey)
    .set({
      hash: hashSecret(secret),
      preview: maskSecret(secret),
      lastRotatedAt: now,
    })
    .where(
      and(
        eq(apiKey.id, id),
        eq(apiKey.organizationId, organization.id),
        isNull(apiKey.revokedAt)
      )
    )
    .returning({ id: apiKey.id });

  if (!row) return { error: "Key not found or revoked." };

  return {
    key: {
      id: row.id,
      secret,
      preview: maskSecret(secret),
      lastRotatedAt: now.toISOString(),
    },
  };
}
