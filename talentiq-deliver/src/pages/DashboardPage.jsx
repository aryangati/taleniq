// src/pages/DashboardPage.jsx
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer, LabelList,
} from "recharts";
import { C } from "../theme";
import {
  Card, SectionTitle, KPICard, ChartTooltip, renderBarLabel, heatColor, heatText,
} from "../components/ui";

export default function DashboardPage({ data: d }) {
  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "24px 24px 40px" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: C.slate400 }}>
          {d.activeDb
            ? <span style={{ color: C.teal600, fontWeight: 500 }}>{d.activeDb.length} active reqs loaded</span>
            : <span>Upload TA file for live metrics</span>}
        </div>
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <KPICard
          label="Total Active Positions"
          value={d.kpis.totalActive}
          sub={`Off ${d.kpis.offOpen + d.kpis.offOffered} · On ${d.kpis.onOpen + d.kpis.onOffered}`}
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: "1 1 0", minWidth: 135 }}>
          <div style={{
            background: C.white, borderRadius: 8, padding: "12px 20px 10px",
            border: `1px solid ${C.slate200}`, borderTop: `3px solid ${C.teal600}`, flex: 1,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: C.slate500, marginBottom: 4 }}>Open Positions</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 400, color: C.slate800, fontFamily: "'Outfit'" }}>{d.kpis.open}</span>
              <span style={{ fontSize: 10, color: C.slate400 }}>Off {d.kpis.offOpen} · On {d.kpis.onOpen}</span>
            </div>
          </div>
          <div style={{
            background: C.white, borderRadius: 8, padding: "12px 20px 10px",
            border: `1px solid ${C.slate200}`, borderTop: `3px solid ${C.offered}`, flex: 1,
          }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: C.slate500, marginBottom: 4 }}>Offered Positions</div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span style={{ fontSize: 26, fontWeight: 400, color: C.slate800, fontFamily: "'Outfit'" }}>{d.kpis.offered}</span>
              <span style={{ fontSize: 10, color: C.slate400 }}>Off {d.kpis.offOffered} · On {d.kpis.onOffered}</span>
            </div>
          </div>
        </div>
        <KPICard label="New Reqs WTD" value={d.kpis.newReqs} sub="Open, Age ≤ 10 days" />
        <KPICard label="Avg Aging (Days)" value={d.kpis.avgAging} sub={`Off ${d.kpis.offAging} · On ${d.kpis.onAging}`} />
      </div>

      {/* Bar charts row — Status by Client gets 2/3 width (more room for labels);
          Aging Pipeline takes 1/3 since it only has 5 buckets */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18, marginTop: 22 }}>
        <Card>
          <SectionTitle>Status by Client — Open vs Offered</SectionTitle>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart
              data={d.clientBar.map((c) => ({ ...c, _total: (c.Open || 0) + (c.Offered || 0) }))}
              barCategoryGap="22%"
              margin={{ top: 12, right: 12, left: 0, bottom: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate200} vertical={false} />
              <XAxis
                dataKey="name"
                axisLine={{ stroke: C.slate200 }}
                tickLine={false}
                interval={0}
                height={42}
                // Custom tick: wraps client names on spaces or hyphens so long
                // names like "PNC Bank", "American Honda", "Hi-Tech_Internal",
                // "Walgreens-Boots" render on two stacked lines instead of
                // overlapping their neighbours.
                tick={({ x, y, payload }) => {
                  // Split on whitespace OR hyphens; keep tokens non-empty.
                  // Underscores are also treated as separators since they
                  // appear in some client identifiers (e.g. "Hi-Tech_Internal").
                  const tokens = String(payload.value || "")
                    .split(/[\s\-_]+/)
                    .filter(Boolean);
                  // Squash to max 2 lines: if 3+ tokens, last line keeps the rest joined
                  const lines = tokens.length <= 1
                    ? [tokens[0] || ""]
                    : [tokens[0], tokens.slice(1).join(" ")];
                  return (
                    <g transform={`translate(${x},${y})`}>
                      {lines.map((line, i) => (
                        <text
                          key={i}
                          x={0}
                          y={i * 11}
                          dy={10}
                          textAnchor="middle"
                          fill={C.slate500}
                          fontSize={9.5}
                          fontFamily="'Outfit',sans-serif"
                        >{line}</text>
                      ))}
                    </g>
                  );
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: C.slate500 }}
                axisLine={false}
                tickLine={false}
                label={{ value: "Positions", angle: -90, position: "insideLeft", offset: 4, style: { fontSize: 10, fill: C.slate400 } }}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 0 }} />
              {/* Stacked: Open at the bottom, Offered on top.
                  Each segment shows its own count in white bold (only if tall enough). */}
              <Bar dataKey="Open" stackId="a" fill={C.teal600} radius={[0, 0, 0, 0]}>
                <LabelList
                  dataKey="Open"
                  content={({ x, y, width, height, value }) => {
                    if (!value || height < 14) return null;
                    return (
                      <text
                        x={x + width / 2}
                        y={y + height / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#FFFFFF"
                        fontSize={11}
                        fontWeight={700}
                        fontFamily="'Outfit',sans-serif"
                        style={{ pointerEvents: "none" }}
                      >{value}</text>
                    );
                  }}
                />
              </Bar>
              <Bar dataKey="Offered" stackId="a" fill={C.offered} radius={[3, 3, 0, 0]}>
                <LabelList
                  dataKey="Offered"
                  content={({ x, y, width, height, value }) => {
                    if (!value || height < 14) return null;
                    return (
                      <text
                        x={x + width / 2}
                        y={y + height / 2}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill="#FFFFFF"
                        fontSize={11}
                        fontWeight={700}
                        fontFamily="'Outfit',sans-serif"
                        style={{ pointerEvents: "none" }}
                      >{value}</text>
                    );
                  }}
                />
                {/* Total floating above the entire stacked bar.
                    Positioned at the top of the Offered segment (which is the topmost segment). */}
                <LabelList
                  dataKey="_total"
                  content={({ x, y, width, value }) => {
                    if (!value) return null;
                    return (
                      <text
                        x={x + width / 2}
                        y={y - 6}
                        textAnchor="middle"
                        fill={C.slate700}
                        fontSize={11}
                        fontWeight={700}
                        fontFamily="'Outfit',sans-serif"
                        style={{ pointerEvents: "none" }}
                      >{value}</text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle>Aging Pipeline Distribution</SectionTitle>
          <ResponsiveContainer width="100%" height={290}>
            <BarChart data={d.agingPipeline} barCategoryGap="22%" margin={{ top: 16, right: 8, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate200} vertical={false} />
              <XAxis
                dataKey="bucket"
                tick={{ fontSize: 9.5, fill: C.slate500 }}
                axisLine={{ stroke: C.slate200 }}
                tickLine={false}
                interval={0}
                height={28}
              />
              <YAxis tick={{ fontSize: 10, fill: C.slate500 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,0,0,0.03)" }} />
              <Bar dataKey="value" name="Positions" radius={[3, 3, 0, 0]}>
                {d.agingPipeline.map((e, i) => <Cell key={i} fill={e.color} />)}
                <LabelList
                  dataKey="value"
                  content={({ x, y, width, height, value }) => {
                    if (!value) return null;
                    // For tall enough bars: white inside; for tiny bars: slate above
                    if (height >= 16) {
                      return (
                        <text x={x + width / 2} y={y + 14} textAnchor="middle" fill="#FFFFFF" fontSize={11} fontWeight={700} fontFamily="'Outfit',sans-serif" style={{ pointerEvents: "none" }}>{value}</text>
                      );
                    }
                    return (
                      <text x={x + width / 2} y={y - 5} textAnchor="middle" fill={C.slate500} fontSize={10} fontWeight={600} fontFamily="'Outfit',sans-serif">{value}</text>
                    );
                  }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Heatmap */}
      <div style={{ marginTop: 22 }}>
        <SectionTitle>Aging Heatmap — Positions by Client & Bucket</SectionTitle>
        <Card style={{ padding: 0, overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, fontFamily: "'Outfit',sans-serif" }}>
            <thead>
              <tr style={{ background: C.slate700, color: C.white }}>
                <th style={{
                  padding: "9px 14px", textAlign: "left", fontWeight: 500, position: "sticky",
                  left: 0, background: C.slate700, zIndex: 2, borderRight: `1px solid ${C.slate600}`,
                }} rowSpan={2}>Client</th>
                {["Pre-approved", "1–30 days", "31–60 days", "61–90 days", "91+ days"].map((h) => (
                  <th key={h} colSpan={3} style={{
                    padding: "9px 6px 4px", textAlign: "center", fontWeight: 500,
                    borderLeft: `1px solid ${C.slate600}`, fontSize: 10.5,
                  }}>{h}</th>
                ))}
              </tr>
              <tr style={{ background: C.slate600, color: C.slate300 }}>
                {[...Array(5)].flatMap((_, i) =>
                  ["Off", "On", "All"].map((s) => (
                    <th key={`${i}-${s}`} style={{
                      padding: "5px 6px", textAlign: "center", fontWeight: 400, fontSize: 9.5,
                      borderLeft: s === "Off" ? `1px solid ${C.slate500}` : "none",
                    }}>{s}</th>
                  ))
                )}
              </tr>
            </thead>
            <tbody>
              {d.heatmap.map((row, ri) => {
                const keys = ["pre", "d30", "d60", "d90", "p90"];
                return (
                  <tr key={ri}
                    style={{ background: ri % 2 === 0 ? C.white : C.slate50 }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.slate100)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = ri % 2 === 0 ? C.white : C.slate50)}
                  >
                    <td style={{
                      padding: "8px 14px", fontWeight: 500, color: C.slate700, position: "sticky",
                      left: 0, background: "inherit", zIndex: 1,
                      borderRight: `1px solid ${C.slate200}`, whiteSpace: "nowrap",
                    }}>{row.client}</td>
                    {keys.flatMap((k) =>
                      ["Off", "On", "T"].map((s) => {
                        const v = row[k + s] || 0;
                        return (
                          <td key={k + s} style={{
                            padding: "8px", textAlign: "center", fontWeight: s === "T" ? 600 : 400,
                            color: v === 0 ? C.slate300 : heatText(v),
                            background: s === "T" ? heatColor(v) : "transparent",
                            borderRadius: s === "T" ? 3 : 0,
                            borderLeft: s === "Off" ? `1px solid ${C.slate200}` : "none",
                          }}>{v}</td>
                        );
                      })
                    )}
                  </tr>
                );
              })}
              <tr style={{ background: C.slate700, color: C.white, fontWeight: 600 }}>
                <td style={{ padding: "9px 14px", position: "sticky", left: 0, background: C.slate700, zIndex: 1, borderRight: `1px solid ${C.slate600}` }}>Total</td>
                {["pre", "d30", "d60", "d90", "p90"].flatMap((k) =>
                  ["Off", "On", "T"].map((s) => (
                    <td key={`t-${k}${s}`} style={{
                      padding: "9px 8px", textAlign: "center", fontWeight: s === "T" ? 700 : 500,
                      borderLeft: s === "Off" ? `1px solid ${C.slate600}` : "none",
                    }}>{d.heatmapTotals[k + s] || 0}</td>
                  ))
                )}
              </tr>
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 18, padding: "10px 18px", borderTop: `1px solid ${C.slate200}`, flexWrap: "wrap" }}>
            {[
              { l: "0–5 healthy", c: "#E0F2F1" },
              { l: "6–10 watch", c: "#B2DFDB" },
              { l: "11–15 at risk", c: C.amberLt },
              { l: "16–20 warning", c: "#FBBF24" },
              { l: "21+ critical", c: "#F87171" },
            ].map((l) => (
              <div key={l.l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 10, color: C.slate500 }}>
                <span style={{ width: 12, height: 12, borderRadius: 2, background: l.c, border: `1px solid ${C.slate300}` }} />{l.l}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Off/On + donut */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginTop: 22 }}>
        <Card>
          <SectionTitle>Offshore vs Onshore Split</SectionTitle>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 18 }}>
            {[
              { l: "Offshore Open", v: d.kpis.offOpen, s: `of ${d.kpis.open} open` },
              { l: "Onshore Open", v: d.kpis.onOpen, s: `of ${d.kpis.open} open` },
              { l: "Offshore Offered", v: d.kpis.offOffered, s: `of ${d.kpis.offered} offered` },
              { l: "Onshore Offered", v: d.kpis.onOffered, s: `of ${d.kpis.offered} offered` },
            ].map((i) => (
              <div key={i.l} style={{ padding: "10px 12px", background: C.slate50, borderRadius: 6, border: `1px solid ${C.slate200}` }}>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.8, color: C.slate400 }}>{i.l}</div>
                <div style={{ fontSize: 26, fontWeight: 400, color: C.slate800, fontFamily: "'Outfit'" }}>{i.v}</div>
                <div style={{ fontSize: 10, color: C.slate400 }}>{i.s}</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d.offOnBar} barCategoryGap="28%">
              <CartesianGrid strokeDasharray="3 3" stroke={C.slate200} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: C.slate500 }} axisLine={{ stroke: C.slate200 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: C.slate500 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Offshore" fill={C.teal600} radius={[3, 3, 0, 0]}><LabelList content={renderBarLabel} /></Bar>
              <Bar dataKey="Onshore" fill={C.onshore} radius={[3, 3, 0, 0]}><LabelList content={renderBarLabel} /></Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card>
          <SectionTitle>Avg Aging — Offshore vs Onshore</SectionTitle>
          <div style={{ display: "flex", gap: 12, marginBottom: 18, justifyContent: "center" }}>
            {[
              { l: "Overall", v: d.kpis.avgAging },
              { l: "Offshore", v: d.kpis.offAging },
              { l: "Onshore", v: d.kpis.onAging },
            ].map((i) => (
              <div key={i.l} style={{ textAlign: "center", padding: "12px 22px", borderRadius: 6, background: C.slate50, border: `1px solid ${C.slate200}`, minWidth: 100 }}>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, color: C.slate400, marginBottom: 3 }}>{i.l}</div>
                <div style={{ fontSize: 28, fontWeight: 400, color: C.teal700, fontFamily: "'Outfit'" }}>{i.v}</div>
                <div style={{ fontSize: 10, color: C.slate400, marginTop: 2 }}>days avg</div>
              </div>
            ))}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={d.donut} dataKey="value" cx="50%" cy="50%"
                innerRadius={58} outerRadius={90} paddingAngle={1.5} strokeWidth={0}
                labelLine={false}
                label={({ value, cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                  // Hide label entirely if the slice is too thin to read
                  if (!value || percent < 0.04) return null;
                  const R = Math.PI / 180;
                  // Position label at the radial midpoint of the slice (inside the ring)
                  const r = innerRadius + (outerRadius - innerRadius) / 2;
                  const x = cx + r * Math.cos(-midAngle * R);
                  const y = cy + r * Math.sin(-midAngle * R);
                  return (
                    <text
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={12}
                      fontWeight={700}
                      fill="#FFFFFF"
                      fontFamily="'Outfit',sans-serif"
                      style={{ pointerEvents: "none" }}
                    >
                      {value}
                    </text>
                  );
                }}
              >
                {d.donut.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const dd = payload[0].payload;
                return <div style={{ background: C.slate800, color: C.white, padding: "7px 12px", borderRadius: 6, fontSize: 11 }}>{dd.name}: {dd.value}</div>;
              }} />
              <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 10.5 }} formatter={(v) => <span style={{ color: C.slate600 }}>{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
