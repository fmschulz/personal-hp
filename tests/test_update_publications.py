"""Offline tests for scripts/update_publications.py (no network)."""

import importlib.util
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("upd", Path(__file__).resolve().parent.parent / "scripts" / "update_publications.py")
upd = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upd)


def work(doi, title, date, venue="Nature Communications", kind="journal-article"):
    return {"doi": doi, "title": title, "venue": venue, "type": kind, "date": date, "year": date[:4]}


class PickRecent(unittest.TestCase):
    def test_filters_sorts_and_dedupes(self):
        works = [
            work("10.1/a", "Old paper", "2019-01-01"),
            work("10.1/b", "New paper", "2026-06-05"),
            work("10.1/b2", "New paper.", "2026-06-05", venue="eScholarship (California Digital Library)"),
            work("10.1/c", "A preprint", "2026-07-01", kind="preprint"),
            work("10.1/d", "Author Correction: New paper", "2026-07-02"),
            work("10.1/e", "Pinned paper", "2026-08-01"),
            work("10.1/f", "Tagged as erratum by OpenAlex", "2026-08-02"),
            work(None, "No DOI", "2026-09-01"),
        ]
        info = {"10.1/f": {"type": "erratum", "authors": []}}
        got = upd.pick_recent(works, {"10.1/e"}, info, 5)
        self.assertEqual([w["doi"] for w in got], ["10.1/b", "10.1/a"])

    def test_limit(self):
        works = [work(f"10.1/{i}", f"Paper {i}", f"2026-01-{i + 10:02d}") for i in range(8)]
        self.assertEqual(len(upd.pick_recent(works, set(), {}, 3)), 3)


class Formatting(unittest.TestCase):
    def test_norm_doi(self):
        self.assertEqual(upd.norm_doi("https://doi.org/10.1038/SREP13381"), "10.1038/srep13381")
        self.assertEqual(upd.norm_doi("doi:10.1126/science.aal4657"), "10.1126/science.aal4657")

    def test_clean_title(self):
        self.assertEqual(upd.clean_title("  The <i>Mimivirus</i>  genome. "), "The Mimivirus genome")

    def test_author_line(self):
        self.assertEqual(upd.author_line([]), "")
        self.assertEqual(upd.author_line(["Frederik Schulz"]), "Schulz")
        self.assertEqual(upd.author_line(["Rosa Aureli", "Frederik Schulz"]), "Aureli and Schulz")
        self.assertEqual(upd.author_line(["A B", "C D", "E F"]), "B et al.")

    def test_render_escapes_and_numbers(self):
        groups = [
            ("Papers & more", "", [{"title": "A <b> & C", "href": "https://x/?a=1&b=2", "desc": "d", "venue": "V", "year": "2020"}]),
            ("Lab", "note", [{"title": "L", "href": "lab/x/", "internal": True, "desc": "d", "venue": "V", "year": "2026"}]),
        ]
        out = upd.render(groups)
        self.assertIn("A &lt;b&gt; &amp; C", out)
        self.assertIn('href="https://x/?a=1&amp;b=2" target="_blank"', out)
        self.assertIn('href="lab/x/">', out)
        self.assertIn(">02</span>", out)
        self.assertIn("2 Entries &mdash; 2020&ndash;2026", out)
        self.assertIn("Papers &amp; more", out)


class Markers(unittest.TestCase):
    def test_replace_is_idempotent(self):
        page = "a<!-- work:start -->old<!-- work:end -->b"
        once = upd.replace_block(page, "new")
        self.assertEqual(once, "a<!-- work:start -->new<!-- work:end -->b")
        self.assertEqual(upd.replace_block(once, "new"), once)

    def test_missing_markers_fail(self):
        with self.assertRaises(SystemExit):
            upd.replace_block("no markers here", "x")


class Build(unittest.TestCase):
    def test_pinned_falls_back_to_crossref(self):
        config = {"selected": [{"doi": "10.1/pin", "desc": "why"}], "recent_count": 0, "groups": []}
        crossref = lambda doi: work(doi, "From Crossref", "2015", venue="Scientific Reports")
        groups = upd.build(config, [], crossref, {})
        self.assertEqual(groups[0][2][0]["title"], "From Crossref")
        self.assertEqual(groups[0][2][0]["href"], "https://doi.org/10.1/pin")

    def test_incomplete_pinned_metadata_fails(self):
        config = {"selected": [{"doi": "10.1/pin", "desc": "why"}], "recent_count": 0, "groups": []}
        crossref = lambda doi: work(doi, "", "2015")
        with self.assertRaises(SystemExit):
            upd.build(config, [], crossref, {})


if __name__ == "__main__":
    unittest.main()
