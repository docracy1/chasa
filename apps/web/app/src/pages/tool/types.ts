import type {
  ChaseReminder,
  ChaseSequence,
  CloudFileImport,
  CloudProvider,
  RewriteAction,
  SmsWhatsAppDraft,
} from "../../lib/api";

export type PendingCloudImport = CloudFileImport & {
  provider: CloudProvider;
  providerLabel: string;
};

export type AiBusy = RewriteAction | "thankyou" | "reply" | "sequence" | "multi" | "sms" | null;

export interface Invoice {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  draft?: { subject: string; body: string };
  generating: boolean;
  rewriting: AiBusy;
  clientReply?: string;
  sequence?: ChaseSequence | null;
  reminders?: ChaseReminder[];
  smsDraft?: SmsWhatsAppDraft | null;
  lastChaseStatus?: string | null;
  lastChaseAt?: string | null;
  trackingNote?: string | null;
  error?: string;
}

export type StoredInvoice = {
  id: string;
  clientName: string;
  amount: number;
  dueDate: string;
  lastChaseStatus?: string | null;
  lastChaseAt?: string | null;
};
