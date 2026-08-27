import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import {
  Building2,
  CheckCircle2,
  ChevronDown,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Save,
  Trash2,
  XCircle,
} from "lucide-react";
import React, { useEffect, useState } from "react";
import { toast } from "sonner";

type PostForm = {
  routeId: string;
  name: string;
  addressStreet: string;
  addressNumber: string;
  addressNeighborhood: string;
  addressCity: string;
  addressPostalCode: string;
};

const EMPTY_FORM: PostForm = {
  routeId: "",
  name: "",
  addressStreet: "",
  addressNumber: "",
  addressNeighborhood: "",
  addressCity: "",
  addressPostalCode: "",
};

function formatPostalCode(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return digits.length > 5
    ? `${digits.slice(0, 5)}-${digits.slice(5)}`
    : digits;
}

function fallbackAddressStreet(post: any) {
  if (post.addressStreet) return post.addressStreet;
  if (!post.address || post.address === "Endereço pendente de cadastro")
    return "";
  return post.address;
}

function postToForm(post: any): PostForm {
  return {
    routeId: String(post.routeId),
    name: post.name ?? "",
    addressStreet: fallbackAddressStreet(post),
    addressNumber: post.addressNumber ?? "",
    addressNeighborhood: post.addressNeighborhood ?? "",
    addressCity: post.addressCity ?? post.region ?? "",
    addressPostalCode: post.addressPostalCode ?? "",
  };
}

function addressLabel(post: any) {
  if (post.address === "Endereço pendente de cadastro" || !post.address)
    return "Endereço pendente de cadastro";
  return post.address;
}

