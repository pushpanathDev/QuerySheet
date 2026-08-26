import { v4 as uuidv4 } from "uuid";

// ─── Severity normalisation ──────────────────────────────────────────────────
// Gemini validates internally as info/warning/critical.
// The frontend badge system uses low/medium/high.
const SEVERITY_MAP = {
  info: "low",
  warning: "medium",
  critical: "high",
};

// ─── Chart helpers ────────────────────────────────────────────────────────────

const findStatsForChart = (chartConfig, sheetSummaries) => {
  if (chartConfig.sheetName) {
    const named = sheetSummaries.find(
      (sheet) => sheet.name === chartConfig.sheetName,
    );
    if (named?.columnStats?.[chartConfig.xKey]) {
      return named.columnStats[chartConfig.xKey];
    }
  }
  for (const sheet of sheetSummaries) {
    if (sheet.columnStats?.[chartConfig.xKey]) {
      return sheet.columnStats[chartConfig.xKey];
    }
  }
  return null;
};

const buildSyntheticChartPoints = (chartConfig, sheetSummaries) => {
  const sourceStats = findStatsForChart(chartConfig, sheetSummaries);

  if (!sourceStats?.topValues || sourceStats.topValues.length === 0) {
    return [];
  }

  const yKey = chartConfig.yKeys?.[0] ?? "value";

  return sourceStats.topValues.map((entry) => ({
    [chartConfig.xKey]: entry.value,
    [yKey]: entry.count,
  }));
};

/**
 * barStats — one entry per numeric column, derived from server-computed
 * columnStats.  These are always accurate to the actual dataset (not LLM
 * output) so the bar chart never shows fictional Revenue / Units Sold data.
 */
const buildBarStats = (sheetSummaries) => {
  const stats = [];
  for (const sheet of sheetSummaries) {
    for (const [column, colStats] of Object.entries(sheet.columnStats ?? {})) {
      if (colStats.type === "numeric" && colStats.mean !== null) {
        stats.push({
          column,
          sheetName: sheet.name,
          mean: colStats.mean !== null ? Number(colStats.mean.toFixed(2)) : null,
          min: colStats.min,
          max: colStats.max,
          stdDev: colStats.stdDev !== null ? Number(colStats.stdDev.toFixed(2)) : null,
          nullCount: colStats.nullCount ?? 0,
          uniqueCount: colStats.uniqueCount ?? 0,
        });
      }
    }
  }
  return stats;
};

// ─── Insight normalisation ────────────────────────────────────────────────────

const normalizeInsight = (insight) => ({
  ...insight,
  id: !insight?.id || insight.id === "uuid" ? uuidv4() : insight.id,
  // Map internal severity enum to the frontend badge system.
  severity: SEVERITY_MAP[insight?.severity] ?? insight?.severity ?? "low",
  relativeTime: "Just now",
});

// ─── Main mapper ──────────────────────────────────────────────────────────────

const mapInsightsToResponse = (
  geminiOutput,
  analysisId,
  datasetName,
  sheetSummaries = [],
  rowCount = 0,
) => {
  // Backward-compat: if a single columnStats object is passed instead of sheets,
  // wrap it into a synthetic single-sheet array.
  const normalizedSheets = Array.isArray(sheetSummaries)
    ? sheetSummaries
    : [
        {
          name: datasetName || "Sheet1",
          headers: Object.keys(sheetSummaries ?? {}),
          rowCount,
          columnStats: sheetSummaries ?? {},
          sampleRows: [],
        },
      ];

  const insights = (geminiOutput?.insights ?? []).map(normalizeInsight);

  // LLM-generated chart configs — kept as `charts` for configurable rendering.
  const charts = (geminiOutput?.chartData ?? []).map((chart) => ({
    ...chart,
    data: buildSyntheticChartPoints(chart, normalizedSheets),
  }));

  // chartData shape the frontend expects:
  //   barStats  — server-computed numeric column stats (always accurate)
  //   timeSeries — placeholder; full date aggregation requires all rows on
  //                the frontend (see architectural note in docs/)
  //   charts     — LLM-generated chart configs for rich/configurable charts
  const chartData = {
    barStats: buildBarStats(normalizedSheets),
    timeSeries: [],
    charts,
  };

  // aiSummary shape the frontend expects:
  //   dataQuality        — "good" | "fair" | "poor"
  //   qualityNote        — prose summary of key findings
  //   recommendedActions — array of action strings
  const rawSummary = geminiOutput?.summary ?? null;
  const aiSummary = rawSummary
    ? {
        dataQuality: rawSummary.dataQuality,
        qualityNote: rawSummary.keyFindings ?? null,
        recommendedActions: rawSummary.recommendedActions ?? [],
      }
    : null;

  return {
    analysisId,
    datasetName,
    rowCount,
    sheetCount: normalizedSheets.length,
    sheets: normalizedSheets.map((sheet) => ({
      name: sheet.name,
      headers: sheet.headers,
      rowCount: sheet.rowCount,
      columnStats: sheet.columnStats,
    })),
    insights,
    chartData,
    aiSummary,
    generatedAt: new Date().toISOString(),
  };
};

export { mapInsightsToResponse };
