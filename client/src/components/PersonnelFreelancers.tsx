import React, { FormEvent, useMemo, useState } from "react";
import { BriefcaseBusiness, Loader2, Pencil, Plus, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import {
  personnelFreelancerFieldLabels,
  type PersonnelFreelancerFields,
} from "@shared/personnelFreelancer";

type EditableRole = "RH" | "ADM" | "SUPERVISOR" | "FINANCEIRO";
type FreelancerRecord = PersonnelFreelancerFields & {
  id: number;
  sourceFileSha256: string | null;
  sourceSheet: string | null;
  sourceRow: number | null;
  sourceData: { cells: Array<{ column: string; header: string; value: string; kind?: string; formula?: string; cachedValue?: string }> } | null;
};

const emptyFields: PersonnelFreelancerFields = {
  collaboratorRaw: "",
  jobFunction: "",
  situation: "",
  hours: "",
  posts: "",
  coverage: "",
  pix: "",
  value: "",
  supervision: "",
  observations: "",
};

export function PersonnelFreelancers({ role }: { role: EditableRole }) {
  const allowed = role === "RH" || role === "ADM";
  const utils = trpc.useUtils();
  const query = trpc.personnel.freelancers.useQuery({}, { enabled: allowed });
  const create = trpc.personnel.createFreelancer.useMutation();
  const update = trpc.personnel.updateFreelancer.useMutation();
  const [fields, setFields] = useState<PersonnelFreelancerFields>(emptyFields);
  const [editing, setEditing] = useState<FreelancerRecord | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.toLocaleLowerCase("pt-BR").trim();
    if (!needle) return query.data ?? [];
    return (query.data ?? []).filter((item) =>
      personnelFreelancerFieldLabels.some(({ key }) => item[key].toLocaleLowerCase("pt-BR").includes(needle))
      || String(item.sourceRow ?? "").includes(needle),
    );
  }, [query.data, search]);

  if (!allowed) return null;

  const resetForm = () => {
    setFields(emptyFields);
    setEditing(null);
    setFormOpen(false);
  };

  const startEdit = (item: FreelancerRecord) => {
    const editableFields = Object.fromEntries(personnelFreelancerFieldLabels.map(({ key }) => [key, item[key]])) as PersonnelFreelancerFields;
    setFields(editableFields);
    setEditing(item);
    setFormOpen(true);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      if (editing) {
        await update.mutateAsync({ id: editing.id, ...fields });
        toast.success("Ficha freelancer atualizada");
      } else {
        await create.mutateAsync(fields);
        toast.success("Freelancer cadastrado na lista separada");
      }
      await utils.personnel.freelancers.invalidate();
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar a ficha");
    }
  };

  const saving = create.isPending || update.isPending;
  return (
    <div className="space-y-5">
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BriefcaseBusiness className="h-5 w-5 text-blue-600" /> Freelancers
            </CardTitle>
            <CardDescription className="mt-1 max-w-3xl">
              Lista independente dos funcionários. “Colaborador” permanece como texto original, sem separar contatos nem criar vínculos automáticos.
            </CardDescription>
          </div>
          <Button type="button" className="bg-[#0d1b2a] hover:bg-slate-800" onClick={() => { setFields(emptyFields); setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Novo freelancer
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {formOpen && (
            <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <div>
                <h3 className="font-semibold text-slate-900">{editing ? "Editar ficha freelancer" : "Nova ficha freelancer"}</h3>
                <p className="mt-1 text-xs text-slate-600">Os dez campos são mantidos como texto; valores como horários, PIX e valores não são convertidos.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {personnelFreelancerFieldLabels.map(({ key, label }) => (
                  <div key={key} className="space-y-1.5">
                    <Label htmlFor={`freelancer-${key}`}>{label}{key === "collaboratorRaw" ? " *" : ""}</Label>
                    {key === "collaboratorRaw" || key === "observations" ? (
                      <Textarea
                        id={`freelancer-${key}`}
                        value={fields[key]}
                        onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
                        required={key === "collaboratorRaw"}
                        maxLength={4_000}
                        rows={key === "collaboratorRaw" ? 3 : 2}
                      />
                    ) : (
                      <Input
                        id={`freelancer-${key}`}
                        value={fields[key]}
                        onChange={(event) => setFields((current) => ({ ...current, [key]: event.target.value }))}
                        maxLength={4_000}
                      />
                    )}
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={saving} className="bg-[#0d1b2a] hover:bg-slate-800">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {saving ? "Salvando..." : "Salvar"}
                </Button>
                <Button type="button" variant="outline" onClick={resetForm} disabled={saving}>
                  <X className="mr-2 h-4 w-4" /> Cancelar
                </Button>
              </div>
            </form>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="freelancer-search">Buscar na lista</Label>
            <Input id="freelancer-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Colaborador, função, posto ou linha de origem" />
            <p className="text-xs text-slate-500" aria-live="polite">{filtered.length} registros encontrados · {query.data?.length ?? 0} no total</p>
          </div>

          {query.isLoading && <p className="flex items-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando freelancers...</p>}
          {query.isError && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">Não foi possível carregar a lista de freelancers.</p>}
          {!query.isLoading && !query.isError && filtered.length === 0 && (
            <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">{search ? "Nenhum resultado para esta busca." : "Nenhum freelancer cadastrado."}</p>
          )}
          <div className="space-y-2">
            {filtered.map((item) => (
              <details key={item.id} className="rounded-xl border border-slate-200 bg-white">
                <summary className="cursor-pointer list-none px-4 py-3">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 break-words font-semibold text-slate-900">{item.collaboratorRaw}</span>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600">{item.situation || "Situação não informada"}</span>
                  </span>
                  <span className="mt-1 block text-xs text-slate-500">{item.jobFunction || "Função não informada"}{item.sourceSheet && item.sourceRow ? ` · Origem: ${item.sourceSheet}, linha ${item.sourceRow}` : " · Cadastro manual"}</span>
                </summary>
                <div className="border-t border-slate-100 p-4">
                  <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {personnelFreelancerFieldLabels.map(({ key, label }) => (
                      <div key={key} className="min-w-0 rounded-lg bg-slate-50 p-3">
                        <dt className="text-xs font-semibold text-slate-500">{label}</dt>
                        <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-900">{item[key] || "—"}</dd>
                      </div>
                    ))}
                  </dl>
                  {item.sourceData?.cells?.length ? (
                    <p className="mt-3 text-xs text-slate-500">Valores de origem preservados em Planilhas e pendências do RH.</p>
                  ) : null}
                  <div className="mt-3 flex justify-end">
                    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(item)}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar ficha
                    </Button>
                  </div>
                </div>
              </details>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
