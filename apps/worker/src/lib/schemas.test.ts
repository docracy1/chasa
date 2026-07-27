import { describe, expect, it } from "vitest";
import { z } from "zod";
import { agingSyncSchema, parseJsonBody } from "./schemas";

describe("schemas", () => {
  it("parses aging sync batch", async () => {
    const result = await parseJsonBody(
      {
        json: async () => ({
          replace: true,
          invoices: [
            { clientName: "Acme", amount: 1200, dueDate: "2026-01-15" },
          ],
        }),
      },
      agingSyncSchema
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.invoices).toHaveLength(1);
      expect(result.data.replace).toBe(true);
    }
  });

  it("rejects invalid aging due date", async () => {
    const result = await parseJsonBody(
      {
        json: async () => ({
          invoices: [{ clientName: "Acme", amount: 100, dueDate: "bad" }],
        }),
      },
      agingSyncSchema
    );
    expect(result.ok).toBe(false);
  });

  it("caps analytics properties size", () => {
    const big = { properties: { x: "y".repeat(3000) } };
    const schema = z.object({
      properties: z
        .record(z.string(), z.unknown())
        .refine((obj) => JSON.stringify(obj).length <= 2048, "properties too large")
        .optional(),
    });
    expect(schema.safeParse(big).success).toBe(false);
  });
});
