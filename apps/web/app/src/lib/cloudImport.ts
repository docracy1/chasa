import type { CloudProvider } from "./api";

export const CLOUD_LABELS: Record<CloudProvider, string> = {
  dropbox: "Dropbox",
  onedrive: "OneDrive",
  box: "Box",
  google: "Google Drive",
};
