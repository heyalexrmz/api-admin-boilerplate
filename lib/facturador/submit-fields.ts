import { ApiError } from "../api-contracts";

const GENERIC_RFCS = new Set(["XAXX010101000", "XEXX010101000"]);
const NAME_PARTICLES = new Set([
  "DA", "DAS", "DE", "DEL", "DEN", "DER", "DI", "DO", "DOS", "DU",
  "LA", "LAS", "LE", "LOS", "MAC", "MC", "SAN", "SANTA", "SANTO", "VAN", "VON", "Y",
]);

function isPersonaFisicaRfc(rfc: string): boolean {
  return /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/.test(rfc) && !GENERIC_RFCS.has(rfc);
}

function nameKey(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

function splitTaxpayerName(taxpayer: string, rfc: string): Record<string, string> {
  const parts = taxpayer.split(/\s+/);
  const givenNames = parts.slice(0, -2);
  const lastName = parts.at(-2) ?? "";
  const secondLastName = parts.at(-1) ?? "";
  // RFC initials only corroborate this conservative split; this is not SAT
  // identity validation. Explicit fields are needed for other name structures.
  const givenInitials = [nameKey(givenNames[0] ?? "")[0]];
  if (["MARIA", "JOSE"].includes(nameKey(givenNames[0] ?? ""))) {
    givenInitials.push(nameKey(givenNames[1] ?? "")[0]);
  }
  if (
    parts.length < 3 ||
    parts.some((part) => !/^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u.test(part) || NAME_PARTICLES.has(nameKey(part))) ||
    nameKey(lastName)[0] !== rfc[0] ||
    nameKey(secondLastName)[0] !== rfc[2] ||
    !givenInitials.includes(rfc[3])
  ) {
    throw new ApiError({
      status: 400,
      code: "ambiguous_taxpayer_name",
      type: "validation_error",
      message: "No podemos separar el nombre completo con suficiente certeza. Envía taxpayer_name, taxpayer_last_name y taxpayer_second_last_name por separado.",
      param: "taxpayer",
    });
  }
  return {
    taxpayer_name: givenNames.join(" "),
    taxpayer_last_name: lastName,
    taxpayer_second_last_name: secondLastName,
  };
}

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

  const rfc = (normalized.tax_id ?? "").toUpperCase();
  if (taxpayer && !isPersonaFisicaRfc(rfc)) return normalized;
  if (taxpayer && !taxpayerName && !taxpayerLastName && !taxpayerSecondLastName) {
    return { ...normalized, ...splitTaxpayerName(taxpayer, rfc) };
  }

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
