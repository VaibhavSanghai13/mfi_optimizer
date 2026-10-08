"""Step 3 — join OpenStreetMap villages to the census list → data/villages_baramati.csv.

The census list (step 2) is the master list: every inhabited Baramati village with
its code and population. OSM points (step 1) mark where the settlement actually is,
which is a better meeting location than the centre of the village's land boundary.

Matching: names are normalised (lower-case, "Bk"/"Kh" suffixes removed, w→v …) and
compared with rapidfuzz. A pair matches when the score is ≥ 88 AND the OSM point is
within 5 km of the census boundary centroid — the distance check stops two different
villages with similar names (e.g. Malegaon Bk / Malegaon Kh) from being mixed up.

Result per village:
  * census village matched to OSM   → OSM coordinates        (coord_source = osm)
  * census village without a match   → boundary centroid      (coord_source = census_boundary)
  * OSM place not in the census      → OSM data, empty census fields
  * second OSM point with a census village's name → skipped as a duplicate

Run:  python scripts/data/join_census.py
"""

from __future__ import annotations

import csv

from rapidfuzz import fuzz

from common import CENSUS_VILLAGES_CSV, OSM_VILLAGES_CSV, ROOT, VILLAGES_CSV, haversine_km, normalise_name

MIN_SCORE = 88
MAX_DISTANCE_KM = 5.0


def read_csv(path) -> list[dict]:
    if not path.exists():
        raise SystemExit(f"{path.relative_to(ROOT)} is missing — run the earlier step first.")
    with path.open(encoding="utf-8") as file:
        return list(csv.DictReader(file))


def find_matches(census: list[dict], osm: list[dict]) -> dict[str, tuple[dict, float]]:
    """census_code -> (osm row, score). Each OSM point is used at most once."""
    candidates = []
    for c in census:
        for o in osm:
            score = fuzz.ratio(normalise_name(c["name"]), normalise_name(o["name"]))
            if score < MIN_SCORE:
                continue
            distance = haversine_km(float(c["lat"]), float(c["lng"]), float(o["lat"]), float(o["lng"]))
            if distance <= MAX_DISTANCE_KM:
                candidates.append((score, -distance, c["census_code"], o["osm_id"], o))

    # Best pairs first (highest score, then shortest distance); skip anything already used.
    matches: dict[str, tuple[dict, float]] = {}
    used_osm: set[str] = set()
    for score, _, census_code, osm_id, o in sorted(candidates, key=lambda c: c[:4], reverse=True):
        if census_code not in matches and osm_id not in used_osm:
            matches[census_code] = (o, score)
            used_osm.add(osm_id)
    return matches


def main() -> None:
    census = read_csv(CENSUS_VILLAGES_CSV)
    osm = read_csv(OSM_VILLAGES_CSV)
    matches = find_matches(census, osm)
    matched_osm_ids = {o["osm_id"] for o, _ in matches.values()}

    rows = []
    for c in census:
        o, score = matches.get(c["census_code"], (None, None))
        rows.append(
            {
                "name": c["name"],
                "lat": o["lat"] if o else c["lat"],
                "lng": o["lng"] if o else c["lng"],
                "census_code": c["census_code"],
                "population": c["population"],
                "match_score": round(score, 1) if o else "",
                "coord_source": "osm" if o else "census_boundary",
            }
        )
    # OSM sometimes has two points with the same village name. The second one is a
    # duplicate of a census village, not a new village, so it is left out.
    census_names = {normalise_name(c["name"]) for c in census}
    leftovers = [o for o in osm if o["osm_id"] not in matched_osm_ids]
    duplicates = [o for o in leftovers if normalise_name(o["name"]) in census_names]
    unmatched_osm = [o for o in leftovers if o not in duplicates]
    for o in unmatched_osm:
        rows.append(
            {
                "name": o["name"],
                "lat": o["lat"],
                "lng": o["lng"],
                "census_code": "",
                "population": "",
                "match_score": "",
                "coord_source": "osm",
            }
        )
    rows.sort(key=lambda row: (row["name"], row["census_code"]))

    with VILLAGES_CSV.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    with_census = sum(1 for row in rows if row["census_code"])
    print("── Match report ──")
    print(f"Census villages:          {len(census)}")
    print(f"OSM places:               {len(osm)}")
    print(f"OSM places matched:       {len(matches)} ({len(matches) / len(osm):.0%})")
    print(f"Total villages written:   {len(rows)}")
    print(f"With census code + pop.:  {with_census} ({with_census / len(rows):.0%})")
    print(f"Coordinates from OSM:     {sum(1 for row in rows if row['coord_source'] == 'osm')}")
    print("Sample matches:")
    for code, (o, score) in list(matches.items())[:5]:
        c = next(c for c in census if c["census_code"] == code)
        print(f"  {c['name']!r:28} ↔ {o['name']!r:24} score {score:5.1f}")
    print("OSM places not in the census (kept with empty census fields):")
    print("  " + (", ".join(o["name"] for o in unmatched_osm) or "none"))
    print("Duplicate OSM points skipped (name already matched):")
    print("  " + (", ".join(o["name"] for o in duplicates) or "none"))
    print(f"Wrote {VILLAGES_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
