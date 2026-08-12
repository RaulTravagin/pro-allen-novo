export type GestorRouteMode = "login" | "dashboard" | null;

/**
 * Mantém a entrada por senha isolada do painel protegido. A rota de login
 * não pode montar o dashboard, pois ele consulta dados que exigem sessão.
 */
export function getGestorRouteMode(pathname: string): GestorRouteMode {
  if (pathname === "/gestor/acesso") return "login";
  if (pathname === "/gestor") return "dashboard";
  return null;
}
