export type ReportVisit = {
  occurrenceReport?: string | null;
  occurrenceSubmittedAt?: Date | string | null;
};

export function isOccurrenceReported(visit: ReportVisit) {
  return Boolean(visit.occurrenceSubmittedAt || visit.occurrenceReport?.trim());
}

export function countReportedOccurrences(visits: ReportVisit[] | null | undefined) {
  return (visits ?? []).filter(isOccurrenceReported).length;
}
