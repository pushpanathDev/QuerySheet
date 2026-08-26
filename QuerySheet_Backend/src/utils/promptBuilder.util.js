const ANALYSIS_SYSTEM_PROMPT =
  "You are a senior business data analyst. You analyze statistical summaries of business datasets and return structured JSON insights. Datasets may contain MULTIPLE sheets (tabs). Treat each sheet as a related but distinct table; cross-reference them when meaningful. You MUST ONLY respond with valid JSON that exactly matches the schema provided. Never add any text before or after the JSON object. Never use markdown code blocks.";

const buildAnalysisPrompt = (sheetSummaries, datasetName) => {
  const userPayload = {
    datasetName,
    sheetCount: sheetSummaries.length,
    sheets: sheetSummaries.map((sheet) => ({
      name: sheet.name,
      rowCount: sheet.rowCount,
      columnCount: sheet.headers.length,
      columns: sheet.columnStats,
      sampleRows: sheet.sampleRows,
    })),
  };

  const outputSchema = {
    insights: [
      {
        id: "uuid",
        type: "trend|anomaly|correlation|distribution|recommendation",
        title: "string (max 80 chars)",
        description: "string (max 500 chars)",
        severity: "info|warning|critical",
        relatedColumns: ["string"],
        sheetName: "string (which sheet this insight refers to; optional but recommended for multi-sheet datasets)",
      },
    ],
    chartData: [
      {
        chartType: "bar|line|pie",
        title: "string",
        sheetName: "string (which sheet provides xKey/yKeys)",
        xKey: "string",
        yKeys: ["string"],
      },
    ],
    summary: {
      keyFindings: "string",
      dataQuality: "good|fair|poor",
      recommendedActions: ["string"],
    },
  };

  return [
    ANALYSIS_SYSTEM_PROMPT,
    `Dataset payload:\n${JSON.stringify(userPayload, null, 2)}`,
    `Required output schema:\n${JSON.stringify(outputSchema, null, 2)}`,
    "Generate exactly 5 insights. Prioritize anomalies, cross-sheet relationships, and actionable recommendations. When the dataset has multiple sheets, ensure insights collectively cover the most important sheets — do not focus on a single sheet only.",
    "IMPORTANT: The 'severity' field MUST be exactly one of 'info', 'warning', or 'critical' — never 'recommendation' or any other value. Use 'info' for neutral observations and recommendations, 'warning' for concerning patterns, and 'critical' for severe issues. The 'type' field is separate and may be 'recommendation'.",
    "IMPORTANT: For each chart in 'chartData' and each insight referencing columns, set 'sheetName' to the exact sheet name from the payload, and ensure 'xKey'/'yKeys'/'relatedColumns' are valid headers of that sheet.",
  ].join("\n\n");
};

export { buildAnalysisPrompt };
