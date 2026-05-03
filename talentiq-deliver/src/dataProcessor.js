// src/dataProcessor.js
// ═══════════════════════════════════════════════════════════════
// TalentIQ Data Processing Engine
// Transforms TA, MSD, and Bench data into dashboard-ready structures
// ═══════════════════════════════════════════════════════════════

// ── Grade Hierarchy ──
const GRADE_ORDER = ["A","1A","2A","2B","3A","3B","4A","4B","5A","5B","6A","6B","6C","7A","7B","8A"];
export function gradeRank(g) {
  const idx = GRADE_ORDER.indexOf(String(g).trim());
  return idx >= 0 ? idx : -1;
}
export function gradeLabel(g) { return String(g || "").trim(); }
export function isGradeMatch(posGrade, resGrade) {
  const pRank = gradeRank(posGrade);
  const rRank = gradeRank(resGrade);
  if (pRank < 0 || rRank < 0) return true; // unknown = no penalty
  return Math.abs(pRank - rRank) <= 2; // within 2 levels
}

// ── Shore Logic ──
const ONSHORE_COUNTRIES = new Set(["US","CA","MX"]);
export const isOffshore = (c) => String(c).toUpperCase().trim() === "IN";
export const isOnshore = (c) => ONSHORE_COUNTRIES.has(String(c).toUpperCase().trim());
export const getShore = (c) => isOffshore(c) ? "Offshore" : "Onshore";
export const getShoreFromLabel = (label) => {
  const l = String(label||"").toLowerCase();
  if (l.includes("offshore")) return "Offshore";
  if (l.includes("onshore")) return "Onshore";
  return "Offshore";
};

// ── Aging Bucket ──
function agingBucket(age, reqStatus) {
  if (reqStatus === "Pre-Approved" || age == null) return "Pre-appr.";
  if (age <= 30) return "1–30 d";
  if (age <= 60) return "31–60 d";
  if (age <= 90) return "61–90 d";
  return "91+ d";
}
function bucketKey(bucket) {
  return {"Pre-appr.":"pre","1–30 d":"d30","31–60 d":"d60","61–90 d":"d90","91+ d":"p90"}[bucket]||"p90";
}

// ── Skill Parsing ──
// Normalizes and deduplicates skills from comma/plus/semicolon separated strings
export function parseSkills(...fields) {
  const skills = new Set();
  fields.forEach(f => {
    if (!f) return;
    String(f).split(/[,;+\/]/).forEach(s => {
      const trimmed = s.trim().replace(/\s+/g," ");
      if (trimmed && trimmed.length > 1 && trimmed.toLowerCase() !== "na" && trimmed !== "-") {
        skills.add(trimmed);
      }
    });
  });
  return [...skills];
}

// Normalize skill name for comparison (lowercase, remove spaces/special chars)
function normalizeSkill(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]/g,"").trim();
}

// ── Skill Match Score ──
// Compares position required skills against resource skills
// Returns { score (0-100), matched (skill names), total }
export function getMatchScore(posSkills, resSkills) {
  if (!posSkills.length) return { score: 0, matched: [], total: 0 };
  const resNorm = new Map(resSkills.map(s => [normalizeSkill(s), s]));
  const matched = [];
  posSkills.forEach(ps => {
    const pn = normalizeSkill(ps);
    // Exact match
    if (resNorm.has(pn)) { matched.push(ps); return; }
    // Partial/contains match (e.g. "PySpark" matches "Spark")
    for (const [rn, rs] of resNorm) {
      if (pn.includes(rn) || rn.includes(pn)) { matched.push(ps); return; }
    }
  });
  return {
    score: Math.round((matched.length / posSkills.length) * 100),
    matched,
    total: posSkills.length,
  };
}

// ── Bench Tenure ──
export function monthsOnBench(benchDays) {
  if (benchDays == null || benchDays === "" || isNaN(Number(benchDays))) return 0;
  return Math.round(Number(benchDays) / 30);
}
export function formatBenchDuration(benchDays) {
  const m = monthsOnBench(benchDays);
  if (m < 1) return "< 1 mo";
  return `${m} mo`;
}

