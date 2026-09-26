#!/usr/bin/env python3
# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
"""Rebuild the Selected Work index in index.html.

Sources:
  data/work.json  pinned papers (DOI + one-line description) and the curated
                  software, group and lab entries
  ORCID           title, venue and date of each paper, and the newest journal
                  articles for the Recent group
  Crossref        fallback metadata for a pinned DOI that is not on the ORCID record
  OpenAlex        author lists and work types (to drop errata and preprints)

The script only writes index.html when every source answered and every pinned
DOI resolved, so a failed run never publishes a half-built list.

Usage: uv run scripts/update_publications.py [--dry-run]
"""

from __future__ import annotations

import argparse
import difflib
import html
import json
import re
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
DATA = ROOT / "data" / "work.json"
START, END = "<!-- work:start -->", "<!-- work:end -->"
USER_AGENT = "personal-hp publications updater (https://github.com/fmschulz/personal-hp)"

CORRECTION = re.compile(r"^\s*(author|publisher)?\s*(correction|erratum|corrigendum)\b", re.I)
REPOSITORY = re.compile(r"escholarship|biorxiv|medrxiv|arxiv|zenodo|figshare|research square|ssrn", re.I)
SKIP_TYPES = {"erratum", "preprint", "paratext", "retraction", "dataset"}


def get_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.load(resp)


def norm_doi(doi: str) -> str:
    return re.sub(r"^(https?://(dx\.)?doi\.org/|doi:)", "", doi.strip(), flags=re.I).lower()


def clean_title(title: str) -> str:
    title = re.sub(r"<[^>]+>", "", html.unescape(title or ""))
    return re.sub(r"\s+", " ", title).strip().rstrip(".")


