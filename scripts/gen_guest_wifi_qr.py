#!/usr/bin/env python3
"""Regenerate the saloon display's guest WiFi QR image (issue #63 follow-up).

Reads the live guest WiFi password from homeassistant/esphome/secrets.yaml
(never hardcode it here) and renders a styled QR + title card in the Sisu
brand teal/blue/navy palette (sampled from "Sisu Good Life Logo"), then
writes it to homeassistant/esphome/images/sisu_guest_wifi.jpg — the file
saloon_display.yaml's `wifi_qr` image resizes to 480x480 at build time.

Deps (not vendored — install into a venv before running):
    pip install qrcode pillow

Usage:
    python3 scripts/gen_guest_wifi_qr.py
"""

from __future__ import annotations

import math
import re
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from qrcode import QRCode, constants
from qrcode.image.styledpil import StyledPilImage
from qrcode.image.styles.colormasks import VerticalGradiantColorMask
from qrcode.image.styles.moduledrawers import RoundedModuleDrawer

REPO_ROOT = Path(__file__).resolve().parent.parent
SECRETS_PATH = REPO_ROOT / "homeassistant" / "esphome" / "secrets.yaml"
OUT_PATH = REPO_ROOT / "homeassistant" / "esphome" / "images" / "sisu_guest_wifi.jpg"

SSID = "Sisu-Guest"
WIFI_SECURITY = "WPA"  # WPA2/3-Personal networks both use T:WPA in the QR spec

# Palette sampled from ~/Downloads/Sisu Good Life Logo.jpeg
TEAL = (65, 182, 174)  # sail teal — used for accents only, too light for modules
SKY_BLUE = (133, 208, 240)  # too light for modules — accent only
BRAND_BLUE = (6, 135, 174)  # "Sisu" wordmark blue
PINK = (216, 11, 80)  # "the good life" script accent
DARK_TEAL = (15, 139, 139)  # darkened brand teal — safe module contrast (4.1:1 on white)
NAVY_TEAL = (10, 46, 54)  # near-black teal — safe module contrast (14.4:1 on white)
WHITE = (255, 255, 255)
PALE_MINT = (240, 251, 250)

CANVAS_SIZE = (1350, 1600)
FONT_PATH = "/System/Library/Fonts/Supplemental/Arial Rounded Bold.ttf"


def read_secret(key: str) -> str:
    pattern = re.compile(rf"^{re.escape(key)}:\s*(.+?)\s*$")
    for line in SECRETS_PATH.read_text().splitlines():
        m = pattern.match(line)
        if m:
            return m.group(1).strip().strip('"').strip("'")
    raise KeyError(f"{key} not found in {SECRETS_PATH}")


def wifi_qr_payload(password: str) -> str:
    return f"WIFI:T:{WIFI_SECURITY};S:{SSID};P:{password};;"


