import { useEffect, useState } from "react";
import { track } from "../lib/analytics";
import { useT } from "../lib/i18n";

type DocumentTemplate = {
  slug: string;
  name: string;
  description: string;
  category: string;
  verifiedExpert?: boolean;
  expertCredential?: string | null;
  featured?: boolean;
};

export default function DocumentTemplates() {
  const t = useT();
  const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<DocumentTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

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

  function renderCard(tpl: DocumentTemplate) {
    return (
      <a
        key={tpl.slug}
        href={`/document-templates/${tpl.slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-secondary templates-tile"
        title={tpl.description}
        onClick={() => track("template_opened", { slug: tpl.slug, type: "document" })}
      >
        <span className="templates-tile-name">{tpl.name}</span>
        <span className="templates-tile-meta">
          {tpl.category}
          {tpl.verifiedExpert ? ` · ${tpl.expertCredential || "Verified expert"}` : ""}
          {!tpl.verifiedExpert && tpl.featured ? ` · ${t("templates.featured")}` : ""}
        </span>
      </a>
    );
  }

  return (
    <div className="templates-page">
      <div className="panel templates-card">
        <h1 className="templates-title">{t("documentTemplates.title")}</h1>
        <p className="templates-sub">{t("documentTemplates.sub")}</p>

        {error && <p className="templates-error">{error}</p>}
        {!error && templates.length === 0 && <p className="page-sub">{t("documentTemplates.loading")}</p>}

        <div className="templates-grid">{templates.map(renderCard)}</div>

        {communityTemplates.length > 0 && (
          <>
            <h2 className="templates-title" style={{ fontSize: 16, marginTop: 24 }}>
              {t("templates.communityTitle")}
            </h2>
            <div className="templates-grid">{communityTemplates.map(renderCard)}</div>
          </>
        )}
      </div>
    </div>
  );
}
