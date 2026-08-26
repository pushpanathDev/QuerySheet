import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { log } from "../utils/logger.util";

const storeLog = log.scope("analysis.store");

const useAnalysisStore = create(
  persist(
    immer((set) => ({
      // ── Current analysis (shown on Dashboard / Chat) ──────────────────────
      analysisId: null,
      datasetName: null,
      rowCount: null,
      headers: null,
      insights: null,
      chartData: null,
      aiSummary: null,
      createdAt: null,
      status: null,

      setAnalysis: (payload) =>
        set((state) => {
          storeLog.info("setAnalysis", {
            analysisId: payload?.analysisId,
            rowCount: payload?.rowCount,
            insightsCount: Array.isArray(payload?.insights)
              ? payload.insights.length
              : 0,
            hasChartData: Boolean(payload?.chartData),
          });

          state.analysisId = payload.analysisId ?? null;
          state.datasetName = payload.datasetName ?? null;
          state.rowCount = payload.rowCount ?? null;
          state.headers = payload.headers ?? null;
          state.insights = payload.insights ?? null;
          state.chartData = payload.chartData ?? null;
          state.aiSummary = payload.aiSummary ?? null;
          state.createdAt = payload.createdAt ?? null;
          state.status = payload.status ?? null;
        }),

      clearAnalysis: () =>
        set((state) => {
          state.analysisId = null;
          state.datasetName = null;
          state.rowCount = null;
          state.headers = null;
          state.insights = null;
          state.chartData = null;
          state.aiSummary = null;
          state.createdAt = null;
          state.status = null;
        }),

      // ── History list cache (avoids re-fetching on every navigation) ────────
      // Cached for HISTORY_STALE_MS; invalidated on sign-out / UID change.
      historyList: [],
      historyFetchedAt: null,

      /** Replace the entire cached list and stamp the fetch time. */
      setHistory: (list) =>
        set((state) => {
          state.historyList = Array.isArray(list) ? list : [];
          state.historyFetchedAt = Date.now();
        }),

      /**
       * Optimistically remove one entry after a delete.
       * Also resets historyFetchedAt to now so the stale timer restarts from
       * the moment of the mutation — preventing a redundant background re-fetch
       * that would fire if the original fetchedAt had already aged past STALE_MS.
       */
      removeFromHistory: (analysisId) =>
        set((state) => {
          state.historyList = state.historyList.filter(
            (a) => a.analysisId !== analysisId,
          );
          state.historyFetchedAt = Date.now();
        }),

      /**
       * Mark the history cache as stale WITHOUT clearing the list.
       *
       * Call this after any mutation that changes Firestore (new analysis
       * submitted, analysis status transitions to completed, etc.).
       * The History page will show the existing cached list immediately and
       * kick off a background re-fetch to pull the fresh data — no spinner,
       * no visible flash.
       */
      invalidateHistory: () =>
        set((state) => {
          state.historyFetchedAt = null;
        }),

      /** Wipe the cache entirely (sign-out, user switch). */
      clearHistory: () =>
        set((state) => {
          state.historyList = [];
          state.historyFetchedAt = null;
        }),
    })),
    {
      name: "querysheet-analysis",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export default useAnalysisStore;
