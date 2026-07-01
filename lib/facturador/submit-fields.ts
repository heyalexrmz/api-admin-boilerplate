import { ApiError } from "../api-contracts";

function trimmedField(fields: Record<string, string>, name: string): string | null {
  const value = fields[name]?.trim();
  return value ? value : null;
}

export function normalizeTicketSubmitFields(
  fields: Record<string, string>
): Record<string, string> {
  const normalized = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, value.trim()])
  );
  const taxpayerName = trimmedField(normalized, "taxpayer_name");
  const firstname = trimmedField(normalized, "firstname");
  const lastname = trimmedField(normalized, "lastname");

  if (taxpayerName) return normalized;

  if (!firstname) {
    throw new ApiError({
      status: 400,
      code: "missing_field",
      type: "validation_error",
      message: "firstname is required for persona fisica when taxpayer_name is not provided.",
      param: "firstname",
    });
  }

  if (!lastname) {
    throw new ApiError({
      status: 400,
      code: "missing_field",
      type: "validation_error",
      message: "lastname is required for persona fisica when taxpayer_name is not provided.",
      param: "lastname",
    });
  }

  return normalized;
}
