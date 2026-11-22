"""Export original LOCAIZ brand assets and local web photography.

Install pillow and pymupdf, then run this script from the repository root.
Optional --hero and --products paths rebuild the photos from their originals.
"""

import argparse
import io
import math
import re
import zipfile
from pathlib import Path

import pymupdf
from PIL import Image


INK, MILK = "#0A0A0A", "#FFF6EC"
ROOT = Path("brand-kit")
SIZES = (16, 32, 48, 64, 128, 180, 192, 256, 512, 1024)
MONOGRAM = re.search(r'd="([^"]+)"', Path("public/brand/symbol.svg").read_text()).group(1)
WORDMARK = re.search(r'd="([^"]+)"', Path("public/brand/wordmark.svg").read_text()).group(1)


def path(data, color, transform=""):
    return f'<path fill="{color}" d="{data}" transform="{transform}"/>'


def svg(width, height, contents):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">{contents}</svg>'


def box(width, height, color, radius=0):
    return f'<rect width="{width}" height="{height}" rx="{radius}" fill="{color}"/>'


def horizontal(color=INK, with_tagline=False):
    contents = path(MONOGRAM, color) + path(WORDMARK, color, "translate(45 8)")
    if with_tagline:
        contents += '<text x="45" y="40" font-family="sans-serif" font-size="7.8" fill="' + color + '">Local Roots. Global Reach.</text>'
    return svg(165, 46 if with_tagline else 40, contents)


def document(vector):
    with pymupdf.open(stream=vector.encode(), filetype="svg") as source:
        return pymupdf.open(stream=source.convert_to_pdf(), filetype="pdf")


def raster(vector, size):
    with document(vector) as pdf:
        page = pdf[0]
        scale = size / max(page.rect.width, page.rect.height)
        pixels = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=True)
        return Image.open(io.BytesIO(pixels.tobytes("png"))).convert("RGBA")


def export_primary_eps(target, vector):
    with document(vector) as pdf:
        page = pdf[0]
        width, height = page.rect.width, page.rect.height
        commands = ["%!PS-Adobe-3.0 EPSF-3.0", f"%%BoundingBox: 0 0 {math.ceil(width)} {math.ceil(height)}", "%%EndComments"]
        for shape in page.get_drawings():
            rgb = " ".join(f"{channel:.5f}" for channel in shape["fill"])
            commands.extend([f"{rgb} setrgbcolor", "newpath"])
            end = None
            for operation, *geometry in shape["items"]:
                if operation == "re":
                    rect, direction = geometry
                    corners = [rect.tl, rect.tr, rect.br, rect.bl]
                    if direction < 0:
                        corners.reverse()
                    for index, point in enumerate(corners):
                        command = "moveto" if index == 0 else "lineto"
                        commands.append(f"{point.x:.4f} {height - point.y:.4f} {command}")
                    commands.append("closepath")
                    end = None
                    continue
                if operation != "l":
                    raise ValueError(f"Unexpected shape in the primary EPS: {operation}")
                start, finish = geometry
                if end != start:
                    commands.append(f"{start.x:.4f} {height - start.y:.4f} moveto")
                commands.append(f"{finish.x:.4f} {height - finish.y:.4f} lineto")
                end = finish
            commands.append("eofill" if shape.get("even_odd") else "fill")
        commands.append("%%EOF")
    target.write_text("\n".join(commands) + "\n", encoding="ascii")


def export(name, vector, formats=()):
    target = ROOT / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.with_suffix(".svg").write_text(vector, encoding="utf-8")
    if "pdf" in formats:
        with document(vector) as pdf:
            pdf.save(target.with_suffix(".pdf"))
    if set(formats) & {"png", "jpg", "webp", "ico"}:
        bitmap = raster(vector, 1024)
        for extension in ("png", "webp", "ico"):
            if extension in formats:
                bitmap.save(target.with_suffix("." + extension))
        if "jpg" in formats:
            opaque = Image.new("RGB", bitmap.size, MILK)
            opaque.paste(bitmap, mask=bitmap.getchannel("A"))
            opaque.save(target.with_suffix(".jpg"), quality=92)


