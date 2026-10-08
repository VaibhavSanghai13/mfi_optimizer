"""Shared helpers for the village data scripts (paths, HTTP, name normalisation, geometry)."""

from __future__ import annotations

import math
import re
import sys
from pathlib import Path

import requests
import truststore

# Reports print characters such as "↔"; make sure Windows consoles accept them.
sys.stdout.reconfigure(encoding="utf-8")

# Use the operating system's certificate store. censusindia.gov.in serves an
# incomplete certificate chain that Python's bundled certificates reject.
truststore.inject_into_ssl()

ROOT = Path(__file__).resolve().parents[2]
RAW_DIR = ROOT / "data" / "raw"
OSM_VILLAGES_CSV = RAW_DIR / "osm_villages.csv"
CENSUS_VILLAGES_CSV = RAW_DIR / "census_villages.csv"
VILLAGES_CSV = ROOT / "data" / "villages_baramati.csv"

# Census 2011 codes for Baramati sub-district (Pune district, Maharashtra).
CENSUS_DISTRICT_CODE = 521
CENSUS_SUBDISTRICT_CODE = 4199

# Pune district bounding box, used as a sanity check on every coordinate.
PUNE_BOUNDS = {"lat": (17.8, 19.5), "lng": (73.3, 75.4)}

HEADERS = {"User-Agent": "MFI-Route-Optimizer/0.1 (student project; data preparation)"}


def download(url: str, path: Path) -> Path:
    """Download `url` to `path` once; later runs reuse the local copy."""
    if path.exists():
        print(f"  using cached {path.relative_to(ROOT)}")
        return path
    print(f"  downloading {url}")
    response = requests.get(url, headers=HEADERS, timeout=300)
    response.raise_for_status()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(response.content)
    return path


def in_pune(lat: float, lng: float) -> bool:
    (lat_min, lat_max), (lng_min, lng_max) = PUNE_BOUNDS["lat"], PUNE_BOUNDS["lng"]
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


# Marathi village names are transliterated inconsistently ("Wadi"/"Vadi",
# "Budruk"/"Bk"). Normalising both sides first lets fuzzy matching focus on the name.
_SUFFIXES = r"\b(bk|bu|budruk|kh|khurd|ct)\b"


def normalise_name(name: str) -> str:
    """'Malegaon Bk.' -> 'malegaon', 'Kharade Wadi' -> 'kharadevadi'."""
    s = name.lower()
    s = re.sub(r"\(.*?\)", " ", s)  # drop bracketed notes such as "(CT)"
    s = re.sub(r"[^a-z ]", " ", s)
    s = re.sub(_SUFFIXES, " ", s)
    s = s.replace("w", "v").replace("ee", "i").replace("oo", "u")
    return re.sub(r"\s+", "", s)


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0
    d_lat, d_lng = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    a = math.sin(d_lat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lng / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def polygon_centroid(ring: list[list[float]]) -> tuple[float, float]:
    """Area-weighted centroid of a GeoJSON ring ([lng, lat] points). Returns (lat, lng)."""
    area = cx = cy = 0.0
    for (x1, y1), (x2, y2) in zip(ring, ring[1:]):
        cross = x1 * y2 - x2 * y1
        area += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross
    area /= 2
    return cy / (6 * area), cx / (6 * area)
