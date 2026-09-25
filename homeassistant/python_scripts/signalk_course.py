#!/usr/bin/env python3
"""Signal K active course → route ETA for the Helm dashboard.

Source: Signal K course API on F8 (navigation.course) plus calcValues from
the course-provider plugin. Sisu Nav commits routes as SK resources; a
route or destination is "active" only once the course API is following it
(or the chartplotter is emitting RMB). See issue #138.

`DP` / `VP` / `WP<n>` are server placeholders for an unnamed point, not
waypoint names.

Usage:
  signalk_course.py data      # JSON for the HA command_line sensor (default)
  signalk_course.py health    # reachability + auth check only
  signalk_course.py raw       # course + calcValues, for debugging
  signalk_course.py selftest  # offline checks (no network)

Secrets (homeassistant/secrets.yaml or /config/secrets.yaml):
  signalk_host, signalk_port, SignalKUser, SignalKPwd
"""
from __future__ import annotations

import json
import math
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

_SECRET_CANDIDATES = (
    Path(__file__).resolve().parent.parent / "secrets.yaml",
    Path("/config/secrets.yaml"),
    Path("/homeassistant/secrets.yaml"),
)

_M_PER_NMI = 1852.0
# Below this, distance/SOG is not a passage ETA (GPS noise at anchor).
_MIN_SOG_MPS = 0.257  # 0.5 kn
_PLACEHOLDER_NAME = re.compile(r"^(DP|VP|WP\d*)$")

_FIELDS = (
    "online",
    "active",
    "status",
    "route_name",
    "destination_name",
    "eta",
    "time_to_go_s",
    "distance_nmi",
    "next_name",
    "next_eta",
    "next_time_to_go_s",
    "next_distance_nmi",
    "source",
)


def _load_secrets() -> dict[str, str]:
    out: dict[str, str] = {}
    for p in _SECRET_CANDIDATES:
        if not p.is_file():
            continue
        try:
            text = p.read_text(encoding="utf-8", errors="replace")
        except OSError:
            continue
        for line in text.splitlines():
            m = re.match(r'^([A-Za-z0-9_]+):\s*["\']?([^"\'#\n]*?)["\']?\s*(?:#.*)?$', line)
            if not m:
                continue
            k, v = m.group(1), m.group(2).strip()
            if v:
                out[k] = v
        if out:
            break
    return out


def _cfg() -> dict[str, str]:
    s = _load_secrets()
    return {
        "host": os.environ.get("SIGNALK_HOST") or s.get("signalk_host") or "192.168.0.21",
        "port": os.environ.get("SIGNALK_PORT") or s.get("signalk_port") or "3000",
        "user": os.environ.get("SIGNALK_USER") or s.get("SignalKUser") or "",
        "pwd": os.environ.get("SIGNALK_PWD") or s.get("SignalKPwd") or "",
    }


def _http_json(url: str, *, method: str = "GET", data: dict | None = None,
                headers: dict | None = None, timeout: float = 6.0,
                missing_ok: bool = False) -> Any:
    body = json.dumps(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, method=method,
                                  headers={"Content-Type": "application/json", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        if missing_ok and e.code == 404:
            return {}
        raise


def _login(cfg: dict[str, str]) -> str | None:
    if not cfg["user"] or not cfg["pwd"]:
        return None
    url = f"http://{cfg['host']}:{cfg['port']}/signalk/v1/auth/login"
    try:
        resp = _http_json(url, method="POST", data={"username": cfg["user"], "password": cfg["pwd"]})
        return resp.get("token")
    except (urllib.error.URLError, OSError, ValueError):
        return None


def _get(cfg: dict[str, str], token: str | None, path: str, *,
         version: str = "v1", missing_ok: bool = False) -> Any:
    url = f"http://{cfg['host']}:{cfg['port']}/signalk/{version}/api/vessels/self/{path}"
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    return _http_json(url, headers=headers, missing_ok=missing_ok)


def _unwrap(node: Any) -> Any:
    """SK v1 leaves are {value, timestamp, $source}. v2 course JSON is raw."""
    if isinstance(node, dict) and "value" in node and (
        "$source" in node or "timestamp" in node or "meta" in node
    ):
        return _unwrap(node["value"])
    return node


def _num(node: Any) -> float | None:
    node = _unwrap(node)
    if isinstance(node, bool) or not isinstance(node, (int, float)):
        return None
    if not math.isfinite(node) or node < 0:
        return None
    return float(node)


def _text(node: Any) -> str | None:
    node = _unwrap(node)
    if isinstance(node, str):
        node = node.strip()
        return node or None
    return None


def _real_name(node: Any) -> str | None:
    name = _text(node)
    if name and _PLACEHOLDER_NAME.match(name):
        return None
    return name


def _position(node: Any) -> tuple[float, float] | None:
    node = _unwrap(node)
    if not isinstance(node, dict):
        return None
    if "latitude" not in node and isinstance(node.get("position"), dict):
        node = node["position"]
    lat, lon = node.get("latitude"), node.get("longitude")
    if isinstance(lat, bool) or isinstance(lon, bool):
        return None
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)):
        return None
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    if not math.isfinite(lat) or not math.isfinite(lon):
        return None
    return float(lat), float(lon)