// ════════════════════════════════════════════════════════════════
// 1. PROCESS TA DATA → Dashboard
// ════════════════════════════════════════════════════════════════
export function processTAData(rawRows) {
  const all = rawRows.map(r => ({
    reqId: String(r.Job_Req_ID||r["Job_Req_ID"]||""),
    client: r.Client_Name||r["Client_Name"]||"",
    customer: r.Customer_Name||r["Customer_Name"]||"",
    project: r.Project_Name||r["Project_Name"]||"",
    status: r.Status||r["Status"]||"",
    country: String(r.Country||r["Country"]||"").toUpperCase().trim(),
    age: r.Age!=null&&r.Age!==""?Number(r.Age):null,
    reqStatus: r.Requisition_Status||r["Requisition_Status"]||"",
    jobTitle: r.Job_Title||r["Job_Title"]||"",
    primarySkill: r.Primary_Skill_1||r["Primary_Skill_1"]||"",
    l3Skills: r.L3_Skills||r["L3_Skills"]||"",
    grade: r.Grade||r["Grade"]||"",
    lob: r.LOB||r["LOB"]||"",
    vertical: r.Vertical||r["Vertical"]||"",
    criticality: r.Criticality||r["Criticality"]||"",
  }));

  const activeDb = all.filter(r => r.status==="Open"||r.status==="Offered");
  const historicalDb = all.filter(r => r.status!=="Open"&&r.status!=="Offered");
  const openRows = activeDb.filter(r => r.status==="Open");
  const offeredRows = activeDb.filter(r => r.status==="Offered");

  const offOpen = openRows.filter(r => isOffshore(r.country)).length;
  const onOpen = openRows.filter(r => isOnshore(r.country)).length;
  const offOffered = offeredRows.filter(r => isOffshore(r.country)).length;
  const onOffered = offeredRows.filter(r => isOnshore(r.country)).length;
  const newReqs = openRows.filter(r => r.age!=null&&r.age<=10).length;

  const avg = arr => arr.length?(arr.reduce((s,v)=>s+v,0)/arr.length).toFixed(1):"0";
  const activeAges = activeDb.filter(r=>r.age!=null).map(r=>r.age);
  const offAges = activeDb.filter(r=>r.age!=null&&isOffshore(r.country)).map(r=>r.age);
  const onAges = activeDb.filter(r=>r.age!=null&&isOnshore(r.country)).map(r=>r.age);

  const kpis = {
    totalActive:activeDb.length, open:openRows.length, offered:offeredRows.length, newReqs,
    avgAging:Number(avg(activeAges)), offOpen, onOpen, offOffered, onOffered,
    offAging:Number(avg(offAges)), onAging:Number(avg(onAges)),
  };

  // Client bar chart
  const clientMap = {};
  activeDb.forEach(r => {
    const c=r.client||"Unknown";
    if(!clientMap[c])clientMap[c]={name:c,Open:0,Offered:0};
    clientMap[c][r.status]++;
  });
  const clientBar = Object.values(clientMap).sort((a,b)=>(b.Open+b.Offered)-(a.Open+a.Offered));

  // Aging pipeline
  const bucketOrder=["Pre-appr.","1–30 d","31–60 d","61–90 d","91+ d"];
  const bucketColors={"Pre-appr.":"#5EEAD4","1–30 d":"#0D9488","31–60 d":"#64748B","61–90 d":"#D97706","91+ d":"#DC2626"};
  const bucketCounts={};bucketOrder.forEach(b=>bucketCounts[b]=0);
  activeDb.forEach(r=>{const b=agingBucket(r.age,r.reqStatus);if(bucketCounts[b]!=null)bucketCounts[b]++});
  const agingPipeline=bucketOrder.map(b=>({bucket:b,value:bucketCounts[b],color:bucketColors[b]}));
  const donut=agingPipeline.map(b=>({name:b.bucket.replace(" d"," days").replace("Pre-appr.","Pre-approved"),value:b.value,color:b.color}));

  // Heatmap
  const heatmapMap={};
  activeDb.forEach(r=>{
    const client=r.client||"Unknown";const bucket=agingBucket(r.age,r.reqStatus);const shore=isOffshore(r.country)?"Off":"On";
    if(!heatmapMap[client]){heatmapMap[client]={client};bucketOrder.forEach(b=>{const k=bucketKey(b);heatmapMap[client][k+"Off"]=0;heatmapMap[client][k+"On"]=0;heatmapMap[client][k+"T"]=0})}
    const k=bucketKey(bucket);heatmapMap[client][k+shore]++;heatmapMap[client][k+"T"]++;
  });
  const heatmap=Object.values(heatmapMap).sort((a,b)=>{
    const tA=["pre","d30","d60","d90","p90"].reduce((s,k)=>s+(a[k+"T"]||0),0);
    const tB=["pre","d30","d60","d90","p90"].reduce((s,k)=>s+(b[k+"T"]||0),0);
    return tB-tA;
  });
  const heatmapTotals={};
  ["pre","d30","d60","d90","p90"].forEach(k=>{
    heatmapTotals[k+"Off"]=heatmap.reduce((s,r)=>s+(r[k+"Off"]||0),0);
    heatmapTotals[k+"On"]=heatmap.reduce((s,r)=>s+(r[k+"On"]||0),0);
    heatmapTotals[k+"T"]=heatmap.reduce((s,r)=>s+(r[k+"T"]||0),0);
  });

  const offOnBar=[{name:"Open",Offshore:offOpen,Onshore:onOpen},{name:"Offered",Offshore:offOffered,Onshore:onOffered}];

  return { kpis,clientBar,agingPipeline,donut,heatmap,heatmapTotals,offOnBar,activeDb,historicalDb };
}