def guidelines():
    def color(hex_code):
        return tuple(int(hex_code[offset:offset + 2], 16) / 255 for offset in (1, 3, 5))

    paper, ink, muted = color(MILK), color(INK), color("#5C5752")
    guide = pymupdf.open()
    pages = [
        ("01 / Identity", "Local Roots. Global Reach.", [
            ("Concept", "The angular L/Z monogram shares a diagonal between the local starting point and global movement. The geometric wordmark stays legible at header size."),
            ("Direction selection", "The custom wordmark reads most clearly. The L/Z monogram holds up at app-icon size. The connected-market study carries more detail and suits larger illustrations. The primary lockup pairs the first two."),
            ("Construction", "The symbol uses a 40-unit frame and a 5-unit stroke. The six wordmark letters use a shared 20-unit cap height and angled terminals."),
        ]),
        ("02 / Application", "A clear, warm identity.", [
            ("Clear space and scale", "Keep at least 5 symbol units clear around the mark. Prefer 120 CSS px or 32 mm for the full lockup. Use the simplified app icon at 16 CSS px."),
            ("Palette", "Royal Black #0A0A0A and Creamy Light Milk #FFF6EC define the brand. Supporting neutrals: #1A1A1A, #242424, #5C5752, #E8DDCF, #F4EBDD and #FFFBF6."),
            ("Typography and iconography", "Space Grotesk for display and Manrope for UI. Use consistent Lucide outline icons and label commerce actions."),
            ("Correct use", "Use the black lockup on cream and the cream lockup on black. Use the horizontal lockup in the header and the monogram for icons and profiles."),
            ("Incorrect use", "Keep the geometry, spacing and contrast intact. Avoid stretching, recolouring, adding shadows or placing the mark over a busy photograph."),
        ]),
    ]
    for label, headline, blocks in pages:
        page = guide.new_page(width=595, height=842)
        page.draw_rect(page.rect, color=None, fill=paper)
        page.insert_text((52, 65), "LOCAIZ / BRAND GUIDELINES", fontsize=11, fontname="hebo", color=muted)
        page.insert_text((52, 102), label, fontsize=12, color=muted)
        page.insert_text((52, 150), headline, fontsize=34, fontname="hebo", color=ink)
        with document(horizontal(with_tagline=True)) as logo:
            page.show_pdf_page(pymupdf.Rect(52, 173, 370, 262), logo)
        for index, (title, body) in enumerate(blocks):
            y = 311 + index * 85
            page.draw_line((52, y - 17), (543, y - 17), color=muted, width=.4)
            page.insert_text((52, y), title, fontsize=13, fontname="hebo", color=ink)
            result = page.insert_textbox(pymupdf.Rect(52, y + 8, 543, y + 67), body, fontsize=10.5, lineheight=1.25, color=muted)
            if result < 0:
                raise ValueError(f"Guideline text does not fit: {title}")
    page = guide.new_page(width=595, height=842)
    page.draw_rect(page.rect, color=None, fill=paper)
    page.insert_text((52, 65), "LOCAIZ / BRAND GUIDELINES", fontsize=11, fontname="hebo", color=muted)
    page.insert_text((52, 102), "03 / Examples", fontsize=12, color=muted)
    page.insert_text((52, 150), "From storefront to screen.", fontsize=32, fontname="hebo", color=ink)
    swatches = [INK, MILK, "#1A1A1A", "#242424", "#5C5752", "#E8DDCF", "#F4EBDD", "#FFFBF6"]
    for index, swatch in enumerate(swatches):
        x = 52 + index % 4 * 124
        y = 192 + index // 4 * 74
        page.draw_rect(pymupdf.Rect(x, y, x + 119, y + 48), color=muted, fill=color(swatch), width=.45)
        page.insert_text((x, y + 62), swatch, fontsize=9, color=ink)
    wraps = [
        ("Digital storefront · Light theme", 366, paper, INK),
        ("Business card · Dark theme", 485, ink, MILK),
    ]
    for title, y, background, foreground in wraps:
        page.insert_text((52, y), title, fontsize=13, fontname="hebo", color=ink)
        page.draw_rect(pymupdf.Rect(52, y + 12, 543, y + 96), color=muted, fill=background, width=.45)
        with document(horizontal(foreground, with_tagline=True)) as logo:
            page.show_pdf_page(pymupdf.Rect(72, y + 29, 266, y + 79), logo)
    page.insert_text((52, 609), "Application icon and social profile", fontsize=13, fontname="hebo", color=ink)
    for index, radius in enumerate((8, 20)):
        with document(svg(40, 40, box(40, 40, INK, radius) + path(MONOGRAM, MILK))) as logo:
            x = 52 + 96 * index
            page.show_pdf_page(pymupdf.Rect(x, 625, x + 74, 699), logo)
    target = ROOT / "guidelines/LOCAIZ-Brand-Guidelines.pdf"
    target.parent.mkdir(parents=True, exist_ok=True)
    guide.save(target)
    guide.close()