def _nmi(meters: float | None) -> float | None:
    if meters is None:
        return None
    return round(meters / _M_PER_NMI, 2)


def _seconds(value: float | None) -> int | None:
    if value is None:
        return None
    return int(round(value))


def _parse_time(node: Any) -> datetime | None:
    text = node if isinstance(node, str) else None
    if not text:
        return None
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None


def _fresh_value(node: Any, start: datetime | None) -> Any:
    """Drop a Signal K leaf whose timestamp predates the current course."""
    if not isinstance(node, dict) or "value" not in node:
        return None
    stamped = _parse_time(node.get("timestamp"))
    if start and stamped and stamped < start - timedelta(seconds=5):
        return None
    value = node.get("value")
    if value is None:
        return None
    return value


def _fresh_calc(tree: Any, start_text: Any) -> dict[str, Any]:
    """v1 calcValues, keeping only values published for the current course."""
    if not isinstance(tree, dict):
        return {}
    start = _parse_time(start_text)
    out: dict[str, Any] = {}
    for key in ("distance", "timeToGo", "estimatedTimeOfArrival"):
        value = _fresh_value(tree.get(key), start)
        if value is not None:
            out[key] = value
    route = tree.get("route") if isinstance(tree.get("route"), dict) else {}
    route_out: dict[str, Any] = {}
    for key in ("distance", "timeToGo", "estimatedTimeOfArrival"):
        value = _fresh_value(route.get(key), start)
        if value is not None:
            route_out[key] = value
    if route_out:
        out["route"] = route_out
    return out


def _iso(node: Any) -> str | None:
    text = _text(node)
    if text and "T" in text:
        return text
    return None


def _haversine_m(a: tuple[float, float], b: tuple[float, float]) -> float:
    radius = 6_371_000.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat, dlon = lat2 - lat1, lon2 - lon1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 2 * radius * math.asin(min(1.0, math.sqrt(h)))


def _eta_from_sog(distance_m: float | None, sog_mps: float | None) -> tuple[int | None, str | None]:
    if distance_m is None or sog_mps is None or sog_mps < _MIN_SOG_MPS:
        return None, None
    ttg = distance_m / sog_mps
    eta = (datetime.now(timezone.utc) + timedelta(seconds=ttg)).replace(microsecond=0)
    return _seconds(ttg), eta.isoformat().replace("+00:00", "Z")


def _blank(online: bool, *, status: str | None = None) -> dict[str, Any]:
    row: dict[str, Any] = {key: None for key in _FIELDS}
    row["online"] = online
    row["active"] = False
    if not online:
        row["status"] = "Signal K offline"
    else:
        row["status"] = status or "No active route"
    return row


def _route_points(active: dict) -> list[tuple[float, float]]:
    raw = active.get("waypoints")
    if not isinstance(raw, list):
        return []
    points: list[tuple[float, float]] = []
    for item in raw:
        if isinstance(item, dict):
            pos = _position(item)
        elif isinstance(item, (list, tuple)) and len(item) >= 2:
            # GeoJSON position is [lon, lat].
            lon, lat = item[0], item[1]
            pos = _position({"latitude": lat, "longitude": lon})
        else:
            pos = None
        if pos:
            points.append(pos)
    return points


def _geo_points(coords: Any) -> list[tuple[float, float]]:
    """GeoJSON positions are [lon, lat]. Also accepts {latitude, longitude}."""
    if not isinstance(coords, list):
        return []
    points: list[tuple[float, float]] = []
    for item in coords:
        if isinstance(item, (list, tuple)) and len(item) >= 2:
            pos = _position({"latitude": item[1], "longitude": item[0]})
        elif isinstance(item, dict):
            pos = _position(item)
        else:
            pos = None
        if pos:
            points.append(pos)
    return points


def _route_id(href: Any) -> str | None:
    text = _text(href)
    if not text:
        return None
    parts = [part for part in text.strip("/").split("/") if part]
    if "routes" not in parts:
        return None
    i = parts.index("routes")
    if i + 1 < len(parts):
        return parts[i + 1]
    return None


