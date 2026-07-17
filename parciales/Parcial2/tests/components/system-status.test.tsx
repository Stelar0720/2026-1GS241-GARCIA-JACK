import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ErrorBoundary } from "@/components/error-boundary";
import { NetworkStatus, NotFoundPage } from "@/components/system-status";

function BrokenView(): never { throw new Error("render roto"); }

beforeEach(() => Object.defineProperty(navigator, "onLine", { configurable: true, value: true }));

describe("estados de error", () => {
  test("muestra una página 404 con regreso al inicio", () => {
    render(<MemoryRouter><NotFoundPage /></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Página no encontrada" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Volver al inicio" })).toHaveAttribute("href", "/");
  });

  test("aísla un error y permite reintentar", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(<MemoryRouter><ErrorBoundary area="productos"><BrokenView /></ErrorBoundary></MemoryRouter>);
    expect(screen.getByRole("heading", { name: "Error interno" })).toBeVisible();
    await userEvent.click(screen.getByRole("button", { name: "Volver a intentar" }));
    expect(screen.getByRole("heading", { name: "Error interno" })).toBeVisible();
  });
});

test("avisa al quedar offline y se oculta al recuperar la red", () => {
  render(<NetworkStatus />);
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  act(() => window.dispatchEvent(new Event("offline")));
  expect(screen.getByText("Sin conexión")).toBeVisible();
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  act(() => window.dispatchEvent(new Event("online")));
  expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
});
