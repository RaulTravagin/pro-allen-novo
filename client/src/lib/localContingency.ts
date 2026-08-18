export type LocalChecklistAnswer = "conforme" | "atencao" | "pendente";
export type LocalVisitStatus = "pending" | "in_progress" | "visited";

export type LocalChecklistItem = {
  id: string;
  label: string;
  answer: LocalChecklistAnswer;
  notes: string;
};

export type LocalVisit = {
  id: string;
  postId: string;
  postName: string;
  region: string;
  status: LocalVisitStatus;
  arrivalAt: string | null;
  departureAt: string | null;
  observations: string;
  items: LocalChecklistItem[];
};

export type LocalActivity = {
  id: string;
  supervisorUsername: string;
  supervisorName: string;
  routeId: string;
  routeName: string;
  routeRegion: string;
  activityType: "field_route" | "operational_base";
  status: "in_progress" | "completed";
  startedAt: string;
  completedAt: string | null;
  kmInitial: number | null;
  kmFinal: number | null;
  visits: LocalVisit[];
};

export type LocalSession = { username: string; name: string; createdAt: string };

type LocalState = {
  version: 1;
  session: LocalSession | null;
  activities: LocalActivity[];
  updatedAt: string;
};

export type LocalRoute = {
  id: string;
  name: string;
  region: string;
  activityType: "field_route" | "operational_base";
  posts: Array<{ id: string; name: string; region: string }>;
};

const STORAGE_KEY = "pro-allen:contingency:v1";
const CHECKLIST_LABELS = [
  "Uniforme e apresentação pessoal",
  "Pontualidade e escala",
  "Livro de ocorrências",
  "Procedimentos operacionais",
  "Equipamentos e materiais",
  "Limpeza e organização",
  "Contato com o cliente",
  "Registro fotográfico",
  "Plano de ação (quando necessário)",
];

const LOCAL_USERS = [
  { username: "paulo.murashita", name: "Paulo Murashita", credentialHash: "eada2356396d89a2fe8429895da07f345f00b4bbe5db6200fe234e63749386fd" },
  { username: "rodrigo.ramos", name: "Rodrigo Ramos", credentialHash: "7dc3e1a60e0f40b8c5e40e28a150b93f0835bfca286af4c51ad15ed72edadf11" },
  { username: "aparecido.quirino", name: "Aparecido Quirino", credentialHash: "f4d97ebbeaea58b5768d8257edda594b6df7abd14e17c3ff4bc319d5987db4e1" },
  { username: "raultravagin", name: "Raul Travagin", credentialHash: "e6ccfe27c51c40ef200d3cea6a3c9dc1600313ad96469e710e44153bb092881c" },
] as const;

export const LOCAL_ROUTES: LocalRoute[] = [
  { id: "local-base", name: "Base Operacional", region: "Operação interna", activityType: "operational_base", posts: [] },
  { id: "local-r1", name: "Rota 1", region: "Jordanésia e Campo Limpo", activityType: "field_route", posts: [
    { id: "kelvion", name: "Kelvion", region: "Jordanésia" }, { id: "supertec", name: "Supertec", region: "Campo Limpo" }, { id: "comtec-2", name: "Comtec 2", region: "Campo Limpo" }, { id: "coco-leve", name: "Coco Leve", region: "Campo Limpo" },
  ] },
  { id: "local-r2", name: "Rota 2", region: "Jundiaí", activityType: "field_route", posts: [
    { id: "condominio-esmeralda", name: "Condomínio Esmeralda", region: "Jundiaí" }, { id: "caminhos-serra-1", name: "Caminhos da Serra 1", region: "Jundiaí" }, { id: "caminhos-serra-2", name: "Caminhos da Serra 2", region: "Jundiaí" }, { id: "instituto-luiz-braille", name: "Instituto Luiz Braille", region: "Jundiaí" }, { id: "flex-1", name: "Flex 1", region: "Jundiaí" }, { id: "flex-2", name: "Flex 2", region: "Jundiaí" }, { id: "cidade-vicentina", name: "Cidade Vicentina", region: "Jundiaí" }, { id: "condominio-tropical", name: "Condomínio Tropical I", region: "Jundiaí" }, { id: "shell", name: "Auto Posto Shell", region: "Jundiaí" },
  ] },
  { id: "local-r3", name: "Rota 3", region: "Jundiaí", activityType: "field_route", posts: [
    { id: "open-view", name: "Open View", region: "Jundiaí" }, { id: "terras-genova", name: "Terras de Gênova", region: "Jundiaí" }, { id: "reserva-mata", name: "Reserva da Mata", region: "Jundiaí" }, { id: "saff", name: "Metalúrgica Saff", region: "Jundiaí" }, { id: "cma", name: "C.M.A.", region: "Jundiaí" }, { id: "sao-francisco", name: "São Francisco", region: "Jundiaí" },
  ] },
  { id: "local-r4", name: "Rota 4", region: "Jundiaí e Cabreúva", activityType: "field_route", posts: [
    { id: "brasimet", name: "Brasimet", region: "Jundiaí" }, { id: "bottcher", name: "Bottcher", region: "Jundiaí" }, { id: "magnera", name: "Magnera", region: "Jundiaí" }, { id: "gag", name: "G.A.G.", region: "Jundiaí" }, { id: "eco-village", name: "Eco Village", region: "Jundiaí" }, { id: "cpq", name: "C.P.Q.", region: "Jundiaí" }, { id: "carmel", name: "Carmel", region: "Cabreúva" },
  ] },
];

