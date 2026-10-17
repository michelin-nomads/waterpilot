"""Deterministic one-page proposal renderer for local and pilot workflows.

Numbers and source details come from immutable proposal inputs. No model call can rewrite
financial values. The HTML copy keeps the complete evidence and checklist for review.
"""

from __future__ import annotations

import html
import textwrap

from waterpilot.application.artifacts import PDF
from waterpilot.application.ports import JsonValue, RenderedDocument


def _mapping(value: JsonValue) -> dict[str, JsonValue]:
    return value if isinstance(value, dict) else {}


def _strings(value: JsonValue) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def _money(value: JsonValue) -> str:
    item = _mapping(value)
    if not item:
        return "Not recorded"
    return f"{item.get('currency', 'Unknown')} {item.get('minor_units', 'Unknown')} minor units"


def _money_range(value: JsonValue) -> str:
    item = _mapping(value)
    low, high = _money(item.get("low")), _money(item.get("high"))
    if low == high:
        return low
    if low == "Not recorded" or high == "Not recorded":
        return "Not recorded"
    return f"{low} to {high}"


def _pdf_escape(value: str) -> str:
    return (
        value.encode("cp1252", "replace")
        .decode("cp1252")
        .replace("\\", "\\\\")
        .replace("(", "\\(")
        .replace(")", "\\)")
    )


