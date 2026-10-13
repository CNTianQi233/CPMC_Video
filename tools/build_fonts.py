#!/usr/bin/env python3
"""Download the MV's fonts from Google Fonts and subset them to the glyphs used.

The glyph set is: every character in assets/lyrics.lrc, every non-ASCII
character in src/ and index.html, printable ASCII and the full kana blocks.
Outputs small .woff2 files into assets/fonts/ (all fonts are SIL OFL 1.1).

Requires: pip install fonttools brotli
Usage:    python3 tools/build_fonts.py
"""
import io
import pathlib
import re
import urllib.request

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "fonts"

FONTS = [
    # (Google Fonts family query, output file)
    ("Zen+Maru+Gothic:wght@700", "ZenMaruGothic-Bold.woff2"),
    ("Zen+Maru+Gothic:wght@900", "ZenMaruGothic-Black.woff2"),
    ("ZCOOL+KuaiLe", "ZCOOLKuaiLe-Regular.woff2"),
    ("Dela+Gothic+One", "DelaGothicOne-Regular.woff2"),
]


def glyph_text():
    chars = set(chr(c) for c in range(0x20, 0x7F))
    chars |= set(chr(c) for c in range(0x3040, 0x3100))  # hiragana + katakana
    chars |= set("　、。・「」『』！？〜ー…（）：／￥¥×÷−±≈≠√∞πΣ∫∂φ²³½♪★☆✦✓✕→←↑↓▶⏸⛶")
    lrc = (ROOT / "assets" / "lyrics.lrc").read_text(encoding="utf-8")
    chars |= set(re.sub(r"\[\d+:\d+(?:[.:]\d+)?\]", "", lrc))
    for path in [ROOT / "index.html", *sorted((ROOT / "src").glob("*.js"))]:
        chars |= set(c for c in path.read_text(encoding="utf-8") if ord(c) > 0x7F)
    return "".join(sorted(c for c in chars if not c.isspace() or c == " "))


def fetch_ttf(family):
    css_url = f"https://fonts.googleapis.com/css2?family={family}"
    # an old user agent makes Google Fonts serve one plain TTF per style
    req = urllib.request.Request(css_url, headers={"User-Agent": "curl/8"})
    css = urllib.request.urlopen(req).read().decode()
    url = re.search(r"url\((https://[^)]+\.ttf)\)", css).group(1)
    return urllib.request.urlopen(url).read()


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    text = glyph_text()
    for family, name in FONTS:
        font = TTFont(io.BytesIO(fetch_ttf(family)))
        opts = subset.Options()
        opts.flavor = "woff2"
        opts.layout_features = ["*"]
        opts.name_IDs = ["*"]
        sub = subset.Subsetter(opts)
        sub.populate(text=text)
        sub.subset(font)
        font.flavor = "woff2"
        font.save(OUT / name)
        print(f"{name}: {(OUT / name).stat().st_size // 1024} KiB")


if __name__ == "__main__":
    main()