def _is_active(course: Any) -> bool:
    if not isinstance(course, dict):
        return False
    active = course.get("activeRoute")
    if isinstance(active, dict) and (
        _text(active.get("href")) or _real_name(active.get("name")) or _route_points(active)
    ):
        return True
    nxt = course.get("nextPoint")
    if isinstance(nxt, dict) and (_position(nxt) or _text(nxt.get("href"))):
        return True
    return False


def build(course: Any, calc: Any, position: Any, sog_mps: float | None,
          route_coords: Any = None) -> dict[str, Any]:
    """Flatten course + calcValues. Inactive courses emit nulls, never the last fix.

    route_coords is the route resource's GeoJSON coordinates. This server's
    course GET omits activeRoute.waypoints, so the remaining legs come from
    the resource when course-provider has not filled route.distance yet.
    """
    if not _is_active(course):
        return _blank(True)

    course = course if isinstance(course, dict) else {}
    calc = calc if isinstance(calc, dict) else {}
    active = course.get("activeRoute") if isinstance(course.get("activeRoute"), dict) else {}
    nxt = course.get("nextPoint") if isinstance(course.get("nextPoint"), dict) else {}
    route_calc = calc.get("route") if isinstance(calc.get("route"), dict) else {}

    route_name = _real_name(active.get("name"))
    next_name = _real_name(nxt.get("name"))
    points = _route_points(active) or _geo_points(route_coords)
    if active.get("reverse") is True:
        points = list(reversed(points))
    point_total = _num(active.get("pointTotal"))
    if point_total is None and points:
        point_total = float(len(points))
    point_index = _num(active.get("pointIndex"))
    index = int(point_index) if point_index is not None else 0
    multi = (point_total or 0) > 1 or len(points) > 1

    if multi and not next_name:
        total = int(point_total or len(points) or 0)
        shown = index + 1
        next_name = f"Point {shown} of {total}" if total else f"Point {shown}"

    dest_m = _num(route_calc.get("distance"))
    dest_ttg = _num(route_calc.get("timeToGo"))
    dest_eta = _iso(route_calc.get("estimatedTimeOfArrival"))
    next_m = _num(calc.get("distance"))
    next_ttg = _num(calc.get("timeToGo"))
    next_eta = _iso(calc.get("estimatedTimeOfArrival"))
    source = "course-provider" if any(
        v is not None for v in (dest_m, dest_ttg, dest_eta, next_m, next_ttg, next_eta)
    ) else None

    # A single destination has no route totals; the next-point figures are the passage.
    if dest_m is None and not multi:
        dest_m, dest_ttg, dest_eta = next_m, next_ttg, next_eta

    origin = _position(position)
    if points:
        index = max(0, min(index, len(points) - 1))
    if next_m is None and origin is not None and points:
        next_m = _haversine_m(origin, points[index])
        source = source or "derived"
    elif next_m is None:
        nxt_pos = _position(nxt)
        if origin and nxt_pos:
            next_m = _haversine_m(origin, nxt_pos)
            source = source or "derived"
    # course-provider's route.distance is the passage total. When it is absent,
    # add the legs after the next point (the course payload does not carry them).
    if dest_m is None and next_m is not None:
        extra = 0.0
        if multi and points:
            for i in range(index, len(points) - 1):
                extra += _haversine_m(points[i], points[i + 1])
        dest_m = next_m + extra
        if extra or source != "course-provider":
            source = "derived"

    if dest_eta is None or dest_ttg is None:
        sog_ttg, sog_eta = _eta_from_sog(dest_m, sog_mps)
        if dest_ttg is None:
            dest_ttg = sog_ttg
        if dest_eta is None:
            dest_eta = sog_eta
        if source is None and (dest_ttg is not None or dest_eta is not None):
            source = "derived"
    if multi and (next_eta is None or next_ttg is None):
        sog_ttg, sog_eta = _eta_from_sog(next_m, sog_mps)
        if next_ttg is None:
            next_ttg = sog_ttg
        if next_eta is None:
            next_eta = sog_eta

    label = route_name or next_name or "Destination"
    row = _blank(True)
    row["active"] = True
    row["status"] = label
    row["route_name"] = route_name
    row["destination_name"] = label
    row["eta"] = dest_eta
    row["time_to_go_s"] = _seconds(dest_ttg)
    row["distance_nmi"] = _nmi(dest_m)
    row["source"] = source
    # Next-waypoint rows only when the route has a further point than the destination.
    if multi:
        row["next_name"] = next_name
        row["next_eta"] = next_eta
        row["next_time_to_go_s"] = _seconds(next_ttg)
        row["next_distance_nmi"] = _nmi(next_m)
    return row


