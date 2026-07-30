#!/usr/bin/env python3
"""Generate the branded Chasa polite invoice templates PDF pack.

Reads apps/web/public/free-templates/templates.json and writes
apps/web/public/free-templates/chasa-polite-invoice-templates.pdf

Run from repo root (after generate-free-templates.mjs):
  python3 apps/web/scripts/generate-templates-pdf.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from reportlab.lib.colors import Color, HexColor, white
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    Image,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / "apps" / "web" / "public"
TEMPLATES_JSON = PUBLIC / "free-templates" / "templates.json"
OUT_PDF = PUBLIC / "free-templates" / "chasa-polite-invoice-templates.pdf"
LOGO = PUBLIC / "brand" / "chasa-icon-512.png"
if not LOGO.exists():
    LOGO = PUBLIC / "brand" / "chasa-icon.png"

ACCENT = HexColor("#EC683C")
INK = HexColor("#1B3155")
MUTED = HexColor("#6B7A90")
PAPER = HexColor("#F2F4F8")
LINE = HexColor("#D5DBE6")


def build_styles():
    base = getSampleStyleSheet()
    styles = {
        "cover_brand": ParagraphStyle(
            "cover_brand",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=28,
            textColor=ACCENT,
            alignment=TA_CENTER,
            spaceAfter=8,
            leading=32,
        ),
        "cover_title": ParagraphStyle(
            "cover_title",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=22,
            textColor=INK,
            alignment=TA_CENTER,
            spaceAfter=10,
            leading=28,
        ),
        "cover_sub": ParagraphStyle(
            "cover_sub",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=11,
            textColor=MUTED,
            alignment=TA_CENTER,
            leading=16,
            spaceAfter=6,
        ),
        "h1": ParagraphStyle(
            "h1",
            parent=base["Heading1"],
            fontName="Helvetica-Bold",
            fontSize=16,
            textColor=INK,
            spaceBefore=0,
            spaceAfter=10,
            leading=20,
        ),
        "h2": ParagraphStyle(
            "h2",
            parent=base["Heading2"],
            fontName="Helvetica-Bold",
            fontSize=13,
            textColor=ACCENT,
            spaceBefore=4,
            spaceAfter=6,
            leading=17,
        ),
        "body": ParagraphStyle(
            "body",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=INK,
            leading=14,
            spaceAfter=8,
        ),
        "meta": ParagraphStyle(
            "meta",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=9,
            textColor=MUTED,
            leading=12,
            spaceAfter=4,
        ),
        "label": ParagraphStyle(
            "label",
            parent=base["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            textColor=MUTED,
            spaceBefore=8,
            spaceAfter=3,
        ),
        "mono": ParagraphStyle(
            "mono",
            parent=base["Normal"],
            fontName="Courier",
            fontSize=9,
            textColor=INK,
            leading=12.5,
            spaceAfter=4,
        ),
        "footer": ParagraphStyle(
            "footer",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "toc": ParagraphStyle(
            "toc",
            parent=base["Normal"],
            fontName="Helvetica",
            fontSize=10,
            textColor=INK,
            leading=15,
            spaceAfter=4,
        ),
    }
    return styles


def esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\n", "<br/>")
    )


def footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(LINE)
    canvas.setLineWidth(0.4)
    y = 14 * mm
    canvas.line(18 * mm, y + 6, A4[0] - 18 * mm, y + 6)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(MUTED)
    canvas.drawString(18 * mm, y, "chasa.io · polite invoice templates")
    canvas.drawRightString(A4[0] - 18 * mm, y, f"{doc.page}")
    canvas.restoreState()


def cover_page(styles, count: int):
    story = []
    story.append(Spacer(1, 28 * mm))
    if LOGO.exists():
        img = Image(str(LOGO), width=22 * mm, height=22 * mm)
        img.hAlign = "CENTER"
        story.append(img)
        story.append(Spacer(1, 6 * mm))
    story.append(Paragraph("chasa", styles["cover_brand"]))
    story.append(Spacer(1, 8 * mm))
    story.append(
        Paragraph(
            f"{count} politely worded templates<br/>to get invoices paid",
            styles["cover_title"],
        )
    )
    story.append(
        Paragraph(
            "Copy-paste email subjects and bodies for every stage of follow-up — "
            "from sending the invoice through final notice, thank-yous, disputes, "
            "and multi-invoice summaries.",
            styles["cover_sub"],
        )
    )
    story.append(Spacer(1, 10 * mm))
    story.append(
        Paragraph(
            "Replace the [placeholders] with your details. Edit the tone to match "
            "your relationship. Or paste an unpaid invoice into Chasa and get a "
            "tone-matched draft you send from your own inbox.",
            styles["cover_sub"],
        )
    )
    story.append(Spacer(1, 18 * mm))
    story.append(
        Paragraph(
            "RELACON GmbH · Vienna · chasa.io<br/>Drafts only — you always send.",
            styles["cover_sub"],
        )
    )
    story.append(PageBreak())
    return story


def how_to_use(styles):
    story = [
        Paragraph("How to use this pack", styles["h1"]),
        Paragraph(
            "Each template includes a subject line and body. Swap the brackets for real values:",
            styles["body"],
        ),
    ]
    bullets = [
        "[Client name] — who you're writing to",
        "[Invoice #] / [Amount] / [Due date] — the facts",
        "[Payment link or bank details] — how they pay",
        "[Your name] — how you sign off",
    ]
    story.append(
        ListFlowable(
            [ListItem(Paragraph(esc(b), styles["body"]), leftIndent=8) for b in bullets],
            bulletType="bullet",
            start="•",
        )
    )
    story.append(
        Paragraph(
            "Send from your own email so clients hear from you — not from an automated "
            "collections domain. Chasa writes drafts; you stay in control of the send.",
            styles["body"],
        )
    )
    story.append(PageBreak())
    return story


def toc_page(styles, templates):
    story = [Paragraph("What's inside", styles["h1"])]
    for i, t in enumerate(templates, 1):
        story.append(
            Paragraph(
                f"<b>{i}.</b> {esc(t['name'])} "
                f"<font color='#6B7A90'>({esc(t['stage'])} · {esc(t['tone'])})</font>",
                styles["toc"],
            )
        )
    story.append(PageBreak())
    return story


def template_pages(styles, templates):
    story = []
    for i, t in enumerate(templates, 1):
        block = [
            Paragraph(f"{i}. {esc(t['name'])}", styles["h2"]),
            Paragraph(
                f"Stage: {esc(t['stage'])} · Tone: {esc(t['tone'])}",
                styles["meta"],
            ),
            Paragraph(esc(t.get("description") or ""), styles["body"]),
            Paragraph("SUBJECT", styles["label"]),
            Paragraph(esc(t["subject"]), styles["mono"]),
            Paragraph("BODY", styles["label"]),
            Paragraph(esc(t["body"]), styles["mono"]),
            Spacer(1, 4 * mm),
        ]
        story.append(KeepTogether(block))
        if i % 2 == 0 and i < len(templates):
            story.append(PageBreak())
        elif i % 2 == 1 and i < len(templates):
            # light divider between paired templates on same page
            story.append(Spacer(1, 3 * mm))
    story.append(PageBreak())
    return story


def closing_page(styles):
    return [
        Paragraph("Want the right tone without rewriting every time?", styles["h1"]),
        Paragraph(
            "Paste unpaid invoices into Chasa and get a follow-up draft matched to how "
            "late each one is. Soften, firm up, or shorten on paid plans. You copy the "
            "result into Gmail, Outlook, or Apple Mail — clients always hear from you.",
            styles["body"],
        ),
        Paragraph(
            "Start free at <b>chasa.io/app</b> — five AI drafts per month, no card required. "
            "Browse the same templates online anytime at <b>chasa.io/free-templates</b>.",
            styles["body"],
        ),
        Spacer(1, 8 * mm),
        Paragraph(
            "© RELACON GmbH. For personal or business use. Please don't resell this pack as your own product.",
            styles["meta"],
        ),
    ]


def main() -> int:
    if not TEMPLATES_JSON.exists():
        print(f"Missing {TEMPLATES_JSON} — run generate-free-templates.mjs first", file=sys.stderr)
        return 1

    templates = json.loads(TEMPLATES_JSON.read_text(encoding="utf-8"))
    if not isinstance(templates, list) or not templates:
        print("templates.json empty", file=sys.stderr)
        return 1

    styles = build_styles()
    OUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=20 * mm,
        title=f"Chasa — {len(templates)} politely worded invoice templates",
        author="Chasa / RELACON GmbH",
        subject="Polite invoice payment reminder email templates",
    )

    story = []
    story.extend(cover_page(styles, len(templates)))
    story.extend(how_to_use(styles))
    story.extend(toc_page(styles, templates))
    story.extend(template_pages(styles, templates))
    story.extend(closing_page(styles))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)
    print(f"Wrote {OUT_PDF} ({len(templates)} templates)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
