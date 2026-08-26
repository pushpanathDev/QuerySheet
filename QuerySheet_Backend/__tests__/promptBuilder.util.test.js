import { describe, expect, it } from "@jest/globals";

import { buildAnalysisPrompt } from "../src/utils/promptBuilder.util.js";

describe("promptBuilder.util", () => {
  it("contains column names from input", () => {
    const prompt = buildAnalysisPrompt(
      {
        sales: { type: "numeric", mean: 120.4 },
        region: { type: "categorical", topValues: [{ value: "APAC", count: 10 }] },
      },
      "Retail",
    );

    expect(prompt).toContain("sales");
    expect(prompt).toContain("region");
  });

  it("does not contain raw row values", () => {
    const prompt = buildAnalysisPrompt(
      {
        revenue: { type: "numeric", mean: 300, max: 900 },
      },
      "Retail",
    );

    expect(prompt).not.toContain("customer_email");
    expect(prompt).not.toContain("john@example.com");
  });

  it("contains JSON instruction", () => {
    const prompt = buildAnalysisPrompt(
      {
        sales: { type: "numeric", mean: 10 },
      },
      "Retail",
    );

    expect(prompt).toContain("JSON");
  });
});
