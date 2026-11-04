import { describe, expect, it } from "vitest";
import { normalizeTicketSubmitFields } from "./submit-fields";
import { tocinoSubmitBody } from "./provider-submit";

const fullNameOnly = {
  tax_id: "LOTJ900101AB1",
  taxpayer: "JULIETA SOFIA LOPEZ TORRES",
  country: "Mexico",
  postal_code: "01000",
  invoice_cfdi_use: "G03",
  invoice_fiscal_regimen: "612",
};
const separateNames = {
  taxpayer_name: "JULIETA SOFIA",
  taxpayer_last_name: "LOPEZ",
  taxpayer_second_last_name: "TORRES",
};

describe("persona fisica name normalization", () => {
  it("enriches the reported full-name-only payload without changing its fiscal data", () => {
    const result = normalizeTicketSubmitFields(fullNameOnly);
    expect(result).toEqual({ ...fullNameOnly, ...separateNames });
    expect(fullNameOnly).not.toHaveProperty("taxpayer_name");
    expect(normalizeTicketSubmitFields(result)).toEqual(result);
  });

  it("handles lowercase RFCs and repeated whitespace without changing name spelling", () => {
    expect(normalizeTicketSubmitFields({
      tax_id: " lotj900101ab1 ", taxpayer: " Julieta  Sofia\tLopez\nTorres ",
    })).toMatchObject({
      taxpayer_name: "Julieta Sofia", taxpayer_last_name: "Lopez", taxpayer_second_last_name: "Torres",
    });
  });

  it.each([
    ["LOPA900101AB1", "ANA LÓPEZ PÉREZ", "ANA", "LÓPEZ", "PÉREZ"],
    ["LOPF900101AB1", "MARÍA FERNANDA LÓPEZ PÉREZ", "MARÍA FERNANDA", "LÓPEZ", "PÉREZ"],
    ["LOPL900101AB1", "JOSÉ LUIS LÓPEZ PÉREZ", "JOSÉ LUIS", "LÓPEZ", "PÉREZ"],
  ])("splits a straightforward name for %s", (tax_id, taxpayer, name, last, second) => {
    expect(normalizeTicketSubmitFields({ tax_id, taxpayer })).toMatchObject({
      taxpayer_name: name, taxpayer_last_name: last, taxpayer_second_last_name: second,
    });
  });

  it.each(["EKU9003173C9", "XAXX010101000", "XEXX010101000", "INVALID-RFC", "1234567890123"])(
    "does not split company, generic, or unrecognized RFC %s", (tax_id) => {
      const fields = { tax_id, taxpayer: "EMPRESA DEMO SA DE CV" };
      expect(normalizeTicketSubmitFields(fields)).toEqual(fields);
    },
  );

  it.each([
    ["LOPM900101AB1", "MARIA DEL CARMEN LOPEZ PEREZ", "MARIA DEL CARMEN", "LOPEZ", "PEREZ"],
    ["LOPC900101AB1", "MARIA DEL CARMEN LOPEZ PEREZ", "MARIA DEL CARMEN", "LOPEZ", "PEREZ"],
    ["GAHJ900101AB1", "JUAN DE DIOS GARCIA HERNANDEZ", "JUAN DE DIOS", "GARCIA", "HERNANDEZ"],
    ["CUPA900101AB1", "ANA DE LA CRUZ PEREZ", "ANA", "DE LA CRUZ", "PEREZ"],
    ["LORM900101AB1", "MARIA LOPEZ DEL RIO", "MARIA", "LOPEZ", "DEL RIO"],
    ["RORL900101AB1", "LUZ MARIA DE LA ROSA DE LOS RIOS", "LUZ MARIA", "DE LA ROSA", "DE LOS RIOS"],
    ["ROVJ900101AB1", "MARIA DE JESUS DE LA ROSA VEGA", "MARIA DE JESUS", "DE LA ROSA", "VEGA"],
    ["lopm900101ab1", "maría del carmen lópez pérez", "maría del carmen", "lópez", "pérez"],
  ])("splits a name with Spanish connectors confirmed by the RFC: %s / %s", (tax_id, taxpayer, name, last, second) => {
    expect(normalizeTicketSubmitFields({ tax_id, taxpayer })).toMatchObject({
      taxpayer_name: name, taxpayer_last_name: last, taxpayer_second_last_name: second,
    });
  });

  it.each([
    ["LOTJ900101AB1", "JULIETA LOPEZ", "too_few_words"],
    ["CUXA900101AB1", "ANA DE LA CRUZ", "too_few_words"],
    ["PEXJ900101AB1", "JUAN CARLOS PEREZ", "initials_mismatch"],
    ["PEXL900101AB1", "MARIA DE LA LUZ PEREZ", "initials_mismatch"],
    ["LOPM900101AB1", "MARIA LOPEZ DEL RIO", "initials_mismatch"],
    ["LOTJ900101AB1", "ANA LOPEZ PEREZ", "initials_mismatch"],
    ["LOTJ900101AB1", "LOPEZ TORRES, JULIETA SOFIA", "unsupported_characters"],
    ["SAPA900101AB1", "ANA SAN MARTIN PEREZ", "unsupported_particle"],
    ["MAPA900101AB1", "ANA MAC GREGOR PEREZ", "unsupported_particle"],
    ["GAPJ900101AB1", "JUAN GARCIA Y PEREZ LOPEZ", "unsupported_particle"],
    ["LOPM900101AB1", "DE LA MARIA LOPEZ PEREZ", "misplaced_connector"],
    ["LOPM900101AB1", "MARIA LOPEZ PEREZ DE", "misplaced_connector"],
  ])("asks for explicit fields for %s / %s (%s)", (tax_id, taxpayer, logReason) => {
    expect(() => normalizeTicketSubmitFields({ tax_id, taxpayer })).toThrow(expect.objectContaining({
      status: 400, code: "ambiguous_taxpayer_name", type: "validation_error", param: "taxpayer", logReason,
    }));
  });

  it("preserves explicit fields, including compound surnames, even when taxpayer differs", () => {
    const fields = {
      tax_id: "CUPA900101AB1", taxpayer: "ANA DE LA CRUZ PEREZ",
      taxpayer_name: "ANA MARIA", taxpayer_last_name: "DE LA CRUZ", taxpayer_second_last_name: "PEREZ",
    };
    expect(normalizeTicketSubmitFields(fields)).toEqual(fields);
  });

  it.each<Record<string, string>>([
    { taxpayer_name: "JULIETA SOFIA" },
    { taxpayer_last_name: "LOPEZ" },
    { taxpayer_second_last_name: "TORRES" },
  ])("does not mix partial explicit fields with inferred names: %j", (partial) => {
    expect(() => normalizeTicketSubmitFields({ ...fullNameOnly, ...partial })).toThrow(expect.objectContaining({
      status: 400, code: "missing_field", type: "validation_error",
    }));
  });

  it("treats blank split fields as absent", () => {
    expect(normalizeTicketSubmitFields({
      ...fullNameOnly, taxpayer_name: " ", taxpayer_last_name: "", taxpayer_second_last_name: "\t",
    })).toEqual({ ...fullNameOnly, ...separateNames });
  });

  it("enriches a stored legacy payload when preparing a retry and retains its actual image", () => {
    expect(tocinoSubmitBody({
      storedFields: { ...fullNameOnly, file: "<base64 omitted>", request_id: "internal" },
      imageBase64: "actual-image", fileName: "ticket.jpg",
    })).toEqual({
      tax_id: fullNameOnly.tax_id, taxpayer: fullNameOnly.taxpayer, country: fullNameOnly.country,
      postal_code: fullNameOnly.postal_code, cfdi_use_code: "G03", fiscal_regimen_code: "612",
      ...separateNames, file: "actual-image", filename: "ticket.jpg",
    });
  });
});
