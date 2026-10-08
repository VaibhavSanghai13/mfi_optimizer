"""Step 1 — fetch village and hamlet points inside Baramati taluka from OpenStreetMap.

Queries the Overpass API for place=village|hamlet nodes inside the Baramati taluka
boundary and writes data/raw/osm_villages.csv. If the boundary (area) query fails,
it falls back to a bounding box around the taluka.

Run:  python scripts/data/fetch_villages.py
"""

from __future__ import annotations

import csv
import time

import requests

from common import HEADERS, OSM_VILLAGES_CSV, ROOT, in_pune

# OSM relation for Baramati taluka (boundary=administrative, admin_level=6).
# Overpass area ids are the relation id + 3 600 000 000.
BARAMATI_RELATION_ID = 10351621
AREA_ID = 3_600_000_000 + BARAMATI_RELATION_ID

# Fallback: roughly the taluka's extent (south, west, north, east).
BARAMATI_BBOX = (17.98, 74.30, 18.37, 74.80)

OVERPASS_URLS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]

AREA_QUERY = f"""
[out:json][timeout:90];
area(id:{AREA_ID})->.taluka;
node["place"~"^(village|hamlet)$"](area.taluka);
out body;
"""

BBOX_QUERY = """
[out:json][timeout:90];
node["place"~"^(village|hamlet)$"]({},{},{},{});
out body;
""".format(*BARAMATI_BBOX)


def run_query(query: str) -> list[dict]:
    """Try each Overpass server in turn; the public servers are often busy."""
    for url in OVERPASS_URLS:
        for attempt in range(2):
            try:
                response = requests.post(url, data={"data": query}, headers=HEADERS, timeout=120)
                response.raise_for_status()
                elements = response.json()["elements"]
                if elements:
                    return elements
                print(f"  {url}: empty result")
                break
            except (requests.RequestException, ValueError) as error:
                print(f"  {url} attempt {attempt + 1} failed: {error}")
                time.sleep(5)
    return []


def main() -> None:
    print("Fetching villages inside the Baramati taluka boundary…")
    elements = run_query(AREA_QUERY)
    method = "taluka boundary"
    if not elements:
        print("Boundary query failed — falling back to the bounding box.")
        elements = run_query(BBOX_QUERY)
        method = "bounding box"
    if not elements:
        raise SystemExit("Overpass API unavailable. Try again in a few minutes.")

    rows = [
        {
            "osm_id": element["id"],
            "name": element["tags"]["name"].strip(),
            "name_mr": element["tags"].get("name:mr", ""),
            "place": element["tags"]["place"],
            "lat": round(element["lat"], 6),
            "lng": round(element["lon"], 6),
        }
        for element in elements
        # Unnamed points cannot be matched to the census or shown to a user.
        if element.get("tags", {}).get("name") and in_pune(element["lat"], element["lon"])
    ]
    # Sorted so re-running produces an identical file.
    rows.sort(key=lambda row: (row["name"], row["osm_id"]))

    OSM_VILLAGES_CSV.parent.mkdir(parents=True, exist_ok=True)
    with OSM_VILLAGES_CSV.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    skipped = len(elements) - len(rows)
    print(f"Found {len(elements)} places via {method}; kept {len(rows)} named ones ({skipped} unnamed skipped).")
    print(f"Wrote {OSM_VILLAGES_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
