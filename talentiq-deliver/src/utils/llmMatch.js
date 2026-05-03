// src/utils/llmMatch.js
// Sends position + bench resources to Claude and returns structured match analysis.
import { getMatchScore, formatBenchDuration } from "../dataProcessor";

/**
 * Run Claude-powered skill matching for an open position against bench resources.
 *
 * Strategy:
 *  1. Pre-sort benchResources by algorithmic score (so Claude focuses on plausible fits)
 *  2. Cap at 60 resources to stay within token budget
 *  3. Ask Claude to go beyond keyword matching — synonyms, domain adjacency, grade fit, etc.
 *
 * Returns: { summary, recommendation, matches: [{ id, score, confidence, reasoning, strengths, gaps }] }
 */
export async function fetchLLMMatches(position, benchResources) {
  // Pre-rank by algorithmic score and cap
  const MAX_CANDIDATES = 60;
  const ranked = benchResources
    .map((r) => {
      const { score } = getMatchScore(position.skills, r.skills);
      return { ...r, _algoScore: score };
    })
    .sort((a, b) => b._algoScore - a._algoScore)
    .slice(0, MAX_CANDIDATES);

  const posLine = [
    `Role: ${position.role}`,
    `Req ID: ${position.id}`,
    `Client: ${position.client}`,
    `Grade Required: ${position.grade || "Not specified"}`,
    `Location: ${position.location}`,
    `Aging: ${position.aging} days`,
    `Required Skills: ${position.skills.join(", ") || "Not specified"}`,
  ].join("\n");

  const resourceLines = ranked
    .map((r) =>
      `${r.id} | ${r.name} | Grade:${r.grade || "?"} | Bench:${formatBenchDuration(r.benchDays)} | Skills: ${r.skills.slice(0, 20).join(", ")}${r.skills.length > 20 ? " [+" + (r.skills.length - 20) + " more]" : ""}`
    )
    .join("\n");

  const prompt = `You are a senior technical recruiter doing an expert skill match review.

OPEN POSITION:
${posLine}

BENCH RESOURCES (format: ID | Name | Grade | Bench Duration | Skills):
${resourceLines}

Evaluate each resource and identify the best matches for this position. Go beyond keyword matching:
- Treat skill synonyms as equivalent (e.g. JS = JavaScript, React = ReactJS, ML = Machine Learning)
- Recognise when a broader skill implies a narrower one (e.g. "Full Stack" covers frontend + backend)
- Account for grade proximity (within 2 levels is acceptable)
- Flag any resource on bench >3 months as advantageous (more available)
- Note skill gaps clearly but don't penalise for skills not commonly listed alongside the core ones

Return ONLY valid JSON — no markdown, no explanation, no code fences. Use this exact shape:
{
  "summary": "2-3 sentence overall assessment of bench coverage for this role",
  "recommendation": "1-2 sentence top recommendation",
  "matches": [
    {
      "id": "resource id from input",
      "score": 85,
      "confidence": "High",
      "reasoning": "1-2 sentence explanation",
      "strengths": ["strength1", "strength2"],
      "gaps": ["gap1"]
    }
  ]
}

Rules:
- Only include resources with score >= 30
- Sort matches by score descending
- Limit to top 15 matches
- confidence must be "High" (>=80), "Medium" (>=60), or "Low" (<60)
- score is 0–100`;

  const response = await fetch("/api/anthropic/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`API error ${response.status}${errBody ? ": " + errBody : ""}`);
  }

  const data = await response.json();
  const rawText = (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  // Strip any accidental markdown fences
  const cleaned = rawText.replace(/```json|```/gi, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error("Claude returned invalid JSON. Raw response: " + rawText.slice(0, 200));
  }

  // Enrich each match with the original resource data so the UI can render it
  const resourceById = Object.fromEntries(benchResources.map((r) => [r.id, r]));
  const enriched = (parsed.matches || []).map((m) => ({
    ...m,
    resource: resourceById[m.id] || null,
  }));

  return {
    summary: parsed.summary || "",
    recommendation: parsed.recommendation || "",
    matches: enriched,
  };
}
