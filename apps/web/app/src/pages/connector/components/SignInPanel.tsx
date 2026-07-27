export function SignInPanel() {
  return (
    <div className="panel">
      <h1>Connector</h1>
      <p className="page-sub">
        Sign in to connect Dropbox, OneDrive, or Box, or create API keys for Zapier / Make
        (QuickBooks, FreshBooks, Xero, Wave, Zoho, sevDesk, and more). CSV upload works without a
        paid plan in the Tool.
      </p>
      <a className="btn-primary" href="/app/login">
        Sign in
      </a>
    </div>
  );
}
