/* @vitest-environment jsdom */
import React, { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import PostCard from "./PostCard";

function PostCardFlowHarness() {
  const [status, setStatus] = useState<"pending" | "in_progress" | "visited">("pending");
  const [arrivalTime, setArrivalTime] = useState<Date | null>(null);
  const [departureTime, setDepartureTime] = useState<Date | null>(null);

  return (
    <PostCard
      id={22}
      postId={3}
      postName="Posto de teste"
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
      onOpenChecklist={vi.fn()}
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
        postName="Posto com GPS"
        status="visited"
        arrivalTime={new Date("2026-08-12T11:00:00.000Z")}
        departureTime={new Date("2026-08-12T11:30:00.000Z")}
        arrivalLatitude="-23.12345678"
        arrivalLongitude="-46.98765432"
        departureLatitude="-23.12340000"
        departureLongitude="-46.98760000"
        onCheckIn={async () => undefined}
        onCheckOut={async () => undefined}
        onOpenChecklist={vi.fn()}
      />,
    );

    expect(screen.getByText("-23.123457, -46.987654")).toBeTruthy();
    expect(screen.getByText("-23.123400, -46.987600")).toBeTruthy();
  });
});
