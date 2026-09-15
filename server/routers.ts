import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";
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

const gestorOrAdminProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (ctx.user?.role === "admin" || await hasGestorSession(ctx.req)) return next();
  throw new TRPCError({ code: "FORBIDDEN", message: "Acesso do Gestor ou Administrador necessário" });
});

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

const DEFAULT_CHECKLIST_ITEMS = [
  { category: 'Uniforme', description: 'Uniforme e apresentação pessoal' },
  { category: 'Pontualidade', description: 'Pontualidade e escala' },
  { category: 'Documentação', description: 'Livro de ocorrências' },
  { category: 'Procedimentos', description: 'Procedimentos operacionais' },
  { category: 'Equipamentos', description: 'Equipamentos e materiais' },
  { category: 'Limpeza', description: 'Limpeza e organização' },
  { category: 'Contato', description: 'Contato com o cliente' },
  { category: 'Fotografia', description: 'Registro fotográfico' },
  { category: 'Ação', description: 'Plano de ação (quando necessário)' },
] as const;

async function createChecklistWithDefaultItems(
  supervisorRouteId: number,
  postId: number,
  options: { isCoverage?: boolean; coverageReason?: string | null } = {},
) {
  const checklistId = options.isCoverage || options.coverageReason
    ? await db.createVisitChecklist(supervisorRouteId, postId, options)
    : await db.createVisitChecklist(supervisorRouteId, postId);
  for (const item of DEFAULT_CHECKLIST_ITEMS) {
    await db.createChecklistItem(checklistId, item.category, item.description);
  }
  return checklistId;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
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
      return { role, ...(await db.getPersonnelDashboardData(ctx.user.id, role)) };
    }),

    employees: protectedProcedure.query(async ({ ctx }) => {
      const role = db.getPersonnelRole(ctx.user);
      if (role === "SUPERVISOR") return db.listPersonnelEmployees();
      return db.listPersonnelEmployees(true);
    }),

    posts: protectedProcedure.query(async ({ ctx }) => {
      const role = db.getPersonnelRole(ctx.user);
      if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode consultar os postos" });
      return db.listPersonnelPosts();
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
          return await db.createPersonnelEmployee({ ...input, cpf: normalizePersonnelIdentifier(input.cpf), post: post?.name ?? "Posto não informado", pixKey: input.pixKey || null });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cadastrar o funcionário" });
        }
      }),

    updateEmployee: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        name: z.string().trim().min(2).max(255),
        cpf: z.string().trim().min(3).max(14),
        position: z.string().trim().min(2).max(255),
        postId: z.number().int().positive().nullable(),
        pixKey: z.string().trim().max(255).optional().nullable(),
        isActive: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "RH" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente RH ou ADM pode editar funcionários" });
        const { id, ...data } = input;
        const post = data.postId ? await db.getPostById(data.postId) : null;
        if (data.postId && (!post || post.isActive === false)) throw new TRPCError({ code: "BAD_REQUEST", message: "Posto principal inválido ou inativo" });
        const existing = await db.getPersonnelEmployeeById(id);
        return db.updatePersonnelEmployee(id, { ...data, cpf: normalizePersonnelIdentifier(data.cpf), post: post?.name ?? existing?.post ?? "Posto não informado", pixKey: data.pixKey || null });
      }),

    ensureLegacyEmployee: protectedProcedure
      .input(z.object({ name: z.string().trim().min(2).max(255) }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "SUPERVISOR" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não pode usar o cadastro temporário" });
        return db.createLegacyPersonnelEmployee(input.name);
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
          return db.createPersonnelUser({
            name: input.name,
            username: input.username,
            passwordHash: await hashSupervisorPassword(input.password),
            personnelRole: input.personnelRole,
          });
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível criar o usuário" });
        }
      }),

    setUserRole: protectedProcedure
      .input(z.object({ userId: z.number().int().positive(), personnelRole: z.enum(["SUPERVISOR", "RH", "FINANCEIRO", "ADM"] as const) }))
      .mutation(async ({ ctx, input }) => {
        if (db.getPersonnelRole(ctx.user) !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Somente o ADM pode gerenciar perfis" });
        if (input.userId === ctx.user.id && input.personnelRole !== "ADM") throw new TRPCError({ code: "BAD_REQUEST", message: "O ADM não pode remover o próprio acesso administrativo" });
        return db.updatePersonnelUserRole(input.userId, input.personnelRole);
      }),

    createFt: protectedProcedure
      .input(z.object({ employeeId: z.number().int().positive(), date: z.coerce.date(), amount: z.number().finite().positive().max(9999999999.99), reason: z.string().trim().min(5).max(2_000) }))
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
        document: z.object({ name: z.string().min(1).max(255), mimeType: z.string(), base64: z.string().min(1) }).optional().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const role = db.getPersonnelRole(ctx.user);
        if (role !== "SUPERVISOR" && role !== "ADM") throw new TRPCError({ code: "FORBIDDEN", message: "Seu perfil não pode lançar ocorrências" });
        if (input.type === "ATESTADO" && !input.document) throw new TRPCError({ code: "BAD_REQUEST", message: "Anexe o atestado médico em PDF ou imagem" });
        try {
          const document = input.document ? await db.uploadPersonnelDocument(ctx.user.id, input.document) : null;
          return await db.createPersonnelOccurrence({ employeeId: input.employeeId, supervisorId: ctx.user.id, type: input.type, date: input.date, observation: input.observation || null, documentKey: document?.key ?? null, documentUrl: document?.url ?? null, documentName: document?.name ?? null, status: "PENDING" });
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
        return result;
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
          user: {
            id: user.id,
            name: user.name,
            username: user.username,
            role: user.role,
            personnelRole: user.personnelRole ?? (user.role === "admin" ? "ADM" : "SUPERVISOR"),
          },
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
    operationalReport: gestorOrAdminProcedure.input(z.object({
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
    updateFuelAmount: gestorOrAdminProcedure.input(z.object({
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
  }),

  // Routes and Posts
  routes: router({
    list: publicProcedure.query(async () => {
      return await db.getAllRoutes();
    }),
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getRouteById(input.id);
    }),
    getPostsByRoute: publicProcedure.input(z.object({ routeId: z.number() })).query(async ({ input }) => {
      return await db.getPostsByRouteId(input.routeId);
    }),
    getPostsWithPriority: adminProcedure.input(z.object({ routeId: z.number() })).query(async ({ input }) => {
      const posts = await db.getPostsByRouteId(input.routeId);
      
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
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getPostById(input.id);
    }),
  }),

  fleet: router({
    listVehicles: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
      return db.listActiveVehicles();
    }),

    saveVehicle: protectedProcedure
      .input(z.object({ plate: z.string().min(7).max(12), model: z.string().min(2).max(120) }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        try {
          return await db.upsertVehicle(input);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Não foi possível cadastrar a viatura" });
        }
      }),

    getFuelSummary: protectedProcedure
      .input(z.object({ vehicleId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
        return db.getVehicleFuelSummary(input.vehicleId);
      }),

    registerFuel: protectedProcedure
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

    updateFuel: protectedProcedure
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
    create: protectedProcedure
      .input(z.object({ routeId: z.number(), date: z.date() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getRouteById(input.routeId);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND', message: 'Rota não encontrada' });
        const todayRoutes = await db.getSupervisorRoutesToday(ctx.user.id);
        const openRoute = todayRoutes.find((item) => item.status === 'in_progress')
          ?? todayRoutes.find((item) => item.status === 'pending');
        if (openRoute) {
          return openRoute.id;
        }
        return await db.createSupervisorRoute(ctx.user.id, input.routeId, input.date);
      }),
    
    getTodayRoute: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const routes = await db.getSupervisorRoutesToday(ctx.user.id);
      return routes.find((route) => route.status === 'in_progress')
        ?? routes.find((route) => route.status === 'pending')
        ?? null;
    }),

    getTodayHistory: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      return await db.getSupervisorRoutesToday(ctx.user.id);
    }),

    getShiftReport: protectedProcedure
      .input(z.object({ supervisorRouteId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        const report = await db.getSupervisorShiftReport(ctx.user.id, input.supervisorRouteId);
        if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Não foi possível consolidar o turno' });
        return report;
      }),

    finishShift: protectedProcedure
      .input(z.object({ supervisorRouteId: z.number().int().positive(), kmFinal: z.number().finite().nonnegative() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        if (route.status !== 'in_progress') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Somente uma rota em andamento pode encerrar o turno' });
        }
        const kmInitial = route.kmInitial == null ? null : Number(route.kmInitial);
        if (kmInitial !== null && input.kmFinal < kmInitial) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'O KM final não pode ser menor que o KM inicial' });
        }
        await db.updateSupervisorRoute(input.supervisorRouteId, {
          kmFinal: input.kmFinal,
          status: 'completed',
          completedAt: new Date(),
        });
        const report = await db.getSupervisorShiftReport(ctx.user.id, input.supervisorRouteId);
        if (!report) throw new TRPCError({ code: 'NOT_FOUND', message: 'Turno encerrado, mas o relatório não pôde ser consolidado' });
        return { closed: true, report };
      }),
    
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const route = await db.getSupervisorRouteById(input.id);
      if (!route || route.supervisorId !== ctx.user.id) return null;
      return route;
    }),

    cancelPending: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const route = await db.getSupervisorRouteById(input.id);
      if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
      if (route.status !== 'pending' || route.kmInitial != null || route.startedAt != null) {
        throw new TRPCError({ code: 'CONFLICT', message: 'Somente uma rota ainda não iniciada pode ser cancelada' });
      }
      await db.cancelPendingSupervisorRoute(input.id);
      return { cancelled: true, supervisorRouteId: input.id };
    }),
    
    updateKm: protectedProcedure
      .input(z.object({ id: z.number(), vehicleId: z.number().int().positive().optional(), kmInitial: z.number().optional(), kmFinal: z.number().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.id);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        const updates: Record<string, unknown> = {};
        if (input.kmInitial !== undefined) {
          if (!Number.isFinite(input.kmInitial) || input.kmInitial < 0 || route.status !== 'pending') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe um KM inicial válido para uma rota pendente' });
          }
          if (!input.vehicleId) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selecione a viatura antes de registrar o KM inicial' });
          }
          const vehicle = await db.getVehicleById(input.vehicleId);
          if (!vehicle?.isActive) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Viatura inválida ou indisponível' });
          }
          updates.kmInitial = input.kmInitial;
          updates.vehicleId = input.vehicleId;
          updates.status = 'in_progress';
          updates.startedAt = new Date();
        }
        if (input.kmFinal !== undefined) {
          const initial = route.kmInitial == null ? null : Number(route.kmInitial);
          if (!Number.isFinite(input.kmFinal) || input.kmFinal < 0 || route.status !== 'in_progress') {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'Informe um KM final válido para uma rota em andamento' });
          }
          if (initial !== null && input.kmFinal < initial) {
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'O KM final não pode ser menor que o KM inicial' });
          }
          updates.kmFinal = input.kmFinal;
          updates.status = 'completed';
          updates.completedAt = new Date();
        }
        if (Object.keys(updates).length === 0) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Nenhuma alteração informada' });
        return await db.updateSupervisorRoute(input.id, updates);
      }),
  }),

  // Visit Checklists
  checklists: router({
    createForRoute: protectedProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        const existing = await db.getVisitChecklistsByRoute(input.supervisorRouteId);
        const hasPlannedChecklists = existing.some((item) => !item.isCoverage);
        if (hasPlannedChecklists) return existing.map((item) => item.id);
        
        const posts = await db.getPostsByRouteId(route.routeId);
        const checklistIds = [];
        
        for (const post of posts) {
          const checklistId = await createChecklistWithDefaultItems(input.supervisorRouteId, post.id);
          checklistIds.push(checklistId);
        }
        
        return checklistIds;
      }),

    startNewVisit: protectedProcedure
      .input(z.object({ checklistId: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const checklist = await db.getVisitChecklistById(input.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND' });
        const route = await db.getSupervisorRouteById(checklist.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        if (route.status !== 'in_progress') {
          throw new TRPCError({ code: 'CONFLICT', message: 'A rota precisa estar em andamento para iniciar uma nova visita' });
        }
        if (checklist.status !== 'visited') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Somente uma visita concluída pode ser reiniciada' });
        }
        const routeChecklists = await db.getVisitChecklistsByRoute(checklist.supervisorRouteId);
        if (routeChecklists.some((item) => item.status === 'in_progress')) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Finalize a visita ativa antes de iniciar outro posto' });
        }

        const newChecklistId = await createChecklistWithDefaultItems(checklist.supervisorRouteId, checklist.postId, {
          isCoverage: checklist.isCoverage,
          coverageReason: checklist.coverageReason,
        });
        return { checklistId: newChecklistId };
      }),
    
    getByRoute: protectedProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        return await db.getVisitChecklistsByRoute(input.supervisorRouteId);
      }),

    getCoveragePosts: protectedProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        return await db.getCoveragePostsBySupervisorRoute(input.supervisorRouteId);
      }),

    createCoverage: protectedProcedure
      .input(z.object({
        supervisorRouteId: z.number(),
        postId: z.union([z.number().int().positive(), z.literal("operational_base")]),
        coverageReason: z.string().trim().min(8, 'Informe uma justificativa com pelo menos 8 caracteres').max(2000),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        if (route.status !== 'in_progress') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Inicie a rota pelo KM inicial antes de registrar uma cobertura' });
        }
        const post = input.postId === "operational_base"
          ? await db.getOrCreateOperationalBasePost()
          : await db.getPostById(input.postId);
        if (!post) throw new TRPCError({ code: 'NOT_FOUND', message: 'Posto não encontrado' });
        if (post.routeId === route.routeId) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Este posto já faz parte da rota planejada' });
        }
        const routeChecklists = await db.getVisitChecklistsByRoute(input.supervisorRouteId);
        if (routeChecklists.some((item) => item.status === 'in_progress')) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Finalize a visita ativa antes de registrar uma cobertura' });
        }
        const checklistId = await createChecklistWithDefaultItems(input.supervisorRouteId, post.id, {
          isCoverage: true,
          coverageReason: input.coverageReason,
        });
        return { checklistId };
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const checklist = await db.getVisitChecklistById(input.id);
        if (!checklist) return null;
        const route = await db.getSupervisorRouteById(checklist.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) return null;
        const items = await db.getChecklistItemsByVisit(input.id);
        return { ...checklist, items };
      }),
    
    updateItem: protectedProcedure
      .input(z.object({ itemId: z.number(), isCompliant: z.boolean(), notes: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const item = await db.getChecklistItemById(input.itemId);
        if (!item) throw new TRPCError({ code: 'NOT_FOUND' });
        const checklist = await db.getVisitChecklistById(item.visitChecklistId);
        const route = checklist ? await db.getSupervisorRouteById(checklist.supervisorRouteId) : null;
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        return await db.updateChecklistItem(input.itemId, {
          isCompliant: input.isCompliant,
          notes: input.notes,
        });
      }),

    updateDetails: protectedProcedure
      .input(z.object({ checklistId: z.number(), observations: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        const checklist = await db.getVisitChecklistById(input.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND' });
        const route = await db.getSupervisorRouteById(checklist.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        const result = await db.updateVisitChecklist(input.checklistId, {
          observations: input.observations ?? null,
          auditSubmittedAt: new Date(),
        });
        await db.touchSupervisorRouteFromChecklist(input.checklistId);
        return result;
      }),
    
    markVisited: protectedProcedure
      .input(z.object({ checklistId: z.number(), observations: z.string().optional(), arrivalTime: z.date().optional(), departureTime: z.date().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        const checklist = await db.getVisitChecklistById(input.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND' });
        const route = await db.getSupervisorRouteById(checklist.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        
        await db.updateVisitChecklist(input.checklistId, {
          status: 'visited',
          visitedAt: new Date(),
          observations: input.observations,
          arrivalTime: input.arrivalTime,
          departureTime: input.departureTime,
        });
        
        // Record in visit history
        await db.recordPostVisit(checklist.postId, ctx.user.id, input.observations);
        
        return { success: true };
      }),
    
    checkIn: protectedProcedure
      .input(z.object({ 
        checklistId: z.number(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        const checklist = await db.getVisitChecklistById(input.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND' });
        const route = await db.getSupervisorRouteById(checklist.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        if (checklist.status !== 'pending' && checklist.status !== 'visited') {
          throw new TRPCError({ code: 'CONFLICT', message: 'Esta visita já está em andamento' });
        }
        const routeChecklists = await db.getVisitChecklistsByRoute(checklist.supervisorRouteId);
        if (routeChecklists.some((item) => item.status === 'in_progress')) {
          throw new TRPCError({ code: 'CONFLICT', message: 'Finalize a visita ativa antes de iniciar outro posto' });
        }

        const targetChecklistId = checklist.status === 'visited'
          ? await createChecklistWithDefaultItems(checklist.supervisorRouteId, checklist.postId, {
              isCoverage: checklist.isCoverage,
              coverageReason: checklist.coverageReason,
            })
          : checklist.id;
        const arrivalTime = new Date();
        
        await db.updateVisitChecklist(targetChecklistId, {
          status: 'in_progress',
          arrivalTime,
          arrivalLatitude: input.latitude ?? null,
          arrivalLongitude: input.longitude ?? null,
        });
        
        return { success: true, checklistId: targetChecklistId, arrivalTime };
      }),
    
    checkOut: protectedProcedure
      .input(z.object({ 
        checklistId: z.number(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        const checklist = await db.getVisitChecklistById(input.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND' });
        const route = await db.getSupervisorRouteById(checklist.supervisorRouteId);
        if (!route || route.supervisorId !== ctx.user.id) throw new TRPCError({ code: 'NOT_FOUND' });
        if (checklist.status !== 'in_progress') throw new TRPCError({ code: 'CONFLICT', message: 'Só é possível registrar saída de uma visita em andamento' });
        
        await db.updateVisitChecklist(input.checklistId, {
          status: 'visited',
          departureTime: new Date(),
          visitedAt: new Date(),
          departureLatitude: input.latitude ?? null,
          departureLongitude: input.longitude ?? null,
        });
        
        await db.recordPostVisit(checklist.postId, ctx.user.id);
        
        return { success: true, departureTime: new Date() };
      }),
  }),

  // Supervisor Locations
  locations: router({
    record: protectedProcedure
      .input(z.object({
        latitude: z.number(),
        longitude: z.number(),
        accuracy: z.number().optional(),
        supervisorRouteId: z.number().optional(),
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
    
    getLatest: protectedProcedure
      .input(z.object({ supervisorId: z.number() }))
      .query(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        if (ctx.user.role !== 'admin' && ctx.user.id !== input.supervisorId) {
          throw new TRPCError({ code: 'FORBIDDEN' });
        }
        return await db.getLatestSupervisorLocation(input.supervisorId);
      }),
    
    getAllLatest: adminProcedure.query(async () => {
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
    
    visitChecklistsByDateRange: adminProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        return await db.getVisitChecklistsWithTimes(input.startDate, input.endDate);
      }),

    conformanceSummaryByDateRange: adminProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        return await db.getChecklistConformanceSummary(input.startDate, input.endDate);
      }),
  }),
});

export type AppRouter = typeof appRouter;
