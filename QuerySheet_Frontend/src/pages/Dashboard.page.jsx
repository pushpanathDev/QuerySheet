import { useState, useCallback, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  Cell,
  Legend,
} from "recharts";
import useAnalysisStore from "../store/analysis.store";
import InsightCard from "../components/dashboard/InsightCard";
import HeroWelcome from "../components/dashboard/HeroWelcome";
import { useAnalysisPoller } from "../hooks/useAnalysisPoller";
import { getAnalysis } from "../api/analyze.api";
import { AnalysisLoader, Spinner } from "../components/common/Loader";

// Vibrant but cohesive multi-colour palette (green-anchored, high contrast).
const CHART_COLORS = [
  "#16a34a", // brand green
  "#2563eb", // blue
  "#f59e0b", // amber
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#e11d48", // rose
  "#0e1311", // ink
  "#65a30d", // lime-olive
];

const AXIS_TICK = { fontSize: 12, fill: "#505050" };
const GRID_PROPS = {
  strokeDasharray: "3 3",
  stroke: "#ececec",
  vertical: false,
};
const TOOLTIP_STYLE = {
  borderRadius: "12px",
  border: "1px solid #ececec",
  fontSize: "12px",
  boxShadow: "0 8px 24px rgba(0,0,0,0.08)",
};

const DATA_QUALITY_STYLES = {
  good: "bg-brand-soft text-brand border border-brand/30",
  fair: "bg-amber-50 text-amber-700 border border-amber-300",
  poor: "bg-red-50 text-red-700 border border-red-300",
  unknown: "bg-black/5 text-muted border border-line",
};

