import { describe, expect, it } from "vitest";
import { formatDueDateForPrompt, inferDueDateIso, parseEmail } from "./ai";

describe("formatDueDateForPrompt", () => {
  it("formats ISO dates as long US dates", () => {
    expect(formatDueDateForPrompt("2026-08-15")).toBe("August 15, 2026");
  });

  it("formats European dotted dates", () => {
    expect(formatDueDateForPrompt("15.08.2026")).toBe("August 15, 2026");
  });
});

describe("inferDueDateIso", () => {
  it("subtracts days overdue from today", () => {
    const today = new Date("2026-09-01T12:00:00");
    expect(inferDueDateIso(17, today)).toBe("2026-08-15");
  });
});

describe("parseEmail", () => {
  it("parses the well-formed Subject/Body format", () => {
    const result = parseEmail(
      "Subject: Overdue Payment for Invoice #1\nBody:\nDear Acme Co,\n\nThis is a reminder."
    );
    expect(result.subject).toBe("Overdue Payment for Invoice #1");
    expect(result.body).toBe("Dear Acme Co,\n\nThis is a reminder.");
  });

  it("strips a leading Subject line from the body when the model skips the Body: marker", () => {
    const result = parseEmail(
      "Subject: Overdue Payment for Invoice #1\n\nDear Acme Co,\n\nThis is a reminder."
    );
    expect(result.subject).toBe("Overdue Payment for Invoice #1");
    expect(result.body).toBe("Dear Acme Co,\n\nThis is a reminder.");
    expect(result.body).not.toContain("Subject:");
  });

  it("falls back to defaults when nothing matches at all", () => {
    const result = parseEmail("");
    expect(result.subject).toBe("Following up on your invoice");
    expect(result.body).toBe("");
  });
});
