import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { isCivilDate, isCivilMonth } from "../shared/personnel-schedules";
import { isValidCoordinatePair } from "../shared/geographic-coordinates";
import { TRPCError } from "@trpc/server";
import { RouteClosureError } from "./route-closure";
import { selectOpenSupervisorRoute } from "./supervisor-route-selection";
import {
  createGestorSession,
  GESTOR_COOKIE_NAME,
  GESTOR_SESSION_MAX_AGE_SECONDS,
  hasGestorSession,
  isGestorPasswordValid,
} from "./gestor-access";
import {
  createSupervisorSession,
  LOCAL_SUPERVISOR_COOKIE_NAME,
  LOCAL_SUPERVISOR_SESSION_MAX_AGE_SECONDS,
  hashSupervisorPassword,
  verifySupervisorPassword,
} from "./local-supervisor-auth";
import { buildDailyOperationalReport } from "./daily-operational-report";
import {
  projectGestorPersonnelMovementReport,
  projectGestorPersonnelOverview,
  projectPersonnelDashboard,
  projectPersonnelEmployee,
  projectPersonnelMovementRow,
  projectPersonnelOccurrence,
} from "./personnel-security";
import type { MovementPeriod } from "../shared/personnel-movement-report";
import type { User } from "../drizzle/schema";
import { randomUUID } from "node:crypto";
import { storageGetSignedUrl, storagePut } from "./storage";
import { canManagePostPops } from "./post-pops-access";
import {
  MAX_UPLOAD_BASE64_LENGTH,
  isValidUploadBase64,
  isValidUploadContent,
  resolvePersonnelDocumentMimeType,
  resolvePostPopMimeType,
} from "../shared/upload-file-types";

type PublicUser = Pick<User, "id" | "name" | "username" | "role" | "isOperational" | "defaultShift"> & {
  personnelRole: User["personnelRole"] | "SUPERVISOR" | "ADM";
};

export function toPublicUser(user: User): PublicUser;
export function toPublicUser(user: null | undefined): null;
export function toPublicUser(user: User | null | undefined): PublicUser | null;
export function toPublicUser(user: User | null | undefined): PublicUser | null {
  if (!user) return null;
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    personnelRole: user.personnelRole ?? (user.role === "admin" ? "ADM" : "SUPERVISOR"),
    isOperational: user.isOperational,
    defaultShift: user.defaultShift,
  };
}

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user?.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx });
});

// O Gestor entra somente com a senha exclusiva, em uma sessão separada do login operacional.
const gestorProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const hasPasswordAccess = await hasGestorSession(ctx.req);
  if (!hasPasswordAccess) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso do Gestor necessário" });
  }
  return next();
});

const postPopManagerProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const role = ctx.user ? db.getPersonnelRole(ctx.user) : null;
  if (!canManagePostPops(role, await hasGestorSession(ctx.req))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente ADM ou Gestor pode administrar POPs" });
  }
  return next();
});

const routeCatalogReadProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const role = ctx.user ? db.getPersonnelRole(ctx.user) : null;
  const gestorSession = await hasGestorSession(ctx.req);
  if (role !== "SUPERVISOR" && !canManagePostPops(role, gestorSession)) {
    throw new TRPCError({
      code: ctx.user ? "FORBIDDEN" : "UNAUTHORIZED",
      message: "Acesso ao catálogo de rotas e postos não autorizado",
    });
  }
  return next({ ctx });
});

const supervisorProcedure = protectedProcedure.use(({ ctx, next }) => {
  const personnelRole = ctx.user.role === "admin" ? "ADM" : (ctx.user.personnelRole ?? "SUPERVISOR");
  if (personnelRole !== "SUPERVISOR") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Esta operação é exclusiva do perfil Supervisor" });
  }
  return next({ ctx });
});

const supervisorReadProcedure = protectedProcedure.use(({ ctx, next }) => {
  const personnelRole = ctx.user.role === "admin" ? "ADM" : (ctx.user.personnelRole ?? "SUPERVISOR");
  if (ctx.user.role !== "admin" && personnelRole !== "SUPERVISOR") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Acesso de leitura operacional não autorizado" });
  }
  return next({ ctx });
});

const supervisorOrGestorReadProcedure = publicProcedure.use(async ({ ctx, next }) => {
  const personnelRole = ctx.user
    ? (ctx.user.role === "admin" ? "ADM" : (ctx.user.personnelRole ?? "SUPERVISOR"))
    : null;
  if (personnelRole === "SUPERVISOR" || await hasGestorSession(ctx.req)) return next({ ctx });
  throw new TRPCError({ code: "FORBIDDEN", message: "Acesso de leitura operacional não autorizado" });
});

function isAdminOperationalViewer(user: { role: string; personnelRole?: string | null }) {
  return user.role === "admin";
}

const adminOperationalReadProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Somente role=admin pode consultar o monitoramento operacional" });
  }
  return next({ ctx });
});

const visitPresenceInput = z.object({
  checklistId: z.number().int().positive(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
}).refine(({ latitude, longitude }) => isValidCoordinatePair(latitude, longitude), {
  message: "Informe latitude e longitude juntas e dentro das faixas geográficas válidas",
  path: ["longitude"],
});

function getPostPopStorageFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message.startsWith("Storage config missing")) {
    return {
      code: "PRECONDITION_FAILED" as const,
      message: "O armazenamento de arquivos não está configurado no Render. Cadastre BUILT_IN_FORGE_API_URL e BUILT_IN_FORGE_API_KEY no serviço.",
    };
  }
  if (message.startsWith("Storage presign") || message.startsWith("Storage upload")) {
    return {
      code: "BAD_GATEWAY" as const,
      message: "O serviço de arquivos recusou o POP. Verifique a configuração do storage no Render e tente novamente.",
    };
  }
  return null;
}

