#!/usr/bin/env python3
"""Regenerate the saloon display's guest WiFi QR (issues #63 / #135).

Reads the live guest WiFi password from homeassistant/secrets.yaml (never
hardcode it here) and writes a *square* scannable QR to
homeassistant/esphome/images/sisu_guest_wifi.png — saloon_display.yaml
resizes that file to 400x400 at build time. The image is square on purpose:
a portrait card gets squashed by ESPHome's `resize: WxH`.

Center mark is the Sisu sail (`images/sisu_sail.png`, extracted from the
Good Life logo). Modules are circular, navy→teal gradient, both stops
checked to stay ≥7:1 against white so phones can still decode them.

Deps (venv, not vendored):
    pip install 'qrcode[pil]' pillow
    pip install opencv-python-headless   # optional, for --verify

Usage:
    python3 scripts/gen_guest_wifi_qr.py
    python3 scripts/gen_guest_wifi_qr.py --verify
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw
from qrcode import QRCode, constants
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import VerticalGradiantColorMask
from qrcode.image.styles.moduledrawers.pil import CircleModuleDrawer

REPO_ROOT = Path(__file__).resolve().parent.parent
SECRETS_PATH = REPO_ROOT / "homeassistant" / "secrets.yaml"
SAIL_PATH = REPO_ROOT / "homeassistant" / "esphome" / "images" / "sisu_sail.png"
OUT_PATH = REPO_ROOT / "homeassistant" / "esphome" / "images" / "sisu_guest_wifi.png"

SSID = "Sisu-Guest"
WIFI_SECURITY = "WPA"  # WPA2/3-Personal networks both use T:WPA in the QR spec

# Palette sampled from ~/Downloads/Sisu Good Life Logo.jpeg
# Module stops are darkened until white-on-module contrast is ≥7:1 (WCAG AAA)
# — the logo's own teal/sky (#41B6AE / #85D0F0) are 2.46:1 / 1.71:1, too light
# to put in the scan area. Brand teal is used on the sail and the badge ring.
NAVY = (10, 46, 54)  # 14.4:1 on white
TEAL_DARK = (12, 80, 82)  # 9.2:1 on white
TEAL = (65, 182, 174)  # logo sail teal — badge ring only
WHITE = (255, 255, 255)

CANVAS = 1200
BADGE_RATIO = 0.26  # of QR width; stays inside ERROR_CORRECT_H budget


def read_secret(key: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}:\s*(.+?)\s*$")
    for line in SECRETS_PATH.read_text().splitlines():
        m = pattern.match(line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    raise KeyError(f"{key} not found in {SECRETS_PATH}")


def wifi_qr_payload(password: str) -> str:
    return f"WIFI:T:{WIFI_SECURITY};S:{SSID};P:{password};;"


def contrast_ratio(fg: tuple[int, int, int], bg: tuple[int, int, int]) -> float:
    def lin(c: int) -> float:
        x = c / 255.0
        return x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4

    def lum(rgb: tuple[int, int, int]) -> float:
        r, g, b = rgb
        return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)

    lighter, darker = sorted((lum(fg), lum(bg)), reverse=True)
    return (lighter + 0.05) / (darker + 0.05)


def make_sail_badge(diameter: int) -> Image.Image:
    """White circle, teal ring, Sisu sail centered — scannable center mark."""
    if not SAIL_PATH.is_file():
        raise FileNotFoundError(
            f"{SAIL_PATH} missing — sail mark is a committed brand asset"
        )
    sail = Image.open(SAIL_PATH).convert("RGBA")

    scale = 4
    d = diameter * scale
    badge = Image.new("RGBA", (d, d), (0, 0, 0, 0))
    draw = ImageDraw.Draw(badge)
    draw.ellipse([0, 0, d - 1, d - 1], fill=WHITE)
    ring = max(3, d // 28)
    draw.ellipse(
        [ring // 2, ring // 2, d - 1 - ring // 2, d - 1 - ring // 2],
        outline=TEAL,
        width=ring,
    )

    # Sail sits inside the ring with a small inset.
    inset = ring * 3
    inner = d - 2 * inset
    sw, sh = sail.size
    fit = min(inner / sw, inner / sh)
    sail_r = sail.resize((max(1, round(sw * fit)), max(1, round(sh * fit))), Image.LANCZOS)
    sx = (d - sail_r.size[0]) // 2
    sy = (d - sail_r.size[1]) // 2
    badge.paste(sail_r, (sx, sy), sail_r)
    return badge.resize((diameter, diameter), Image.LANCZOS)


def build_qr_image(payload: str) -> Image.Image:
    qr = QRCode(
        error_correction=constants.ERROR_CORRECT_H,
        box_size=16,
        border=4,  # quiet zone — do not shrink
    )
    qr.add_data(payload)
    qr.make(fit=True)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=CircleModuleDrawer(),
        color_mask=VerticalGradiantColorMask(
            back_color=WHITE, top_color=NAVY, bottom_color=TEAL_DARK
        ),
    ).convert("RGBA")

    badge = make_sail_badge(round(img.width * BADGE_RATIO))
    bx = (img.width - badge.width) // 2
    by = (img.height - badge.height) // 2
    img.paste(badge, (bx, by), badge)
    return img.convert("RGB")


def compose_square(qr_img: Image.Image) -> Image.Image:
    """Pad to a square canvas with a white quiet margin. No title — the
    400x400 LVGL slot should be as much QR as possible."""
    canvas = Image.new("RGB", (CANVAS, CANVAS), WHITE)
    margin = 36
    target = CANVAS - 2 * margin
    scale = min(target / qr_img.width, target / qr_img.height)
    resized = qr_img.resize(
        (round(qr_img.width * scale), round(qr_img.height * scale)), Image.LANCZOS
    )
    x = (CANVAS - resized.width) // 2
    y = (CANVAS - resized.height) // 2
    canvas.paste(resized, (x, y))
    return canvas


def decode_at(path: Path, size: int, expected: str) -> str:
    import cv2  # optional extra

    img = Image.open(path).convert("RGB").resize((size, size), Image.LANCZOS)
    import numpy as np

    arr = np.array(img)[:, :, ::-1]  # RGB → BGR
    detector = cv2.QRCodeDetector()
    data, _, _ = detector.detectAndDecode(arr)
    if data != expected:
        raise SystemExit(
            f"decode failed at {size}x{size}: got {data!r}, expected payload match"
        )
    return data


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--verify",
        action="store_true",
        help="decode-check at 240/400/480/960 after writing",
    )
    args = parser.parse_args()

    for name, color in (("NAVY", NAVY), ("TEAL_DARK", TEAL_DARK)):
        ratio = contrast_ratio(WHITE, color)
        if ratio < 7.0:
            raise SystemExit(f"{name} contrast {ratio:.2f}:1 < 7:1 against white")

    password = read_secret("guest_wifi_password")
    payload = wifi_qr_payload(password)
    qr_img = build_qr_image(payload)
    final = compose_square(qr_img)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    final.save(OUT_PATH, format="PNG", optimize=True)
    print(f"Wrote {OUT_PATH} ({final.size[0]}x{final.size[1]})")
    print(
        f"module contrast navy {contrast_ratio(WHITE, NAVY):.1f}:1, "
        f"teal-dark {contrast_ratio(WHITE, TEAL_DARK):.1f}:1"
    )

    if args.verify:
        for size in (240, 400, 480, 960):
            decode_at(OUT_PATH, size, payload)
            print(f"decoded ok at {size}x{size}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
