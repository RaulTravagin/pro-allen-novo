import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { TRPCError } from "@trpc/server";

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
  }),

  posts: router({
    getById: publicProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getPostById(input.id);
    }),
  }),

  // Supervisor Routes
  supervisorRoutes: router({
    create: protectedProcedure
      .input(z.object({ routeId: z.number(), date: z.date() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        return await db.createSupervisorRoute(ctx.user.id, input.routeId, input.date);
      }),
    
    getTodayRoute: protectedProcedure.query(async ({ ctx }) => {
      if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
      const routes = await db.getSupervisorRoutesToday(ctx.user.id);
      return routes.length > 0 ? routes[0] : null;
    }),
    
    getById: protectedProcedure.input(z.object({ id: z.number() })).query(async ({ input }) => {
      return await db.getSupervisorRouteById(input.id);
    }),
    
    updateKm: protectedProcedure
      .input(z.object({ id: z.number(), kmInitial: z.number().optional(), kmFinal: z.number().optional() }))
      .mutation(async ({ input }) => {
        const updates: any = {};
        if (input.kmInitial !== undefined) {
          updates.kmInitial = input.kmInitial;
          updates.status = 'in_progress';
          updates.startedAt = new Date();
        }
        if (input.kmFinal !== undefined) {
          updates.kmFinal = input.kmFinal;
          updates.status = 'completed';
          updates.completedAt = new Date();
        }
        return await db.updateSupervisorRoute(input.id, updates);
      }),
  }),

  // Visit Checklists
  checklists: router({
    createForRoute: protectedProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .mutation(async ({ input }) => {
        const route = await db.getSupervisorRouteById(input.supervisorRouteId);
        if (!route) throw new TRPCError({ code: 'NOT_FOUND' });
        
        const posts = await db.getPostsByRouteId(route.routeId);
        const checklistIds = [];
        
        for (const post of posts) {
          const checklistId = await db.createVisitChecklist(input.supervisorRouteId, post.id);
          
          // Create predefined checklist items
          const items = [
            { category: 'Uniforme', description: 'Uniforme e apresentação pessoal' },
            { category: 'Pontualidade', description: 'Pontualidade e escala' },
            { category: 'Documentação', description: 'Livro de ocorrências' },
            { category: 'Procedimentos', description: 'Procedimentos operacionais' },
            { category: 'Equipamentos', description: 'Equipamentos e materiais' },
            { category: 'Limpeza', description: 'Limpeza e organização' },
            { category: 'Contato', description: 'Contato com o cliente' },
            { category: 'Fotografia', description: 'Registro fotográfico' },
            { category: 'Ação', description: 'Plano de ação (quando necessário)' },
          ];
          
          for (const item of items) {
            await db.createChecklistItem(checklistId, item.category, item.description);
          }
          
          checklistIds.push(checklistId);
        }
        
        return checklistIds;
      }),
    
    getByRoute: protectedProcedure
      .input(z.object({ supervisorRouteId: z.number() }))
      .query(async ({ input }) => {
        return await db.getVisitChecklistsByRoute(input.supervisorRouteId);
      }),
    
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const checklist = await db.getVisitChecklistById(input.id);
        if (!checklist) return null;
        
        const items = await db.getChecklistItemsByVisit(input.id);
        return { ...checklist, items };
      }),
    
    updateItem: protectedProcedure
      .input(z.object({ itemId: z.number(), isCompliant: z.boolean(), notes: z.string().optional() }))
      .mutation(async ({ input }) => {
        return await db.updateChecklistItem(input.itemId, {
          isCompliant: input.isCompliant,
          notes: input.notes,
        });
      }),
    
    markVisited: protectedProcedure
      .input(z.object({ checklistId: z.number(), observations: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
        
        const checklist = await db.getVisitChecklistById(input.checklistId);
        if (!checklist) throw new TRPCError({ code: 'NOT_FOUND' });
        
        await db.updateVisitChecklist(input.checklistId, {
          status: 'visited',
          visitedAt: new Date(),
          observations: input.observations,
        });
        
        // Record in visit history
        await db.recordPostVisit(checklist.postId, ctx.user.id, input.observations);
        
        return { success: true };
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
      .query(async ({ input }) => {
        return await db.getLatestSupervisorLocation(input.supervisorId);
      }),
    
    getAllLatest: protectedProcedure.query(async () => {
      return await db.getAllSupervisorsLatestLocations();
    }),
  }),

  // Reports
  reports: router({
    visitsByDateRange: protectedProcedure
      .input(z.object({ startDate: z.date(), endDate: z.date() }))
      .query(async ({ input }) => {
        return await db.getPostVisitsByDateRange(input.startDate, input.endDate);
      }),
  }),
});

export type AppRouter = typeof appRouter;