def health() -> dict[str, Any]:
    cfg = _cfg()
    token = _login(cfg)
    return {"host": cfg["host"], "port": cfg["port"], "authenticated": token is not None}


def raw() -> Any:
    cfg = _cfg()
    token = _login(cfg)
    if token is None:
        return {"online": False}
    return {
        "course": _get(cfg, token, "navigation/course", version="v2", missing_ok=True),
        "calcValues": _get(cfg, token, "navigation/course/calcValues", version="v2", missing_ok=True),
    }


def _route_coords(cfg: dict[str, str], token: str, course: Any) -> Any:
    """LineString coordinates for the active route, or None."""
    if not isinstance(course, dict):
        return None
    active = course.get("activeRoute")
    if not isinstance(active, dict):
        return None
    rid = _route_id(active.get("href"))
    if not rid:
        return None
    url = f"http://{cfg['host']}:{cfg['port']}/signalk/v2/api/resources/routes/{rid}"
    headers = {"Authorization": f"Bearer {token}"}
    try:
        rec = _http_json(url, headers=headers, missing_ok=True)
    except (urllib.error.URLError, OSError, ValueError):
        return None
    if not isinstance(rec, dict):
        return None
    feature = rec.get("feature")
    geom = feature.get("geometry") if isinstance(feature, dict) else None
    if not isinstance(geom, dict):
        return None
    return geom.get("coordinates")


def data() -> dict[str, Any]:
    cfg = _cfg()
    token = _login(cfg)
    if token is None:
        return _blank(False)
    try:
        course = _get(cfg, token, "navigation/course", version="v2", missing_ok=True)
    except (urllib.error.URLError, OSError, ValueError):
        return _blank(False)
    start = course.get("startTime") if isinstance(course, dict) else None
    # v1 leaves carry timestamps. Values older than this course are the
    # previous destination and must not be shown as the new route. Fall
    # back to the unstamped v2 payload only when v1 itself is missing.
    v1_ok = False
    calc: dict[str, Any] = {}
    try:
        v1_calc = _get(cfg, token, "navigation/course/calcValues", missing_ok=True)
        v1_ok = isinstance(v1_calc, dict)
        if v1_ok:
            calc = _fresh_calc(v1_calc, start)
    except (urllib.error.URLError, OSError, ValueError):
        v1_ok = False
    if not v1_ok:
        try:
            v2_calc = _get(cfg, token, "navigation/course/calcValues", version="v2", missing_ok=True)
            calc = v2_calc if isinstance(v2_calc, dict) else {}
        except (urllib.error.URLError, OSError, ValueError):
            calc = {}
    try:
        position = _get(cfg, token, "navigation/position", missing_ok=True)
    except (urllib.error.URLError, OSError, ValueError):
        position = {}
    try:
        sog = _get(cfg, token, "navigation/speedOverGround", missing_ok=True)
    except (urllib.error.URLError, OSError, ValueError):
        sog = {}
    try:
        coords = _route_coords(cfg, token, course)
    except (urllib.error.URLError, OSError, ValueError):
        coords = None
    return build(course, calc, position, _num(sog), coords)


