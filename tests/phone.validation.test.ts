import { describe, expect, it } from "vitest";
import {
  isValidBrazilPhone,
  normalizePhoneE164,
} from "@/lib/validations";

describe("normalizePhoneE164", () => {
  it("prefixes 55 for national mobile", () => {
    expect(normalizePhoneE164("31972245606")).toBe("+5531972245606");
    expect(normalizePhoneE164("(31) 97224-5606")).toBe("+5531972245606");
  });

  it("keeps existing country code", () => {
    expect(normalizePhoneE164("5531972245606")).toBe("+5531972245606");
    expect(normalizePhoneE164("+55 31 97224-5606")).toBe("+5531972245606");
  });

  it("does not double-prefix when input already starts with 55", () => {
    // 11 digits starting with 55 used to become +5555319722456
    expect(normalizePhoneE164("55319722456")).toBe("+55319722456");
    expect(normalizePhoneE164("5555319722456")).toBe("+55319722456");
    expect(normalizePhoneE164("555531972245606")).toBe("+5531972245606");
  });

  it("rejects doubled / incomplete numbers via isValidBrazilPhone", () => {
    expect(isValidBrazilPhone("31972245606")).toBe(true);
    expect(isValidBrazilPhone("5531972245606")).toBe(true);
    expect(isValidBrazilPhone("55319722456")).toBe(false);
    expect(isValidBrazilPhone("5555319722456")).toBe(false);
  });
});
