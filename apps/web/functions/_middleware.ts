/** 301 www.docstoc.io → docstoc.io — consolidates link equity on apex (SEO audit item 1). */
export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  if (url.hostname === "www.docstoc.io") {
    url.hostname = "docstoc.io";
    return Response.redirect(url.toString(), 301);
  }
  return context.next();
};
