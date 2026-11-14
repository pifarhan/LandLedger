#!/usr/bin/env python3
"""Build a reproducible State/District/Sub-District index from Survey of India ABDB.

Usage:
  python build-abdb-hierarchy.py <extracted-abdb-root> <output-json> [registry-json]

Requires: pip install pyshp

The script indexes administrative attributes only. It does not infer parcel ownership,
legal title, mutation, encumbrance or any person-level property record.
"""
import collections
import csv
import json
import re
import sys
import unicodedata
from pathlib import Path

try:
    import shapefile
except ImportError:
    print("Missing dependency: pyshp. Install with: pip install pyshp", file=sys.stderr)
    raise SystemExit(3)


def normalise(value):
    value = unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode()
    value = value.lower().replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9]+", " ", value)).strip()


ALIASES = {
    "andaman and nicobar": "andaman and nicobar islands",
    "andaman nicobar islands": "andaman and nicobar islands",
    "delhi": "nct of delhi",
    "dadra and nagar haveli and daman diu": "dadra and nagar haveli and daman and diu",
    "jammu kashmir": "jammu and kashmir",
    "pondicherry": "puducherry",
    "orissa": "odisha",
    "uttaranchal": "uttarakhand",
}


def canonical(value):
    value = normalise(value)
    return ALIASES.get(value, value)


def read_layer(path):
    reader = shapefile.Reader(str(path), encoding="utf-8")
    fields = [field[0] for field in reader.fields[1:]]
    rows = [record.as_dict() for record in reader.iterRecords()]
    return fields, rows


def required_file(root, filename):
    found = list(root.rglob(filename))
    if len(found) != 1:
        raise RuntimeError(f"Expected exactly one {filename}, found {len(found)}")
    return found[0]


