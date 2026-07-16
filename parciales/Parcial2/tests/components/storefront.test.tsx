import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import { CartDropdown, ProductCard } from "@/App";
import { CheckoutButton } from "@/components/checkout-button";

afterEach(() => vi.restoreAllMocks());

describe("ProductCard", () => {
  test("renderiza el contenido del producto", () => {
    render(<ProductCard className="product-card"><h2>Kit balcón</h2></ProductCard>);
    expect(screen.getByRole("article")).toHaveAttribute("data-tilt-card");
    expect(screen.getByRole("heading", { name: "Kit balcón" })).toBeVisible();
  });
});

describe("CartDropdown", () => {
  test("abre el drawer y muestra el estado vacío", async () => {
    render(<CartDropdown cartLines={[]} cartCount={0} cartTotal={0} checkoutError={null} checkingOut={false} openCartSignal={0} updateCartQuantity={vi.fn()} checkoutCart={vi.fn()} />);
    await userEvent.click(screen.getByRole("button", { name: "Carrito con 0 productos" }));
    expect(screen.getByRole("dialog", { name: "Resumen del carrito" })).toBeVisible();
    expect(screen.getByText(/Agrega kits del catálogo/)).toBeVisible();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("CheckoutButton", () => {
  test("renderiza el estado sin stock", () => {
    render(<CheckoutButton productId="kit" userId={null} userEmail={null} disabled />);
    expect(screen.getByRole("button", { name: "Sin stock" })).toBeDisabled();
  });

  test("muestra el error devuelto por checkout", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: "Stock insuficiente" }), { status: 409 })));
    render(<CheckoutButton productId="kit" userId="user" userEmail="user@example.com" />);
    await userEvent.click(screen.getByRole("button", { name: "Comprar kit" }));
    await waitFor(() => expect(screen.getByText("Stock insuficiente")).toBeVisible());
  });
});
