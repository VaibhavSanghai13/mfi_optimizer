"""Step 2 — build the official list of Baramati villages from the Census of India 2011.

Sources (downloaded once into data/raw/):
  * Census 2011 Primary Census Abstract, Pune district (village name, code, population)
  * DataMeet "Indian Village Boundaries" for Maharashtra: a directory linking 2011
    census codes to 2001 codes, and village boundary polygons keyed by the 2001 code

The census has no coordinates, so each village gets the centroid of its boundary
polygon. Writes data/raw/census_villages.csv.

Run:  python scripts/data/fetch_census.py
"""

from __future__ import annotations

import csv
import json

import pandas as pd

from common import (
    CENSUS_DISTRICT_CODE,
    CENSUS_SUBDISTRICT_CODE,
    CENSUS_VILLAGES_CSV,
    RAW_DIR,
    ROOT,
    download,
    in_pune,
    polygon_centroid,
)

CENSUS_PCA_URL = (
    "https://censusindia.gov.in/nada/index.php/catalog/6712/download/9789/"
    "DDW_PCA2725_2011_MDDS%20with%20UI.xlsx"
)
DATAMEET_BASE = "https://raw.githubusercontent.com/datameet/indian_village_boundaries/master/mh/"
DATAMEET_FILES = ["mh.csv", "mh1.geojson", "mh2.geojson"]


def load_census_villages() -> pd.DataFrame:
    """Villages of Baramati sub-district with their 2011 code and population."""
    path = download(CENSUS_PCA_URL, RAW_DIR / "census_pca_pune_2011.xlsx")
    pca = pd.read_excel(path)
    villages = pca[
        (pca["District"] == CENSUS_DISTRICT_CODE)
        & (pca["Subdistt"] == CENSUS_SUBDISTRICT_CODE)
        & (pca["Level"] == "VILLAGE")
        & (pca["TOT_P"] > 0)  # uninhabited villages have nobody to lend to
    ]
    return pd.DataFrame(
        {
            "census_code": villages["Town/Village"].astype(str),
            "name": villages["Name"].str.strip(),
            "population": villages["TOT_P"].astype(int),
            "households": villages["No_HH"].astype(int),
        }
    )


def load_boundary_centroids() -> dict[str, tuple[float, float]]:
    """2001 census code -> (lat, lng) centroid of the village boundary."""
    centroids: dict[str, tuple[float, float]] = {}
    for name in DATAMEET_FILES[1:]:
        path = download(DATAMEET_BASE + name, RAW_DIR / f"datameet_{name}")
        with path.open(encoding="utf-8") as file:
            features = json.load(file)["features"]
        for feature in features:
            code = feature["properties"].get("CEN_2001")
            geometry = feature["geometry"]
            if not code or not geometry:
                continue
            # A MultiPolygon village is represented by its largest part.
            polygons = geometry["coordinates"] if geometry["type"] == "MultiPolygon" else [geometry["coordinates"]]
            outer_rings = [polygon[0] for polygon in polygons]
            centroids[code] = polygon_centroid(max(outer_rings, key=len))
    return centroids


def main() -> None:
    print("Loading Census 2011 villages for Baramati…")
    villages = load_census_villages()

    print("Loading DataMeet village directory and boundaries…")
    directory = pd.read_csv(download(DATAMEET_BASE + "mh.csv", RAW_DIR / "datameet_mh.csv"), dtype=str)
    code_2001 = dict(zip(directory["village_code_2011"], directory["CEN_2001"]))
    centroids = load_boundary_centroids()

    rows, missing = [], []
    for village in villages.itertuples(index=False):
        centroid = centroids.get(code_2001.get(village.census_code, ""))
        if centroid is None or not in_pune(*centroid):
            missing.append(village.name)
            continue
        rows.append(
            {
                "census_code": village.census_code,
                "name": village.name,
                "population": village.population,
                "households": village.households,
                "lat": round(centroid[0], 6),
                "lng": round(centroid[1], 6),
            }
        )
    rows.sort(key=lambda row: row["census_code"])

    with CENSUS_VILLAGES_CSV.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

    print(f"Census villages: {len(villages)}; with a boundary centroid: {len(rows)}")
    if missing:
        print(f"No boundary found for: {', '.join(missing)}")
    print(f"Wrote {CENSUS_VILLAGES_CSV.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
