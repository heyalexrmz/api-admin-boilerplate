import { ApiError } from "../api-contracts";

const GENERIC_RFCS = new Set(["XAXX010101000", "XEXX010101000"]);
// The RFC skips these words, so its initials can still confirm the split.
const RFC_SKIPPED_CONNECTORS = new Set(["DE", "DEL", "LA", "LAS", "LOS"]);
const UNSUPPORTED_PARTICLES = new Set([
  "DA", "DAS", "DEN", "DER", "DI", "DO", "DOS", "DU",
  "LE", "MAC", "MC", "SAN", "SANTA", "SANTO", "VAN", "VON", "Y",
]);

function isPersonaFisicaRfc(rfc: string): boolean {
  return /^[A-ZÑ&]{4}\d{6}[A-Z0-9]{3}$/.test(rfc) && !GENERIC_RFCS.has(rfc);
}

function nameKey(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
}

function ambiguousTaxpayerName(logReason: string): ApiError {
  return new ApiError({
    status: 400,
    code: "ambiguous_taxpayer_name",
    type: "validation_error",
    message: "No podemos separar el nombre completo con suficiente certeza. Envía taxpayer_name, taxpayer_last_name y taxpayer_second_last_name por separado.",
    param: "taxpayer",
    logReason,
  });
}

function splitTaxpayerName(taxpayer: string, rfc: string): Record<string, string> {
  const parts = taxpayer.split(/\s+/);
  const keys = parts.map(nameKey);
  if (parts.some((part) => !/^[\p{L}\p{M}]+(?:[-'’][\p{L}\p{M}]+)*$/u.test(part))) {
    throw ambiguousTaxpayerName("unsupported_characters");
  }
  if (keys.some((key) => UNSUPPORTED_PARTICLES.has(key))) {
    throw ambiguousTaxpayerName("unsupported_particle");
  }

  // The last two words outside a connector are the surnames, and each one keeps
  // the connectors before it: "ANA DE LA CRUZ PEREZ" has "DE LA CRUZ" as a surname.
  const significant = keys.flatMap((key, index) => (RFC_SKIPPED_CONNECTORS.has(key) ? [] : [index]));
  if (significant.length < 3) throw ambiguousTaxpayerName("too_few_words");
  if (RFC_SKIPPED_CONNECTORS.has(keys[0]!) || RFC_SKIPPED_CONNECTORS.has(keys.at(-1)!)) {
    throw ambiguousTaxpayerName("misplaced_connector");
  }
  const lastGivenIndex = significant.at(-3)!;
  const lastNameIndex = significant.at(-2)!;
  const secondLastNameIndex = significant.at(-1)!;

  // RFC initials only corroborate this conservative split; this is not SAT
  // identity validation. Explicit fields are needed for other name structures.
  const givenKeys = significant.slice(0, -2).map((index) => keys[index]!);
  const givenInitials = [givenKeys[0]![0]];
  if (["MARIA", "JOSE"].includes(givenKeys[0]!) && givenKeys[1]) givenInitials.push(givenKeys[1][0]);
  if (
    keys[lastNameIndex]![0] !== rfc[0] ||
    keys[secondLastNameIndex]![0] !== rfc[2] ||
    !givenInitials.includes(rfc[3])
  ) {
    throw ambiguousTaxpayerName("initials_mismatch");
  }
  return {
    taxpayer_name: parts.slice(0, lastGivenIndex + 1).join(" "),
    taxpayer_last_name: parts.slice(lastGivenIndex + 1, lastNameIndex + 1).join(" "),
    taxpayer_second_last_name: parts.slice(lastNameIndex + 1).join(" "),
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
