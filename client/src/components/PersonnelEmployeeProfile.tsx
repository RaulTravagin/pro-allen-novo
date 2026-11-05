import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  personnelProfileFields,
  type PersonnelEmployeeProfile,
  type PersonnelProfileFieldKey,
} from "@shared/personnelEmployeeProfile";

export function countPersonnelProfileFields(profile?: PersonnelEmployeeProfile | null) {
  return personnelProfileFields.filter(field => Boolean(profile?.fields?.[field.key]?.trim())).length;
}

function normalizedSearch(value: unknown) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").trim();
}

export function personnelEmployeeMatchesSearch(employee: any, query: string) {
  const search = normalizedSearch(query);
  if (!search) return true;
  const fields = employee.profileData?.fields ?? {};
  const values = [employee.name, employee.cpf, employee.position, employee.post,
    fields.registrationNumber, fields.documentCpf, fields.email, fields.phoneAreaCode, fields.phoneNumber,
    fields.homeCity, fields.departmentName];
  const text = normalizedSearch(values.filter(Boolean).join(" "));
  const identifierDigits = [employee.cpf, fields.documentCpf, fields.registrationNumber]
    .map(value => String(value ?? "").replace(/\D/g, "")).join(" ");
  return text.includes(search) || (/^\d+$/.test(search) && identifierDigits.includes(search));
}

export function PersonnelEmployeeProfileEditor({
  profile,
  onChange,
  role,
}: {
  profile: PersonnelEmployeeProfile;
  onChange: (value: PersonnelEmployeeProfile) => void;
  role: "RH" | "ADM" | "SUPERVISOR" | "FINANCEIRO";
}) {
  if (role !== "RH" && role !== "ADM") return null;
  const sections = Array.from(new Set(personnelProfileFields.map(field => field.section)));
  const setField = (key: PersonnelProfileFieldKey, value: string) => {
    const fields = { ...profile.fields };
    if (value === "") delete fields[key];
    else fields[key] = value;
    onChange({ ...profile, fields });
  };
  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
      <div>
        <h3 className="font-semibold text-slate-900">Ficha completa RH</h3>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {countPersonnelProfileFields(profile)} campos preenchidos. Abra uma seção para consultar ou editar.
          Dados pessoais, bancários e de benefícios são exclusivos de RH/ADM.
        </p>
      </div>
      {profile.fields.reviewNotes && <div role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900"><strong>Conferência necessária:</strong> {profile.fields.reviewNotes}</div>}
      {sections.map(section => {
        const fields = personnelProfileFields.filter(field => field.section === section);
        const filled = fields.filter(field => Boolean(profile.fields[field.key]?.trim())).length;
        return (
          <details key={section} className="rounded-lg border border-slate-200 bg-white">
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-slate-800">
              {section} <span className="ml-1 font-normal text-slate-500">({filled}/{fields.length})</span>
            </summary>
            <div className="grid gap-3 border-t border-slate-100 p-3 sm:grid-cols-2">
              {fields.map(field => (
                <div key={field.key} className="min-w-0 space-y-1.5">
                  <Label htmlFor={`employee-profile-${field.key}`} className="text-xs leading-relaxed">{field.label}</Label>
                  <Input
                    id={`employee-profile-${field.key}`}
                    type={field.type === "date" ? "date" : "text"}
                    inputMode={field.type === "email" ? "email" : undefined}
                    value={profile.fields[field.key] ?? ""}
                    onChange={event => setField(field.key, event.target.value)}
                    maxLength={2000}
                    className="bg-white"
                  />
                </div>
              ))}
            </div>
          </details>
        );
      })}
      {Boolean(profile.sources?.length) && (
        <details className="rounded-lg border border-blue-200 bg-blue-50/50">
          <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-blue-900">
            Origem e valores da planilha ({profile.sources?.length} referências)
          </summary>
          <div className="space-y-4 border-t border-blue-100 p-3 text-xs">
            <p className="text-slate-600">Referências originais preservadas para conferência. Editar a ficha não altera os valores de origem.</p>
            {profile.sources?.map((source, index) => (
              <div key={`${source.fileSha256}-${source.sheet}-${source.row}-${index}`} className="min-w-0">
                <p className="break-words font-semibold text-slate-800">{source.fileName}</p>
                <p className="mt-1 text-slate-600">{source.sheet} · linha {source.row}</p>
                <dl className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded border border-slate-200 bg-white p-2">
                  {source.cells.map((cell, cellIndex) => (
                    <div key={`${cell.column}-${cellIndex}`} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-2 border-b border-slate-100 pb-2 last:border-0">
                      <dt className="break-words text-slate-500">{cell.column} · {cell.header || "Sem cabeçalho"}</dt>
                      <dd className="whitespace-pre-wrap break-words text-slate-800">{cell.value || "—"}{cell.formula && <span className="block font-mono text-[10px] text-slate-500">{cell.formula}</span>}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
