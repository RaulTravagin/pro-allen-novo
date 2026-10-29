import { z } from "zod";

/**
 * CPF and employee registration identifiers share one field. Keep it as text so
 * leading zeroes are preserved, while maintaining the existing 14-character cap.
 */
export const personnelIdentifierSchema = z
  .string()
  .trim()
  .min(1, "Informe o CPF ou a matrícula")
  .max(14, "CPF ou matrícula muito longo");

/** Normalize formatted 11-digit CPFs exactly as the server did before. */
export function normalizePersonnelIdentifier(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 11 ? digits : trimmed;
}
