const PROVIDER_FIELD_NAMES = [
  "tax_id",
  "taxpayer_name",
  "firstname",
  "lastname",
  "second_lastname",
] as const;

export function tocinoSubmitBody(input: {
  storedFields: Record<string, unknown>;
  imageBase64: string;
  fileName: string;
  csfBase64?: string;
}): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  for (const name of PROVIDER_FIELD_NAMES) {
    const value = input.storedFields[name];
    if (typeof value === "string" && value.trim()) fields[name] = value.trim();
  }

  return {
    ...fields,
    country: "México",
    file: input.imageBase64,
    file_name: input.fileName,
    ...(input.csfBase64 ? { csf_pdf: input.csfBase64 } : {}),
  };
}
