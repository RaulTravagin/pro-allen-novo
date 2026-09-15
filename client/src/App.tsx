import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import Login from "./pages/Login";
import { lazy, Suspense } from "react";
import { useLocation } from "wouter";
import { getGestorRouteMode } from "./lib/gestor-routing";

const SupervisorDashboard = lazy(() => import("./pages/SupervisorDashboard"));
const RouteDetails = lazy(() => import("./pages/RouteDetails"));
const ChecklistPage = lazy(() => import("./pages/ChecklistPage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MetricsDashboard = lazy(() => import("./pages/MetricsDashboard"));
const ReportExport = lazy(() => import("./pages/ReportExport"));
const GestorLogin = lazy(() => import("./pages/GestorLogin"));
const GestorDashboard = lazy(() => import("./pages/GestorDashboard"));
const LocalContingency = lazy(() => import("./pages/LocalContingency"));
const Presentation = lazy(() => import("./pages/Presentation"));
const OperationalReports = lazy(() => import("./pages/OperationalReports"));
const PersonnelDashboard = lazy(() => import("./pages/PersonnelDashboard"));

function PersonnelRoute() {
  return <PersonnelDashboard />;
}

function HrEmployeesRoute() {
  return <PersonnelDashboard initialSection="employees" requiredRole={["RH", "ADM"]} />;
}

function FinancePaymentsRoute() {
  return <PersonnelDashboard initialSection="finance" requiredRole={["FINANCEIRO", "ADM"]} />;
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50" role="status" aria-live="polite">
      <span className="text-sm text-slate-600">Carregando tela...</span>
    </div>
  );
}

function Router() {
  const [location] = useLocation();
  const { user, loading, isAuthenticated } = useAuth();
  const gestorRouteMode = getGestorRouteMode(location);

  if (location === "/local") {
    return <Suspense fallback={<LoadingScreen />}><LocalContingency /></Suspense>;
  }

  if (location === "/apresentacao" || location === "/pitch") {
    return <Suspense fallback={<LoadingScreen />}><Presentation /></Suspense>;
  }

  if (location === "/gestor/relatorios" || location === "/admin/relatorios") {
    return <Suspense fallback={<LoadingScreen />}><OperationalReports /></Suspense>;
  }

  if (gestorRouteMode === "login") {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <GestorLogin />
      </Suspense>
    );
  }

  if (gestorRouteMode === "dashboard") {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <GestorDashboard />
      </Suspense>
    );
  }

  if (loading) return <LoadingScreen />;

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path="/" component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  if (user?.role === "admin") {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <Switch>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/metrics" component={MetricsDashboard} />
          <Route path="/admin/export" component={ReportExport} />
          <Route path="/pessoal" component={PersonnelRoute} />
          <Route path="/rh/funcionarios" component={HrEmployeesRoute} />
          <Route path="/financeiro/pagamentos" component={FinancePaymentsRoute} />
          <Route path="/supervisor" component={SupervisorDashboard} />
          <Route path="/supervisor/route/:supervisorRouteId" component={RouteDetails} />
          <Route path="/supervisor/checklist/:checklistId" component={ChecklistPage} />
          <Route path="/" component={AdminDashboard} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Switch>
        <Route path="/supervisor" component={SupervisorDashboard} />
        <Route path="/pessoal" component={PersonnelRoute} />
        <Route path="/rh/funcionarios" component={HrEmployeesRoute} />
        <Route path="/financeiro/pagamentos" component={FinancePaymentsRoute} />
        <Route path="/supervisor/route/:supervisorRouteId" component={RouteDetails} />
        <Route path="/supervisor/checklist/:checklistId" component={ChecklistPage} />
        <Route path="/" component={SupervisorDashboard} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
