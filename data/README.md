# Village data — Baramati taluka

`villages_baramati.csv` lists the real villages of Baramati taluka (Pune district, Maharashtra). The synthetic JLG groups are placed on these villages in S4.

| Column | Meaning |
|---|---|
| `name` | Village name (census spelling; OSM spelling for places not in the census) |
| `lat`, `lng` | Where to place meetings (WGS84) |
| `census_code` | Census of India 2011 village code (empty if not in the census) |
| `population` | Census 2011 total population (empty if not in the census) |
| `match_score` | Name-match score 0–100 when an OSM point was matched to the census village |
| `coord_source` | `osm` = OpenStreetMap place point (the settlement itself); `census_boundary` = centre of the village's land boundary |

## How it is built

```bash
pip install -r requirements-data.txt
python scripts/data/fetch_villages.py   # 1. OSM places inside the taluka  → data/raw/osm_villages.csv
python scripts/data/fetch_census.py     # 2. Census villages + boundaries → data/raw/census_villages.csv
python scripts/data/join_census.py      # 3. Join and report             → data/villages_baramati.csv
```

1. **OpenStreetMap** (Overpass API): `place=village|hamlet` points inside the Baramati taluka boundary (OSM relation 10351621). OSM maps only about 20 named places here, so it cannot be the master list.
2. **Census of India 2011**: the Primary Census Abstract for Pune district gives every village of Baramati sub-district (code 4199) with its code and population. The census has no coordinates, so each village gets the centre of its boundary polygon from **DataMeet's Indian Village Boundaries** (joined exactly by census code).
3. **Join**: names are normalised and fuzzy-matched with `rapidfuzz` (score ≥ 88 and within 5 km). Matched villages use the OSM point, which marks the settlement; the rest use the boundary centre.

The same inputs always produce the same CSV. Raw downloads (~150 MB) are cached in `data/raw/` (git-ignored); delete a file there to download it again.

## Sources and licences

| Source | Used for | Licence |
|---|---|---|
| [OpenStreetMap](https://www.openstreetmap.org/copyright) via the [Overpass API](https://overpass-api.de/) | village points, taluka boundary | © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) |
| [Census of India 2011 — PCA, Pune district](https://censusindia.gov.in/nada/index.php/catalog/6712) | village list, codes, population | Government of India open data ([GODL-India](https://www.data.gov.in/Godl)) |
| [DataMeet Indian Village Boundaries](https://github.com/datameet/indian_village_boundaries) (Maharashtra) | census code links, village boundary centres | © DataMeet contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/) |

Because it is derived from ODbL data, `villages_baramati.csv` is also shared under ODbL 1.0 with attribution to OpenStreetMap contributors and DataMeet.
