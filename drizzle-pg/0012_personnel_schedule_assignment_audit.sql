CREATE TABLE "personnel_employee_schedule_assignment_audit" (
	"id" serial PRIMARY KEY NOT NULL,
	"assignmentId" integer NOT NULL,
	"employeeId" integer NOT NULL,
	"action" varchar(16) NOT NULL,
	"actorId" integer NOT NULL,
	"actorNameSnapshot" text NOT NULL,
	"actorUsernameSnapshot" varchar(64),
	"changedAt" timestamp with time zone DEFAULT now() NOT NULL,
	"transactionId" bigint DEFAULT txid_current() NOT NULL,
	"reason" text NOT NULL,
	"previousSnapshot" jsonb,
	"newSnapshot" jsonb NOT NULL,
	CONSTRAINT "chk_personnel_schedule_assignment_audit_action" CHECK ("personnel_employee_schedule_assignment_audit"."action" IN ('ASSIGN', 'CLOSE', 'EDIT')),
	CONSTRAINT "chk_personnel_schedule_assignment_audit_reason" CHECK (length(btrim("personnel_employee_schedule_assignment_audit"."reason")) >= 5)
);
--> statement-breakpoint
CREATE INDEX "idx_personnel_schedule_assignment_audit_assignment_changed" ON "personnel_employee_schedule_assignment_audit" USING btree ("assignmentId","changedAt");
--> statement-breakpoint
CREATE INDEX "idx_personnel_schedule_assignment_audit_employee_changed" ON "personnel_employee_schedule_assignment_audit" USING btree ("employeeId","changedAt");
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reject_personnel_schedule_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'A trilha de auditoria de jornadas é append-only';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_personnel_schedule_audit_no_update_delete
BEFORE UPDATE OR DELETE ON public.personnel_employee_schedule_assignment_audit
FOR EACH ROW EXECUTE FUNCTION public.reject_personnel_schedule_audit_mutation();
--> statement-breakpoint
CREATE TRIGGER trg_personnel_schedule_audit_no_truncate
BEFORE TRUNCATE ON public.personnel_employee_schedule_assignment_audit
FOR EACH STATEMENT EXECUTE FUNCTION public.reject_personnel_schedule_audit_mutation();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.require_personnel_schedule_assignment_audit()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.personnel_employee_schedule_assignment_audit AS audit
    WHERE audit."assignmentId" = NEW."id"
      AND audit."transactionId" = txid_current()
      AND audit."newSnapshot" ->> 'id' = NEW."id"::text
      AND audit."newSnapshot" ->> 'employeeId' = NEW."employeeId"::text
      AND audit."newSnapshot" ->> 'scheduleId' = NEW."scheduleId"::text
      AND audit."newSnapshot" ->> 'startDate' = NEW."startDate"::text
      AND (audit."newSnapshot" ->> 'endDate') IS NOT DISTINCT FROM NEW."endDate"::text
      AND (audit."newSnapshot" ->> 'cycleAnchorDate') IS NOT DISTINCT FROM NEW."cycleAnchorDate"::text
  ) THEN
    RAISE EXCEPTION 'Toda inclusão ou alteração de vigência exige um snapshot de auditoria na mesma transação';
  END IF;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER trg_personnel_schedule_assignment_requires_audit
AFTER INSERT OR UPDATE ON public.personnel_employee_schedule_assignments
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION public.require_personnel_schedule_assignment_audit();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.reject_personnel_schedule_assignment_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Atribuições de jornada não podem ser excluídas; corrija-as com histórico';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER trg_personnel_schedule_assignment_no_delete
BEFORE DELETE ON public.personnel_employee_schedule_assignments
FOR EACH ROW EXECUTE FUNCTION public.reject_personnel_schedule_assignment_delete();