def build():
    export("concepts/01-geometric-wordmark", svg(114, 24, path(WORDMARK, INK)))
    export("concepts/02-local-global-monogram", svg(40, 40, path(MONOGRAM, INK)))
    export("concepts/03-connected-market", svg(40, 40, path("M5 5h12v4H9v8H5zm18 0h12v12h-4V9h-8zM5 23h4v8h8v4H5zm26 0h4v12H23v-4h8zM13 19l6-6h4l5 5-3 3-4-4-5 5 4 4-3 3-5-5z", INK)))
    export("master/locaiz-primary", horizontal(), ("pdf", "png", "jpg", "webp"))
    export_primary_eps(ROOT / "master/locaiz-primary.eps", horizontal())
    export("horizontal/locaiz-tagline", horizontal(with_tagline=True), ("pdf", "png"))
    export("horizontal/locaiz-light", horizontal().replace(">", ">" + box(165, 40, MILK), 1), ("png", "jpg", "webp"))
    export("horizontal/locaiz-inverted", horizontal(MILK).replace(">", ">" + box(165, 40, INK), 1), ("png", "jpg", "webp"))
    export("vertical/locaiz-stacked", svg(134, 77, path(MONOGRAM, INK, "translate(47 2)") + path(WORDMARK, INK, "translate(10 48)")), ("png", "pdf"))
    export("wordmark/locaiz-wordmark", svg(114, 24, path(WORDMARK, INK)), ("pdf", "png"))
    export("symbols/locaiz-monogram", svg(40, 40, path(MONOGRAM, INK)), ("pdf", "png"))
    export("monochrome/black", horizontal("#000000"), ("png",))
    export("monochrome/white", horizontal("#FFFFFF"), ("png",))
    export("transparent/on-light", horizontal(), ("png", "webp"))
    export("transparent/on-dark", horizontal(MILK), ("png", "webp"))
    icon = svg(40, 40, box(40, 40, INK, 8) + path(MONOGRAM, MILK))
    export("app-icons/rounded", icon)
    export("favicon/locaiz", icon, ("ico",))
    export("social/locaiz-profile", svg(40, 40, box(40, 40, INK, 20) + path(MONOGRAM, MILK)), ("png", "jpg", "webp"))
    export("animation/locaiz-loading", svg(40, 40, '[STYLE]' + path(MONOGRAM, INK)).replace('[STYLE]', '<style>@keyframes pulse{50%{opacity:.35}}@media(prefers-reduced-motion:no-preference){path{animation:pulse 1.4s infinite}}</style>'))
    for size in SIZES:
        image = raster(icon, size)
        image.save(ROOT / f"app-icons/locaiz-{size}.png")
        if size in (180, 192, 512):
            image.save(Path("public/brand") / f"locaiz-{size}.png")
    guidelines()
    with zipfile.ZipFile("LOCAIZ-Brand-Kit.zip", "w", zipfile.ZIP_DEFLATED) as archive:
        for file in sorted(ROOT.rglob("*")):
            if file.is_file():
                archive.write(file)
    with zipfile.ZipFile("LOCAIZ-Brand-Kit.zip") as archive:
        if bad_entry := archive.testzip():
            raise ValueError(f"Invalid archive entry: {bad_entry}")


def photos(hero, products):
    folder = Path("public/images")
    folder.mkdir(parents=True, exist_ok=True)
    if hero:
        with Image.open(hero) as image:
            image.thumbnail((1450, 1000), Image.Resampling.LANCZOS)
            image.convert("RGB").save(folder / "hero.webp", quality=88)
    if products:
        with Image.open(products) as image:
            width, height = image.size
            for index, name in enumerate(("headphones", "cups", "lamp", "tote")):
                x, y = (index % 2) * (width // 2), (index // 2) * (height // 2)
                slice_ = image.crop((x, y, x + width // 2, y + height // 2)).convert("RGB")
                slice_.thumbnail((720, 520), Image.Resampling.LANCZOS)
                slice_.save(folder / f"{name}.webp", quality=87)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--hero")
    parser.add_argument("--products")
    args = parser.parse_args()
    photos(args.hero, args.products)
    build()