def title_key(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", title.lower())


def parse_orcid(data: dict) -> list[dict]:
    """Flatten an ORCID /works response into one record per work group."""
    works = []
    for group in data.get("group", []):
        summary = group["work-summary"][0]
        ids = (group.get("external-ids") or {}).get("external-id", [])
        doi = next((norm_doi(e["external-id-value"]) for e in ids if e["external-id-type"] == "doi"), None)
        date = summary.get("publication-date") or {}
        parts = [(date.get(k) or {}).get("value") for k in ("year", "month", "day")]
        works.append({
            "doi": doi,
            "title": clean_title(((summary.get("title") or {}).get("title") or {}).get("value", "")),
            "venue": ((summary.get("journal-title") or {}).get("value") or "").strip(),
            "type": summary.get("type"),
            "date": "-".join(p for p in parts if p),
            "year": parts[0] or "",
        })
    return works


def crossref_work(doi: str) -> dict:
    m = get_json("https://api.crossref.org/works/" + urllib.parse.quote(doi))["message"]
    year = str(((m.get("issued") or {}).get("date-parts") or [[""]])[0][0])
    return {
        "doi": doi,
        "title": clean_title((m.get("title") or [""])[0]),
        "venue": (m.get("container-title") or [""])[0],
        "type": m.get("type"),
        "date": year,
        "year": year,
    }


def openalex_info(dois: list[str]) -> dict[str, dict]:
    """Map DOI -> {type, authors} for the DOIs OpenAlex knows."""
    info = {}
    for i in range(0, len(dois), 40):
        query = urllib.parse.urlencode({"filter": "doi:" + "|".join(dois[i:i + 40]), "per-page": 50, "select": "doi,type,authorships"})
        for w in get_json("https://api.openalex.org/works?" + query)["results"]:
            if w.get("doi"):
                info[norm_doi(w["doi"])] = {
                    "type": w.get("type"),
                    "authors": [a["author"]["display_name"] for a in w.get("authorships", [])],
                }
    return info


def author_line(authors: list[str]) -> str:
    surnames = [a.split()[-1] for a in authors if a.strip()]
    if not surnames:
        return ""
    if len(surnames) == 1:
        return surnames[0]
    if len(surnames) == 2:
        return f"{surnames[0]} and {surnames[1]}"
    return f"{surnames[0]} et al."


def pick_recent(works: list[dict], exclude: set[str], info: dict[str, dict], n: int) -> list[dict]:
    """Newest journal articles with a DOI, minus pinned papers, corrections, preprints and repository copies."""
    candidates = [
        w for w in works
        if w["type"] == "journal-article" and w["doi"] and w["doi"] not in exclude
        and not CORRECTION.search(w["title"]) and not REPOSITORY.search(w["venue"])
        and (info.get(w["doi"], {}).get("type") not in SKIP_TYPES)
    ]
    candidates.sort(key=lambda w: w["date"], reverse=True)
    seen, out = set(), []
    for w in candidates:
        key = title_key(w["title"])
        if key in seen:
            continue
        seen.add(key)
        out.append(w)
        if len(out) == n:
            break
    return out


def render_item(no: int, e: dict) -> str:
    internal = e.get("internal", False)
    target = "" if internal else ' target="_blank" rel="noopener"'
    arrow = "&rarr;" if internal else "&#8599;"
    esc = lambda s: html.escape(s, quote=True)
    return f"""                    <li class="index-item" data-reveal="rise">
                        <a class="index-link" href="{esc(e['href'])}"{target}>
                            <span class="ix-no">{no:02d}</span>
                            <span class="ix-body">
                                <span class="ix-title">{esc(e['title'])}</span>
                                <span class="ix-desc">{esc(e['desc'])}</span>
                            </span>
                            <span class="ix-venue">{esc(e['venue'])}</span>
                            <span class="ix-year">{esc(e['year'])}</span>
                            <span class="ix-arrow" aria-hidden="true">{arrow}</span>
                        </a>
                    </li>
"""


def render(groups: list[tuple[str, str, list[dict]]]) -> str:
    """groups: (label, note, entries). Returns the block that sits between the markers."""
    entries = [e for _, _, items in groups for e in items]
    years = sorted(int(e["year"]) for e in entries if str(e["year"]).isdigit())
    span = f"{years[0]}&ndash;{years[-1]}" if years else ""
    out = f"""
            <div class="section-head" data-reveal="rise">
                <span class="sec-no">02</span>
                <span class="sec-label">Selected Work</span>
                <span class="sec-count">{len(entries)} Entries &mdash; {span}</span>
            </div>

            <div class="index-cols" aria-hidden="true">
                <span>No.</span><span>Title</span><span>Venue</span><span>Year</span>
            </div>
"""
    no = 0
    for label, note, items in groups:
        note_html = f' <span class="index-group-note">{html.escape(note)}</span>' if note else ""
        out += f"""
            <div class="index-group">
                <h3 class="index-group-label" data-reveal="rise">{html.escape(label)}{note_html}</h3>
                <ol class="index-list">
"""
        for e in items:
            no += 1
            out += render_item(no, e)
        out += """                </ol>
            </div>
"""
    return out + "            "


def replace_block(page: str, block: str) -> str:
    if page.count(START) != 1 or page.count(END) != 1:
        raise SystemExit(f"index.html must contain exactly one {START} and one {END}")
    head, rest = page.split(START)
    _, tail = rest.split(END)
    return head + START + block + END + tail


def build(config: dict, orcid: list[dict], fetch_crossref, info: dict[str, dict]) -> list[tuple[str, str, list[dict]]]:
    by_doi = {w["doi"]: w for w in orcid if w["doi"]}
    selected = []
    for pin in config["selected"]:
        doi = norm_doi(pin["doi"])
        meta = by_doi.get(doi) or fetch_crossref(doi)
        if not meta["title"] or not meta["venue"] or not meta["year"]:
            raise SystemExit(f"incomplete metadata for pinned DOI {doi}: {meta}")
        selected.append({"title": meta["title"], "href": f"https://doi.org/{doi}", "desc": pin["desc"], "venue": meta["venue"], "year": meta["year"]})
    pinned = {norm_doi(p["doi"]) for p in config["selected"]}
    recent = [
        {"title": w["title"], "href": f"https://doi.org/{w['doi']}", "desc": author_line(info.get(w["doi"], {}).get("authors", [])), "venue": w["venue"], "year": w["year"]}
        for w in pick_recent(orcid, pinned, info, config["recent_count"])
    ]
    groups = [("Selected papers", "", selected), ("Recent papers", "updated weekly from ORCID", recent)]
    groups += [(g["label"], "", g["items"]) for g in config["groups"]]
    return groups


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--dry-run", action="store_true", help="print the diff instead of writing index.html")
    args = ap.parse_args()

    config = json.loads(DATA.read_text(encoding="utf-8"))
    orcid = parse_orcid(get_json(f"https://pub.orcid.org/v3.0/{config['orcid']}/works"))
    if not orcid:
        raise SystemExit("ORCID returned no works; refusing to rewrite the list")
    info = openalex_info(sorted({w["doi"] for w in orcid if w["doi"]}))
    groups = build(config, orcid, crossref_work, info)

    page = INDEX.read_text(encoding="utf-8")
    new = replace_block(page, render(groups))
    counts = ", ".join(f"{label}: {len(items)}" for label, _, items in groups)
    if new == page:
        print(f"index.html unchanged ({counts})")
        return 0
    if args.dry_run:
        sys.stdout.writelines(difflib.unified_diff(page.splitlines(True), new.splitlines(True), "index.html", "index.html (updated)"))
        return 0
    INDEX.write_text(new, encoding="utf-8")
    print(f"index.html updated ({counts})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
