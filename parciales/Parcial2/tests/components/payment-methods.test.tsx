import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { PaymentMethodsPanel } from "@/components/payment-methods";

const stripeMocks = vi.hoisted(() => ({
  elementsSubmit: vi.fn(),
  confirmSetup: vi.fn(),
  loadStripe: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock("@clerk/clerk-react", () => ({
  useAuth: () => ({ getToken: stripeMocks.getToken }),
}));

vi.mock("@stripe/stripe-js", () => ({
  loadStripe: stripeMocks.loadStripe,
}));

vi.mock("@stripe/react-stripe-js", () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  PaymentElement: () => <div data-testid="stripe-payment-element" />,
  useElements: () => ({ submit: stripeMocks.elementsSubmit }),
  useStripe: () => ({ confirmSetup: stripeMocks.confirmSetup }),
}));

vi.mock("@/lib/env", () => ({
  getApiUrl: () => "/api",
  getStripePublishableKey: () => "pk_test_urbansprout",
}));

vi.mock("@/lib/i18n", () => ({
  useLocale: () => ({ locale: "es" }),
  translatePaymentMethod: (_locale: string, key: string) => key,
}));

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("PaymentMethodsPanel con Stripe Elements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stripeMocks.getToken.mockResolvedValue("token-test");
    stripeMocks.loadStripe.mockResolvedValue({});
    stripeMocks.elementsSubmit.mockResolvedValue({});
    stripeMocks.confirmSetup.mockResolvedValue({
      setupIntent: { status: "succeeded" },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  test("crea el SetupIntent y monta PaymentElement con su formulario", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ clientSecret: "seti_secret_test" }, 201));
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentMethodsPanel />);
    await screen.findByText("empty");
    await userEvent.click(screen.getByRole("button", { name: "add" }));

    expect(await screen.findByRole("heading", { name: "cardTitle" })).toBeVisible();
    expect(screen.getByTestId("stripe-payment-element")).toBeVisible();
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/me/payment-methods",
      expect.objectContaining({
        method: "POST",
        headers: { Authorization: "Bearer token-test" },
      }),
    );
  });

  test("confirma el SetupIntent y recarga las tarjetas al guardarlo", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ clientSecret: "seti_secret_test" }, 201))
      .mockResolvedValueOnce(
        jsonResponse([{ id: "pm_1", brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 }]),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentMethodsPanel />);
    await screen.findByText("empty");
    await userEvent.click(screen.getByRole("button", { name: "add" }));
    await userEvent.click(await screen.findByRole("button", { name: "save" }));

    await waitFor(() => {
      expect(stripeMocks.elementsSubmit).toHaveBeenCalledOnce();
      expect(stripeMocks.confirmSetup).toHaveBeenCalledWith({
        elements: expect.objectContaining({ submit: stripeMocks.elementsSubmit }),
        redirect: "if_required",
      });
    });
    expect(
      await screen.findByText((_content, element) => element?.tagName === "SPAN" && !!element.textContent?.includes("4242")),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "cardTitle" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("saved");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