def selftest() -> None:
    stale_calc = {
        "distance": 5000,
        "timeToGo": 1000,
        "estimatedTimeOfArrival": "2026-01-01T00:00:00Z",
        "route": {"distance": 9000, "timeToGo": 2000, "estimatedTimeOfArrival": "2026-06-01T00:00:00Z"},
    }
    cleared = build({"activeRoute": None, "nextPoint": None}, stale_calc, None, 2.0)
    assert cleared["online"] is True and cleared["active"] is False
    assert cleared["status"] == "No active route"
    assert cleared["eta"] is None and cleared["distance_nmi"] is None
    assert cleared["next_eta"] is None

    live_like = build(
        {
            "activeRoute": None,
            "nextPoint": {
                "position": {"latitude": 12.01217, "longitude": -61.74006333333333},
                "type": "Location",
                "name": "DP",
            },
        },
        {
            "distance": 685863.2846277945,
            "timeToGo": 25469061.83,
            "estimatedTimeOfArrival": "2027-07-17T09:04:26.590Z",
            "route": {"distance": None, "timeToGo": None, "estimatedTimeOfArrival": None},
        },
        {"value": {"latitude": 18.04, "longitude": -63.09}, "timestamp": "t", "$source": "x"},
        0.028,
    )
    assert live_like["active"] is True
    assert live_like["status"] == "Destination"  # "DP" is a placeholder
    assert live_like["distance_nmi"] == 370.34
    assert live_like["eta"] == "2027-07-17T09:04:26.590Z"
    assert live_like["time_to_go_s"] == 25469062
    assert live_like["source"] == "course-provider"
    assert live_like["next_name"] is None  # same point as the destination

    route = build(
        {
            "activeRoute": {
                "href": "/resources/routes/abc",
                "name": "BVI hop",
                "pointIndex": 0,
                "pointTotal": 3,
                "waypoints": [
                    {"latitude": 18.4, "longitude": -64.6},
                    {"latitude": 18.5, "longitude": -64.5},
                    {"latitude": 18.6, "longitude": -64.4},
                ],
            },
            "nextPoint": {"type": "RoutePoint", "position": {"latitude": 18.4, "longitude": -64.6}},
        },
        {
            "distance": 1852,
            "timeToGo": 600,
            "estimatedTimeOfArrival": "2026-09-25T16:00:00Z",
            "route": {
                "distance": 18520,
                "timeToGo": 7200,
                "estimatedTimeOfArrival": "2026-09-25T18:00:00Z",
            },
        },
        {"latitude": 18.3, "longitude": -64.7},
        2.5,
    )
    assert route["status"] == "BVI hop"
    assert route["distance_nmi"] == 10.0
    assert route["eta"] == "2026-09-25T18:00:00Z"
    assert route["time_to_go_s"] == 7200
    assert route["next_name"] == "Point 1 of 3"
    assert route["next_distance_nmi"] == 1.0
    assert route["next_eta"] == "2026-09-25T16:00:00Z"
    assert route["source"] == "course-provider"

    derived = build(
        {"activeRoute": None, "nextPoint": {"position": {"latitude": 18.1, "longitude": -64.0}, "name": "DP"}},
        {},
        {"latitude": 18.0, "longitude": -64.0},
        0.01,
    )
    assert derived["source"] == "derived"
    assert derived["distance_nmi"] is not None and 5.9 <= derived["distance_nmi"] <= 6.2
    assert derived["eta"] is None  # not making way; do not invent a year-long ETA

    making_way = build(
        {"activeRoute": None, "nextPoint": {"position": {"latitude": 18.1, "longitude": -64.0}}},
        {},
        {"latitude": 18.0, "longitude": -64.0},
        2.0,
    )
    assert making_way["eta"] is not None and making_way["time_to_go_s"] is not None

    # Course GET on this server has pointTotal but no waypoints. Remaining
    # distance has to include the legs after the next point.
    summed = build(
        {
            "activeRoute": {
                "href": "/resources/routes/fd22011f-7ba4-4aba-b894-21f63264c307",
                "name": "BVI test hop",
                "pointIndex": 0,
                "pointTotal": 3,
                "reverse": False,
            },
            "nextPoint": {
                "type": "RoutePoint",
                "position": {"latitude": 18.405, "longitude": -64.575},
                "name": "",
            },
        },
        {},
        {"latitude": 18.04067, "longitude": -63.09195},
        0.02,
        [[-64.575, 18.405], [-64.410, 18.447], [-64.3455, 18.501]],
    )
    assert summed["status"] == "BVI test hop"
    assert summed["next_name"] == "Point 1 of 3"
    assert summed["source"] == "derived"
    assert summed["next_distance_nmi"] is not None and summed["distance_nmi"] is not None
    assert summed["distance_nmi"] > summed["next_distance_nmi"] + 10

    stale = _fresh_calc(
        {
            "distance": {
                "value": 685863,
                "timestamp": "2026-09-25T13:59:01Z",
                "$source": "course-provider",
            },
            "estimatedTimeOfArrival": {
                "value": "2027-07-17T09:26:47Z",
                "timestamp": "2026-09-25T13:59:01Z",
                "$source": "course-provider",
            },
        },
        "2026-09-25T14:40:00Z",
    )
    assert "distance" not in stale and "estimatedTimeOfArrival" not in stale
    fresh = _fresh_calc(
        {"distance": {"value": 1000, "timestamp": "2026-09-25T14:40:05Z", "$source": "course-provider"}},
        "2026-09-25T14:40:00Z",
    )
    assert fresh["distance"] == 1000

    offline = _blank(False)
    assert offline["status"] == "Signal K offline" and offline["eta"] is None
    print("selftest ok")


def main() -> None:
    cmd = sys.argv[1] if len(sys.argv) > 1 else "data"
    if cmd == "health":
        print(json.dumps(health()))
    elif cmd == "raw":
        print(json.dumps(raw()))
    elif cmd == "selftest":
        selftest()
    else:
        print(json.dumps(data(), allow_nan=False))


if __name__ == "__main__":
    main()
