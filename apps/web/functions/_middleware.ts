/** 301 legacy + www hosts → docstoc apex — consolidates link equity (SEO + cutover). */
const HOST_TO_APEX: Record<string, string> = {
  "www.docstoc.io": "docstoc.io",
  "chasa.io": "docstoc.io",
  "www.chasa.io": "docstoc.io",
};

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const apex = HOST_TO_APEX[url.hostname];
  if (apex) {
    url.hostname = apex;
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
};