function DataQualityBadge({ quality }) {
  const q = quality?.toLowerCase() ?? "unknown";
  const style = DATA_QUALITY_STYLES[q] ?? DATA_QUALITY_STYLES.unknown;
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${style}`}
    >
      {q.charAt(0).toUpperCase() + q.slice(1)}
    </span>
  );
}

function ChartEmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-[300px] text-center">
      <svg
        className="w-10 h-10 text-line mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

/** Shared card chrome used across the dashboard for a uniform look. */
function Panel({ title, children, className = "" }) {
  return (
    <div
      className={`bg-white border border-line rounded-2xl p-6 shadow-sm ${className}`}
    >
      {title && (
        <h2 className="text-base font-display font-bold text-ink mb-4">
          {title}
        </h2>
      )}
      {children}
    </div>
  );
}

/**
 * All possible metrics we know how to render from barStats.
 * `key` is the field name from the backend response object.
 * `label` is human-friendly. `suffix` is appended to value labels.
 * The list is ordered by display priority — first available metric
 * becomes the default selection.
 */
const KNOWN_METRICS = [
  { key: "mean", label: "Average", suffix: "" },
  { key: "max", label: "Maximum", suffix: "" },
  { key: "min", label: "Minimum", suffix: "" },
  { key: "stdDev", label: "Std Deviation", suffix: "" },
  { key: "nullCount", label: "Null Count", suffix: "" },
  { key: "uniqueCount", label: "Unique Values", suffix: "" },
];

/**
 * Dynamically detects which metrics exist in `barData`, builds interactive
 * metric tabs, and renders sorted horizontal bars (Option 1 from the mockups).
 * Tabs, chart type, and values are 100% driven by the backend response.
 */
function ColumnStatsChart({ barData }) {
  // Detect which metrics are actually present in this dataset's response.
  const availableMetrics = KNOWN_METRICS.filter((m) =>
    barData.some((d) => d[m.key] != null && d[m.key] !== 0),
  );

  const [activeKey, setActiveKey] = useState(
    () => availableMetrics[0]?.key ?? "mean",
  );

  // If the active metric disappears on data change, reset to first available.
  const metric =
    availableMetrics.find((m) => m.key === activeKey) ?? availableMetrics[0];
  if (!metric)
    return (
      <ChartEmptyState message="No numeric column statistics available." />
    );

  // Sort columns by the selected metric (descending) so the ranking is clear.
  const sorted = [...barData].sort(
    (a, b) => (Number(b[metric.key]) || 0) - (Number(a[metric.key]) || 0),
  );

  // Height scales with the number of columns to keep bars readable.
  const chartHeight = Math.max(180, sorted.length * 38);

  return (
    <Panel>
      {/* Dynamic metric tabs */}
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <h2 className="text-base font-display font-bold text-ink">
          Column Statistics
        </h2>
        <div className="flex items-center gap-1.5 flex-wrap">
          {availableMetrics.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveKey(m.key)}
              className={[
                "px-3 py-1 text-xs font-medium rounded-lg border transition-colors",
                m.key === metric.key
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-body border-line hover:border-accent/40 hover:text-ink",
              ].join(" ")}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sorted horizontal bar chart */}
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 0, right: 40, left: 10, bottom: 0 }}
        >
          <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />
          <XAxis
            type="number"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="category"
            dataKey="column"
            tick={{ fontSize: 12, fill: "#0e1311" }}
            tickLine={false}
            axisLine={false}
            width={120}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            cursor={{ fill: "rgba(0,0,0,0.04)" }}
            formatter={(value) => [
              Number(value).toLocaleString(),
              metric.label,
            ]}
            labelFormatter={(label) => {
              const item = sorted.find((d) => d.column === label);
              return item?.sheetName ? `${label} · ${item.sheetName}` : label;
            }}
          />
          <Bar
            dataKey={metric.key}
            name={metric.label}
            radius={[0, 6, 6, 0]}
            maxBarSize={28}
            label={{
              position: "right",
              fontSize: 11,
              fill: "#505050",
              formatter: (v) => Number(v).toLocaleString() + metric.suffix,
            }}
          >
            {sorted.map((_, i) => (
              <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <p className="text-xs text-muted mt-3 text-center">
        Sorted by {metric.label.toLowerCase()} · one bar per numeric column in
        your dataset
      </p>
    </Panel>
  );
}

/**
 * Renders a single LLM-generated chart config from chartData.charts.
 * Supports chartType "bar" (default) and "line".
 */
function DynamicChart({ chart, idx = 0 }) {
  const { chartType = "bar", title, xKey, yKeys = [], data = [] } = chart;
  // Unique gradient ids per chart instance so multiple charts don't clash.
  const gid = (i) => `dyn-${idx}-${i}`;
  // A single-series bar chart reads better with one colour per category.
  const colorPerCategory = chartType !== "line" && yKeys.length === 1;

  const inner =
    chartType === "line" ? (
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <defs>
          {yKeys.map((key, i) => {
            const c = CHART_COLORS[i % CHART_COLORS.length];
            return (
              <linearGradient key={key} id={gid(i)} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c} stopOpacity={0.35} />
                <stop offset="100%" stopColor={c} stopOpacity={0.02} />
              </linearGradient>
            );
          })}
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "#ececec" }}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ stroke: "#16a34a", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
        {yKeys.map((key, i) => {
          const c = CHART_COLORS[i % CHART_COLORS.length];
          return (
            <Area
              key={key}
              type="monotone"
              dataKey={key}
              stroke={c}
              strokeWidth={2.5}
              fill={`url(#${gid(i)})`}
              dot={false}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          );
        })}
      </AreaChart>
    ) : (
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey={xKey}
          tick={AXIS_TICK}
          tickLine={false}
          axisLine={{ stroke: "#ececec" }}
        />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        {!colorPerCategory && (
          <Legend wrapperStyle={{ fontSize: "12px" }} iconType="circle" />
        )}
        {yKeys.map((key, i) => (
          <Bar
            key={key}
            dataKey={key}
            fill={CHART_COLORS[i % CHART_COLORS.length]}
            radius={[6, 6, 0, 0]}
            maxBarSize={56}
          >
            {colorPerCategory &&
              data.map((_, di) => (
                <Cell key={di} fill={CHART_COLORS[di % CHART_COLORS.length]} />
              ))}
          </Bar>
        ))}
      </BarChart>
    );

  return (
    <Panel title={title}>
      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          {inner}
        </ResponsiveContainer>
      ) : (
        <ChartEmptyState message="No data for this chart." />
      )}
    </Panel>
  );
}

