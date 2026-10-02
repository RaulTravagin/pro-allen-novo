/* @vitest-environment jsdom */
import React, { useState } from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import PostCard from "./PostCard";

afterEach(cleanup);

vi.mock("@/lib/trpc", () => ({
  trpc: {
    supervisorRoutes: { getPostPops: { useQuery: () => ({ isSuccess: false }) } },
    postPops: { downloadUrl: { useMutation: () => ({ isPending: false, mutateAsync: vi.fn() }) } },
  },
}));

function PostCardFlowHarness() {
  const [status, setStatus] = useState<"pending" | "in_progress" | "visited">("pending");
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);
  const [departureTime, setDepartureTime] = useState<Date | null>(null);

  return (
    <PostCard
      id={22}
      postId={3}
      supervisorRouteId={8}
      postName="Posto de teste"
      occurrenceReport="Visita realizada e posto em funcionamento."
      status={status}
      arrivalTime={arrivalTime}
      departureTime={departureTime}
      isActiveVisit={status === "in_progress"}
      onCheckIn={async () => {
        setStatus("in_progress");
        setArrivalTime(new Date("2026-08-12T11:00:00.000Z"));
        setDepartureTime(null);
      }}
      onCheckOut={async () => {
        setStatus("visited");
        setDepartureTime(new Date("2026-08-12T12:00:00.000Z"));
      }}
      onOpenOccurrence={vi.fn()}
    />
  );
}

describe("PostCard", () => {
  it("executa o ciclo chegada, saída e chegada reaparecida no mesmo card", async () => {
    const user = userEvent.setup();
    render(<PostCardFlowHarness />);

    await user.click(screen.getByRole("button", { name: "Registrar chegada em Posto de teste" }));
    expect(await screen.findByRole("button", { name: "Registrar saída de Posto de teste" })).toBeTruthy();
    expect(screen.getByText(/Entrada:/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Registrar saída de Posto de teste" }));
    expect(await screen.findByRole("button", { name: "Visita concluída em Posto de teste" })).toBeTruthy();
    expect(screen.getByText(/Entrada:/)).toBeTruthy();
    expect(screen.getByText(/Saída:/)).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Registrar chegada em Posto de teste" }));
    expect(await screen.findByRole("button", { name: "Registrar saída de Posto de teste" })).toBeTruthy();
  });

  it("normaliza coordenadas GPS textuais sem quebrar a renderização", () => {
    render(
      <PostCard
        id={23}
        postId={4}
        supervisorRouteId={9}
        postName="Posto com GPS"
        occurrenceReport="Visita realizada e posto em funcionamento."
        status="visited"
        arrivalTime={new Date("2026-08-12T11:00:00.000Z")}
        departureTime={new Date("2026-08-12T11:30:00.000Z")}
        arrivalLatitude="-12.5"
        arrivalLongitude="-46.98765432"
        departureLatitude="-23.12340000"
        departureLongitude="-46.98760000"
        onCheckIn={async () => undefined}
        onCheckOut={async () => undefined}
        onOpenOccurrence={vi.fn()}
      />,
    );

    expect(screen.getByText("-12.500000, -46.987654")).toBeTruthy();
    expect(screen.getByText("-23.123400, -46.987600")).toBeTruthy();
  });

  it("mostra somente posto, status e horários em modo Admin read-only", () => {
    const onCheckIn = vi.fn(async () => undefined);
    const onCheckOut = vi.fn(async () => undefined);
    const onOpenOccurrence = vi.fn();
    render(
      <PostCard
        id={24}
        postId={5}
        supervisorRouteId={10}
        postName="Posto Admin"
        postAddress="Endereço não autorizado"
        observations="Observação não autorizada"
        occurrenceReport="Relato não autorizado"
        isCoverage
        coverageReason="Motivo não autorizado"
        status="in_progress"
        arrivalTime={new Date("2026-10-01T10:00:00.000Z")}
        departureTime={new Date("2026-10-01T10:30:00.000Z")}
        arrivalLatitude="-12.5"
        arrivalLongitude="-46.98765432"
        departureLatitude="-23.1234"
        departureLongitude="-46.9876"
        onCheckIn={onCheckIn}
        onCheckOut={onCheckOut}
        onOpenOccurrence={onOpenOccurrence}
        readOnly
      />,
    );

    expect(screen.getByText("Posto Admin")).toBeTruthy();
    expect(screen.getByText("Em Visita")).toBeTruthy();
    expect(screen.getByText("Entrada: 10:00")).toBeTruthy();
    expect(screen.getByText("Saída: 10:30")).toBeTruthy();
    expect(screen.queryByText(/não autorizado/)).toBeNull();
    expect(screen.queryByText(/-12\.500000|-46\.987654|-23\.123400|-46\.987600/)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(onCheckIn).not.toHaveBeenCalled();
    expect(onCheckOut).not.toHaveBeenCalled();
    expect(onOpenOccurrence).not.toHaveBeenCalled();
  });
});