const gestorPostInput = z.object({
  routeId: z.number().int().positive(),
  name: z.string().trim().min(2, "Informe o nome do posto").max(255),
  addressStreet: z.string().trim().min(2, "Informe a rua do posto").max(255),
  addressNumber: z.string().trim().min(1, "Informe o número do posto").max(32),
  addressNeighborhood: z.string().trim().min(2, "Informe o bairro do posto").max(255),
  addressCity: z.string().trim().min(2, "Informe a cidade do posto").max(255),
  addressPostalCode: z.string().trim().regex(/^\d{5}-?\d{3}$/, "Informe um CEP válido"),
});

function normalizePersonnelIdentifier(value: string) {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, "");
  return digits.length === 11 ? digits : trimmed;
}

async function runChecklistMutation<T>(mutation: () => Promise<T>): Promise<T> {
  try {
    return await mutation();
  } catch (error) {
    if (error instanceof RouteClosureError) {
      throw new TRPCError({ code: error.code, message: error.message });
    }
    throw error;
  }
}

const civilDateSchema = z.string().refine(isCivilDate, "Use uma data civil válida no formato AAAA-MM-DD");
const civilMonthSchema = z.string().refine(isCivilMonth, "Use um mês válido no formato AAAA-MM");
const uploadBase64Schema = z.string().min(4).max(MAX_UPLOAD_BASE64_LENGTH).refine(isValidUploadBase64, "Arquivo em formato inválido");
const personnelDocumentSchema = z.object({
  name: z.string().trim().min(1).max(255),
  mimeType: z.string().max(128).optional().default(""),
  base64: uploadBase64Schema,
});
const movementPeriodSchema = z.enum(["ALL", "FIRST_HALF", "SECOND_HALF"] as const);
const movementReportInput = z.object({ month: civilMonthSchema, period: movementPeriodSchema });
const schedulePatternSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("WEEKLY"), minutesByDay: z.array(z.number().int().min(0).max(1440)).length(7) }),
  z.object({ kind: z.literal("CYCLE"), minutesByDay: z.array(z.number().int().min(0).max(1440)).min(2).max(42) }),
]);

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => toPublicUser(opts.ctx.user)),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  personnel: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const role = db.getPersonnelRole(ctx.user);
      const data = await db.getPersonnelDashboardData(ctx.user.id, role);
      return { role, ...projectPersonnelDashboard(data, role) };
    }),

    movementReport: protectedProcedure
      .input(movementReportInput)
      .query(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "FINANCEIRO" && role !== "ADM") {
          throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH, Financeiro ou ADM pode consultar este relatório" });
        }
        const report = await db.getPersonnelMovementReport(input.month, input.period as MovementPeriod, role);
        return { ...report, rows: report.rows.map((row) => projectPersonnelMovementRow(row, role)) };
      }),

    employees: protectedProcedure.query(async ({ ctx }) => {
      const role = db.getPersonnelRole(ctx.user);
      if (role === "FINANCEIRO") throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não precisa consultar a base de funcionários" });
      const employees = await db.listPersonnelEmployees(role !== "SUPERVISOR", role === "RH" || role === "ADM");
      return employees.map((employee) => projectPersonnelEmployee(employee, role));
    }),

    posts: protectedProcedure.query(async ({ ctx }) => {
      const role = db.getPersonnelRole(ctx.user);
      if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode consultar os postos" });
      return db.listPersonnelPosts();
    }),

    workSchedules: protectedProcedure.query(async ({ ctx }) => {
      const role = db.getPersonnelRole(ctx.user);
      if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode consultar as jornadas" });
      return db.listPersonnelWorkSchedules();
    }),

    createWorkSchedule: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(120), pattern: schedulePatternSchema }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode cadastrar jornadas" });
        try {
          return await db.createPersonnelWorkSchedule({ ...input, createdBy: ctx.user.id });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cadastrar a jornada" });
        }
      }),

    assignWorkSchedule: protectedProcedure
      .input(z.object({ employeeId: z.number().int().positive(), scheduleId: z.number().int().positive(), startDate: civilDateSchema, cycleAnchorDate: civilDateSchema.nullable(), reason: z.string().trim().min(5).max(2_000) }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode atribuir jornadas" });
        try {
          return await db.assignPersonnelWorkSchedule({
            ...input,
            assignedBy: ctx.user.id,
            actorName: ctx.user.name ?? ctx.user.username ?? "",
            actorUsername: ctx.user.username,
          });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível atribuir a jornada" });
        }
      }),

    editWorkScheduleAssignment: protectedProcedure
      .input(z.object({
        assignmentId: z.number().int().positive(),
        employeeId: z.number().int().positive(),
        scheduleId: z.number().int().positive(),
        startDate: civilDateSchema,
        endDate: civilDateSchema.nullable(),
        cycleAnchorDate: civilDateSchema.nullable(),
        reason: z.string().trim().min(5).max(2_000),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode corrigir atribuições de jornada" });
        try {
          return await db.editPersonnelWorkScheduleAssignment({
            ...input,
            actorId: ctx.user.id,
            actorName: ctx.user.name ?? ctx.user.username ?? "",
            actorUsername: ctx.user.username,
          });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível corrigir a vigência" });
        }
      }),

    workScheduleAssignmentAudit: protectedProcedure
      .input(z.object({ assignmentId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode consultar a auditoria de jornadas" });
        return db.listPersonnelWorkScheduleAssignmentAudits(input.assignmentId);
      }),

    employeeScheduleCalendar: protectedProcedure
      .input(z.object({ employeeId: z.number().int().positive(), month: civilMonthSchema }))
      .query(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode consultar o calendário de jornadas" });
        return db.getPersonnelEmployeeScheduleCalendar(input.employeeId, input.month);
      }),

    classifyFtDate: protectedProcedure
      .input(z.object({ employeeId: z.number().int().positive(), civilDate: civilDateSchema }))
      .query(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "SUPERVISOR" && role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não pode consultar a classificação de FT" });
        const result = await db.getPersonnelScheduleDay(input.employeeId, input.civilDate);
        return { status: result.status };
      }),

    createEmployee: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Informe o nome do funcionário").max(255),
        cpf: z.string().trim().min(3, "Informe o CPF ou a matrícula").max(14, "CPF ou matrícula muito longo"),
        position: z.string().trim().min(2, "Informe o cargo/função").max(255),
        postId: z.number().int().positive("Selecione o posto principal").nullable(),
        pixKey: z.string().trim().max(255).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode cadastrar funcionários" });
        try {
          const post = input.postId ? await db.getPostById(input.postId) : null;
          if (input.postId && (!post || post.isActive === false)) throw new Error("Posto principal inválido ou inativo");
          const employee = await db.createPersonnelEmployee({ ...input, cpf: normalizePersonnelIdentifier(input.cpf), post: post?.name ?? "Posto não informado", pixKey: input.pixKey || null });
          return employee ? projectPersonnelEmployee(employee, role) : employee;
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cadastrar o funcionário" });
        }
      }),

    updateEmployee: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(255),
        cpf: z.string().trim().min(3).max(14).optional(),
        position: z.string().trim().min(2).max(255),
        postId: z.number().int().positive().nullable(),
        pixKey: z.string().trim().max(255).optional().nullable(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode editar funcionários" });
        if (input.cpf === undefined) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o CPF ou a matrícula" });
        const { id, ...data } = input;
        const post = data.postId ? await db.getPostById(data.postId) : null;
        if (data.postId && (!post || post.isActive === false)) throw new TRPCError({ code: "BAD_REQUEST", message: "Posto principal inválido ou inativo" });
        const existing = await db.getPersonnelEmployeeById(id);
        const sensitiveFields = role === "RH" || role === "ADM"
          ? { cpf: normalizePersonnelIdentifier(data.cpf!), pixKey: data.pixKey || null }
          : {};
        const employee = await db.updatePersonnelEmployee(id, { ...data, ...sensitiveFields, post: post?.name ?? existing?.post ?? "Posto não informado" });
        return employee ? projectPersonnelEmployee(employee, role) : employee;
      }),

    ensureLegacyEmployee: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2, "Informe o nome do funcionário").max(255) }))
      .mutation(async ({ ctx, input }) => {
        void ctx;
        void input;
        throw new TRPCError({ code: "BAD_REQUEST", message: "O cadastro temporário foi desativado. O RH deve cadastrar o funcionário na aba Funcionários antes de lançar registros." });
      }),

    users: protectedProcedure.query(async ({ ctx }) => {
      const role = db.getPersonnelRole(ctx.user);
      if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode gerenciar usuários" });
      return db.listPersonnelUsers();
    }),

    createUser: protectedProcedure
      .input(z.object({
        name: z.string().trim().min(2, "Informe o nome completo").max(255),
        username: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9._-]{2,63}$/, "Use apenas letras, números, ponto, hífen ou sublinhado"),
        password: z.string().min(8, "A senha deve ter pelo menos 8 caracteres").max(200),
        personnelRole: z.enum(["SUPERVISOR", "RH", "FINANCEIRO", "ADM"] as const),
      }))
      .mutation(async ({ ctx, input }) => {
        const requesterRole = db.getPersonnelRole(ctx.user);
        if (requesterRole !== "RH" && requesterRole !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode criar usuários" });
        if (requesterRole === "RH" && input.personnelRole === "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "O RH não pode criar usuários ADM" });
        try {
          const created = await db.createPersonnelUser({
            name: input.name,
            username: input.username,
            passwordHash: await hashSupervisorPassword(input.password),
            personnelRole: input.personnelRole,
          });
          return toPublicUser(created);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível criar o usuário" });
        }
      }),

    setUserRole: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), personnelRole: z.enum(["SUPERVISOR", "RH", "FINANCEIRO", "ADM"] as const) }))
      .mutation(async ({ ctx, input }) => {
        if (db.getPersonnelRole(ctx.user) !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente o ADM pode gerenciar perfis" });
        if (input.userId === ctx.user.id && input.personnelRole !== "ADM") throw new TRPCError({ code: "BAD_REQUEST", message: "O ADM não pode remover o próprio acesso administrativo" });
        return toPublicUser(await db.updatePersonnelUserRole(input.userId, input.personnelRole));
      }),

    createFt: protectedProcedure
      .input(z.object({ employeeId: z.number().int().positive(), civilDate: civilDateSchema, amount: z.number().finite().positive().max(9999999999.99), reason: z.string().trim().min(5).max(2_000) }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "SUPERVISOR" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não pode lançar FTs" });
        try {
          return await db.createPersonnelFt({ ...input, supervisorId: ctx.user.id, amount: input.amount.toFixed(2), status: "PENDING" });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível lançar a FT" });
        }
      }),

    createOccurrence: protectedProcedure
      .input(z.object({
        employeeId: z.number().int().positive(),
        type: z.enum(["FALTA_JUSTIFICADA", "FALTA_INJUSTIFICADA", "ATESTADO"]),
        date: z.coerce.date(),
        observation: z.string().trim().max(2_000).optional().nullable(),
        document: personnelDocumentSchema.optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "SUPERVISOR" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não pode lançar ocorrências" });
        if (input.type === "ATESTADO" && !input.document) throw new TRPCError({ code: "BAD_REQUEST", message: "Anexe o atestado médico em PDF ou imagem" });
        const documentMimeType = input.document
          ? resolvePersonnelDocumentMimeType(input.document.name, input.document.mimeType)
          : null;
        if (input.document && !documentMimeType) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Anexe um arquivo PDF, JPG/JPEG, PNG ou WEBP; SVG não é aceito" });
        }
        try {
          const document = input.document && documentMimeType
            ? await db.uploadPersonnelDocument(ctx.user.id, { ...input.document, mimeType: documentMimeType })
            : null;
          const occurrence = await db.createPersonnelOccurrence({ employeeId: input.employeeId, supervisorId: ctx.user.id, type: input.type, date: input.date, observation: input.observation || null, documentKey: document?.key ?? null, documentUrl: document?.url ?? null, documentName: document?.name ?? null, status: "PENDING" });
          return occurrence ? projectPersonnelOccurrence(occurrence, role) : occurrence;
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível registrar a ocorrência" });
        }
      }),

    createExtra: protectedProcedure
      .input(z.object({ employeeId: z.number().int().positive(), date: z.coerce.date(), hoursOrDaily: z.number().finite().positive().max(9999), amount: z.number().finite().positive().max(9999999999.99), description: z.string().trim().min(5).max(2_000) }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "SUPERVISOR" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não pode lançar serviços extras" });
        try {
          return await db.createPersonnelExtra({ ...input, supervisorId: ctx.user.id, hoursOrDaily: input.hoursOrDaily.toFixed(2), amount: input.amount.toFixed(2), status: "PENDING" });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível lançar o serviço extra" });
        }
      }),

    reviewFt: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["APPROVED", "REJECTED"]), rejectionReason: z.string().trim().max(500).optional().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode auditar FTs" });
        if (input.status === "REJECTED" && (!input.rejectionReason || input.rejectionReason.length < 5)) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o motivo da rejeição" });
        const result = await db.reviewPersonnelFt({ ...input, reviewedBy: ctx.user.id });
        if (!result || result.status === "PENDING") throw new TRPCError({ code: "CONFLICT", message: "Este lançamento já foi revisado" });
        return result;
      }),

    reviewOccurrence: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["APPROVED", "REJECTED"]), rejectionReason: z.string().trim().max(500).optional().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode auditar ocorrências" });
        if (input.status === "REJECTED" && (!input.rejectionReason || input.rejectionReason.length < 5)) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o motivo da rejeição" });
        const result = await db.reviewPersonnelOccurrence({ ...input, reviewedBy: ctx.user.id });
        if (!result || result.status === "PENDING") throw new TRPCError({ code: "CONFLICT", message: "Esta ocorrência já foi revisada" });
        return projectPersonnelOccurrence(result, role);
      }),

    reviewExtra: protectedProcedure
      .input(z.object({ id: z.number().int().positive(), status: z.enum(["APPROVED", "REJECTED"]), rejectionReason: z.string().trim().max(500).optional().nullable() }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode auditar serviços extras" });
        if (input.status === "REJECTED" && (!input.rejectionReason || input.rejectionReason.length < 5)) throw new TRPCError({ code: "BAD_REQUEST", message: "Informe o motivo da rejeição" });
        const result = await db.reviewPersonnelExtra({ ...input, reviewedBy: ctx.user.id });
        if (!result || result.status === "PENDING") throw new TRPCError({ code: "CONFLICT", message: "Este lançamento já foi revisado" });
        return result;
      }),

    payFt: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "FINANCEIRO" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente Financeiro ou ADM pode quitar FTs" });
        const result = await db.payPersonnelFt(input.id, ctx.user.id);
        if (!result || result.status !== "PAID") throw new TRPCError({ code: "CONFLICT", message: "A FT precisa estar aprovada e ainda não quitada" });
        return result;
      }),

    payExtra: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "FINANCEIRO" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente Financeiro ou ADM pode quitar extras" });
        const result = await db.payPersonnelExtra(input.id, ctx.user.id);
        if (!result || result.status !== "PAID") throw new TRPCError({ code: "CONFLICT", message: "O extra precisa estar aprovado e ainda não quitado" });
        return result;
      }),
  }),

  localAuth: router({
    login: publicProcedure
      .input(z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        const user = await db.getUserByUsername(input.username.toLowerCase());
        const passwordValid = user ? await verifySupervisorPassword(input.password, user.passwordHash) : false;
        if (!user || !passwordValid || (user.role !== "user" && user.role !== "admin") || user.isOperational === false) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Usuário ou senha inválidos" });
        }
        const token = await createSupervisorSession(user.id);
        ctx.res.cookie(LOCAL_SUPERVISOR_COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: LOCAL_SUPERVISOR_SESSION_MAX_AGE_SECONDS * 1000,
        });
        return {
          success: true,
          user: toPublicUser(user),
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(LOCAL_SUPERVISOR_COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  gestorAccess: router({
    session: publicProcedure.query(async ({ ctx }) => ({
      authenticated: await hasGestorSession(ctx.req),
    })),
    login: publicProcedure
      .input(z.object({ password: z.string().min(1).max(200) }))
      .mutation(async ({ ctx, input }) => {
        if (!isGestorPasswordValid(input.password)) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Senha do Gestor inválida" });
        }
        const token = await createGestorSession();
        ctx.res.cookie(GESTOR_COOKIE_NAME, token, {
          ...getSessionCookieOptions(ctx.req),
          maxAge: GESTOR_SESSION_MAX_AGE_SECONDS * 1000,
        });
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.res.clearCookie(GESTOR_COOKIE_NAME, { ...getSessionCookieOptions(ctx.req), maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  adminOperations: router({
    liveSnapshot: adminOperationalReadProcedure.query(async () => {
      const snapshot = await db.getAdminOperationalLiveSnapshot();
      return {
        visits: snapshot.visits.map(({ postName, status, arrivalTime, departureTime }) => ({
          postName,
          status,
          arrivalTime,
          departureTime,
        })),
      };
    }),
  }),

  gestor: router({
    dashboard: gestorProcedure.input(z.object({ shiftType: z.enum(["day", "night"]).optional().nullable() }).optional()).query(async ({ input }) => {
      const shiftType = input?.shiftType ?? null;
      const [snapshot, kpis] = await Promise.all([
        db.getGestorOperationalSnapshot(undefined, { shiftType }),
        db.getGestorOperationalKpis({ shiftType }),
      ]);
      return { ...snapshot, kpis };
    }),
    dailyReport: gestorProcedure.input(z.object({ reportDate: z.date().optional(), shiftType: z.enum(["day", "night"]).optional().nullable() }).optional()).query(async ({ input }) => {
      return buildDailyOperationalReport(await db.getGestorOperationalSnapshot(input?.reportDate, { includeHistoricalUsers: true, shiftType: input?.shiftType ?? null }));
    }),
    personnelOverview: gestorProcedure.query(async () => projectGestorPersonnelOverview(await db.getGestorPersonnelOverview())),
    personnelMovementReport: gestorProcedure
      .input(movementReportInput)
      .query(async ({ input }) => projectGestorPersonnelMovementReport(await db.getGestorPersonnelMovementReport(input.month, input.period as MovementPeriod))),
    operationalReport: gestorProcedure.input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      supervisorId: z.number().int().positive().optional().nullable(),
      vehicleId: z.number().int().positive().optional().nullable(),
      shiftType: z.enum(["day", "night"]).optional().nullable(),
    })).query(async ({ input }) => {
      if (input.endDate < input.startDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A data final não pode ser anterior à data inicial" });
      }
      return db.getOperationalManagementReport(input);
    }),
    updateFuelAmount: gestorProcedure.input(z.object({
      id: z.number().int().positive(),
      amount: z.number().finite().positive().max(9999999999.99),
    })).mutation(async ({ input }) => {
      try {
        return await db.updateFuelLogAmount(input.id, input.amount);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível corrigir o valor do abastecimento" });
      }
    }),
    schedule: gestorProcedure.input(z.object({ scheduleDate: z.date().optional() }).optional()).query(async ({ input }) => {
      return db.getGestorSchedule(input?.scheduleDate);
    }),
    kpis: gestorProcedure.input(z.object({
      startDate: z.date().optional().nullable(),
      endDate: z.date().optional().nullable(),
      shiftType: z.enum(["day", "night"]).optional().nullable(),
      supervisorId: z.number().int().positive().optional().nullable(),
    }).optional()).query(async ({ input }) => {
      if (input?.startDate && input?.endDate && input.endDate < input.startDate) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "A data final não pode ser anterior à data inicial" });
      }
      // Indicadores nunca derrubam o painel: qualquer falha de consulta vira resultado zerado.
      try {
        return await db.getGestorOperationalKpis({
          startDate: input?.startDate ?? null,
          endDate: input?.endDate ?? null,
          shiftType: input?.shiftType ?? null,
          supervisorId: input?.supervisorId ?? null,
        });
      } catch (error) {
        console.error("[Indicadores] Consulta de indicadores indisponível; retornando valores zerados:", error);
        return db.buildEmptyGestorKpis({
          startDate: input?.startDate ?? null,
          endDate: input?.endDate ?? null,
          shiftType: input?.shiftType ?? null,
          supervisorId: input?.supervisorId ?? null,
        });
      }
    }),
    updateSchedule: gestorProcedure.input(z.object({
      scheduleDate: z.date(),
      entries: z.array(z.object({
        supervisorId: z.number().int().positive(),
        assignment: z.enum(["day", "night", "reliever", "off"]),
        note: z.string().trim().max(1_000).optional().nullable(),
      })).min(1),
    })).mutation(async ({ input }) => {
      const primaryAssignments = ["day", "night", "reliever"] as const;
      for (const assignment of primaryAssignments) {
        if (input.entries.filter((entry) => entry.assignment === assignment).length > 1) {
          throw new TRPCError({ code: "BAD_REQUEST", message: `A escala permite apenas um responsável em ${assignment === "day" ? "Dia" : assignment === "night" ? "Noite" : "Folguista"}` });
        }
      }
      try {
        return await db.replaceGestorSchedule(input);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível atualizar a escala" });
      }
    }),
    postsManagement: gestorProcedure.query(async () => db.getGestorPostsManagement()),
    createPost: gestorProcedure.input(gestorPostInput).mutation(async ({ input }) => {
      try {
        const post = await db.createGestorPost(input);
        if (!post) throw new Error("Não foi possível localizar o posto criado");
        return post;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cadastrar o posto" });
      }
    }),
    updatePost: gestorProcedure.input(gestorPostInput.extend({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      try {
        const post = await db.updateGestorPost(input.id, input);
        if (!post) throw new Error("Não foi possível localizar o posto atualizado");
        return post;
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível atualizar o posto" });
      }
    }),
    deletePost: gestorProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ input }) => {
      try {
        return await db.deleteGestorPost(input.id);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível excluir o posto" });
      }
    }),
    postPops: router({
      list: postPopManagerProcedure.input(z.object({ postId: z.number().int().positive() })).query(async ({ input }) => {
        const post = await db.getPostById(input.postId);
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Posto não encontrado" });
        const documents = await db.listPostPopDocuments(input.postId);
        return documents.map(({ id, postId, originalName, mimeType, createdAt }) => ({ id, postId, originalName, mimeType, createdAt }));
      }),
      upload: postPopManagerProcedure.input(z.object({
        postId: z.number().int().positive(),
        name: z.string().trim().min(1).max(255),
        mimeType: z.string().max(128).optional().default(""),
        base64: uploadBase64Schema,
      })).mutation(async ({ ctx, input }) => {
        const post = await db.getPostById(input.postId);
        if (!post) throw new TRPCError({ code: "NOT_FOUND", message: "Posto não encontrado" });
        const mimeType = resolvePostPopMimeType(input.name, input.mimeType);
        if (!mimeType) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Anexe um POP em PDF, DOC ou DOCX" });
        }
        const bytes = Buffer.from(input.base64, "base64");
        if (!bytes.length || bytes.length > 10 * 1024 * 1024) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O arquivo deve ter até 10 MB" });
        }
        if (!isValidUploadContent(bytes, mimeType)) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O conteúdo do arquivo não corresponde ao formato informado" });
        }
        const safeName = input.name.replace(/[^A-Za-z0-9._-]+/g, "_").replace(/^\.+/, "").slice(-200) || "procedimento";
        const key = `posts/pops/${input.postId}/${randomUUID()}-${safeName}`;
        let stored: { key: string; url: string };
        try {
          stored = await storagePut(key, bytes, mimeType);
        } catch (error) {
          const storageFailure = getPostPopStorageFailure(error);
          console.error("[Post POP] Falha no storage:", error instanceof Error ? error.message : "erro desconhecido");
          if (storageFailure) throw new TRPCError(storageFailure);
          throw new TRPCError({ code: "BAD_GATEWAY", message: "Não foi possível enviar o POP ao armazenamento. Tente novamente." });
        }

        try {
          const document = await db.createPostPopDocument({
            postId: input.postId,
            originalName: input.name,
            mimeType,
            storageKey: stored.key,
            uploadedBy: ctx.user?.id ?? null,
          });
          if (!document) throw new Error("Não foi possível registrar o POP");
          return { id: document.id, postId: document.postId, originalName: document.originalName, mimeType: document.mimeType, createdAt: document.createdAt };
        } catch (error) {
          console.error("[Post POP] Falha ao registrar documento:", error instanceof Error ? error.message : "erro desconhecido");
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "O arquivo foi enviado, mas não foi possível registrar o POP. Verifique se a migration 0013 foi aplicada." });
        }
      }),
      delete: postPopManagerProcedure.input(z.object({ postId: z.number().int().positive(), documentId: z.number().int().positive() })).mutation(async ({ input }) => {
        const removed = await db.deletePostPopDocument(input.postId, input.documentId);
        if (!removed) throw new TRPCError({ code: "NOT_FOUND", message: "POP não encontrado neste posto" });
        return removed;
      }),
    }),
  }),

  postPops: router({
    downloadUrl: publicProcedure.input(z.object({
      postId: z.number().int().positive(),
      documentId: z.number().int().positive(),
      supervisorRouteId: z.number().int().positive().optional(),
    })).mutation(async ({ ctx, input }) => {
      const role = ctx.user ? db.getPersonnelRole(ctx.user) : null;
      const isManager = canManagePostPops(role, await hasGestorSession(ctx.req));
      if (!isManager) {
        if (role !== "SUPERVISOR" || !ctx.user || !input.supervisorRouteId) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Acesso ao POP não autorizado" });
        }
        if (!await db.supervisorRouteCanAccessPost(input.supervisorRouteId, input.postId, ctx.user.id)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Este posto não pertence à rota vinculada ao supervisor" });
        }
      }
      const document = await db.getPostPopDocumentById(input.documentId);
      if (!document || document.postId !== input.postId) throw new TRPCError({ code: "NOT_FOUND", message: "POP não encontrado neste posto" });
      return { url: await storageGetSignedUrl(document.storageKey) };
    }),
  }),

  // Routes and Posts
  routes: router({
    list: routeCatalogReadProcedure.query(async ({ ctx }) => {
      if (!ctx.user || db.getPersonnelRole(ctx.user) !== "SUPERVISOR") return db.getAdminRoutesWithoutPostCoordinates();
      return await db.getAllRoutes();
    }),
    getById: routeCatalogReadProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getRouteById(input.id);
    }),
    getPostsByRoute: routeCatalogReadProcedure.input(z.object({ routeId: z.number() })).query(async ({ ctx, input }) => {
      if (!ctx.user || db.getPersonnelRole(ctx.user) !== "SUPERVISOR") return db.getAdminPostsByRouteId(input.routeId);
      return await db.getPostsByRouteId(input.routeId);
    }),
    getPostsWithPriority: adminProcedure.input(z.object({ routeId: z.number() })).query(async ({ input }) => {
      const posts = await db.getAdminPostsByRouteId(input.routeId);
      
      const postsWithPriority = await Promise.all(posts.map(async (post) => {
        const lastVisit = await db.getLastPostVisit(post.id);
        const { priority, daysSinceVisit } = db.calculateVisitPriority(lastVisit?.visitedAt || null);
        
        return {
          ...post,
          lastVisitDate: lastVisit?.visitedAt || null,
          priority,
          daysSinceVisit,
        };
      }));
      
      return postsWithPriority;
    }),
  }),

  posts: router({
    getById: routeCatalogReadProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      if (!ctx.user || db.getPersonnelRole(ctx.user) !== "SUPERVISOR") return db.getAdminPostByIdWithoutCoordinates(input.id);
      return await db.getPostById(input.id);
    }),
  }),

  fleet: router({
    listVehicles: supervisorOrGestorReadProcedure.query(async () => {
      return db.listActiveVehicles();
    }),

    saveVehicle: supervisorProcedure
      .input(z.object({ plate: z.string().min(7).max(12), model: z.string().min(2).max(120) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        try {
          return await db.upsertVehicle(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cadastrar a viatura" });
        }
      }),

    getFuelSummary: supervisorOrGestorReadProcedure
      .input(z.object({ vehicleId: z.number().int().positive() }))
      .query(async ({ input }) => {
        return db.getVehicleFuelSummary(input.vehicleId);
      }),

    registerFuel: supervisorProcedure
      .input(z.object({
        supervisorRouteId: z.number().int().positive(),
        odometerKm: z.number().finite().nonnegative(),
        amount: z.number().finite().positive(),
        liters: z.number().finite().positive(),
        fuelType: z.enum(["gasoline", "ethanol", "diesel"]),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: "NOT_FOUND" });
        if (route.status !== "in_progress" || !route.vehicleId) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Inicie uma rota com viatura antes de registrar o abastecimento" });
        }
        const kmInitial = route.kmInitial == null ? null : Number(route.kmInitial);
        if (kmInitial !== null && input.odometerKm < kmInitial) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "O KM de abastecimento não pode ser menor que o KM inicial" });
        }
        const { supervisorRouteId: _supervisorRouteId, ...fuelInput } = input;
        return db.createFuelLog({ vehicleId: route.vehicleId, supervisorRouteId: route.id, supervisorId: ctx.user.id, ...fuelInput });
      }),

    updateFuel: supervisorProcedure
      .input(z.object({
        id: z.number().int().positive(),
        odometerKm: z.number().finite().positive(),
        amount: z.number().finite().positive(),
        liters: z.number().finite().positive(),
        fuelType: z.enum(["gasoline", "ethanol", "diesel"]),
        confirmPriceVariation: z.boolean().optional().default(false),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        try {
          return await db.updateSupervisorFuelLog({ ...input, supervisorId: ctx.user.id });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível editar o abastecimento" });
        }
      }),
  }),

  // Supervisor Routes
  supervisorRoutes: router({
    getPostPops: supervisorProcedure.input(z.object({ supervisorRouteId: z.number().int().positive(), postId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      const route = await db.getSupervisorRouteById(input.supervisorRouteId);
      if (!route || route.supervisorId !== ctx.user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Este posto não pertence à rota vinculada ao supervisor" });
      }
      if (!await db.supervisorRouteCanAccessPost(input.supervisorRouteId, input.postId, route.supervisorId)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Este posto não pertence à rota vinculada ao supervisor" });
      }
      const documents = await db.listPostPopDocuments(input.postId);
      return documents.map(({ id, postId, originalName, mimeType, createdAt }) => ({ id, postId, originalName, mimeType, createdAt }));
    }),
    create: supervisorProcedure
      .input(z.object({ routeId: z.number(), date: z.date() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getRouteById(input.routeId);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: 'Rota não encontrada' });
        const todayRoutes = await db.getSupervisorRoutesToday(ctx.user.id);
        const openRoute = selectOpenSupervisorRoute(todayRoutes);
        if (openRoute) {
          return openRoute.id;
        }
        return await db.createSupervisorRoute(ctx.user.id, input.routeId, input.date);
      }),
    
    getTodayRoute: supervisorProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const routes = await db.getSupervisorRoutesToday(ctx.user.id);
      return selectOpenSupervisorRoute(routes);
    }),

    getTodayHistory: supervisorProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return await db.getSupervisorRoutesToday(ctx.user.id);
    }),

    getShiftReport: supervisorProcedure
      .input(z.object({ supervisorRouteId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        const report = await db.getSupervisorShiftReport(route.supervisorId, input.supervisorRouteId);
        if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Não foi possível consolidar o turno' });
        return report;
      }),

    finishShift: supervisorProcedure
      .input(z.object({
        supervisorRouteId: z.number().int().positive(),
        kmFinal: z.number().finite().nonnegative(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        let closure;
        try {
          closure = await db.closeSupervisorRoute({
            supervisorRouteId: input.supervisorRouteId,
            supervisorId: ctx.user.id,
            kmFinal: input.kmFinal,
          });
        } catch (error) {
          if (error instanceof RouteClosureError) {
            throw new TRPCError({ code: error.code, message: error.message });
          }
          throw error;
        }
        const report = await db.getSupervisorShiftReport(ctx.user.id, input.supervisorRouteId);
        if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Turno encerrado, mas o relatório não pôde ser consolidado' });
        return { ...closure, report };
      }),
    
    getById: supervisorReadProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const isAdminViewer = isAdminOperationalViewer(ctx.user);
      if (isAdminViewer) {
        const route = await db.getAdminSupervisorRouteStatusById(input.id);
        return route ? { id: route.id, status: route.status } : null;
      }
      const route = await db.getSupervisorRouteById(input.id);
      if (!route || route.supervisorId !== ctx.user.id) return null;
      return route;
    }),

    cancelPending: supervisorProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return runChecklistMutation(() => db.cancelPendingSupervisorRoute(input.id, ctx.user.id));
    }),
    
    updateKm: supervisorProcedure
      .input(z.object({ id: z.number(), vehicleId: z.number().int().positive().optional(), kmInitial: z.number().optional(), kmFinal: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        if (input.kmFinal !== undefined) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'O KM final só pode encerrar a rota pelo fluxo canônico “Encerrar turno”' });
        }
        if (input.kmInitial === undefined || !input.vehicleId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe o KM inicial e selecione a viatura para iniciar a rota' });
        }
        try {
          return await db.startSupervisorRoute({
            supervisorRouteId: input.id,
            supervisorId: ctx.user.id,
            vehicleId: input.vehicleId,
            kmInitial: input.kmInitial,
          });
        } catch (error) {
          if (error instanceof RouteClosureError) {
            throw new TRPCError({ code: error.code, message: error.message });
          }
          throw error;
        }
      }),
  }),

  // Visit Checklists
  checklists: router({
    createForRoute: supervisorProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return runChecklistMutation(() => db.createRouteChecklists(input.supervisorRouteId, ctx.user.id));
      }),

    startNewVisit: supervisorProcedure
      .input(z.object({ checklistId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return runChecklistMutation(() => db.startNewVisitForRoute({ checklistId: input.checklistId, supervisorId: ctx.user.id }));
      }),
    
    getByRoute: supervisorReadProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdminViewer = isAdminOperationalViewer(ctx.user);
        if (isAdminViewer) {
          const route = await db.getAdminSupervisorRouteStatusById(input.supervisorRouteId);
          if (!route) throw new TRPCError({ code: 'NOT_FOUND' });
          const visits = await db.getAdminVisitChecklistsByRoute(input.supervisorRouteId);
          return visits.map(({ postName, status, arrivalTime, departureTime }) => ({ postName, status, arrivalTime, departureTime }));
        }
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        return db.getVisitChecklistsByRoute(input.supervisorRouteId);
      }),

    getCoveragePosts: supervisorProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        return await db.getCoveragePostsBySupervisorRoute(input.supervisorRouteId);
      }),

    createCoverage: supervisorProcedure
      .input(z.object({
        supervisorRouteId: z.number(),
        postId: z.union([z.number().int().positive(), z.literal("operational_base")]),
        coverageReason: z.string().trim().min(8, 'Informe uma justificativa com pelo menos 8 caracteres').max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return runChecklistMutation(() => db.createCoverageVisit({
          supervisorRouteId: input.supervisorRouteId,
          supervisorId: ctx.user.id,
          postId: input.postId,
          coverageReason: input.coverageReason,
        }));
      }),
    
    getById: supervisorReadProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const isAdminViewer = isAdminOperationalViewer(ctx.user);
        if (isAdminViewer) {
          const visit = await db.getAdminVisitChecklistById(input.id);
          if (!visit) return null;
          const route = await db.getAdminSupervisorRouteStatusById(visit.supervisorRouteId);
          return route ? {
            postName: visit.postName,
            status: visit.status,
            arrivalTime: visit.arrivalTime,
            departureTime: visit.departureTime,
          } : null;
        }
        const visit = await db.getVisitChecklistById(input.id);
        if (!visit) return null;
        const route = await db.getSupervisorRouteById(visit.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) return null;
        return visit;
      }),

    submitOccurrence: supervisorProcedure
      .input(z.object({ checklistId: z.number(), occurrenceReport: z.string().trim().min(8, 'Informe pelo menos 8 caracteres no relato da ocorrência').max(5000) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return runChecklistMutation(() => db.submitOccurrenceForActiveRoute({
          checklistId: input.checklistId,
          supervisorId: ctx.user.id,
          occurrenceReport: input.occurrenceReport,
        }));
      }),
    
    markVisited: supervisorProcedure
      .input(z.object({ checklistId: z.number(), occurrenceReport: z.string().trim().min(8).max(5000) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return runChecklistMutation(() => db.markVisitVisitedForActiveRoute({
          checklistId: input.checklistId,
          supervisorId: ctx.user.id,
          occurrenceReport: input.occurrenceReport,
        }));
      }),
    
    checkIn: supervisorProcedure
      .input(visitPresenceInput)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return runChecklistMutation(() => db.checkInVisitForRoute({
          checklistId: input.checklistId,
          supervisorId: ctx.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
        }));
      }),
    
    checkOut: supervisorProcedure
      .input(visitPresenceInput)
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return runChecklistMutation(() => db.checkOutVisitForRoute({
          checklistId: input.checklistId,
          supervisorId: ctx.user.id,
          latitude: input.latitude,
          longitude: input.longitude,
        }));
      }),
  }),

  // Supervisor Locations
  locations: router({
    record: supervisorProcedure
      .input(z.object({
        latitude: z.number().finite(),
        longitude: z.number().finite(),
        accuracy: z.number().finite().nonnegative().optional(),
        supervisorRouteId: z.number().optional(),
      }).refine(({ latitude, longitude }) => isValidCoordinatePair(latitude, longitude), {
        message: "Informe latitude e longitude dentro das faixas geográficas válidas",
        path: ["latitude"],
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        if (input.supervisorRouteId) {
          const route = await db.getSupervisorRouteById(input.supervisorRouteId);
          if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        }
        
        return await db.saveSupervisorLocation(
          ctx.user.id,
          input.supervisorRouteId || null,
          input.latitude,
          input.longitude,
          input.accuracy
        );
      }),
    
    getLatest: supervisorOrGestorReadProcedure
      .input(z.object({ supervisorId: z.number() }))
      .query(async ({ ctx, input }) => {
        const isGestor = await hasGestorSession(ctx.req);
        if (!isGestor && (!ctx.user || ctx.user.id !== input.supervisorId)) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await db.getLatestSupervisorLocation(input.supervisorId);
      }),
    
    getAllLatest: gestorProcedure.query(async () => {
      return await db.getAllSupervisorsLatestLocations();
    }),
  }),

  // Reports
  reports: router({
    visitsByDateRange: adminProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        return await db.getPostVisitsByDateRange(input.startDate, input.endDate);
      }),
    
    occurrencesByDateRange: adminProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        return await db.getVisitsWithTimes(input.startDate, input.endDate);
      }),

    occurrenceSummaryByDateRange: adminProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        return await db.getVisitOccurrenceSummary(input.startDate, input.endDate);
      }),
  }),
});

export type AppRouter = typeof appRouter;
