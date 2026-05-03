// src/pages/ResourceMatchesTab.jsx
import { useEffect, useMemo, useState, useRef } from "react";
import { C } from "../theme";
import { Card, SectionTitle, SmallBtn, SkillTag, MatchBadge, PriorityDot, GradeBadge, BenchBadge } from "../components/ui";
import { getMatchScore, monthsOnBench } from "../dataProcessor";
import { isSkillInList } from "../utils/skillUtils";
import { fetchLLMMatches } from "../utils/llmMatch";

// ─── Small shared components ────────────────────────────────

function LocationBadge({ location }) {
  if (!location) return null;
  const off = String(location).toLowerCase().includes("offshore") || location === "Offshore";
  return (
    <span style={{
      padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 500, flexShrink: 0,
      background: off ? C.teal50 : "#F0F9FF",
      color: off ? C.teal700 : "#0369A1",
      border: `1px solid ${off ? C.teal200 : "#BAE6FD"}`,
    }}>{location}</span>
  );
}

function Chevron({ open }) {
  return (
    <span style={{
      fontSize: 14, color: C.slate400, flexShrink: 0, lineHeight: 1,
      display: "inline-block",
      transform: open ? "rotate(90deg)" : "rotate(0deg)",
      transition: "transform 0.15s",
    }}>›</span>
  );
}

function AIScoreBadge({ score }) {
  const bg = score >= 80 ? "#EDE9FE" : score >= 60 ? "#FEF3C7" : "#FEE2E2";
  const color = score >= 80 ? "#5B21B6" : score >= 60 ? "#92400E" : "#991B1B";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 700, background: bg, color, flexShrink: 0 }}>✦ {score}%</span>;
}

function AIConfBadge({ level }) {
  const map = { High: { bg: "#EDE9FE", c: "#5B21B6", b: "#DDD6FE" }, Medium: { bg: "#FEF3C7", c: "#92400E", b: "#FDE68A" }, Low: { bg: "#FEE2E2", c: "#991B1B", b: "#FECACA" } };
  const x = map[level] || map.Low;
  return <span style={{ padding: "2px 8px", borderRadius: 4, fontSize: 10, fontWeight: 600, background: x.bg, color: x.c, border: `1px solid ${x.b}`, flexShrink: 0 }}>{level}</span>;
}

function ChipList({ items, color, bg, border }) {
  if (!items?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
      {items.map((s) => <span key={s} style={{ padding: "2px 8px", borderRadius: 3, fontSize: 10, fontWeight: 500, background: bg, color, border: `1px solid ${border}` }}>{s}</span>)}
    </div>
  );
}

function MatchSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <style>{`@keyframes iqpulse{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
      {[0.9, 0.7, 0.5].map((op, i) => (
        <div key={i} style={{ background: C.white, border: `1px solid ${C.slate200}`, borderRadius: 8, padding: "14px 16px", opacity: op }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
            <div style={{ width: 130, height: 13, borderRadius: 5, background: C.slate200, animation: "iqpulse 1.4s infinite" }} />
            <div style={{ width: 52, height: 20, borderRadius: 4, background: "#EDE9FE", animation: "iqpulse 1.4s infinite" }} />
            <div style={{ width: 38, height: 18, borderRadius: 3, background: C.slate100, animation: "iqpulse 1.4s infinite" }} />
          </div>
          <div style={{ width: "88%", height: 48, borderRadius: 6, background: "#F5F3FF", animation: "iqpulse 1.4s infinite", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 5 }}>
            {[65, 50, 42].map((w) => <div key={w} style={{ width: w, height: 20, borderRadius: 3, background: "#DCFCE7", animation: "iqpulse 1.4s infinite" }} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Collapsible Position Card ──────────────────────────────
// Chevron click  → toggle expand/collapse only (stopPropagation)
// Rest of header → first click selects; second click opens popup
function PosCard({ pos, isSelected, isExpanded, onToggle, onFirstClick, onSecondClick, highlightSkills }) {
  return (
    <div style={{
      background: isSelected ? C.teal50 : C.white,
      border: `1.5px solid ${isSelected ? C.teal400 : C.slate200}`,
      borderRadius: 8, overflow: "hidden", transition: "border-color 0.12s",
      boxShadow: isSelected ? `0 0 0 2px ${C.teal100}` : "none",
    }}>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 13px", cursor: "pointer", flexWrap: "nowrap" }}>
        {/* Chevron — independent toggle */}
        <span
          onClick={(e) => { e.stopPropagation(); onToggle(pos.id); }}
          style={{ flexShrink: 0 }}
        >
          <Chevron open={isExpanded} />
        </span>

        {/* Role name + badges — click to select / open popup */}
        <div
          style={{ display: "flex", alignItems: "center", gap: 7, flex: 1, minWidth: 0, flexWrap: "wrap" }}
          onClick={() => isSelected ? onSecondClick(pos) : onFirstClick(pos)}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: C.slate800, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
            {pos.role}
          </span>
          {pos.grade && <GradeBadge grade={pos.grade} />}
          <LocationBadge location={pos.location} />
          {isSelected && (
            <span style={{ fontSize: 9, fontWeight: 700, background: C.teal600, color: C.white, padding: "2px 6px", borderRadius: 3, letterSpacing: 0.5, flexShrink: 0 }}>
              SELECTED
            </span>
          )}
        </div>
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div style={{ padding: "0 13px 12px", borderTop: `1px solid ${C.slate100}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: C.slate500, margin: "9px 0 8px", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, color: C.teal700 }}>{pos.id}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.slate300, display: "inline-block" }} />
            <span>{pos.client}</span>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.slate300, display: "inline-block" }} />
            <span>{pos.aging}d aging</span>
            <PriorityDot priority={pos.priority} />
            {pos.matchScore != null && <MatchBadge score={pos.matchScore} />}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {(pos.skills || []).map((s) => <SkillTag key={s} skill={s} matched={isSkillInList(s, highlightSkills)} />)}
          </div>
          {isSelected && (
            <div style={{ marginTop: 8, fontSize: 10, color: C.teal600, fontStyle: "italic" }}>
              Click title again to open full req details →
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Collapsible Resource Card ───────────────────────────────
// Defensive layout: minHeight on BOTH wrapper and inner row so the card is
// always visibly tall regardless of which fields are populated.
function ResCard({ r, isSelected, isExpanded, onToggle, onSelect, highlightSkills, isFirst }) {
  const nameTrim = r.name?.trim();
  const displayName = nameTrim || r.id || "Unnamed Resource";
  const hasName = !!nameTrim;
  return (
    <div style={{
      background: isSelected ? C.teal50 : C.white,
      border: `1.5px solid ${isSelected ? C.teal400 : C.slate200}`,
      borderRadius: 8, overflow: "hidden", transition: "border-color 0.12s",
      minHeight: 52, // outer guarantee — card itself is always at least this tall
      flexShrink: 0, // never collapse inside a flex column
    }}>
      {/* Header row */}
      <div
        style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "14px 16px", cursor: "pointer", flexWrap: "nowrap",
          minHeight: 50, // inner guarantee
        }}
        onClick={() => { onSelect(r); onToggle(r.id); }}
      >
        <Chevron open={isExpanded} />
        <span style={{
          fontSize: 14, fontWeight: 600,
          color: hasName ? C.slate800 : C.slate500,
          fontStyle: hasName ? "normal" : "italic",
          flex: 1, minWidth: 0,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {displayName}
          {!hasName && r.id && (
            <span style={{ fontSize: 11, color: C.slate400, marginLeft: 8, fontStyle: "normal", fontWeight: 400 }}>
              (no name in data)
            </span>
          )}
        </span>
        {r.grade && <GradeBadge grade={r.grade} />}
        {r.location && <LocationBadge location={r.location} />}
        {r.score != null && <MatchBadge score={r.score} />}
        {isFirst && (
          <span style={{ fontSize: 9, fontWeight: 700, background: C.teal600, color: C.white, padding: "3px 8px", borderRadius: 3, letterSpacing: 0.5, flexShrink: 0 }}>
            BEST
          </span>
        )}
      </div>

      {/* Expanded body */}
      {isExpanded && (
        <div style={{ padding: "0 16px 14px", borderTop: `1px solid ${C.slate100}` }}>
          <div style={{ fontSize: 11, color: C.slate500, margin: "10px 0 8px" }}>
            <strong style={{ color: C.teal700, fontWeight: 600 }}>{r.id || "—"}</strong>
            {r.designation ? ` · ${r.designation}` : ""}
            {r.l3SkillFamily ? ` · ${r.l3SkillFamily}` : ""}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
            <BenchBadge benchDays={r.benchDays} />
            {r.score != null && r.matched != null && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: C.slate500 }}>
                <span>Coverage: <strong style={{ color: C.slate800 }}>{r.matched.length}/{r.total}</strong></span>
                <div style={{ width: 60, height: 4, background: C.slate200, borderRadius: 2 }}>
                  <div style={{ width: `${r.score}%`, height: 4, background: r.score >= 80 ? C.teal500 : r.score >= 60 ? C.amber : C.red, borderRadius: 2 }} />
                </div>
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {(r.skills || []).slice(0, 15).map((s) => <SkillTag key={s} skill={s} matched={isSkillInList(s, highlightSkills)} />)}
            {(r.skills || []).length > 15 && <span style={{ fontSize: 10, color: C.slate400, alignSelf: "center" }}>+{r.skills.length - 15} more</span>}
            {(!r.skills || r.skills.length === 0) && <span style={{ fontSize: 11, color: C.slate400, fontStyle: "italic" }}>No skills listed</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Data Inspector ─────────────────────────────────────────
// Shown at the top of the matches list — exposes the raw structure of the
// first matched resource so blank-card debugging is one glance away.
function DataInspector({ resource, onClose }) {
  if (!resource) return null;
  const fields = [
    ["id", resource.id],
    ["name", resource.name],
    ["grade", resource.grade],
    ["designation", resource.designation],
    ["location", resource.location],
    ["benchDays", resource.benchDays],
    ["score", resource.score],
    ["skills count", (resource.skills || []).length],
  ];
  const empties = fields.filter(([_, v]) => v == null || v === "" || v === 0).map(([k]) => k);
  return (
    <div style={{
      padding: "10px 14px", background: empties.length > 2 ? "#FEF3C7" : "#ECFEFF",
      border: `1px solid ${empties.length > 2 ? "#FDE68A" : "#A5F3FC"}`, borderRadius: 6,
      marginBottom: 8, fontSize: 11, fontFamily: "monospace",
      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8,
    }}>
      <div style={{ flex: 1, overflow: "hidden" }}>
        <strong style={{ color: empties.length > 2 ? "#92400E" : "#0E7490" }}>
          {empties.length > 2 ? "⚠ Data check (first match):" : "✓ Data check (first match):"}
        </strong>
        <div style={{ marginTop: 3, display: "flex", flexWrap: "wrap", gap: 8 }}>
          {fields.map(([k, v]) => (
            <span key={k} style={{ color: (v == null || v === "") ? "#DC2626" : "#1E293B" }}>
              {k}=<strong>{v == null || v === "" ? "(empty)" : String(v).slice(0, 24)}</strong>
            </span>
          ))}
        </div>
      </div>
      <button onClick={onClose} title="Hide data check" style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 14, fontFamily: "inherit", flexShrink: 0 }}>✕</button>
    </div>
  );
}

// ─── AI Resource Card (collapsible) ─────────────────────────
function AIResCard({ match, position, isFirst }) {
  const [open, setOpen] = useState(true);
  const { resource: r, score, confidence, reasoning, strengths, gaps } = match;
  const displayName = r ? (r.name || r.id || "Unknown") : match.id;
  if (!r) return (
    <div style={{ background: C.white, border: `1px solid ${C.slate200}`, borderRadius: 8, padding: "12px 14px", opacity: 0.6 }}>
      <span style={{ fontSize: 12, color: C.slate500 }}>Resource {match.id} not found in current bench</span>
    </div>
  );
  return (
    <div style={{ border: `1.5px solid ${isFirst ? "#A78BFA" : C.slate200}`, borderRadius: 8, background: C.white, overflow: "hidden", position: "relative" }}>
      {isFirst && (
        <div style={{ position: "absolute", top: 0, right: 0, background: "linear-gradient(135deg,#7C3AED,#5B21B6)", color: "#fff", fontSize: 9, fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase", padding: "3px 10px", borderRadius: "0 7px 0 8px" }}>
          AI Top Pick
        </div>
      )}
      <div
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "11px 13px", cursor: "pointer", flexWrap: "nowrap" }}
        onClick={() => setOpen((o) => !o)}
      >
        <Chevron open={open} />
        <span style={{ fontSize: 13, fontWeight: 600, color: C.slate800, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayName}
        </span>
        <AIScoreBadge score={score} />
        <AIConfBadge level={confidence} />
        {r.grade && <GradeBadge grade={r.grade} />}
        <LocationBadge location={r.location} />
      </div>
      {open && (
        <div style={{ padding: "0 13px 12px", borderTop: `1px solid ${C.slate100}` }}>
          <div style={{ fontSize: 11, color: C.slate500, margin: "9px 0 8px" }}>
            {r.id}{r.designation ? ` · ${r.designation}` : ""}
          </div>
          <BenchBadge benchDays={r.benchDays} />
          <div style={{ padding: "10px 13px", background: "#F5F3FF", borderRadius: 6, border: "1px solid #DDD6FE", margin: "10px 0 8px" }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: "#6D28D9", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>AI Reasoning</div>
            <div style={{ fontSize: 12, color: C.slate700, lineHeight: 1.6 }}>{reasoning}</div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 8 }}>
            {strengths?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#166534", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>✓ Strengths</div>
                <ChipList items={strengths} color="#166534" bg="#DCFCE7" border="#BBF7D0" />
              </div>
            )}
            {gaps?.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#991B1B", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 }}>△ Gaps</div>
                <ChipList items={gaps} color="#991B1B" bg="#FEE2E2" border="#FECACA" />
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {(r.skills || []).slice(0, 12).map((s) => <SkillTag key={s} skill={s} matched={isSkillInList(s, position?.skills || [])} />)}
            {(r.skills || []).length > 12 && <span style={{ fontSize: 10, color: C.slate400, alignSelf: "center" }}>+{r.skills.length - 12} more</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Req Detail Popup ────────────────────────────────────────
function ReqDetailPopup({ pos, onClose }) {
  const [jd, setJd] = useState("");
  const [rmgNote, setRmgNote] = useState("");
  const [activeAction, setActiveAction] = useState(null);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.52)", zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(3px)" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: C.white, borderRadius: 14, width: "min(900px, 96vw)", maxHeight: "88vh", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.24)" }}>
        {/* Header */}
        <div style={{ padding: "18px 26px", borderBottom: `1px solid ${C.slate200}`, background: C.slate700, color: C.white, borderRadius: "14px 14px 0 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>{pos.role}</div>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 5, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, color: C.slate300 }}>{pos.id}</span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.slate500, display: "inline-block" }} />
                <span style={{ fontSize: 12, color: C.slate300 }}>{pos.client}</span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: C.slate500, display: "inline-block" }} />
                <span style={{ fontSize: 12, color: C.slate300 }}>Aging: {pos.aging}d</span>
                {pos.grade && <GradeBadge grade={pos.grade} />}
                <LocationBadge location={pos.location} />
                <PriorityDot priority={pos.priority} />
              </div>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", color: C.slate300, fontSize: 22, cursor: "pointer", lineHeight: 1, padding: "0 0 0 12px" }}>✕</button>
          </div>
        </div>
        {/* Body — two columns */}
        <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", flex: 1, minHeight: 0, overflow: "hidden" }}>
          {/* Left — actions */}
          <div style={{ padding: "20px 18px", borderRight: `1px solid ${C.slate200}`, overflowY: "auto", background: C.slate50, display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: C.slate500, marginBottom: 8 }}>Actions</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                <button onClick={() => setActiveAction(activeAction === "rmg" ? null : "rmg")}
                  style={{ padding: "10px 14px", borderRadius: 7, border: `1.5px solid ${activeAction === "rmg" ? C.teal500 : C.teal300}`, background: activeAction === "rmg" ? C.teal600 : C.white, color: activeAction === "rmg" ? C.white : C.teal700, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
                  <span style={{ fontSize: 15 }}>📬</span> Contact RMG
                </button>
                {activeAction === "rmg" && (
                  <div style={{ padding: "10px 12px", background: C.white, border: `1px solid ${C.teal200}`, borderRadius: 7 }}>
                    <textarea value={rmgNote} onChange={(e) => setRmgNote(e.target.value)}
                      placeholder={`Hi RMG,\n\nFollowing up on req ${pos.id} — ${pos.role} for ${pos.client}.\n\nPlease advise on bench resource availability...`}
                      rows={5} style={{ width: "100%", padding: "8px 10px", borderRadius: 5, border: `1px solid ${C.slate200}`, fontSize: 11, fontFamily: "inherit", resize: "vertical", outline: "none", color: C.slate700 }} />
                    <button onClick={() => { alert(`RMG message logged:\n\n${rmgNote || "(empty)"}`); setActiveAction(null); }}
                      style={{ marginTop: 7, padding: "5px 12px", borderRadius: 5, border: "none", background: C.teal600, color: C.white, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Send</button>
                  </div>
                )}
                <button onClick={() => setActiveAction(activeAction === "candidates" ? null : "candidates")}
                  style={{ padding: "10px 14px", borderRadius: 7, border: `1.5px solid ${activeAction === "candidates" ? "#7C3AED" : "#A78BFA"}`, background: activeAction === "candidates" ? "#7C3AED" : C.white, color: activeAction === "candidates" ? C.white : "#5B21B6", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", textAlign: "left", display: "flex", alignItems: "center", gap: 8, transition: "all 0.15s" }}>
                  <span style={{ fontSize: 15 }}>🔍</span> Potential Candidates
                </button>
                {activeAction === "candidates" && (
                  <div style={{ padding: "10px 12px", background: C.white, border: "1px solid #DDD6FE", borderRadius: 7 }}>
                    <div style={{ fontSize: 11, color: C.slate500, lineHeight: 1.6, marginBottom: 8 }}>Search external ATS or sourcing platforms for candidates matching this role.</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                      <button style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #DDD6FE", background: "#EDE9FE", color: "#5B21B6", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Open in ATS</button>
                      <button style={{ padding: "4px 10px", borderRadius: 4, border: "1px solid #DDD6FE", background: "#EDE9FE", color: "#5B21B6", fontSize: 10, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>LinkedIn</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: C.slate500, marginBottom: 7 }}>Required Skills</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {(pos.skills || []).map((s) => <SkillTag key={s} skill={s} matched={false} />)}
                {(!pos.skills || pos.skills.length === 0) && <span style={{ fontSize: 11, color: C.slate400, fontStyle: "italic" }}>No skills specified</span>}
              </div>
            </div>
            {(pos.high != null) && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: C.slate500, marginBottom: 7 }}>Match Confidence</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  {[{ l: "High (80%+)", v: pos.high, c: C.green600, bg: C.green100 }, { l: "Medium (60–79%)", v: pos.medium, c: "#92400E", bg: C.amberLt }, { l: "Low (40–59%)", v: pos.low, c: "#991B1B", bg: C.red100 }].map((m) => (
                    <div key={m.l} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", borderRadius: 5, background: m.bg }}>
                      <span style={{ fontSize: 10, fontWeight: 500, color: m.c }}>{m.l}</span>
                      <span style={{ fontSize: 14, fontWeight: 700, color: m.c, fontFamily: "'Outfit'" }}>{m.v ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {/* Right — JD */}
          <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.slate800 }}>Job Description</div>
              <span style={{ fontSize: 10, background: C.amberLt, color: "#92400E", border: `1px solid #FDE68A`, padding: "2px 8px", borderRadius: 4, fontWeight: 600 }}>Awaiting JD</span>
            </div>
            <textarea value={jd} onChange={(e) => setJd(e.target.value)}
              placeholder={`Paste or type the job description for ${pos.role} here...\n\nYou can include:\n• Role overview & responsibilities\n• Mandatory skills & qualifications\n• Nice-to-have skills\n• Years of experience required\n• Client-specific requirements`}
              style={{ flex: 1, minHeight: 300, width: "100%", padding: "14px 16px", borderRadius: 9, border: `1.5px dashed ${jd ? C.teal300 : C.slate300}`, fontSize: 13, fontFamily: "inherit", lineHeight: 1.8, color: C.slate700, outline: "none", resize: "none", background: jd ? C.teal50 : C.slate50, transition: "all 0.15s" }}
              onFocus={(e) => { e.target.style.borderColor = C.teal400; e.target.style.borderStyle = "solid"; }}
              onBlur={(e) => { e.target.style.borderColor = jd ? C.teal300 : C.slate300; e.target.style.borderStyle = "dashed"; }}
            />
            {jd && (
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                <button onClick={() => alert("JD saved (session only)")} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: C.teal600, color: C.white, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>Save JD</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Main component
// ════════════════════════════════════════════════════════════
export default function ResourceMatchesTab({
  positions, bench, selectedPos, setSelectedPos, selectedRes, setSelectedRes, benchTotals,
}) {
  // ── Filter state ──
  const [posSearch, setPosSearch] = useState("");
  const [posLocFilter, setPosLocFilter] = useState("all");
  const [resSearch, setResSearch] = useState("");
  const [resLocFilter, setResLocFilter] = useState("all");
  const [benchTenure, setBenchTenure] = useState("all");
  const [minScore, setMinScore] = useState(40);

  // ── Collapse state (Set of expanded IDs) ──
  const [expandedPos, setExpandedPos] = useState(new Set());
  const [expandedRes, setExpandedRes] = useState(new Set());

  // ── Popup ──
  const [popupPos, setPopupPos] = useState(null);

  // ── AI state ──
  const [llm, setLlm] = useState({ status: "idle", data: null, error: null });
  const [resultMode, setResultMode] = useState("algorithmic");

  // ── Data inspector toggle ──
  const [showInspector, setShowInspector] = useState(true);

  const selectedCardRef = useRef(null);

  // Reset AI state when position changes
  useEffect(() => {
    setLlm({ status: "idle", data: null, error: null });
    setResultMode("algorithmic");
    setShowInspector(true); // re-show inspector for newly selected position
  }, [selectedPos?.id]);

  // Auto-expand + scroll selected position card into view
  useEffect(() => {
    if (selectedPos) {
      setExpandedPos((prev) => new Set([...prev, selectedPos.id]));
      setTimeout(() => selectedCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }), 80);
    }
  }, [selectedPos?.id]);

  // ── Filtered bench ──
  // Shore filter: if a position is selected, lock to its shore — but if the
  // position has no location field (some legacy/incomplete reqs), DON'T filter
  // by shore (otherwise the matches view goes empty even though Confidence
  // Overview promised matches existed).
  const filteredBench = useMemo(() => bench.filter((r) => {
    const ms = !resSearch || String(r.name || r.id || "").toLowerCase().includes(resSearch.toLowerCase()) || String(r.id || "").toLowerCase().includes(resSearch.toLowerCase());
    const posShore = selectedPos ? String(selectedPos.location || "").toLowerCase() : "";
    const shore = selectedPos ? (posShore || "all") : resLocFilter;
    const ml = shore === "all" || String(r.location || "").toLowerCase() === shore;
    const mt = benchTenure === "all" || (benchTenure === "lt3" ? monthsOnBench(r.benchDays) < 3 : monthsOnBench(r.benchDays) >= 3);
    return ms && ml && mt;
  }), [bench, resSearch, resLocFilter, benchTenure, selectedPos]);

  // ── Reverse lookup (resource → matching positions) ──
  const positionsForResource = useMemo(() => {
    if (!selectedRes) return null;
    return positions
      .filter((p) => String(p.location || "").toLowerCase() === String(selectedRes.location || "").toLowerCase())
      .map((p) => { const m = getMatchScore(p.skills, selectedRes.skills); return { ...p, matchScore: m.score, matchedSkills: m.matched }; })
      .filter((p) => p.matchScore >= minScore)
      .sort((a, b) => b.matchScore - a.matchScore);
  }, [selectedRes, positions, minScore]);

  // ── Filtered positions ──
  const filteredPositions = useMemo(() => {
    const base = positionsForResource || positions;
    return base.filter((p) => {
      const ms = !posSearch
        || String(p.id || "").toLowerCase().includes(posSearch.toLowerCase())
        || String(p.role || "").toLowerCase().includes(posSearch.toLowerCase())
        || String(p.client || "").toLowerCase().includes(posSearch.toLowerCase());
      const ml = posLocFilter === "all" || String(p.location || "").toLowerCase() === posLocFilter;
      return ms && ml;
    });
  }, [positions, positionsForResource, posSearch, posLocFilter]);

  // ── Matched resources for selected position ──
  const matchesForPosition = useMemo(() => {
    if (!selectedPos) return [];
    return filteredBench
      .map((r) => { const m = getMatchScore(selectedPos.skills, r.skills); return { ...r, score: m.score, matched: m.matched, total: m.total }; })
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score);
  }, [selectedPos, filteredBench, minScore]);

  // Debug: log match diagnostics on every selection change
  useEffect(() => {
    if (!selectedPos) return;
    const totalBench = bench.length;
    const afterShoreFilter = filteredBench.length;
    const matchCount = matchesForPosition.length;
    if (matchCount > 0) {
      console.log(`[Matches] ${selectedPos.role} (${selectedPos.id}) → ${matchCount} matches at ≥${minScore}% from ${afterShoreFilter}/${totalBench} bench.`, "First:", matchesForPosition[0]);
    } else {
      console.warn(`[Matches] ${selectedPos.role} (${selectedPos.id}) → 0 matches.`,
        `posLocation="${selectedPos.location}", reqSkills=[${(selectedPos.skills || []).join(", ")}], filteredBench=${afterShoreFilter}/${totalBench}, minScore=${minScore}, tenure=${benchTenure}`);
    }
  }, [matchesForPosition, selectedPos, filteredBench, bench, minScore, benchTenure]);

  // ── Toggle helpers ──
  const togglePosExpand = (id) => setExpandedPos((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleResExpand = (id) => setExpandedRes((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ── Selection handlers ──
  const handleFirstClick = (pos) => {
    setSelectedPos(pos);
    setSelectedRes(null);
    setExpandedPos((prev) => new Set([...prev, pos.id]));
  };
  const handleSelectResource = (res) => { setSelectedRes(res); setSelectedPos(null); };

  // ── AI match ──
  const triggerLLMMatch = async () => {
    if (!selectedPos || !filteredBench.length) return;
    setLlm({ status: "loading", data: null, error: null });
    setResultMode("ai");
    try {
      const result = await fetchLLMMatches(selectedPos, filteredBench);
      setLlm({ status: "done", data: result, error: null });
    } catch (err) {
      setLlm({ status: "error", data: null, error: err.message || "Unknown error" });
      setResultMode("algorithmic");
    }
  };

  const highlightSkillsForPos = selectedRes ? (selectedRes.skills || []) : [];
  const highlightSkillsForRes = selectedPos ? (selectedPos.skills || []) : [];
  const lt3 = benchTotals?.lt3 ?? bench.filter((r) => monthsOnBench(r.benchDays) < 3).length;
  const gt3 = benchTotals?.gt3 ?? bench.filter((r) => monthsOnBench(r.benchDays) >= 3).length;

  // Shared input style
  const inputStyle = { width: "100%", padding: "9px 12px 9px 32px", borderRadius: 7, border: `1px solid ${C.slate200}`, fontSize: 12, fontFamily: "inherit", color: C.slate800, outline: "none", background: C.white };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 18, alignItems: "start" }}>
      {popupPos && <ReqDetailPopup pos={popupPos} onClose={() => setPopupPos(null)} />}

      {/* ═══════════════════ LEFT — Open Positions ═══════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 280px)", minHeight: 400 }}>
        {/* Fixed header / filters */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <SectionTitle style={{ marginBottom: 0 }}>
              {selectedRes ? "Matching Requisitions" : "Open Positions"}
            </SectionTitle>
            {selectedRes && (
              <button onClick={() => setSelectedRes(null)} style={{ fontSize: 11, color: C.teal600, fontWeight: 500, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit" }}>Clear</button>
            )}
          </div>

          {/* Job search */}
          <div style={{ position: "relative", marginBottom: 8 }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.slate400, pointerEvents: "none" }}>🔍</span>
            <input value={posSearch} onChange={(e) => setPosSearch(e.target.value)} placeholder="Search Req ID, role, or client..." style={inputStyle}
              onFocus={(e) => (e.target.style.borderColor = C.teal400)} onBlur={(e) => (e.target.style.borderColor = C.slate200)} />
          </div>

          <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
            {[{ k: "all", l: "All" }, { k: "offshore", l: "Offshore" }, { k: "onshore", l: "Onshore" }].map((f) => (
              <SmallBtn key={f.k} label={f.l} active={posLocFilter === f.k} onClick={() => setPosLocFilter(f.k)} />
            ))}
            <span style={{ fontSize: 11, color: C.slate400, marginLeft: "auto" }}>{filteredPositions.length} reqs</span>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
            <button onClick={() => setExpandedPos(new Set(filteredPositions.map((p) => p.id)))} style={{ fontSize: 10, color: C.teal600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Expand all</button>
            <button onClick={() => setExpandedPos(new Set())} style={{ fontSize: 10, color: C.slate400, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Collapse all</button>
          </div>
        </div>

        {/* Scrollable position cards */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 6 }}>
          {filteredPositions.length === 0 && (
            <div style={{ textAlign: "center", padding: "28px 16px", color: C.slate400, fontSize: 12 }}>
              {selectedRes ? "No requisitions match this resource" : "No positions loaded — upload TA data"}
            </div>
          )}
          {filteredPositions.map((pos) => (
            <div key={pos.id} ref={selectedPos?.id === pos.id ? selectedCardRef : null}>
              <PosCard
                pos={pos}
                isSelected={selectedPos?.id === pos.id}
                isExpanded={expandedPos.has(pos.id)}
                onToggle={togglePosExpand}
                onFirstClick={handleFirstClick}
                onSecondClick={(p) => setPopupPos(p)}
                highlightSkills={highlightSkillsForPos}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ═══════════════════ RIGHT — Resources / Matches ═══════════════════ */}
      <div style={{ display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 280px)", minHeight: 400 }}>
        {/* Fixed resource filters */}
        <div style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: "1 1 180px" }}>
              <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: C.slate400, pointerEvents: "none" }}>👤</span>
              <input value={resSearch} onChange={(e) => setResSearch(e.target.value)} placeholder="Search resource by name or ID..." style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = C.teal400)} onBlur={(e) => (e.target.style.borderColor = C.slate200)} />
            </div>
            <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
              {[{ k: "all", l: "All" }, { k: "offshore", l: "Offshore" }, { k: "onshore", l: "Onshore" }].map((f) => (
                <SmallBtn key={f.k} label={f.l} active={resLocFilter === f.k} onClick={() => setResLocFilter(f.k)} />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 10, color: C.slate400, fontWeight: 500 }}>Tenure:</span>
            <SmallBtn label={`All (${bench.length})`} active={benchTenure === "all"} onClick={() => setBenchTenure("all")} />
            <SmallBtn label={`<3mo (${lt3})`} active={benchTenure === "lt3"} onClick={() => setBenchTenure("lt3")} />
            <SmallBtn label={`>3mo (${gt3})`} active={benchTenure === "gt3"} onClick={() => setBenchTenure("gt3")} />
            <span style={{ width: 1, height: 16, background: C.slate200, margin: "0 4px" }} />
            <span style={{ fontSize: 10, color: C.slate400, fontWeight: 500 }}>Min:</span>
            {[40, 60, 80].map((v) => <SmallBtn key={v} label={`${v}%+`} active={minScore === v} onClick={() => setMinScore(v)} />)}
            <span style={{ fontSize: 11, color: C.slate400, marginLeft: "auto" }}>{filteredBench.length} resources</span>
          </div>
        </div>

        {/* ── Mode A: Position selected → show matching resources ── */}
        {selectedPos && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            {/* Sub-header + AI controls */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 6, flexWrap: "wrap", flexShrink: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.slate700 }}>
                {selectedPos.role} <span style={{ color: C.slate400, fontWeight: 400 }}>({selectedPos.id})</span>
                <span style={{ fontSize: 11, color: C.slate400, fontWeight: 400, marginLeft: 8 }}>
                  {matchesForPosition.length} match{matchesForPosition.length !== 1 ? "es" : ""}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                {llm.status === "done" && (
                  <div style={{ display: "flex", background: C.slate100, borderRadius: 6, padding: 2 }}>
                    {[{ k: "algorithmic", l: "Algo" }, { k: "ai", l: "✦ AI" }].map((m) => (
                      <button key={m.k} onClick={() => setResultMode(m.k)} style={{ padding: "3px 10px", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", border: "none", background: resultMode === m.k ? (m.k === "ai" ? "#7C3AED" : C.teal600) : "transparent", color: resultMode === m.k ? C.white : C.slate500, transition: "all 0.12s" }}>{m.l}</button>
                    ))}
                  </div>
                )}
                {(llm.status === "idle" || llm.status === "error") && (
                  <button onClick={triggerLLMMatch} disabled={!filteredBench.length}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 6, border: "1px solid #A78BFA", background: "#EDE9FE", color: "#5B21B6", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "#7C3AED"; e.currentTarget.style.color = C.white; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = "#EDE9FE"; e.currentTarget.style.color = "#5B21B6"; }}>
                    ✦ Match with AI
                  </button>
                )}
                {llm.status === "loading" && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 6, background: "#EDE9FE", border: "1px solid #A78BFA" }}>
                    <svg width="13" height="13" viewBox="0 0 14 14" style={{ animation: "iqspin 0.9s linear infinite" }}>
                      <circle cx="7" cy="7" r="5" stroke="#A78BFA" strokeWidth="2" fill="none" strokeDasharray="20" strokeLinecap="round" />
                    </svg>
                    <style>{`@keyframes iqspin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                    <span style={{ fontSize: 11, fontWeight: 600, color: "#5B21B6" }}>Analysing…</span>
                  </div>
                )}
                <button onClick={() => setSelectedPos(null)} style={{ fontSize: 11, color: C.slate500, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Clear</button>
              </div>
            </div>

            {llm.status === "error" && (
              <div style={{ padding: "8px 12px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 6, marginBottom: 8, fontSize: 11, color: "#991B1B", flexShrink: 0 }}>
                <strong>AI match failed:</strong> {llm.error}
              </div>
            )}

            {/* Expand/collapse for algorithmic results */}
            {resultMode === "algorithmic" && matchesForPosition.length > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 6, flexShrink: 0 }}>
                <button onClick={() => setExpandedRes(new Set(matchesForPosition.map((r) => r.id)))} style={{ fontSize: 10, color: C.teal600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Expand all</button>
                <button onClick={() => setExpandedRes(new Set())} style={{ fontSize: 10, color: C.slate400, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Collapse all</button>
              </div>
            )}

            {/* Scrollable results */}
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              {/* AI loading skeleton */}
              {resultMode === "ai" && llm.status === "loading" && <MatchSkeleton />}

              {/* AI results */}
              {resultMode === "ai" && llm.status === "done" && llm.data && (
                <>
                  <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: "12px 16px", marginBottom: 4 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 5 }}>
                      <span style={{ fontSize: 14 }}>✦</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#5B21B6", textTransform: "uppercase", letterSpacing: 0.8 }}>Claude AI Analysis</span>
                      <span style={{ fontSize: 9, color: "#7C3AED", background: "#EDE9FE", padding: "2px 6px", borderRadius: 3, fontWeight: 500 }}>claude-sonnet-4</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.slate700, lineHeight: 1.65, marginBottom: llm.data.recommendation ? 7 : 0 }}>{llm.data.summary}</p>
                    {llm.data.recommendation && <div style={{ borderTop: "1px solid #DDD6FE", paddingTop: 6, fontSize: 12, color: "#5B21B6", fontWeight: 500 }}>💡 {llm.data.recommendation}</div>}
                  </div>
                  {llm.data.matches.length === 0
                    ? <div style={{ textAlign: "center", padding: "32px 16px", color: C.slate400, fontSize: 13 }}>AI found no matches above threshold</div>
                    : llm.data.matches.map((m, i) => <AIResCard key={m.id} match={m} position={selectedPos} isFirst={i === 0} />)
                  }
                </>
              )}

              {/* Algorithmic results */}
              {(resultMode === "algorithmic" || (resultMode === "ai" && llm.status === "idle")) && (
                matchesForPosition.length === 0
                  ? (
                    <div style={{ textAlign: "center", padding: "32px 16px", color: C.slate400, fontSize: 13 }}>
                      No bench resources match {selectedPos.role} at {minScore}%+
                      <div style={{ fontSize: 11, marginTop: 6, color: C.slate300 }}>Try lowering the Min% filter or changing the tenure filter</div>
                    </div>
                  )
                  : (
                    <>
                      {showInspector && <DataInspector resource={matchesForPosition[0]} onClose={() => setShowInspector(false)} />}
                      {matchesForPosition.map((r, ri) => (
                        <ResCard
                          key={r.id} r={r}
                          isSelected={false}
                          isExpanded={expandedRes.has(r.id)}
                          onToggle={toggleResExpand}
                          onSelect={() => {}}
                          highlightSkills={highlightSkillsForRes}
                          isFirst={ri === 0}
                        />
                      ))}
                    </>
                  )
              )}
            </div>
          </div>
        )}

        {/* ── Mode B: No position selected → resource browser ── */}
        {!selectedPos && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div style={{ flexShrink: 0, marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: C.slate600, marginBottom: 4 }}>
                {selectedRes ? `Matched positions for ${selectedRes.name || selectedRes.id} shown on the left` : "← Select a position to see matches, or click a resource for reverse lookup"}
              </div>
              {filteredBench.length > 0 && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setExpandedRes(new Set(filteredBench.map((r) => r.id)))} style={{ fontSize: 10, color: C.teal600, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Expand all</button>
                  <button onClick={() => setExpandedRes(new Set())} style={{ fontSize: 10, color: C.slate400, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" }}>Collapse all</button>
                </div>
              )}
            </div>
            <div style={{ flex: 1, overflowY: "auto", paddingRight: 4, display: "flex", flexDirection: "column", gap: 6 }}>
              {filteredBench.length === 0 && (
                <div style={{ textAlign: "center", padding: "28px 16px", color: C.slate400, fontSize: 12 }}>No bench resources found — upload MSD + Bench ID files</div>
              )}
              {filteredBench.map((r) => (
                <ResCard
                  key={r.id} r={r}
                  isSelected={selectedRes?.id === r.id}
                  isExpanded={expandedRes.has(r.id)}
                  onToggle={toggleResExpand}
                  onSelect={handleSelectResource}
                  highlightSkills={[]}
                  isFirst={false}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