// ════════════════════════════════════════════════════════════════
// 2. EXTRACT OPEN POSITIONS FOR SKILL MAPPING
// ════════════════════════════════════════════════════════════════
export function extractPositionsForMapping(activeDb) {
  return activeDb.filter(r=>r.status==="Open").map(r => ({
    id: r.reqId,
    client: r.client,
    role: r.jobTitle,
    skills: parseSkills(r.primarySkill, r.l3Skills),
    priority: r.criticality||(r.age>=60?"High":r.age>=30?"Medium":"Low"),
    aging: r.age||0,
    location: getShore(r.country),
    grade: r.grade,
    vertical: r.vertical,
    lob: r.lob,
  }));
}

// ════════════════════════════════════════════════════════════════
// 3. PROCESS MSD + BENCH IDs → Bench Resources for Skill Mapping
// ════════════════════════════════════════════════════════════════

// Robust field lookup: tries each candidate exactly, then case-insensitive
// (and trim-insensitive) across the row's own keys. Real-world Excel files
// frequently use "Employee Name" / "Full Name" / lowercase / trailing spaces.
function pickField(row, ...candidates) {
  // Pass 1: exact match
  for (const c of candidates) {
    const v = row[c];
    if (v != null && String(v).trim() !== "") return String(v).trim();
  }
  // Pass 2: case- and whitespace-insensitive scan over actual keys
  const keys = Object.keys(row || {});
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
  for (const c of candidates) {
    const target = norm(c);
    const k = keys.find((kk) => norm(kk) === target);
    if (k) {
      const v = row[k];
      if (v != null && String(v).trim() !== "") return String(v).trim();
    }
  }
  return "";
}

