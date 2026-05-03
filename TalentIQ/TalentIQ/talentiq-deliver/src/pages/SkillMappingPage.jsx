// src/pages/SkillMappingPage.jsx
// Container for the Skill Mapping section.
// Owns: active tab + cross-cutting selection (selectedPos / selectedRes).
// Each tab is now full-width by default. The position list (with its search)
// has been moved INTO the Resource Matches tab so it's native to that view —
// Summary and Confidence Overview no longer share screen real-estate with it.
import { useMemo, useState } from "react";
import { C } from "../theme";
import { KPICard, TabBtn } from "../components/ui";
import { getMatchScore, monthsOnBench } from "../dataProcessor";
import SummaryTab from "./SummaryTab";
import ResourceMatchesTab from "./ResourceMatchesTab";
import ConfidenceOverviewTab from "./ConfidenceOverviewTab";

export default function SkillMappingPage({ positions, bench }) {
  const [tab, setTab] = useState("summary");

  // Cross-tab selection — Confidence Overview row click sets these and jumps to Matches.
  const [selectedPos, setSelectedPos] = useState(null);
  const [selectedRes, setSelectedRes] = useState(null);

  // Confidence overview — computed once, shared by Summary + Overview tabs.
  // IMPORTANT: shore filtering must match ResourceMatchesTab's logic exactly,
  // otherwise the Confidence table would show counts (e.g. "14 High") that
  // disappear when the user clicks the row and lands in Matches view (because
  // Matches filters bench resources to the position's shore).
  const overviewData = useMemo(() => positions.map((pos) => {
    const posShore = String(pos.location || "").toLowerCase();
    let high = 0, medium = 0, low = 0;
    const matchedResources = [];
    bench.forEach((r) => {
      // Enforce same-shore matching consistent with ResourceMatchesTab
      const resShore = String(r.location || "").toLowerCase();
      if (posShore && resShore && posShore !== resShore) return;
      const { score, matched } = getMatchScore(pos.skills, r.skills);
      if (score >= 80) { high++; matchedResources.push({ ...r, score, matched, confidence: "High" }); }
      else if (score >= 60) { medium++; matchedResources.push({ ...r, score, matched, confidence: "Medium" }); }
      else if (score >= 40) { low++; matchedResources.push({ ...r, score, matched, confidence: "Low" }); }
    });
    return { ...pos, high, medium, low, total: high + medium + low, matchedResources };
  }), [positions, bench]);

  const lt3 = bench.filter((r) => monthsOnBench(r.benchDays) < 3).length;
  const gt3 = bench.filter((r) => monthsOnBench(r.benchDays) >= 3).length;

  // Confidence Overview row click → preselect position and jump to Matches tab.
  const handleSelectPositionFromOverview = (pos) => {
    setSelectedPos(pos);
    setSelectedRes(null);
    setTab("matches");
  };

  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 24px 40px" }}>
      {/* KPI strip — visible on all tabs */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 22 }}>
        <KPICard label="Open Positions" value={positions.length} />
        <KPICard label="Bench Resources" value={bench.length} />
        <KPICard label="< 3 Months Bench" value={lt3} />
        <KPICard label="> 3 Months Bench" value={gt3} />
      </div>

      {/* Tab bar — full width */}
      <div style={{ display: "flex", borderBottom: `1px solid ${C.slate200}`, marginBottom: 16 }}>
        <TabBtn label="Summary" active={tab === "summary"} onClick={() => setTab("summary")} />
        <TabBtn label="Resource Matches" active={tab === "matches"} onClick={() => setTab("matches")} />
        <TabBtn label="Confidence Overview" active={tab === "overview"} onClick={() => setTab("overview")} />
      </div>

      {/* Tab content — full width */}
      {tab === "summary" && (
        <SummaryTab positions={positions} overviewData={overviewData} />
      )}

      {tab === "matches" && (
        <ResourceMatchesTab
          positions={positions}
          bench={bench}
          selectedPos={selectedPos}
          setSelectedPos={setSelectedPos}
          selectedRes={selectedRes}
          setSelectedRes={setSelectedRes}
          benchTotals={{ lt3, gt3 }}
        />
      )}

      {tab === "overview" && (
        <ConfidenceOverviewTab
          positions={positions}
          bench={bench}
          overviewData={overviewData}
          onSelectPosition={handleSelectPositionFromOverview}
        />
      )}
    </div>
  );
}
