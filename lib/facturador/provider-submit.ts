const PROVIDER_FIELD_NAMES = [
  "tax_id",
  "taxpayer",
  "taxpayer_name",
  "taxpayer_last_name",
  "taxpayer_second_last_name",
  "street_address_1",
  "ext_num",
  "int_num",
  "street_address_2",
  "city",
  "state",
  "country",
  "postal_code",
  "invoice_fiscal_regimen",
  "invoice_cfdi_use",
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

  if (!fields.taxpayer) {
    const fullName = [
      fields.taxpayer_name,
      fields.taxpayer_last_name,
      fields.taxpayer_second_last_name,
    ]
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .join(" ");
    if (fullName) fields.taxpayer = fullName;
  }

  return {
    ...fields,
    country: typeof fields.country === "string" ? fields.country : "México",
    file: input.imageBase64,
    file_name: input.fileName,
    ...(input.csfBase64 ? { csf_pdf: input.csfBase64 } : {}),
  };
}
