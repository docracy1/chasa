const PICKER_API_KEY = import.meta.env.VITE_GOOGLE_PICKER_API_KEY as string | undefined;
const GOOGLE_LOGIN_CLIENT_ID = import.meta.env.VITE_GOOGLE_LOGIN_CLIENT_ID as string | undefined;

type PickerDoc = { id: string; name: string };
type PickerData = { action: string; docs?: PickerDoc[] };
type PickerView = {
  setMimeTypes: (m: string) => PickerView;
  setIncludeFolders: (b: boolean) => PickerView;
};
type PickerBuilder = {
  addView: (view: PickerView) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setDeveloperKey: (key: string) => PickerBuilder;
  setCallback: (cb: (data: PickerData) => void) => PickerBuilder;
  build: () => { setVisible: (v: boolean) => void };
};

declare global {
  interface Window {
    gapi?: { load: (lib: string, cb: () => void) => void };
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }) => { requestAccessToken: () => void };
        };
      };
      picker: {
        PickerBuilder: new () => PickerBuilder;
        Action: { PICKED: string };
        DocsView: new () => PickerView;
      };
    };
  }
}

export function googlePickerEnabled(): boolean {
  return Boolean(PICKER_API_KEY && GOOGLE_LOGIN_CLIENT_ID);
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(s);
  });
}

async function loadPickerScripts(): Promise<void> {
  await loadScript("https://apis.google.com/js/api.js");
  await loadScript("https://accounts.google.com/gsi/client");
  await new Promise<void>((resolve) => {
    window.gapi!.load("picker", () => resolve());
  });
}

export async function openGoogleDrivePicker(
  onPick: (file: { id: string; name: string }) => void,
  onError: (message: string) => void
): Promise<void> {
  if (!PICKER_API_KEY || !GOOGLE_LOGIN_CLIENT_ID) {
    onError("Google Drive picker is not configured.");
    return;
  }
  try {
    await loadPickerScripts();
    const tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_LOGIN_CLIENT_ID,
      scope: "https://www.googleapis.com/auth/drive.readonly",
      callback: (resp) => {
        if (resp.error || !resp.access_token) {
          onError("Google Drive access was denied.");
          return;
        }
        const view = new window.google!.picker.DocsView()
          .setMimeTypes("application/pdf")
          .setIncludeFolders(true);
        const picker = new window.google!.picker.PickerBuilder()
          .addView(view)
          .setOAuthToken(resp.access_token)
          .setDeveloperKey(PICKER_API_KEY)
          .setCallback((data: PickerData) => {
            if (data.action === window.google!.picker.Action.PICKED && data.docs?.[0]) {
              onPick({ id: data.docs[0].id, name: data.docs[0].name });
            }
          })
          .build();
        picker.setVisible(true);
      },
    });
    tokenClient.requestAccessToken();
  } catch {
    onError("Could not load Google Drive picker.");
  }
}
