import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { track } from "../lib/analytics";
import { useT } from "../lib/i18n";

export type FreeChaseTemplate = {
  slug: string;
  name: string;
  description: string;
  stage: string;
  tone: string;
  category: string;
  subject: string;
  body: string;
};

type CommunityEmailTemplate = FreeChaseTemplate & {
  submitterName?: string | null;
  featured?: boolean;
};

export default function Templates() {
  const t = useT();
  const [templates, setTemplates] = useState<FreeChaseTemplate[]>([]);
  const [communityTemplates, setCommunityTemplates] = useState<CommunityEmailTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/free-templates/templates.json")
      .then((r) => {
        if (!r.ok) throw new Error("load_failed");
        return r.json();
      })
      .then((rows: FreeChaseTemplate[]) => {
        if (!Array.isArray(rows)) throw new Error("bad_json");
        setTemplates(rows);
      })
      .catch(() => setError(t("templates.loadFailed")));

    // Community-submitted email templates, fetched live — these are admin-approved but not baked
    // into the static templates.json above, so this is the only way they show up without a
    // full site rebuild.
    fetch("/api/marketplace?type=email")
      .then((r) => (r.ok ? r.json() : { templates: [] }))
      .then((data: { templates?: CommunityEmailTemplate[] }) => {
        setCommunityTemplates(Array.isArray(data.templates) ? data.templates : []);
      })
      .catch(() => setCommunityTemplates([]));
  }, [t]);

  return (
    <div className="templates-page">
      <div className="panel templates-card">
        <h1 className="templates-title">{t("templates.title")}</h1>
        <p className="templates-sub">{t("templates.sub")}</p>

        {error && <p className="templates-error">{error}</p>}

        {!error && templates.length === 0 && (
          <p className="page-sub">{t("templates.loading")}</p>
        )}

        <div className="templates-grid">
          {templates.map((tpl) => (
            <Link
              key={tpl.slug}
              to={`/new?template=${encodeURIComponent(tpl.slug)}`}
              className="btn-secondary templates-tile"
              title={tpl.description}
              onClick={() => track("template_opened", { slug: tpl.slug })}
            >
              <span className="templates-tile-name">{tpl.name}</span>
              <span className="templates-tile-meta">
                {tpl.stage} · {tpl.tone}
              </span>
            </Link>
          ))}
        </div>

        {communityTemplates.length > 0 && (
          <>
            <h2 className="templates-title" style={{ fontSize: 16, marginTop: 24 }}>
              {t("templates.communityTitle")}
            </h2>
            <div className="templates-grid">
              {communityTemplates.map((tpl) => (
                <Link
                  key={tpl.slug}
                  to={`/new?template=${encodeURIComponent(tpl.slug)}`}
                  className="btn-secondary templates-tile"
                  title={tpl.description}
                  onClick={() => track("template_opened", { slug: tpl.slug, community: true })}
                >
                  <span className="templates-tile-name">{tpl.name}</span>
                  <span className="templates-tile-meta">
                    {tpl.stage} · {tpl.tone}
                    {tpl.featured ? ` · ${t("templates.featured")}` : ""}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