export default function GestorPostsManagementPanel({
  management,
  loading,
}: {
  management: any;
  loading: boolean;
}) {
  const routes = (management?.routes ?? []).filter(
    (route: any) => route.activityType !== "operational_base"
  );
  const [form, setForm] = useState<PostForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const utils = trpc.useUtils();

  const invalidatePostViews = async () => {
    await Promise.all([
      utils.gestor.postsManagement.invalidate(),
      utils.gestor.dashboard.invalidate(),
    ]);
  };

  const createPost = trpc.gestor.createPost.useMutation({
    onSuccess: async post => {
      await invalidatePostViews();
      setDialogOpen(false);
      const locationMessage =
        post.geocodingStatus === "updated"
          ? "Coordenadas atualizadas no mapa."
          : "O endereço foi salvo; as coordenadas ficarão pendentes até o proxy de mapas responder.";
      toast.success(`Posto cadastrado. ${locationMessage}`);
    },
    onError: error => setFormError(error.message),
  });

  const updatePost = trpc.gestor.updatePost.useMutation({
    onSuccess: async post => {
      await invalidatePostViews();
      setDialogOpen(false);
      const locationMessage =
        post.geocodingStatus === "updated"
          ? "Coordenadas atualizadas no mapa."
          : "O endereço foi salvo; as coordenadas ficaram pendentes.";
      toast.success(`Posto atualizado. ${locationMessage}`);
    },
    onError: error => setFormError(error.message),
  });

  const deletePost = trpc.gestor.deletePost.useMutation({
    onSuccess: async () => {
      await invalidatePostViews();
      setDeleteTarget(null);
      toast.success("Posto excluído da operação. O histórico foi preservado.");
    },
    onError: error =>
      toast.error(error.message || "Não foi possível excluir o posto"),
  });

  const isEditing = Boolean(editingPost);
  const isSaving = createPost.isPending || updatePost.isPending;

  useEffect(() => {
    if (!dialogOpen || isEditing || form.routeId || !routes[0]) return;
    setForm(current => ({
      ...current,
      routeId: String(routes[0].id),
      addressCity: current.addressCity || routes[0].region || "",
    }));
  }, [dialogOpen, form.addressCity, form.routeId, isEditing, routes]);

  function openCreate(routeId?: number) {
    const route = routes.find((item: any) => item.id === routeId) ?? routes[0];
    setEditingPost(null);
    setForm({
      ...EMPTY_FORM,
      routeId: route ? String(route.id) : "",
      addressCity: route?.region ?? "",
    });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEdit(post: any) {
    setEditingPost(post);
    setForm(postToForm(post));
    setFormError(null);
    setDialogOpen(true);
  }

  function closeDialog(open: boolean) {
    if (isSaving) return;
    setDialogOpen(open);
    if (!open) {
      setEditingPost(null);
      setFormError(null);
    }
  }

  function updateForm<K extends keyof PostForm>(field: K, value: PostForm[K]) {
    setForm(current => ({ ...current, [field]: value }));
    setFormError(null);
  }

  function submitForm(event?: React.SyntheticEvent) {
    event?.preventDefault();
    const routeId = Number(form.routeId);
    if (!Number.isSafeInteger(routeId) || routeId <= 0) {
      setFormError("Selecione a rota vinculada ao posto");
      return;
    }
    const payload = {
      routeId,
      name: form.name.trim(),
      addressStreet: form.addressStreet.trim(),
      addressNumber: form.addressNumber.trim(),
      addressNeighborhood: form.addressNeighborhood.trim(),
      addressCity: form.addressCity.trim(),
      addressPostalCode: form.addressPostalCode.trim(),
    };
    if (editingPost) {
      updatePost.mutate({ id: editingPost.id, ...payload });
    } else {
      createPost.mutate(payload);
    }
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    deletePost.mutate({ id: deleteTarget.id });
  }

  return (
    <>
      <section className="rounded-3xl border border-emerald-100 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <Building2 className="h-4 w-4" /> Postos de serviço
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-slate-950">
              Cadastro completo de Postos
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Cadastre, edite ou exclua locais atendidos. O endereço informado é
              geocodificado para atualizar os pinos do mapa operacional.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => openCreate()}
            disabled={loading || !routes.length}
            className="gap-2 bg-slate-950 text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" /> Adicionar Novo Posto
          </Button>
        </div>

        {loading ? (
          <div className="p-6">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando postos...
            </div>
          </div>
        ) : !routes.length ? (
          <div className="p-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Nenhuma rota cadastrada para vincular novos postos.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 p-6 lg:grid-cols-2">
            {routes.map((route: any) => (
              <details
                key={route.id}
                className="group rounded-2xl border border-slate-200 bg-slate-50 p-4"
                open
              >
                <summary className="cursor-pointer list-none">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-950">
                        {route.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {route.region} · {route.posts.length} posto(s) ativo(s)
                      </p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-500 transition-transform duration-200 group-open:rotate-180" />
                  </div>
                </summary>
                <div className="mt-4 space-y-3 border-t border-slate-200 pt-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => openCreate(route.id)}
                    className="w-full gap-2 border-emerald-200 bg-white text-emerald-800 hover:bg-emerald-50"
                  >
                    <Plus className="h-4 w-4" /> Adicionar posto nesta rota
                  </Button>
                  {route.posts.length ? (
                    route.posts.map((post: any) => (
                      <article
                        key={post.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-slate-950">
                                {post.name}
                              </p>
                              {post.latitude != null &&
                              post.longitude != null ? (
                                <Badge className="gap-1 bg-emerald-100 text-emerald-800">
                                  <CheckCircle2 className="h-3 w-3" /> GPS
                                  atualizado
                                </Badge>
                              ) : (
                                <Badge className="gap-1 bg-amber-100 text-amber-900">
                                  <XCircle className="h-3 w-3" /> Endereço sem
                                  GPS
                                </Badge>
                              )}
                            </div>
                            <p
                              className={`mt-2 flex items-start gap-2 text-sm leading-5 ${post.address === "Endereço pendente de cadastro" || !post.address ? "font-semibold text-amber-800" : "text-slate-600"}`}
                            >
                              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />{" "}
                              {addressLabel(post)}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              Ordem operacional: {post.order} ·{" "}
                              {post.addressCity || post.region || route.region}
                            </p>
                          </div>
                          {post.name !== "Base Operacional" && (
                            <div className="flex shrink-0 gap-2">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => openEdit(post)}
                                className="gap-1.5 text-slate-700"
                              >
                                <Pencil className="h-3.5 w-3.5" /> Editar Posto
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setDeleteTarget(post)}
                                className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Excluir Posto
                              </Button>
                            </div>
                          )}
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                      Nenhum posto cadastrado nesta rota.
                    </p>
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </section>

      <Dialog open={dialogOpen} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? "Editar Posto" : "Adicionar Novo Posto"}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? "Atualize o endereço ou altere a rota. O novo endereço será geocodificado para atualizar o mapa."
                : "Preencha o endereço completo para cadastrar o posto e posicioná-lo no mapa operacional."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitForm} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 sm:col-span-2">
                Rota vinculada
                <select
                  aria-label="Rota vinculada do posto"
                  required
                  value={form.routeId}
                  onChange={event => updateForm("routeId", event.target.value)}
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-emerald-600 focus:ring-2"
                >
                  <option value="" disabled>
                    Selecione uma rota
                  </option>
                  {routes.map((route: any) => (
                    <option key={route.id} value={route.id}>
                      {route.name} · {route.region}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 sm:col-span-2">
                Nome do Posto
                <input
                  aria-label="Nome do Posto"
                  required
                  minLength={2}
                  maxLength={255}
                  value={form.name}
                  onChange={event => updateForm("name", event.target.value)}
                  placeholder="Ex.: Galpão Jundiaí"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-emerald-600 focus:ring-2"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600 sm:col-span-2">
                Rua
                <input
                  aria-label="Rua do posto"
                  required
                  minLength={2}
                  maxLength={255}
                  value={form.addressStreet}
                  onChange={event =>
                    updateForm("addressStreet", event.target.value)
                  }
                  placeholder="Ex.: Avenida das Indústrias"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-emerald-600 focus:ring-2"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                Número
                <input
                  aria-label="Número do posto"
                  required
                  maxLength={32}
                  value={form.addressNumber}
                  onChange={event =>
                    updateForm("addressNumber", event.target.value)
                  }
                  placeholder="Ex.: 655"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-emerald-600 focus:ring-2"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                Bairro
                <input
                  aria-label="Bairro do posto"
                  required
                  minLength={2}
                  maxLength={255}
                  value={form.addressNeighborhood}
                  onChange={event =>
                    updateForm("addressNeighborhood", event.target.value)
                  }
                  placeholder="Ex.: Distrito Industrial"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-emerald-600 focus:ring-2"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                Cidade
                <input
                  aria-label="Cidade do posto"
                  required
                  minLength={2}
                  maxLength={255}
                  value={form.addressCity}
                  onChange={event =>
                    updateForm("addressCity", event.target.value)
                  }
                  placeholder="Ex.: Jundiaí"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-emerald-600 focus:ring-2"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-600">
                CEP
                <input
                  aria-label="CEP do posto"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{5}-?[0-9]{3}"
                  maxLength={9}
                  value={form.addressPostalCode}
                  onChange={event =>
                    updateForm(
                      "addressPostalCode",
                      formatPostalCode(event.target.value)
                    )
                  }
                  placeholder="00000-000"
                  className="h-10 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none ring-emerald-600 focus:ring-2"
                />
              </label>
            </div>
            {formError && (
              <p
                role="alert"
                className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900"
              >
                {formError}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => closeDialog(false)}
                disabled={isSaving}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => submitForm()}
                disabled={isSaving}
                className="gap-2 bg-emerald-700 text-white hover:bg-emerald-800"
              >
                {isSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSaving
                  ? "Salvando..."
                  : isEditing
                    ? "Salvar alterações"
                    : "Cadastrar posto"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={open => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir este Posto?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deleteTarget?.name}</strong>? O posto deixará de aparecer
              nas próximas operações, mas os históricos já registrados serão
              preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePost.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deletePost.isPending}
              className="bg-rose-700 text-white hover:bg-rose-800"
            >
              {deletePost.isPending ? "Excluindo..." : "Sim, excluir Posto"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
