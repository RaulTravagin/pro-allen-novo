import { z } from "zod";

const rawText = z.string().max(4_000);
const sourceCellSchema = z.object({
  column: z.string().max(16),
  header: z.string().max(255),
  value: rawText,
  kind: z.string().max(64).optional(),
  formula: z.string().max(4_000).optional(),
  cachedValue: rawText.optional(),
}).strict();

export const personnelFreelancerFieldsSchema = z.object({
  collaboratorRaw: rawText.min(1, "Informe o conteúdo original de Colaborador"),
  jobFunction: rawText,
  situation: rawText,
  hours: rawText,
  posts: rawText,
  coverage: rawText,
  pix: rawText,
  value: rawText,
  supervision: rawText,
  observations: rawText,
}).strict();

export const personnelFreelancerImportRowSchema = z.object({
  sourceFileSha256: z.string().regex(/^[a-fA-F0-9]{64}$/),
  sourceSheet: z.literal("Planilha2"),
  sourceRow: z.number().int().min(5).max(24),
  fields: personnelFreelancerFieldsSchema,
  sourceData: z.object({ cells: z.array(sourceCellSchema).max(100) }).strict(),
}).strict();

export type PersonnelFreelancerFields = z.infer<typeof personnelFreelancerFieldsSchema>;
export type PersonnelFreelancerImportRow = z.infer<typeof personnelFreelancerImportRowSchema>;
export type PersonnelFreelancerSourceData = PersonnelFreelancerImportRow["sourceData"];

export const personnelFreelancerFieldLabels: Array<{ key: keyof PersonnelFreelancerFields; label: string }> = [
  { key: "collaboratorRaw", label: "Colaborador (texto original)" },
  { key: "jobFunction", label: "Função" },
  { key: "situation", label: "Situação" },
  { key: "hours", label: "Horário" },
  { key: "posts", label: "Postos" },
  { key: "coverage", label: "Cobertura" },
  { key: "pix", label: "PIX" },
  { key: "value", label: "Valor" },
  { key: "supervision", label: "Supervisão" },
  { key: "observations", label: "Observações" },
];