def make_wifi_icon(diameter: int) -> Image.Image:
    """Teal->blue gradient circle with a thin pink ring and a white wifi glyph."""
    scale = 4  # supersample for clean anti-aliasing
    d = diameter * scale
    icon = Image.new("RGBA", (d, d), (0, 0, 0, 0))

    # Radial-ish gradient fill (diagonal top-left teal -> bottom-right blue).
    grad = Image.new("RGB", (d, d))
    gpix = grad.load()
    for y in range(d):
        t = y / (d - 1)
        r = round(DARK_TEAL[0] + (BRAND_BLUE[0] - DARK_TEAL[0]) * t)
        g = round(DARK_TEAL[1] + (BRAND_BLUE[1] - DARK_TEAL[1]) * t)
        b = round(DARK_TEAL[2] + (BRAND_BLUE[2] - DARK_TEAL[2]) * t)
        for x in range(d):
            gpix[x, y] = (r, g, b)

    mask = Image.new("L", (d, d), 0)
    ImageDraw.Draw(mask).ellipse([0, 0, d - 1, d - 1], fill=255)
    icon.paste(grad, (0, 0), mask)

    draw = ImageDraw.Draw(icon)
    # Thin pink accent ring just inside the circle edge, nodding to the logo's
    # "the good life" script color without competing with the wifi glyph.
    ring_w = max(2, d // 40)
    draw.ellipse(
        [ring_w, ring_w, d - 1 - ring_w, d - 1 - ring_w],
        outline=PINK,
        width=ring_w,
    )

    # White wifi glyph: 3 concentric arcs + a dot, centered in the lower half.
    cx, cy = d / 2, d * 0.62
    for i, radius_frac in enumerate((0.34, 0.24, 0.14)):
        radius = d * radius_frac
        bbox = [cx - radius, cy - radius, cx + radius, cy + radius]
        draw.arc(bbox, start=225, end=315, fill=WHITE, width=max(3, d // 22))
    dot_r = d * 0.045
    draw.ellipse([cx - dot_r, cy - dot_r, cx + dot_r, cy + dot_r], fill=WHITE)

    return icon.resize((diameter, diameter), Image.LANCZOS)


def gradient_text(draw_size, text, font, fill_top, fill_bottom):
    """Render text with a vertical gradient fill via an alpha mask."""
    mask = Image.new("L", draw_size, 0)
    ImageDraw.Draw(mask).text((0, 0), text, font=font, fill=255)

    grad = Image.new("RGB", draw_size)
    gpix = grad.load()
    h = draw_size[1]
    for y in range(h):
        t = y / max(1, h - 1)
        r = round(fill_top[0] + (fill_bottom[0] - fill_top[0]) * t)
        g = round(fill_top[1] + (fill_bottom[1] - fill_top[1]) * t)
        b = round(fill_top[2] + (fill_bottom[2] - fill_top[2]) * t)
        for x in range(draw_size[0]):
            gpix[x, y] = (r, g, b)

    out = Image.new("RGBA", draw_size, (0, 0, 0, 0))
    out.paste(grad, (0, 0), mask)
    return out


def build_qr_image(payload: str) -> Image.Image:
    qr = QRCode(
        error_correction=constants.ERROR_CORRECT_H,
        box_size=14,
        border=4,  # standard quiet zone — do not shrink, scanners rely on it
    )
    qr.add_data(payload)
    qr.make(fit=True)

    icon = make_wifi_icon(400)

    img = qr.make_image(
        image_factory=StyledPilImage,
        module_drawer=RoundedModuleDrawer(radius_ratio=0.9),
        color_mask=VerticalGradiantColorMask(
            back_color=WHITE, top_color=NAVY_TEAL, bottom_color=DARK_TEAL
        ),
        embedded_image=icon,
        embedded_image_ratio=0.22,
    )
    return img.convert("RGB")


def compose(qr_img: Image.Image) -> Image.Image:
    canvas = Image.new("RGB", CANVAS_SIZE, PALE_MINT)
    draw = ImageDraw.Draw(canvas)

    margin = 40
    card_box = [margin, margin, CANVAS_SIZE[0] - margin, CANVAS_SIZE[1] - margin]
    draw.rounded_rectangle(card_box, radius=48, fill=WHITE, outline=(210, 228, 226), width=3)

    title = SSID
    font = ImageFont.truetype(FONT_PATH, 130)
    bbox = draw.textbbox((0, 0), title, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    title_img = gradient_text((tw + 20, th + 40), title, font, NAVY_TEAL, BRAND_BLUE)
    canvas.paste(title_img, (int((CANVAS_SIZE[0] - tw) / 2) - 10, 90), title_img)

    qr_target_w = CANVAS_SIZE[0] - 2 * margin - 160
    scale = qr_target_w / qr_img.width
    qr_resized = qr_img.resize(
        (qr_target_w, round(qr_img.height * scale)), Image.LANCZOS
    )
    qx = (CANVAS_SIZE[0] - qr_resized.width) // 2
    qy = 340
    canvas.paste(qr_resized, (qx, qy))

    return canvas


def main() -> None:
    password = read_secret("guest_wifi_password")
    payload = wifi_qr_payload(password)
    qr_img = build_qr_image(payload)
    final = compose(qr_img)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    final.save(OUT_PATH, format="JPEG", quality=92)
    print(f"Wrote {OUT_PATH} ({final.size[0]}x{final.size[1]})")


if __name__ == "__main__":
    main()