def build(extracted_root, output, registry_file):
    registry = json.loads(registry_file.read_text(encoding="utf-8"))
    states = registry["states"]
    if len(states) != 36:
        raise RuntimeError(f"Expected 36 State/UT master rows, found {len(states)}")
    registry_by_name = {canonical(item["name"]): item for item in states}

    state_path = required_file(extracted_root, "State Boundary.shp")
    district_path = required_file(extracted_root, "District Boundary.shp")
    subdistrict_path = required_file(extracted_root, "Sub_district Boundary.shp")

    state_fields, state_rows = read_layer(state_path)
    district_fields, district_rows = read_layer(district_path)
    sub_fields, sub_rows = read_layer(subdistrict_path)

    state_features = []
    disputed_states = []
    for row in state_rows:
        source_name = str(row.get("STATE") or "").strip()
        state = registry_by_name.get(canonical(source_name))
        item = {
            "sourceFeatureId": row.get("OBJECTID"),
            "sourceStateName": source_name,
            "sourceCountry": row.get("Country"),
            "shapeLength": row.get("Shape_Leng"),
            "shapeArea": row.get("Shape_Area"),
        }
        if state:
            item.update({
                "stateCode": state["code"], "stateName": state["name"],
                "officialLgdCode": state["lgdCode"], "type": state["type"],
            })
            state_features.append(item)
        else:
            disputed_states.append({**item, "classification": "disputed_or_unmapped_state_boundary"})

    district_by_state = collections.defaultdict(list)
    district_by_source = collections.defaultdict(list)
    district_by_name = collections.defaultdict(list)
    all_districts = []
    disputed_districts = []

    for row in district_rows:
        source_state = str(row.get("STATE_UT") or "").strip()
        district_name = str(row.get("DISTRICT") or "").strip()
        source_code = str(row.get("DIST_LGD") or "").strip() or None
        if not source_state or not district_name:
            disputed_districts.append({
                "sourceFeatureId": row.get("OBJECTID"),
                "remarks": row.get("REMARKS"),
                "classification": "disputed_or_unassigned_district_boundary",
            })
            continue
        state = registry_by_name.get(canonical(source_state))
        if not state:
            disputed_districts.append({
                "sourceFeatureId": row.get("OBJECTID"),
                "sourceStateName": source_state,
                "sourceDistrictName": district_name,
                "sourceDistrictLgdCode": source_code,
                "classification": "unmapped_state_or_district",
            })
            continue
        item = {
            "stateCode": state["code"], "stateName": state["name"],
            "officialStateLgdCode": state["lgdCode"], "type": state["type"],
            "sourceStateName": source_state,
            "sourceStateLgdCode": str(row.get("STATE_LGD") or "").strip() or None,
            "districtName": district_name, "sourceDistrictLgdCode": source_code,
            "sourceFeatureId": row.get("OBJECTID"),
            "shapeLength": row.get("Shape_Leng"), "shapeArea": row.get("Shape_Area"),
            "remarks": row.get("REMARKS") or None,
        }
        all_districts.append(item)
        district_by_state[state["code"]].append(item)
        if source_code:
            district_by_source[(state["code"], source_code)].append(item)
        district_by_name[(state["code"], normalise(district_name))].append(item)

    subdistricts = []
    invalid_subdistricts = []
    unmatched = []
    duplicate_keys = collections.Counter()

    for row in sub_rows:
        source_state = str(row.get("STATE_UT") or "").strip()
        district_name = str(row.get("DISTRICT") or "").strip()
        subdistrict_name = str(row.get("SUB_DIST") or "").strip()
        district_code = str(row.get("DIST_LGD") or "").strip() or None
        subdistrict_code = str(row.get("SUBDIS_LGD") or "").strip() or None

        if not (source_state and district_name and subdistrict_name and subdistrict_code):
            invalid_subdistricts.append({
                "sourceFeatureId": row.get("OBJECTID"),
                "sourceStateName": source_state or None,
                "sourceDistrictName": district_name or None,
                "sourceSubDistrictName": subdistrict_name or None,
                "remarks": row.get("REMARKS") or None,
                "classification": "missing_required_admin_attribute",
                "sourceSubDistrictLgdCode": subdistrict_code,
            })
            continue

        state = registry_by_name.get(canonical(source_state))
        if not state:
            invalid_subdistricts.append({
                "sourceFeatureId": row.get("OBJECTID"),
                "sourceStateName": source_state,
                "sourceDistrictName": district_name,
                "sourceSubDistrictName": subdistrict_name,
                "classification": "unmapped_state",
            })
            continue

        candidates = district_by_source.get((state["code"], district_code), []) if district_code else []
        parent = None
        match_method = "unmatched"
        if len(candidates) == 1:
            parent = candidates[0]
            match_method = "state_and_source_district_lgd_code"
        elif len(candidates) > 1:
            same_name = [item for item in candidates if normalise(item["districtName"]) == normalise(district_name)]
            if len(same_name) == 1:
                parent = same_name[0]
                match_method = "state_code_and_district_name_disambiguation"
        if parent is None:
            by_name = district_by_name.get((state["code"], normalise(district_name)), [])
            if len(by_name) == 1:
                parent = by_name[0]
                match_method = "state_and_normalized_district_name"

        key = (state["code"], district_code, subdistrict_code)
        duplicate_keys[key] += 1
        item = {
            "stateCode": state["code"], "stateName": state["name"],
            "officialStateLgdCode": state["lgdCode"],
            "sourceStateName": source_state,
            "sourceStateLgdCode": str(row.get("STATE_LGD") or "").strip() or None,
            "districtName": district_name, "sourceDistrictLgdCode": district_code,
            "subDistrictName": subdistrict_name, "sourceSubDistrictLgdCode": subdistrict_code,
            "subDistrictType": str(row.get("SUBDIS_TYP") or "").strip() or None,
            "sourceFeatureId": row.get("OBJECTID"),
            "shapeLength": row.get("Shape_Leng"), "shapeArea": row.get("Shape_Area"),
            "parentDistrictFeatureId": parent["sourceFeatureId"] if parent else None,
            "parentMatchMethod": match_method,
            "sourceDistrictCodeMismatch": bool(
                parent and district_code and parent["sourceDistrictLgdCode"] and
                district_code != parent["sourceDistrictLgdCode"]
            ),
        }
        subdistricts.append(item)
        if not parent:
            unmatched.append(item)

    indexed_states = []
    for state in states:
        state_districts = sorted(
            district_by_state.get(state["code"], []),
            key=lambda item: (normalise(item["districtName"]), str(item["sourceDistrictLgdCode"] or "")),
        )
        state_subdistricts = [item for item in subdistricts if item["stateCode"] == state["code"]]
        indexed_states.append({
            "code": state["code"], "lgdCode": state["lgdCode"], "name": state["name"], "type": state["type"],
            "stateBoundaryFeatures": [item for item in state_features if item["stateCode"] == state["code"]],
            "districtCount": len(state_districts), "districts": state_districts,
            "subDistrictCount": len(state_subdistricts), "subDistricts": state_subdistricts,
            "unmatchedSubDistrictParentCount": sum(item["stateCode"] == state["code"] for item in unmatched),
        })

    archive_manifest = extracted_root.parent / "raw" / "manifest.json"
    archive = json.loads(archive_manifest.read_text(encoding="utf-8")) if archive_manifest.exists() else {}
    coverage = {
        "officialStateUtCount": len(states),
        "stateBoundaryFeatures": len(state_features),
        "disputedOrUnmappedStateBoundaryFeatures": len(disputed_states),
        "districtBoundaryFeatures": len(district_rows),
        "assignedDistrictBoundaryFeatures": len(all_districts),
        "disputedOrUnassignedDistrictFeatures": len(disputed_districts),
        "subDistrictBoundaryFeatures": len(sub_rows),
        "indexedSubDistrictFeatures": len(subdistricts),
        "subDistrictFeaturesMissingRequiredAttributes": len(invalid_subdistricts),
        "statesWithIndexedSubDistricts": len({item["stateCode"] for item in subdistricts}),
        "statesWithoutIndexedSubDistricts": [
            state["name"] for state in states
            if state["code"] not in {item["stateCode"] for item in subdistricts}
        ],
        "subDistrictsWithUnmatchedDistrictBoundaryParent": len(unmatched),
        "duplicateSubDistrictSourceKeys": sum(1 for value in duplicate_keys.values() if value > 1),
        "duplicateSubDistrictRowsBeyondFirst": sum(value - 1 for value in duplicate_keys.values() if value > 1),
    }
    result = {
        "dataset": "Survey of India Administrative Boundary Database (ABDB), State/District/Sub-District PAN INDIA",
        "authority": "Survey of India, Department of Science & Technology, Government of India",
        "source": "https://surveyofindia.gov.in/pages/administrative-boundary-data-base-abdb-",
        "archive": {
            "filename": archive.get("archive", "State_District_Subdistrict_PAN INDIA.rar"),
            "sha256": archive.get("sha256"),
            "compressedBytes": archive.get("bytes"),
            "memberCount": archive.get("member_count"),
        },
        "retrievedAt": "2026-11-14",
        "scope": "Administrative/geospatial boundaries only; not individual parcel ownership, title, mutation, encumbrance or legal-rights data.",
        "coordinateReferenceSystem": "LCC_WGS84 (Lambert Conformal Conic; source PRJ files included in archive)",
        "normalization": {
            "masterStateUt": "DoLR 36-State/UT register and current LGD codes",
            "sourceIds": "ABDB source LGD codes are preserved separately; they are not silently rewritten to current LGD identifiers.",
        },
        "coverage": coverage,
        "disputedStateFeatures": disputed_states,
        "disputedOrUnassignedDistrictFeatures": disputed_districts,
        "invalidSubDistrictFeatures": invalid_subdistricts,
        "unmatchedSubDistrictParents": [
            {
                "stateCode": item["stateCode"], "stateName": item["stateName"],
                "districtName": item["districtName"],
                "sourceDistrictLgdCode": item["sourceDistrictLgdCode"],
                "subDistrictName": item["subDistrictName"],
                "sourceSubDistrictLgdCode": item["sourceSubDistrictLgdCode"],
                "sourceFeatureId": item["sourceFeatureId"],
            }
            for item in unmatched
        ],
        "states": indexed_states,
        "note": "ABDB is a geographic administrative reference, not a land-title register. ABDB feature totals do not exactly equal current DILRMP totals; disputed, incomplete and unmatched attributes are retained as quality metadata, not invented or silently filled.",
    }

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    def write_csv(file_path, fields, records):
        with file_path.open("w", newline="", encoding="utf-8-sig") as handle:
            writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
            writer.writeheader()
            writer.writerows(records)

    district_fields = [
        "stateCode", "stateName", "officialStateLgdCode", "sourceStateLgdCode",
        "districtName", "sourceDistrictLgdCode", "sourceFeatureId", "shapeLength", "shapeArea"
    ]
    subdistrict_fields = [
        "stateCode", "stateName", "officialStateLgdCode", "sourceStateLgdCode",
        "districtName", "sourceDistrictLgdCode", "subDistrictName", "sourceSubDistrictLgdCode",
        "subDistrictType", "sourceFeatureId", "parentDistrictFeatureId", "parentMatchMethod",
        "sourceDistrictCodeMismatch", "shapeLength", "shapeArea"
    ]
    write_csv(output.parent / "districts.csv", district_fields, all_districts)
    write_csv(output.parent / "subdistricts.csv", subdistrict_fields, subdistricts)
    print(json.dumps({
        "output": str(output),
        "districtCsv": str(output.parent / "districts.csv"),
        "subDistrictCsv": str(output.parent / "subdistricts.csv"),
        "coverage": coverage
    }, ensure_ascii=False, indent=2))


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        raise SystemExit(2)
    extracted_root = Path(sys.argv[1]).resolve()
    output = Path(sys.argv[2]).resolve()
    project_root = Path(__file__).resolve().parents[2]
    registry_file = Path(sys.argv[3]).resolve() if len(sys.argv) > 3 else project_root / "server/data/official-state-ut-registry.json"
    if not extracted_root.is_dir():
        raise SystemExit(f"Extracted ABDB directory does not exist: {extracted_root}")
    if not registry_file.is_file():
        raise SystemExit(f"State/UT registry JSON does not exist: {registry_file}")
    build(extracted_root, output, registry_file)


if __name__ == "__main__":
    main()
