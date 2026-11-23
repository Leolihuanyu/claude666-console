import { describe, expect, it } from "vitest";

import { isLegacyHost } from "@/lib/legacy-host";

describe("isLegacyHost", () => {
  it("matches the old claude666.top names", () => {
    expect(isLegacyHost("console.claude666.top")).toBe(true);
    expect(isLegacyHost("api.claude666.top")).toBe(true);
    expect(isLegacyHost("claude666.top")).toBe(true);
  });

  it("ignores the new domain and look-alikes", () => {
    expect(isLegacyHost("api.leoapi.ai")).toBe(false);
    expect(isLegacyHost("claude666.top.evil.com")).toBe(false);
    expect(isLegacyHost("notclaude666.top")).toBe(false);
  });
});
