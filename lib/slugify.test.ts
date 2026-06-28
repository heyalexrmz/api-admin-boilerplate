import { describe, it, expect } from "vitest";

import { slugify } from "./slugify";

describe("slugify", () => {
  it.each([
    ["Acme", "acme"],
    ["Acme Inc.", "acme-inc"],
    ["  Hello  World  ", "hello-world"],
    ["Acme & Co. — LLC", "acme-co-llc"],
    ["Über Würden", "uber-wurden"],
    ["A_B_C", "a-b-c"],
    ["!!!", ""],
    ["Acme" + "x".repeat(100), "acme" + "x".repeat(36)],
    ["Café—München", "cafe-munchen"],
    ["mixedCASE 123", "mixedcase-123"],
  ])("slugify(%j) -> %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("never returns leading or trailing hyphens", () => {
    expect(slugify("---hi---")).toBe("hi");
    expect(slugify("   -   -   ")).toBe("");
  });

  it("collapses runs of non-alphanumerics into a single hyphen", () => {
    expect(slugify("a!!!b???c")).toBe("a-b-c");
  });
});
