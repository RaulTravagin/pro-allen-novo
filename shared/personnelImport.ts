import { z } from "zod";

const nonNegativeInteger = z.number().int().nonnegative();
const positiveInteger = z.number().int().positive();
const boundedString = (max: number) => z.string().max(max);

export const personnelImportPayloadSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  summary: z.object({
    sourceEmployees: nonNegativeInteger,
    created: nonNegativeInteger,
    updated: nonNegativeInteger,
    pending: nonNegativeInteger,
    warnings: nonNegativeInteger,
    unlinkedContacts: nonNegativeInteger,
  }).strict(),
  sheets: z.array(z.object({
    name: z.string(),
    headerRow: z.number().int().min(1),
    rows: z.array(z.object({
      row: positiveInteger,
      status: z.enum(["IMPORTED", "PENDING", "REFERENCE"]),
      employeeId: positiveInteger.optional(),
      reasons: z.array(boundedString(300)).max(30),
      cells: z.array(z.object({
        column: z.string(),
        header: z.string(),
        value: boundedString(4_000),
        kind: z.string().optional(),
        formula: z.string().optional(),
        cachedValue: z.string().optional(),
      }).strict()).max(100),
    }).strict()).max(5_000),
  }).strict()).max(10),
}).strict().superRefine((payload, ctx) => {
  const byteLength = new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (byteLength > 8 * 1024 * 1024) {
    ctx.addIssue({
      code: "custom",
      message: "O payload completo da importação excede 8 MiB",
      path: [],
    });
  }
});

export type PersonnelImportPayload = z.infer<typeof personnelImportPayloadSchema>;
export type PersonnelImportSummary = PersonnelImportPayload["summary"];
export type PersonnelImportBatchMetadata = {
  id: number;
  fileName: string;
  fileSha256: string;
  summary: PersonnelImportSummary;
  createdAt: Date;
  updatedAt: Date;
};
export type PersonnelImportBatch = PersonnelImportBatchMetadata & {
  createdBy: number;
  sourceData: PersonnelImportPayload;
};
