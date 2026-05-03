"""Validates processors.py logic against synthetic data."""
import os
os.environ["DATABASE_URL"] = "postgresql://x:y@localhost:5432/x"

# Import without triggering create_all
from app import processors as P

# parse_skills
assert P.parse_skills("Python, Java; Spark+SQL") == ["Python", "Java", "Spark", "SQL"]
assert P.parse_skills("NA, -, x, ") == []  # noise filtered
print("✓ parse_skills")

# get_match_score
r = P.get_match_score(["Python", "Spark", "AWS"], ["python", "PySpark", "Azure"])
assert r["score"] == 67, r           # Python exact, Spark via PySpark substring
assert sorted(r["matched"]) == ["Python", "Spark"]
print("✓ get_match_score")

# grade
assert P.grade_rank("3A") == 4
assert P.is_grade_match("3A", "4A") is True
assert P.is_grade_match("3A", "6B") is False
print("✓ grade logic")

# shore
assert P.is_offshore("IN") and not P.is_onshore("IN")
assert P.is_onshore("US") and not P.is_offshore("US")
assert P.get_shore_from_label("Onshore-NA") == "Onshore"
print("✓ shore logic")

# aging buckets
assert P.aging_bucket(5, "") == "1–30 d"
assert P.aging_bucket(95, "") == "91+ d"
assert P.aging_bucket(50, "Pre-Approved") == "Pre-appr."
print("✓ aging buckets")

# Full dashboard pipeline
fake_reqs = [
    {"job_req_id": "R1", "client_name": "Acme",  "status": "Open",    "country": "IN", "age": 5,
     "requisition_status": "", "job_title": "DE", "primary_skill_1": "Python, Spark",
     "l3_skills": "AWS", "grade": "3A", "lob": "Data", "vertical": "BFS", "criticality": "High"},
    {"job_req_id": "R2", "client_name": "Acme",  "status": "Offered", "country": "US", "age": 45,
     "requisition_status": "", "job_title": "DE", "primary_skill_1": "Java",
     "l3_skills": "", "grade": "4A", "lob": "Data", "vertical": "BFS", "criticality": ""},
    {"job_req_id": "R3", "client_name": "Globex", "status": "Open",   "country": "IN", "age": 95,
     "requisition_status": "", "job_title": "DS", "primary_skill_1": "ML",
     "l3_skills": "", "grade": "5A", "lob": "AI",   "vertical": "Health", "criticality": ""},
]
d = P.process_dashboard(fake_reqs)
assert d["kpis"]["totalActive"] == 3
assert d["kpis"]["open"] == 2
assert d["kpis"]["offered"] == 1
assert d["kpis"]["newReqs"] == 1
assert d["kpis"]["offOpen"] == 2 and d["kpis"]["onOpen"] == 0
assert len(d["clientBar"]) == 2
assert d["agingPipeline"][0]["bucket"] == "Pre-appr."
print("✓ process_dashboard:", d["kpis"])

# extract_positions
positions = P.extract_positions(fake_reqs)
assert len(positions) == 2  # only Open
assert "Python" in positions[0]["skills"]
print("✓ extract_positions →", len(positions), "open positions")

# bench resources
fake_msd = [
    {"employee_id": "E1", "name": "Alice", "grade": "3A",
     "designation": "DE", "onshore_offshore_label": "Offshore", "work_location": "Mumbai",
     "division": "Data", "lob": "Data", "vertical": "BFS",
     "skillsets": "Python, Spark", "l3_skill_family": "Big Data", "l4_sub_skill": "PySpark",
     "bench_ageing_days": 60, "project_name": "Bench Pool", "allocation_start_date": None},
    {"employee_id": "E2", "name": "Bob", "grade": "4A",
     "designation": "DE", "onshore_offshore_label": "Onshore", "work_location": "NYC",
     "division": "Data", "lob": "Data", "vertical": "BFS",
     "skillsets": "Java, AWS", "l3_skill_family": "Cloud", "l4_sub_skill": "EC2",
     "bench_ageing_days": 30, "project_name": "Bench Holding", "allocation_start_date": None},
    {"employee_id": "E3", "name": "Eve", "grade": "5A",
     "designation": "ML", "onshore_offshore_label": "Offshore", "work_location": "BLR",
     "division": "AI", "lob": "AI", "vertical": "Health",
     "skillsets": "Python, ML", "l3_skill_family": "AI", "l4_sub_skill": "TensorFlow",
     "bench_ageing_days": 10, "project_name": "Active", "allocation_start_date": None},
]
bench_ids = ["E1", "E2"]   # E3 is allocated, should be skipped
resources = P.build_bench_resources(fake_msd, bench_ids)
assert len(resources) == 2
assert resources[0]["benchDays"] == 60
print("✓ build_bench_resources →", len(resources), "bench resources")

# match scoring
ms = P.get_match_score(positions[0]["skills"], resources[0]["skills"])
print(f"✓ Position {positions[0]['id']} vs {resources[0]['name']}: {ms['score']}% ({ms['matched']})")

print("\nAll processor tests passed ✓")
