// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mapMock = {
  fitBounds: vi.fn(),
  setView: vi.fn(),
};

vi.mock("react-leaflet", () => ({
  CircleMarker: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  MapContainer: ({ children }: { children?: React.ReactNode }) => <div data-testid="map-container">{children}</div>,
  Polyline: () => null,
  TileLayer: () => null,
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useMap: () => mapMock,
}));

import { MapView } from "./Map";

const posts = [{ id: 1, title: "Posto 1", position: { lat: -23.18, lng: -46.88 } }];

afterEach(() => cleanup());

function renderMap(viewportKey = "route-1", supervisorLatitude = -23.2) {
  return render(
    <MapView
      viewportKey={viewportKey}
      posts={posts}
      supervisors={[{ id: 7, title: "Supervisor", position: { lat: supervisorLatitude, lng: -46.9 } }]}
    />,
  );
}

describe("MapView", () => {
  beforeEach(() => {
    mapMock.fitBounds.mockClear();
    mapMock.setView.mockClear();
  });

  it("não recentraliza quando os marcadores mudam durante o polling de GPS", () => {
    const view = renderMap();
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(1);
    mapMock.fitBounds.mockClear();
    mapMock.setView.mockClear();

    view.rerender(
      <MapView
        viewportKey="route-1"
        posts={posts}
        supervisors={[{ id: 7, title: "Supervisor", position: { lat: -23.25, lng: -46.95 } }]}
      />,
    );

    expect(mapMock.fitBounds).not.toHaveBeenCalled();
    expect(mapMock.setView).not.toHaveBeenCalled();
  });

  it("recentraliza quando a rota muda ou quando o Gestor solicita manualmente", async () => {
    const user = userEvent.setup();
    const view = renderMap();
    mapMock.fitBounds.mockClear();
    mapMock.setView.mockClear();

    view.rerender(
      <MapView
        viewportKey="route-2"
        posts={[{ id: 2, title: "Posto 2", position: { lat: -22.9, lng: -47.1 } }]}
        supervisors={[]}
      />,
    );
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(1);

    mapMock.fitBounds.mockClear();
    await user.click(screen.getByRole("button", { name: "Recentralizar mapa" }));
    expect(mapMock.fitBounds).toHaveBeenCalledTimes(1);
  });
});
