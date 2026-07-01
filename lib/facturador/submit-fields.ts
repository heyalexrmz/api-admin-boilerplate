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
  const taxpayer = trimmedField(normalized, "taxpayer");
  const taxpayerName = trimmedField(normalized, "taxpayer_name");
  const taxpayerLastName = trimmedField(normalized, "taxpayer_last_name");
  const taxpayerSecondLastName = trimmedField(normalized, "taxpayer_second_last_name");

  if (taxpayer) return normalized;

  if (!taxpayerName) {
    throw new ApiError({
      status: 400,
      code: "missing_field",
      type: "validation_error",
      message: "taxpayer is required for persona moral, or taxpayer_name is required for persona fisica.",
      param: "taxpayer",
    });
  }

  if (!taxpayerLastName) {
    throw new ApiError({
      status: 400,
      code: "missing_field",
      type: "validation_error",
      message: "taxpayer_last_name is required for persona fisica.",
      param: "taxpayer_last_name",
    });
  }

  if (!taxpayerSecondLastName) {
    throw new ApiError({
      status: 400,
      code: "missing_field",
      type: "validation_error",
      message: "taxpayer_second_last_name is required for persona fisica.",
      param: "taxpayer_second_last_name",
    });
  }

  return normalized;
}
