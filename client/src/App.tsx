import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { useAuth } from "@/_core/hooks/useAuth";
import Login from "./pages/Login";
import SupervisorDashboard from "./pages/SupervisorDashboard";
import RouteDetails from "./pages/RouteDetails";
import ChecklistPage from "./pages/ChecklistPage";
import AdminDashboard from "./pages/AdminDashboard";


function Router() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><span>Carregando...</span></div>;
  }

  if (!isAuthenticated) {
    return (
      <Switch>
        <Route path={"/"} component={Login} />
        <Route component={Login} />
      </Switch>
    );
  }

  // Admin routes
  if (user?.role === 'admin') {
    return (
      <Switch>
        <Route path={"/admin"} component={AdminDashboard} />
        <Route path={"/"} component={AdminDashboard} />
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    );
  }

  // Supervisor routes
  return (
    <Switch>
      <Route path={"/supervisor"} component={SupervisorDashboard} />
      <Route path={"/supervisor/route/:supervisorRouteId"} component={RouteDetails} />
      <Route path={"/supervisor/checklist/:checklistId"} component={ChecklistPage} />
      <Route path={"/"} component={SupervisorDashboard} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
