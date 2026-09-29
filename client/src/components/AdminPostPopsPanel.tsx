import PostPopManagement from "@/components/PostPopManagement";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Building2, Loader2 } from "lucide-react";
import React from "react";

function RoutePostPops({ route }: { route: { id: number; name: string; region: string; activityType?: string } }) {
  const posts = trpc.routes.getPostsByRoute.useQuery(
    { routeId: route.id },
    { enabled: route.activityType !== "operational_base" },
  );
  if (route.activityType === "operational_base") return null;
  return (
    <section className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold text-slate-950">{route.name}<span className="ml-2 text-xs font-normal text-slate-500">{route.region}</span></h3>
      {posts.isLoading ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" /> Carregando postos…</p>
      ) : posts.error ? (
        <p className="mt-3 text-sm text-rose-700">Não foi possível carregar os postos desta rota.</p>
      ) : posts.data?.length ? (
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {posts.data.map((post) => (
            <article key={post.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
              <h4 className="flex items-center gap-2 font-medium text-slate-900"><Building2 className="h-4 w-4 text-emerald-700" />{post.name}</h4>
              <PostPopManagement postId={post.id} />
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">Nenhum posto cadastrado nesta rota.</p>
      )}
    </section>
  );
}

export default function AdminPostPopsPanel() {
  const routes = trpc.routes.list.useQuery();
  return (
    <Card>
      <CardHeader>
        <CardTitle>POPs por posto</CardTitle>
        <CardDescription>Anexe e administre procedimentos em PDF, DOC ou DOCX. Os arquivos não são públicos; supervisores só os acessam pela rota vinculada.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {routes.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-slate-600"><Loader2 className="h-5 w-5 animate-spin" /> Carregando rotas…</div>
        ) : routes.error ? (
          <p className="text-sm text-rose-700">Não foi possível carregar as rotas disponíveis.</p>
        ) : routes.data?.length ? (
          routes.data.map((route) => <RoutePostPops key={route.id} route={route} />)
        ) : (
          <p className="py-6 text-sm text-slate-500">Nenhuma rota cadastrada.</p>
        )}
      </CardContent>
    </Card>
  );
}