function SummaryCard({ label, value, sub }) {
  return (
    <div className="bg-white border border-line rounded-2xl p-5 flex flex-col gap-1 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs font-medium text-muted uppercase tracking-wide">
        {label}
      </p>
      <div className="mt-1">{value}</div>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

/** Format any timestamp shape (Firestore object, ISO string, or ms) to "Jun 4, 2026". */
function fmtDate(ts) {
  if (!ts) return null;
  const d = ts?._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Prominent header that tells the user exactly which analysis they are viewing,
 * and lets them switch to any other analysis in their history cache.
 */
function AnalysisContextBar({
  analysisId,
  datasetName,
  createdAt,
  rowCount,
  status,
  historyList,
  onSwitch,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef(null);

  // Close the dropdown on outside click
  useEffect(() => {
    function handler(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const otherAnalyses = (historyList ?? [])
    .filter((item) => item.analysisId !== analysisId)
    .slice(0, 10);

  async function handleSwitch(targetId) {
    if (isSwitching) return;
    setIsOpen(false);
    setIsSwitching(true);
    try {
      const result = await onSwitch(targetId);
      if (result) setIsSwitching(false);
    } catch {
      setIsSwitching(false);
    }
  }

  const dateStr = fmtDate(createdAt);

  return (
    <div className="bg-white border border-line rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted uppercase tracking-wide mb-0.5">
          Currently viewing
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <h1
            className="text-lg font-display font-bold text-ink truncate"
            title={datasetName}
          >
            {datasetName ?? "—"}
          </h1>
          {status === "processing" && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-brand-soft text-brand border border-brand/30 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              Analyzing…
            </span>
          )}
        </div>
        <p className="text-xs text-muted mt-0.5">
          {rowCount != null ? `${rowCount.toLocaleString()} rows` : ""}
          {rowCount != null && dateStr ? " · " : ""}
          {dateStr ? `Analyzed ${dateStr}` : ""}
        </p>
      </div>

      {otherAnalyses.length > 0 && (
        <div className="relative flex-shrink-0" ref={dropdownRef}>
          <button
            onClick={() => setIsOpen((o) => !o)}
            disabled={isSwitching}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-body border border-line rounded-xl hover:bg-black/5 hover:text-ink disabled:opacity-50 transition-colors"
          >
            {isSwitching ? (
              <Spinner size="sm" tone="ink" />
            ) : (
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                />
              </svg>
            )}
            Switch dataset
            <svg
              className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {isOpen && (
            <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-line rounded-2xl shadow-xl z-20 overflow-hidden animate-scale-in origin-top-right">
              <p className="px-4 pt-3 pb-2 text-xs font-semibold text-muted uppercase tracking-wide border-b border-line">
                Recent analyses
              </p>
              <ul className="max-h-64 overflow-y-auto py-1">
                {otherAnalyses.map((item) => (
                  <li key={item.analysisId}>
                    <button
                      onClick={() => handleSwitch(item.analysisId)}
                      className="w-full text-left px-4 py-3 hover:bg-brand-soft/60 transition-colors flex flex-col gap-0.5"
                    >
                      <span className="text-sm font-medium text-ink truncate">
                        {item.datasetName}
                      </span>
                      <span className="text-xs text-muted">
                        {item.rowCount != null
                          ? `${item.rowCount.toLocaleString()} rows`
                          : ""}
                        {item.rowCount != null && item.createdAt ? " · " : ""}
                        {fmtDate(item.createdAt) ?? ""}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="border-t border-line px-4 py-2.5">
                <Link
                  to="/history"
                  onClick={() => setIsOpen(false)}
                  className="text-xs text-brand hover:text-brand/80 font-medium"
                >
                  View all analyses →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Full-section placeholder shown while the backend is processing the analysis. */
function AnalyzingBanner({ timedOut }) {
  return (
    <Panel className="!p-10">
      <AnalysisLoader timedOut={timedOut}>
        {timedOut ? (
          <>
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                />
              </svg>
            </div>
            <h3 className="text-base font-display font-bold text-ink mb-2">
              This is taking longer than expected
            </h3>
            <p className="text-sm text-body max-w-md mx-auto">
              The backend is still processing. Open the{" "}
              <Link
                to="/history"
                className="text-brand hover:underline font-medium"
              >
                History page
              </Link>{" "}
              and select your analysis once it shows a completed status.
            </p>
          </>
        ) : null}
      </AnalysisLoader>
    </Panel>
  );
}

export default function DashboardPage() {
  const analysisId = useAnalysisStore((s) => s.analysisId);
  const datasetName = useAnalysisStore((s) => s.datasetName);
  const rowCount = useAnalysisStore((s) => s.rowCount);
  const headers = useAnalysisStore((s) => s.headers);
  const insights = useAnalysisStore((s) => s.insights);
  const chartData = useAnalysisStore((s) => s.chartData);
  const aiSummary = useAnalysisStore((s) => s.aiSummary);
  const createdAt = useAnalysisStore((s) => s.createdAt);
  const status = useAnalysisStore((s) => s.status);
  const historyList = useAnalysisStore((s) => s.historyList);
  const setAnalysis = useAnalysisStore((s) => s.setAnalysis);

  const { isPolling, timedOut } = useAnalysisPoller();

  const hasAnalysis = Boolean(analysisId);
  const barData = chartData?.barStats ?? [];
  const lineData = chartData?.timeSeries ?? [];
  const llmCharts = chartData?.charts ?? [];
  const activeInsights = insights ?? [];
  const actions = aiSummary?.recommendedActions ?? [];

  const handleSwitch = useCallback(
    async (targetId) => {
      const result = await getAnalysis(targetId);
      setAnalysis(result);
      return result;
    },
    [setAnalysis],
  );

  // No analysis loaded → full-bleed welcome hero (sits flush below AppLayout's nav).
  if (!hasAnalysis) {
    return <HeroWelcome />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Analysis context — tells the user which dataset they are looking at */}
        <AnalysisContextBar
          analysisId={analysisId}
          datasetName={datasetName}
          createdAt={createdAt}
          rowCount={rowCount}
          status={status}
          historyList={historyList}
          onSwitch={handleSwitch}
        />

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard
            label="Total Rows"
            value={
              <span className="text-2xl font-display font-bold text-ink">
                {(rowCount ?? 0).toLocaleString()}
              </span>
            }
            sub="records in dataset"
          />
          <SummaryCard
            label="Insights Generated"
            value={
              <span className="text-2xl font-display font-bold text-ink">
                {activeInsights.length}
              </span>
            }
            sub="actionable findings"
          />
          <SummaryCard
            label="Data Quality"
            value={<DataQualityBadge quality={aiSummary?.dataQuality} />}
            sub={
              aiSummary?.qualityNote ?? "based on completeness & consistency"
            }
          />
          <SummaryCard
            label="Dataset"
            value={
              <span
                className="text-base font-semibold text-ink truncate block"
                title={datasetName}
              >
                {datasetName ?? "—"}
              </span>
            }
            sub={`${(headers ?? []).length} columns`}
          />
        </div>

        {/* While the backend is processing, replace charts + insights with a loader */}
        {isPolling || timedOut ? (
          <AnalyzingBanner timedOut={timedOut} />
        ) : (
          <>
            {/* Charts */}
            <div className="space-y-6">
              {/* Numeric Column Statistics — Option 1 dynamic horizontal bars with metric tabs */}
              {barData.length > 0 ? (
                <ColumnStatsChart barData={barData} />
              ) : (
                <Panel title="Column Statistics">
                  <ChartEmptyState message="No numeric column statistics returned by the backend yet." />
                </Panel>
              )}

              {/* LLM-generated charts — only rendered when the backend sends them */}
              {llmCharts.map((chart, i) => (
                <DynamicChart key={chart.title ?? i} chart={chart} idx={i} />
              ))}

              {/* Trend Over Time — only shown when timeSeries is populated */}
              {lineData.length > 0 && (
                <Panel title="Trend Over Time">
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart
                      data={lineData}
                      margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                    >
                      <defs>
                        <linearGradient
                          id="trendFill"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor="#16a34a"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="100%"
                            stopColor="#16a34a"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis
                        dataKey="date"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={{ stroke: "#ececec" }}
                      />
                      <YAxis
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={TOOLTIP_STYLE}
                        cursor={{
                          stroke: "#16a34a",
                          strokeWidth: 1,
                          strokeDasharray: "4 4",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name="Value"
                        stroke="#16a34a"
                        strokeWidth={2.5}
                        fill="url(#trendFill)"
                        dot={false}
                        activeDot={{ r: 5, strokeWidth: 0 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </Panel>
              )}
            </div>

            {/* Insights Grid */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-display font-bold text-ink">
                  AI Insights
                </h2>
                <Link
                  to="/chat"
                  className="text-sm text-brand hover:text-brand/80 font-medium"
                >
                  Ask a follow-up question →
                </Link>
              </div>
              {activeInsights.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeInsights.map((insight, idx) => (
                    <div
                      key={insight.id ?? idx}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(idx * 80, 480)}ms` }}
                    >
                      <InsightCard insight={insight} />
                    </div>
                  ))}
                </div>
              ) : (
                <Panel className="!p-10 text-center">
                  <p className="text-sm text-muted">
                    No AI insights returned by the backend yet.
                  </p>
                  <Link
                    to="/chat"
                    className="mt-3 inline-block text-sm text-brand hover:text-brand/80 font-medium"
                  >
                    Ask a question about your dataset →
                  </Link>
                </Panel>
              )}
            </div>

            {/* Recommended Actions */}
            {actions.length > 0 && (
              <Panel title="Recommended Actions">
                <ul className="space-y-3">
                  {actions.map((action, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-3 text-sm text-body animate-fade-in-up"
                      style={{ animationDelay: `${Math.min(i * 80, 480)}ms` }}
                    >
                      <span className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-brand-soft text-brand text-xs font-bold flex items-center justify-center">
                        {i + 1}
                      </span>
                      {action}
                    </li>
                  ))}
                </ul>
              </Panel>
            )}
          </>
        )}
      </div>
    </div>
  );
}