function emptyState(): LocalState {
  return { version: 1, session: null, activities: [], updatedAt: new Date().toISOString() };
}

function uuid() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readState(): LocalState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as Partial<LocalState> | null;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.activities)) return emptyState();
    return { version: 1, session: parsed.session ?? null, activities: parsed.activities, updatedAt: parsed.updatedAt ?? new Date().toISOString() };
  } catch {
    return emptyState();
  }
}

function writeState(next: LocalState) {
  const normalized = { ...next, updatedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  return normalized;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function getLocalSession() {
  return readState().session;
}

export async function loginLocal(username: string, password: string): Promise<LocalSession | null> {
  const normalizedUsername = username.trim().toLowerCase();
  const user = LOCAL_USERS.find((candidate) => candidate.username === normalizedUsername);
  if (!user) return null;
  const credentialHash = await sha256(`${normalizedUsername}:${password}`);
  if (credentialHash !== user.credentialHash) return null;
  const state = readState();
  const session = { username: user.username, name: user.name, createdAt: new Date().toISOString() };
  writeState({ ...state, session });
  return session;
}

export function logoutLocal() {
  const state = readState();
  writeState({ ...state, session: null });
}

export function getActivitiesForLocalUser(username: string) {
  return readState().activities.filter((activity) => activity.supervisorUsername === username).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export function getOpenActivityForLocalUser(username: string) {
  return getActivitiesForLocalUser(username).find((activity) => activity.status === "in_progress") ?? null;
}

export function startLocalActivity(session: LocalSession, routeId: string) {
  const route = LOCAL_ROUTES.find((candidate) => candidate.id === routeId);
  if (!route) throw new Error("Rota local não encontrada.");
  const active = getOpenActivityForLocalUser(session.username);
  if (active) throw new Error("Encerre a atividade em andamento antes de iniciar outra.");
  const now = new Date().toISOString();
  const activity: LocalActivity = {
    id: uuid(), supervisorUsername: session.username, supervisorName: session.name,
    routeId: route.id, routeName: route.name, routeRegion: route.region, activityType: route.activityType,
    status: "in_progress", startedAt: now, completedAt: null, kmInitial: null, kmFinal: null,
    visits: route.posts.map((post) => ({ id: uuid(), postId: post.id, postName: post.name, region: post.region, status: "pending", arrivalAt: null, departureAt: null, observations: "", items: CHECKLIST_LABELS.map((label) => ({ id: uuid(), label, answer: "pendente", notes: "" })) })),
  };
  const state = readState();
  writeState({ ...state, activities: [...state.activities, activity] });
  return activity;
}

export function updateLocalActivity(activityId: string, update: (activity: LocalActivity) => LocalActivity): LocalActivity {
  const state = readState();
  let updated: LocalActivity | null = null;
  const activities = state.activities.map((activity) => {
    if (activity.id !== activityId) return activity;
    updated = update(activity);
    return updated;
  });
  if (!updated) throw new Error("Atividade local não encontrada.");
  writeState({ ...state, activities });
  return updated as LocalActivity;
}

export function updateLocalKm(activityId: string, km: number, type: "initial" | "final") {
  return updateLocalActivity(activityId, (activity) => {
    if (type === "initial") return { ...activity, kmInitial: km };
    if (activity.kmInitial === null) throw new Error("Informe o KM inicial antes do KM final.");
    if (km < activity.kmInitial) throw new Error("O KM final não pode ser menor que o KM inicial.");
    return { ...activity, kmFinal: km, completedAt: new Date().toISOString(), status: "completed" };
  });
}

export function updateLocalVisit(activityId: string, visitId: string, update: (visit: LocalVisit) => LocalVisit) {
  return updateLocalActivity(activityId, (activity) => ({
    ...activity,
    visits: activity.visits.map((visit) => visit.id === visitId ? update(visit) : visit),
  }));
}

export function checkInLocalVisit(activityId: string, visitId: string) {
  return updateLocalVisit(activityId, visitId, (visit) => ({ ...visit, status: "in_progress", arrivalAt: new Date().toISOString() }));
}

export function checkOutLocalVisit(activityId: string, visitId: string) {
  return updateLocalVisit(activityId, visitId, (visit) => ({ ...visit, status: "visited", departureAt: new Date().toISOString() }));
}

export function saveLocalChecklistItem(activityId: string, visitId: string, itemId: string, answer: LocalChecklistAnswer, notes: string) {
  return updateLocalVisit(activityId, visitId, (visit) => ({ ...visit, items: visit.items.map((item) => item.id === itemId ? { ...item, answer, notes } : item) }));
}

export function saveLocalVisitObservations(activityId: string, visitId: string, observations: string) {
  return updateLocalVisit(activityId, visitId, (visit) => ({ ...visit, observations }));
}

export function exportLocalContingencyData() {
  const state = readState();
  return JSON.stringify({ exportedAt: new Date().toISOString(), product: "Pro Allen - Modo Local", ...state }, null, 2);
}

export function importLocalContingencyData(raw: string) {
  const parsed = JSON.parse(raw) as Partial<LocalState>;
  if (parsed.version !== 1 || !Array.isArray(parsed.activities)) throw new Error("Arquivo de contingência inválido.");
  return writeState({ version: 1, session: parsed.session ?? null, activities: parsed.activities, updatedAt: new Date().toISOString() });
}

export function clearLocalContingencyData() {
  localStorage.removeItem(STORAGE_KEY);
}