def _pdf_page(title: str, synthetic: bool, rows: list[tuple[str, str]]) -> bytes:
    lines: list[tuple[str, bool]] = []
    for label, value in rows:
        heading = label == "section"
        line = value.upper() if heading else f"{label}: {value}"
        lines.extend(
            (part, heading and index == 0)
            for index, part in enumerate(
                textwrap.wrap(line, width=98, subsequent_indent="  ") or [""]
            )
        )
    if len(lines) > 44:
        raise ValueError("proposal details exceed the one-page PDF layout; review the HTML version")
    commands = [
        "q",
        "0.05 0.25 0.31 rg",
        "0 710 612 82 re f",
        "Q",
        "BT",
        "/F2 15 Tf",
        "1 1 1 rg",
        "44 760 Td",
        f"({_pdf_escape(title[:72])}) Tj",
        "ET",
    ]
    if synthetic:
        commands.extend(
            [
                "BT",
                "/F2 9 Tf",
                "1 0.86 0.55 rg",
                "44 740 Td",
                "(SYNTHETIC DEMO - NOT A REAL FUNDING APPLICATION) Tj",
                "ET",
            ]
        )
    commands.extend(["BT", "/F1 8.5 Tf", "0 0 0 rg", "44 694 Td", "11 TL"])
    for line, heading in lines:
        commands.append("/F2 9 Tf" if heading else "/F1 8.5 Tf")
        commands.extend((f"({_pdf_escape(line)}) Tj", "T*"))
    commands.append("ET")
    stream = "\n".join(commands).encode("cp1252", "replace")
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        (
            b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            b"/Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>"
        ),
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>",
        b"<< /Length " + str(len(stream)).encode() + b" >>\nstream\n" + stream + b"\nendstream",
    ]
    out = bytearray(b"%PDF-1.4\n%WaterPilot\n")
    offsets = [0]
    for index, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out.extend(f"{index} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = len(out)
    out.extend(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        out.extend(f"{offset:010d} 00000 n \n".encode())
    out.extend(
        f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode()
    )
    return bytes(out)


class DeterministicProposalRenderer:
    """Produce a printable PDF and complete HTML review without model calls."""

    def render(self, inputs: dict[str, JsonValue]) -> RenderedDocument:
        report = _mapping(inputs.get("report"))
        scheme = _mapping(inputs.get("scheme"))
        applicant = _mapping(inputs.get("applicant"))
        economics = _mapping(inputs.get("economics"))
        funding = _mapping(economics.get("funding"))
        synthetic = scheme.get("status") == "demo" or scheme.get("evidence") == "synthetic"
        title = str(report.get("title", "Water project proposal"))
        rows: list[tuple[str, str]] = [
            ("section", "Applicant"),
            (
                "Applicant",
                f"{applicant.get('name', 'Not provided')} - "
                f"{applicant.get('organization', 'Not provided')} "
                f"({applicant.get('category', 'Not provided')})",
            ),
            ("Contact", str(applicant.get("contact_email") or "Not provided")),
            ("section", "Project and scheme"),
            ("Project", title),
            ("Goal", str(_mapping(report.get("goal")).get("description") or "See saved report")),
            ("Plan", str(report.get("planName") or report.get("planOptionId", "Plan"))),
            (
                "Scheme",
                f"{scheme.get('name', 'No scheme selected')} - "
                f"{scheme.get('funder', 'Unknown publisher')}",
            ),
        ]
        if synthetic:
            rows.append(("Status", "SYNTHETIC DEMO - not real funding; do not submit"))
        if scheme.get("max_amount") is not None:
            rows.append(("Scheme maximum", _money(scheme.get("max_amount"))))
        if scheme.get("deadline_at"):
            rows.append(
                (
                    "Deadline",
                    f"{scheme.get('deadline_at')} "
                    f"({scheme.get('deadline_timezone', 'timezone unknown')})",
                )
            )
        rows.extend(
            [
                ("section", "Exact financial figures from the report snapshot"),
                ("Total project cost", _money_range(funding.get("total_cost"))),
                ("Upfront total", _money_range(economics.get("upfront_total"))),
                ("Annual recurring costs", _money_range(economics.get("recurring_annual"))),
                (
                    "Annual avoided tanker spend",
                    _money_range(economics.get("avoided_tanker_annual")),
                ),
                ("Annual net benefit", _money_range(economics.get("net_annual"))),
                ("Funding gap", _money_range(funding.get("gap"))),
                ("Approved funding counted", _money(funding.get("approved"))),
                ("Proposed funding not counted", _money(funding.get("candidate"))),
                ("Payback", str(_mapping(economics.get("payback")).get("note", "Not recorded"))),
                ("Currency rule", "No currency conversion; amounts are exact minor-unit integers."),
            ]
        )
        assumptions = [
            *_strings(economics.get("assumptions")),
            *_strings(applicant.get("assumptions")),
        ]
        rows.append(("section", "Assumptions and evidence"))
        rows.append(("Assumptions", "; ".join(assumptions[:3]) or "None recorded"))
        impact = _mapping(report.get("impact"))
        provenance = _mapping(impact.get("provenance"))
        wider = _mapping(impact.get("wider"))
        rows.append(
            (
                "Impact status",
                "Assessed"
                if inputs.get("impactStatus") == "assessed"
                else "Not assessed in this report",
            )
        )
        if wider:
            rows.append(
                (
                    "Impact evidence",
                    f"{wider.get('engine_version', 'Unknown')} / input "
                    f"{wider.get('input_hash', 'Unknown')}",
                )
            )
            findings = []
            benefits = wider.get("local_benefits")
            if isinstance(benefits, list):
                for finding in benefits[:2]:
                    finding_row = _mapping(finding)
                    findings.append(str(finding_row.get("statement", "")))
            if findings:
                rows.append(("Evidence summary", "; ".join(findings)))
        source_ids = _strings(provenance.get("source_ids"))
        rows.append(("Evidence source IDs", ", ".join(source_ids[:4]) or "No source IDs recorded"))
        docs = _strings(scheme.get("required_documents"))
        rows.append(("section", "Required documents"))
        rows.append(("Checklist", "; ".join(f"[ ] {doc}" for doc in docs[:6]) or "None recorded"))
        rows.append(("section", "Sources and version"))
        rows.extend(
            [
                (
                    "Funding publisher source",
                    str(scheme.get("source_url", "No source URL recorded")),
                ),
                ("Source hash", str(scheme.get("source_hash") or "Unknown")),
                ("Verified at", str(scheme.get("last_verified_at", "Unknown"))),
                (
                    "Report snapshot",
                    f"{report.get('id', 'Unknown')} v{report.get('version', '?')} finalized "
                    f"{report.get('finalizedAt', 'Unknown')}",
                ),
                (
                    "Next step",
                    "Review and submit to the publisher yourself; WaterPilot does not submit it.",
                ),
            ]
        )
        if len(docs) > 6 or len(assumptions) > 3:
            rows.append(
                ("Details", "Additional checklist and assumptions are shown in the HTML review.")
            )

        html_rows = "\n".join(
            (
                f'<tr class="section"><th colspan="2">{html.escape(value)}</th></tr>'
                if label == "section"
                else (
                    f'<tr><th scope="row">{html.escape(label)}</th>'
                    f"<td>{html.escape(value)}</td></tr>"
                )
            )
            for label, value in rows
        )
        banner = (
            "SYNTHETIC DEMO - NOT A REAL FUNDING APPLICATION"
            if synthetic
            else "Proposal for review"
        )
        style = (
            "body{font:16px/1.5 system-ui,sans-serif;max-width:880px;margin:40px auto;"
            "padding:0 24px;color:#18211f}h1{font-size:28px}"
            "table{border-collapse:collapse;width:100%}"
            "th,td{padding:10px;border-bottom:1px solid #d5ded9;text-align:left;vertical-align:top}"
            "tr.section th{padding-top:20px;color:#174f57;font-size:13px;text-transform:uppercase}"
            "th{width:25%}.banner{padding:12px;background:#fff2cc;font-weight:700}"
        )
        document = (
            '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            f"<title>{html.escape(title)} - proposal review</title>"
            f'<style>{style}</style></head><body><p class="banner">{html.escape(banner)}</p>'
            f"<h1>{html.escape(title)}</h1><p>Review the cited inputs before use. "
            "External submission remains your action.</p>"
            f"<table><tbody>{html_rows}</tbody></table></body></html>"
        ).encode()
        return RenderedDocument(_pdf_page(title, synthetic, rows), PDF, document)


# Preserve the local adapter name used by existing callers.
LocalProposalRenderer = DeterministicProposalRenderer
