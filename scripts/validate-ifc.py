# Part of the APK.audio project — http://APK.audio — made by Anthony Kuzub
# MIT Licence. Free, for everyone, for ever. Full text in LICENSE at the root.
"""The IfcOpenShell check of an exported model (ROAD-3583). Test-time only: IfcOpenShell is LGPL and never
vendored, never loaded by the page.

    python3 -I scripts/validate-ifc.py model.ifc [more.ifc ...]

prints one JSON object per file:
  schema         FILE_SCHEMA (IFC4X3_ADD2)
  statements     ifcopenshell.validate with express_rules=True: every schema and where-rule finding
  pset_problems  every Pset_/Qto_ against the IFC4X3 templates and every APK_ set against apk_psets.py, plus
                 every IfcRelConnectsPorts SOURCE -> SINK, by the BIM repo's oracle (tools/ifc/oracle.py) when
                 it is beside this app
  structural     the apk-av.ids specifications editors_census.py holds every editor to, that failed
  counts         entities per class, for the test's own checks
Exit status 1 when any file has a statement, a set / connection problem or a failed structural spec.
"""
import json
import sys
from collections import Counter
from pathlib import Path

import ifcopenshell
import ifcopenshell.validate

HERE = Path(__file__).resolve().parent
TOOLS = HERE.parents[4] / "POD.database/DATABASE.server.BIM/SRC/tools/ifc"
STRUCTURAL = ("Every port a schematic joins says which way the signal runs", "Planned subnets carry their prefix",
              "Every space is part of a storey")


def statements(f):
    log = ifcopenshell.validate.json_logger()
    ifcopenshell.validate.validate(f, log, express_rules=True)
    return [str(s.get("message", s)) if isinstance(s, dict) else str(s) for s in log.statements]


def main(paths):
    oracle = None
    if (TOOLS / "oracle.py").exists():
        sys.path.insert(0, str(TOOLS))
        import oracle  # noqa: E402
    worst = 0
    for path in paths:
        f = ifcopenshell.open(path)
        st = statements(f)
        pp = (oracle.pset_problems(f) + getattr(oracle, "connection_problems", lambda _f: [])(f)) if oracle else []
        structural = [n for n, ok, _n, _why in oracle.ids_results(f) if not ok and n in STRUCTURAL] if oracle else []
        counts = Counter(e.is_a() for e in f)
        print(json.dumps({"file": path, "schema": f.schema_identifier, "statements": len(st), "first": st[:5],
                          "pset_problems": pp, "structural": structural, "counts": dict(sorted(counts.items())),
                          "oracle": bool(oracle)}))
        if st or pp or structural:
            worst = 1
    return worst


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
