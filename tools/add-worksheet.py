#!/usr/bin/env python3
"""학습지 추가 스크립트.

이미지(jpg/png/heic 등)나 PDF를 넣으면
  1) img/worksheets/wNN.jpg      (확대용, 긴 변 1400px)
  2) img/worksheets/thumb/wNN.jpg (썸네일, 긴 변 520px)
를 만들고 js/worksheets.js 목록 끝에 항목을 덧붙입니다.

사용법
  python3 tools/add-worksheet.py 사진.jpg
  python3 tools/add-worksheet.py 사진.jpg --title "진로활동 학습지"
  python3 tools/add-worksheet.py 스캔.pdf --title "직업탐색"     # PDF는 쪽마다 한 장씩
  python3 tools/add-worksheet.py a.jpg b.jpg --rotate -90        # 눕힌 사진 세우기
"""

import argparse
import json
import re
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow 가 필요합니다:  pip3 install pillow")

ROOT = Path(__file__).resolve().parent.parent
FULL_DIR = ROOT / "img" / "worksheets"
THUMB_DIR = FULL_DIR / "thumb"
LIST_FILE = ROOT / "js" / "worksheets.js"

FULL_MAX = 1400
THUMB_MAX = 520


def next_index() -> int:
    """이미 있는 wNN.jpg 중 가장 큰 번호 다음."""
    nums = [int(m.group(1)) for p in FULL_DIR.glob("w*.jpg")
            if (m := re.fullmatch(r"w(\d+)", p.stem))]
    return max(nums, default=0) + 1


def load_entries() -> list[dict]:
    if not LIST_FILE.exists():
        return []
    text = LIST_FILE.read_text(encoding="utf-8")
    return [{"file": f, "title": t}
            for f, t in re.findall(r'file:\s*"([^"]+)"\s*,\s*title:\s*"((?:[^"\\]|\\.)*)"', text)]


def write_entries(entries: list[dict]) -> None:
    body = ",\n".join(
        '  { file: %s, title: %s }' % (json.dumps(e["file"], ensure_ascii=False),
                                       json.dumps(e["title"], ensure_ascii=False))
        for e in entries)
    LIST_FILE.write_text(
        "/* 진로활동 학습지 목록.\n"
        "   순서대로 화면에 나옵니다. 새 학습지는 tools/add-worksheet.py 가 아래에 덧붙입니다.\n"
        "   제목만 고치고 싶으면 title 값을 직접 바꾸면 됩니다. */\n\n"
        "const WORKSHEETS = [\n" + body + "\n];\n",
        encoding="utf-8")


def save_pair(img: Image.Image, index: int, rotate: int) -> str:
    img = img.convert("RGB")
    if rotate:
        img = img.rotate(rotate, expand=True)
    name = f"w{index:02d}.jpg"

    full = img.copy()
    full.thumbnail((FULL_MAX, FULL_MAX), Image.LANCZOS)
    full.save(FULL_DIR / name, quality=80, optimize=True, progressive=True)

    thumb = img.copy()
    thumb.thumbnail((THUMB_MAX, THUMB_MAX), Image.LANCZOS)
    thumb.save(THUMB_DIR / name, quality=72, optimize=True)
    return name


def pages_from_pdf(path: Path):
    """PDF 각 쪽에 들어 있는 스캔 이미지를 꺼냅니다."""
    try:
        from pypdf import PdfReader
    except ImportError:
        sys.exit("PDF 를 넣으려면 pypdf 가 필요합니다:  pip3 install pypdf")
    import io as _io
    for page in PdfReader(str(path)).pages:
        for im in page.images:
            yield Image.open(_io.BytesIO(im.data))


def main() -> None:
    ap = argparse.ArgumentParser(description="학습지를 포트폴리오에 추가합니다.")
    ap.add_argument("files", nargs="+", help="이미지 또는 PDF 경로")
    ap.add_argument("--title", help="제목. 여러 장이면 뒤에 번호가 붙습니다. 생략하면 파일명.")
    ap.add_argument("--rotate", type=int, default=0,
                    help="회전 각도. 시계방향으로 세우려면 -90")
    args = ap.parse_args()

    FULL_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)

    entries = load_entries()
    index = next_index()
    added = []

    for raw in args.files:
        path = Path(raw).expanduser()
        if not path.exists():
            sys.exit(f"파일을 찾을 수 없습니다: {path}")

        images = list(pages_from_pdf(path)) if path.suffix.lower() == ".pdf" else [Image.open(path)]
        if not images:
            print(f"  건너뜀 — {path.name} 에서 이미지를 못 찾았습니다")
            continue

        base = args.title or path.stem
        for n, img in enumerate(images, 1):
            title = base if len(images) == 1 else f"{base} {n}"
            name = save_pair(img, index, args.rotate)
            entries.append({"file": name, "title": title})
            added.append((name, title))
            index += 1

    if not added:
        sys.exit("추가된 학습지가 없습니다.")

    write_entries(entries)
    print(f"학습지 {len(added)}장 추가 (총 {len(entries)}장)")
    for name, title in added:
        print(f"  {name}  {title}")
    print("\n브라우저를 새로고침하면 바로 보입니다.")


if __name__ == "__main__":
    main()
