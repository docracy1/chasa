import { useEffect, useMemo, useState } from "react";
import { track } from "../lib/analytics";
import { useT } from "../lib/i18n";

type DocumentTemplate = {
  slug: string;
  name: string;
  description: string;
  category: string;
  bodyMarkdown?: string;
  verifiedExpert?: boolean;
  expertCredential?: string | null;
  featured?: boolean;
};

type FilterId = "all" | "legal" | "other";

function matchesFilter(category: string, filter: FilterId): boolean {
  const isLegal = category.trim().toLowerCase() === "legal";
  if (filter === "legal") return isLegal;
  if (filter === "other") return !isLegal;
  return true;
}

function matchesQuery(tpl: DocumentTemplate, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return (
    tpl.name.toLowerCase().includes(q) ||
    tpl.description.toLowerCase().includes(q) ||
    tpl.category.toLowerCase().includes(q) ||
    tpl.slug.toLowerCase().includes(q)
  );
}

/** Pull a few heading/body snippets for the paper preview (Docracy-style tile). */
function previewLines(tpl: DocumentTemplate): string[] {
  const md = tpl.bodyMarkdown || "";
  const headings = [...md.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1]!.trim()).filter(Boolean);
  if (headings.length >= 2) return headings.slice(0, 4);
  const paras = md
    .split(/\n+/)
    .map((l) => l.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim())
    .filter((l) => l.length > 20 && !l.startsWith("---") && !l.startsWith("*"));
  return paras.slice(0, 4);
}

export default function DocumentTemplates() {
  const t = useT();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<DocumentTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");

  useEffect(() => {
    fetch("/document-templates/templates.json")
      .then((r) => {
        if (!r.ok) throw new Error("load_failed");
        return r.json();
      })
      .then((rows: DocumentTemplate[]) => {
        if (!Array.isArray(rows)) throw new Error("bad_json");
        setTemplates(rows);
      })
      .catch(() => setError(t("documentTemplates.loadFailed")));

    fetch("/api/marketplace?type=document")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((data: { templates?: DocumentTemplate[] }) => {
        setCommunityTemplates(Array.isArray(data.templates) ? data.templates : []);
      })
      .catch(() => setCommunityTemplates([]));
  }, [t]);

  const filteredTemplates = useMemo(
    () => templates.filter((tpl) => matchesFilter(tpl.category, filter) && matchesQuery(tpl, query.trim())),
    [templates, filter, query]
  );

  const filteredCommunity = useMemo(
    () =>
      communityTemplates.filter(
        (tpl) => matchesFilter(tpl.category, filter) && matchesQuery(tpl, query.trim())
      ),
    [communityTemplates, filter, query]
  );

  function setFilterTracked(next: FilterId) {
    setFilter(next);
    track("template_category_viewed", { filter: next, type: "document" });
  }

  function renderCard(tpl: DocumentTemplate, badge: "official" | "community" = "official") {
    const lines = previewLines(tpl);
    return (
      <a
        key={tpl.slug}
        href={`/document-templates/${tpl.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="doc-tpl-card"
        title={tpl.description}
        onClick={() => track("template_opened", { slug: tpl.slug, type: "document" })}
      >
        <div className="doc-tpl-card-preview" aria-hidden="true">
          <div className="doc-tpl-paper">
            <div className="doc-tpl-paper-title">{tpl.name}</div>
            {lines.map((line, i) => (
              <div key={i} className="doc-tpl-paper-block">
                <div className="doc-tpl-paper-heading">{line}</div>
                <div className="doc-tpl-paper-line" />
                <div className="doc-tpl-paper-line is-short" />
              </div>
            ))}
            {lines.length === 0 ? (
              <>
                <div className="doc-tpl-paper-line" />
                <div className="doc-tpl-paper-line" />
                <div className="doc-tpl-paper-line is-short" />
              </>
            ) : null}
          </div>
        </div>
        <div className="doc-tpl-card-body">
          <span className="doc-tpl-card-tag">{tpl.category}</span>
          <h3>
            {tpl.name}
            <span className={`doc-tpl-badge${badge === "community" ? " is-community" : ""}`}>
              {badge === "community" ? t("templates.communityTitle") : t("documentTemplates.badge")}
            </span>
          </h3>
        </div>
      </a>
    );
  }

  const filters: Array<{ id: FilterId; label: string }> = [
    { id: "all", label: t("documentTemplates.filterAll") },
    { id: "legal", label: t("documentTemplates.filterLegal") },
    { id: "other", label: t("documentTemplates.filterOther") },
  ];

  return (
    <div className="templates-page">
      <div className="panel templates-card">
        <h1 className="templates-title">{t("documentTemplates.title")}</h1>
        <p className="templates-sub">{t("documentTemplates.sub")}</p>

        <div className="templates-toolbar">
          <label className="templates-search">
            <span className="sr-only">{t("documentTemplates.searchLabel")}</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("documentTemplates.searchPlaceholder")}
              autoComplete="off"
            />
          </label>
          <div className="templates-filters" role="group" aria-label={t("documentTemplates.filterLabel")}>
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`templates-filter${filter === f.id ? " is-active" : ""}`}
                aria-pressed={filter === f.id}
                onClick={() => setFilterTracked(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="templates-error">{error}</p>}
        {!error && templates.length === 0 && <p className="page-sub">{t("documentTemplates.loading")}</p>}

        {!error && templates.length > 0 && filteredTemplates.length === 0 && filteredCommunity.length === 0 ? (
          <p className="page-sub">{t("documentTemplates.noResults")}</p>
        ) : null}

        <div className="doc-tpl-grid">{filteredTemplates.map((tpl) => renderCard(tpl, "official"))}</div>

        {filteredCommunity.length > 0 && (
          <>
            <h2 className="templates-title" style={{ fontSize: 16, marginTop: 24 }}>
              {t("templates.communityTitle")}
            </h2>
            <div className="doc-tpl-grid">{filteredCommunity.map((tpl) => renderCard(tpl, "community"))}</div>
          </>
        )}
      </div>
    </div>
  );
}
