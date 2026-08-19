import { BarChart3, FileDown, LayoutDashboard, Route } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

interface AdminHeaderProps {
  title: string;
  subtitle: string;
  onLogout: () => void;
}

export function AdminHeader({ title, subtitle, onLogout }: AdminHeaderProps) {
  const [location, navigate] = useLocation();
  const navItems = [
    { label: "Painel", path: "/admin", icon: LayoutDashboard },
    { label: "Relatórios", path: "/admin/relatorios", icon: FileDown },
    { label: "Métricas", path: "/admin/metrics", icon: BarChart3 },
    { label: "Exportar", path: "/admin/export", icon: FileDown },
    { label: "Operação", path: "/supervisor", icon: Route },
  ];

  return (
    <header className="border-b border-slate-200 bg-white/95 shadow-sm">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:py-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white shadow-sm">CT3</div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-600">CT3 · Chults Travagin</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">{title}</h1>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <nav aria-label="Navegação administrativa" className="flex flex-wrap gap-2">
              {navItems.map(({ label, path, icon: Icon }) => (
                <Button
                  key={path}
                  type="button"
                  size="sm"
                  variant={location === path ? "default" : "outline"}
                  onClick={() => navigate(path)}
                  aria-current={location === path ? "page" : undefined}
                  className={location === path ? "bg-slate-950 hover:bg-slate-800" : "text-slate-700"}
                >
                  <Icon className="mr-1.5 h-4 w-4" />{label}
                </Button>
              ))}
            </nav>
            <Button type="button" onClick={onLogout} variant="outline" size="sm">Sair</Button>
          </div>
        </div>
      </div>
    </header>
  );
}
