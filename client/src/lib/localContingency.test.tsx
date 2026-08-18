// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
  checkInLocalVisit,
  checkOutLocalVisit,
  clearLocalContingencyData,
  exportLocalContingencyData,
  getActivitiesForLocalUser,
  getOpenActivityForLocalUser,
  getLocalSession,
  importLocalContingencyData,
  loginLocal,
  saveLocalChecklistItem,
  saveLocalVisitObservations,
  startLocalActivity,
  updateLocalKm,
} from "./localContingency";

afterEach(() => clearLocalContingencyData());

describe("modo local de contingência", () => {
  it("persiste login, rota, quilometragem e checklist no navegador", async () => {
    const session = await loginLocal("paulo.murashita", "123456");
    expect(session).toMatchObject({ username: "paulo.murashita", name: "Paulo Murashita" });
    expect(getLocalSession()?.username).toBe("paulo.murashita");

    const activity = startLocalActivity(session!, "local-r1");
    const withInitialKm = updateLocalKm(activity.id, 12000, "initial");
    const firstVisit = withInitialKm.visits[0];
    const checkedIn = checkInLocalVisit(activity.id, firstVisit.id);
    const withChecklist = saveLocalChecklistItem(activity.id, firstVisit.id, checkedIn.visits[0].items[0].id, "conforme", "Tudo em ordem");
    saveLocalVisitObservations(activity.id, firstVisit.id, "Visita local registrada durante manutenção.");
    const checkedOut = checkOutLocalVisit(activity.id, firstVisit.id);

    expect(withChecklist.visits[0].items[0]).toMatchObject({ answer: "conforme", notes: "Tudo em ordem" });
    expect(checkedOut.visits[0]).toMatchObject({ status: "visited", arrivalAt: expect.any(String), departureAt: expect.any(String) });

    const closed = updateLocalKm(activity.id, 12012, "final");
    expect(closed).toMatchObject({ status: "completed", kmInitial: 12000, kmFinal: 12012, completedAt: expect.any(String) });
    expect(getOpenActivityForLocalUser(session!.username)).toBeNull();
    expect(getActivitiesForLocalUser(session!.username)).toHaveLength(1);
  });

  it("exporta e recupera dados locais sem depender do servidor", async () => {
    const session = await loginLocal("rodrigo.ramos", "123456");
    startLocalActivity(session!, "local-base");
    const exported = exportLocalContingencyData();

    clearLocalContingencyData();
    expect(getLocalSession()).toBeNull();
    importLocalContingencyData(exported);

    expect(getLocalSession()).toMatchObject({ username: "rodrigo.ramos" });
    expect(getOpenActivityForLocalUser("rodrigo.ramos")).toMatchObject({ routeName: "Base Operacional", status: "in_progress" });
  });
});
