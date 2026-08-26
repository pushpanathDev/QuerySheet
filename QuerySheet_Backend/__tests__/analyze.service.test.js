import { beforeEach, describe, expect, it, jest } from "@jest/globals";

const saveAnalysisMock = jest.fn();
const getCachedInsightsMock = jest.fn();
const setCachedInsightsMock = jest.fn();
const generateInsightsMock = jest.fn();

await jest.unstable_mockModule("../src/config/firebase.config.js", () => ({
  db: {
    collection: () => ({
      doc: () => ({
        collection: () => ({
          doc: () => ({}),
        }),
      }),
    }),
    runTransaction: async (fn) => {
      await fn({
        get: async () => ({
          exists: true,
          data: () => ({ analysisCount: 0 }),
        }),
        update: () => {},
        set: () => {},
      });
    },
  },
}));

await jest.unstable_mockModule("../src/services/cache.service.js", () => ({
  default: {
    getCachedInsights: getCachedInsightsMock,
    setCachedInsights: setCachedInsightsMock,
    saveAnalysis: saveAnalysisMock,
    getAnalysis: jest.fn(),
    deleteAnalysis: jest.fn(),
    getAllAnalyses: jest.fn(),
  },
}));

await jest.unstable_mockModule("../src/services/gemini.service.js", () => ({
  default: {
    generateInsights: generateInsightsMock,
  },
}));

await jest.unstable_mockModule("uuid", () => ({
  v4: () => "analysis-test-id",
}));

const { default: analyzeService } = await import("../src/services/analyze.service.js");

describe("analyze.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getCachedInsightsMock.mockRejectedValue({ code: "INSIGHT_CACHE_MISS" });
    generateInsightsMock.mockResolvedValue({
      insights: [
        {
          id: "uuid",
          type: "trend",
          title: "Sales trend",
          description: "Sales increasing",
          severity: "info",
          relatedColumns: ["sales"],
        },
      ],
      chartData: [],
      summary: {
        keyFindings: "Positive trend",
        dataQuality: "good",
        recommendedActions: ["Keep monitoring"],
      },
    });
  });

  it("runAnalysis detects numeric columns correctly", async () => {
    await analyzeService.runAnalysis("u1", {
      headers: ["sales"],
      rows: [{ sales: "10" }, { sales: "20" }, { sales: "40" }],
      datasetName: "Retail",
    });

    const columnStatsArg = generateInsightsMock.mock.calls[0][0];
    expect(columnStatsArg.sales.type).toBe("numeric");
  });

  it("runAnalysis removes columns with more than 50 percent null values", async () => {
    await analyzeService.runAnalysis("u1", {
      headers: ["sales", "notes"],
      rows: [{ sales: 10, notes: null }, { sales: 20, notes: "" }, { sales: 30, notes: null }],
      datasetName: "Retail",
    });

    const columnStatsArg = generateInsightsMock.mock.calls[0][0];
    expect(columnStatsArg.sales).toBeDefined();
    expect(columnStatsArg.notes).toBeUndefined();
  });

  it("runAnalysis throws on empty rows array", async () => {
    await expect(
      analyzeService.runAnalysis("u1", {
        headers: ["sales"],
        rows: [],
        datasetName: "Retail",
      }),
    ).rejects.toMatchObject({
      statusCode: 400,
    });
  });
});