export function processMSDData(msdRawRows, benchEmployeeIds) {
  const benchIdSet = new Set(benchEmployeeIds.map(id => String(id).trim()));
  const empMap = {};

  // One-time diagnostic — shows the actual column headers so unmatched fields
  // can be added to the candidate lists if needed.
  if (msdRawRows.length > 0) {
    console.log("[MSD] Available columns in first row:", Object.keys(msdRawRows[0]));
  }

  msdRawRows.forEach(r => {
    const empId = pickField(r, "Employee Id", "Employee_Id", "EmployeeId", "Emp Id", "Emp ID", "ID");
    if (!empId || !benchIdSet.has(empId)) return;

    const projectName = pickField(r, "Project Name", "Project_Name", "Project");
    const isBenchProject = projectName.toLowerCase().includes("bench");
    const benchDaysStr = pickField(r, "Bench Ageing(days)", "Bench_Ageing_days", "Bench Ageing", "Bench Aging (days)", "Bench Aging", "Bench Days");
    const benchDays = benchDaysStr ? Number(benchDaysStr) : null;

    if (!empMap[empId]) {
      empMap[empId] = {
        id: empId,
        // Try every realistic header variant for name
        name: pickField(r, "Name", "Employee Name", "Full Name", "Resource Name", "Emp Name", "Employee_Name", "Resource"),
        grade: pickField(r, "Grade as per HRIS", "Grade", "HRIS Grade", "Current Grade", "Band"),
        designation: pickField(r, "Designation as per HRIS", "Designation", "Job Title", "Title", "Role"),
        location: getShoreFromLabel(pickField(r, "Onshore/Offshore", "Onshore Offshore", "Shore", "Location Type", "Onshore/offshore")),
        workLocation: pickField(r, "Work Location as per HRIS", "Work Location", "Location", "City"),
        division: pickField(r, "Division", "BU", "Business Unit"),
        lob: pickField(r, "LOB as per HRIS", "LOB", "Line of Business"),
        vertical: pickField(r, "Project Vertical", "Vertical", "Practice"),
        skillsets: pickField(r, "Skillsets", "Skill Sets", "Skills"),
        l3SkillFamily: pickField(r, "L3 (Skill Family)", "L3", "Skill Family", "Primary Skill"),
        l4SubSkill: pickField(r, "L4 (Sub Skill)", "L4", "Sub Skill", "Secondary Skill"),
        skills: [],
        benchDays: !isNaN(benchDays) && benchDays != null ? benchDays : null,
        benchProject: isBenchProject ? projectName : null,
        currentProject: projectName,
        allocationStart: pickField(r, "Allocation Start Date", "Start Date") || null,
        available: "Immediate",
        experience: null,
      };
    }

    if (isBenchProject && !isNaN(benchDays) && benchDays != null) {
      empMap[empId].benchDays = benchDays;
      empMap[empId].benchProject = projectName;
    }

    const rowSkills = parseSkills(
      pickField(r, "Skillsets", "Skill Sets", "Skills"),
      pickField(r, "L4 (Sub Skill)", "L4", "Sub Skill"),
      pickField(r, "L3 (Skill Family)", "L3", "Skill Family"),
    );
    if (rowSkills.length > (empMap[empId].skills?.length || 0)) {
      empMap[empId].skills = rowSkills;
    }
  });

  const benchResources = Object.values(empMap).map(emp => {
    if (!emp.skills.length) {
      emp.skills = parseSkills(emp.skillsets, emp.l4SubSkill, emp.l3SkillFamily);
    }
    return emp;
  });

  // Diagnostic: report how many resources are missing critical fields
  const missingName = benchResources.filter(e => !e.name).length;
  const missingGrade = benchResources.filter(e => !e.grade).length;
  console.log(`[MSD] ${msdRawRows.length} rows → ${benchResources.length} bench resources` + (missingName ? ` · ${missingName} missing name` : "") + (missingGrade ? ` · ${missingGrade} missing grade` : ""));
  if (benchResources.length > 0) {
    console.log("[MSD] Sample resource:", { id: benchResources[0].id, name: benchResources[0].name, grade: benchResources[0].grade, location: benchResources[0].location, skillsCount: benchResources[0].skills.length });
  }
  return benchResources;
}

// ════════════════════════════════════════════════════════════════
// 4. PARSE BENCH EMPLOYEE ID FILE
// ════════════════════════════════════════════════════════════════
export function parseBenchEmployeeIds(rawRows) {
  const ids = [];
  const candidates = ["Employee Id", "Employee_Id", "EmployeeId", "Emp ID", "Emp Id", "ID", "id"];
  rawRows.forEach(r => {
    let id = "";
    // Exact match first
    for (const c of candidates) {
      if (r[c] != null && String(r[c]).trim() !== "") { id = String(r[c]).trim(); break; }
    }
    // Case-insensitive fallback
    if (!id) {
      const keys = Object.keys(r || {});
      const norm = (s) => String(s).toLowerCase().replace(/\s+/g, " ").trim();
      for (const c of candidates) {
        const k = keys.find((kk) => norm(kk) === norm(c));
        if (k && r[k] != null && String(r[k]).trim() !== "") { id = String(r[k]).trim(); break; }
      }
    }
    if (id && id !== "undefined" && id !== "null") ids.push(id);
  });
  console.log(`[Bench IDs] parsed ${ids.length} employee IDs from ${rawRows.length} rows`);
  return ids;
}
