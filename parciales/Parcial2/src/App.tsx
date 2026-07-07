import { SignIn, SignInButton, SignUp, UserButton, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { fetchProductsFromApi, fallbackProducts, Product } from "@/lib/catalog";
import { getAdminAppUrl, getApiUrl, isClerkConfigured } from "@/lib/env";
import { getUserRole } from "@/lib/roles";
import {
  FaqSection,
  FinalCta,
  Hero,
  HowItWorks,
  SiteFooter,
  StatsBar,
  Testimonials,
  TrustMarquee,
  ValueProps,
} from "@/components/home-sections";
import { ProductDetailPage } from "@/pages/product-detail";
import { DevolucionesPage, PrivacidadPage, TerminosPage } from "@/pages/legal";

type PurchaseStatus = "pending" | "paid" | "cancelled";
type ThemeMode = "light" | "dark";

type CustomerPurchase = {
  id: string;
  checkoutSessionId: string;
  productId: string;
  buyerId: string;
  buyerEmail?: string | null;
  status: PurchaseStatus;
  quantity: number;
  amountUsd: number;
  createdAt: string;
  updatedAt: string;
  productName?: string | null;
  productDescription?: string | null;
  productImageUrl?: string | null;
};

type CartItem = {
  productId: string;
  quantity: number;
};

type CartLine = {
  product: Product;
  quantity: number;
};

type StorefrontCart = {
  products: Product[];
  loadingProducts: boolean;
  cartLines: CartLine[];
  cartCount: number;
  cartTotal: number;
  checkoutError: string | null;
  checkingOut: boolean;
  lastAddedProductId: string | null;
  openCartSignal: number;
  addToCart: (product: Product) => void;
  viewCart: () => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  checkoutCart: () => Promise<void>;
};

const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  cancelled: "Cancelada",
};

const FREE_SHIPPING_THRESHOLD_USD = 55;

function useThemeMode() {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "light";
    return window.localStorage.getItem("urbansprout-theme") === "dark" ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
    window.localStorage.setItem("urbansprout-theme", themeMode);
  }, [themeMode]);

  function toggleThemeMode() {
    setThemeMode((current) => (current === "dark" ? "light" : "dark"));
  }

  return { themeMode, toggleThemeMode };
}

function getStockLabel(product: Product) {
  if (product.stock <= 0) return "Sin stock";
  return `${product.stock} disponibles`;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-PA", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha no disponible";

  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getPurchaseAccessText(status: PurchaseStatus) {
  if (status === "paid") return "Acceso activo";
  if (status === "pending") return "En espera de pago";
  return "Sin acceso";
}

async function fetchCustomerPurchases(userId: string, userEmail?: string | null): Promise<CustomerPurchase[]> {
  const emailQuery = userEmail ? `?email=${encodeURIComponent(userEmail)}` : "";
  let response: Response;

  try {
    response = await fetch(`${getApiUrl()}/customers/${encodeURIComponent(userId)}/orders${emailQuery}`);
  } catch {
    throw new Error(
      "No se pudo conectar con el servicio de compras. Verifica que la API esté corriendo.",
    );
  }

  const rawBody = await response.text();
  let body: { data?: CustomerPurchase[]; error?: string } | null = null;

  try {
    body = JSON.parse(rawBody) as { data?: CustomerPurchase[]; error?: string };
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(body?.error ?? "No se pudieron cargar tus compras.");
  }

  return body?.data ?? [];
}

async function createCheckoutSession(params: {
  items: CartItem[];
  userId: string | null;
  userEmail: string | null;
}) {
  const response = await fetch("/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const rawBody = await response.text();
  let parsedBody: { error?: string; checkoutUrl?: string } | null = null;

  try {
    parsedBody = JSON.parse(rawBody) as { error?: string; checkoutUrl?: string };
  } catch {
    parsedBody = null;
  }

  if (!response.ok) {
    throw new Error(parsedBody?.error ?? "No se pudo iniciar el checkout.");
  }

  if (!parsedBody?.checkoutUrl) {
    throw new Error("Stripe no devolvió una URL de checkout válida.");
  }

  window.location.href = parsedBody.checkoutUrl;
}

const CART_STORAGE_KEY = "urbansprout-cart";

function readStoredCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item?.productId === "string" && typeof item?.quantity === "number" && item.quantity > 0,
    );
  } catch {
    return [];
  }
}

function useStorefrontCart(userId: string | null, userEmail: string | null): StorefrontCart {
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [cartItems, setCartItems] = useState<CartItem[]>(() => readStoredCart());
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const [lastAddedProductId, setLastAddedProductId] = useState<string | null>(null);
  const [openCartSignal, setOpenCartSignal] = useState(0);

  async function loadProducts() {
    try {
      const fetchedProducts = await fetchProductsFromApi();
      setProducts(fetchedProducts);
    } catch (error) {
      console.warn("Failed to load products, using fallback:", error);
      setProducts(fallbackProducts);
    } finally {
      setLoadingProducts(false);
    }
  }

  useEffect(() => {
    // Carga inicial de productos al montar; sin librería de data-fetching no hay forma de evitar esta regla.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadProducts();

    function refreshOnFocus() {
      void loadProducts();
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);
    return () => {
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const cartLines = cartItems
    .map((item) => {
      const product = productsById.get(item.productId);
      return product ? { product, quantity: item.quantity } : null;
    })
    .filter((line): line is CartLine => Boolean(line));
  const cartCount = cartLines.reduce((sum, line) => sum + line.quantity, 0);
  const cartTotal = cartLines.reduce((sum, line) => sum + line.product.priceUsd * line.quantity, 0);

  function addToCart(product: Product) {
    setCheckoutError(null);
    setLastAddedProductId(product.id);
    setOpenCartSignal((current) => current + 1);
    setCartItems((current) => {
      const existing = current.find((item) => item.productId === product.id);
      if (!existing) return [...current, { productId: product.id, quantity: 1 }];

      return current.map((item) =>
        item.productId === product.id
          ? { ...item, quantity: Math.min(item.quantity + 1, product.stock) }
          : item,
      );
    });
  }

  function viewCart() {
    setOpenCartSignal((current) => current + 1);
  }

  function updateCartQuantity(productId: string, quantity: number) {
    const product = productsById.get(productId);
    const safeQuantity = Math.max(0, Math.min(Math.floor(quantity), product?.stock ?? 0));
    setCartItems((current) =>
      safeQuantity === 0
        ? current.filter((item) => item.productId !== productId)
        : current.map((item) => (item.productId === productId ? { ...item, quantity: safeQuantity } : item)),
    );
  }

  async function checkoutCart() {
    setCheckoutError(null);
    setCheckingOut(true);
    try {
      await createCheckoutSession({
        items: cartItems,
        userId,
        userEmail,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado en el checkout.";
      setCheckoutError(message);
    } finally {
      setCheckingOut(false);
    }
  }

  return {
    products,
    loadingProducts,
    cartLines,
    cartCount,
    cartTotal,
    checkoutError,
    checkingOut,
    lastAddedProductId,
    openCartSignal,
    addToCart,
    viewCart,
    updateCartQuantity,
    checkoutCart,
  };
}

function CartDropdown({
  cartLines,
  cartCount,
  cartTotal,
  checkoutError,
  checkingOut,
  openCartSignal,
  updateCartQuantity,
  checkoutCart,
}: Pick<
  StorefrontCart,
  | "cartLines"
  | "cartCount"
  | "cartTotal"
  | "checkoutError"
  | "checkingOut"
  | "openCartSignal"
  | "updateCartQuantity"
  | "checkoutCart"
>) {
  const [open, setOpen] = useState(false);
  const [lastOpenCartSignal, setLastOpenCartSignal] = useState(openCartSignal);

  if (openCartSignal !== lastOpenCartSignal) {
    setLastOpenCartSignal(openCartSignal);
    if (openCartSignal > 0) setOpen(true);
  }

  return (
    <div className="cart-menu">
      <button
        className="cart-menu-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`Carrito con ${cartCount} producto${cartCount === 1 ? "" : "s"}`}
      >
        <span aria-hidden="true">🛒</span>
        <strong>{cartCount}</strong>
      </button>
      {open ? (
        <div className="cart-dropdown glass">
          <div className="cart-dropdown-header">
            <h3>Carrito</h3>
            <span>{formatMoney(cartTotal)}</span>
          </div>
          <div className="shipping-progress">
            <p className="meta">
              {cartTotal >= FREE_SHIPPING_THRESHOLD_USD
                ? "🎉 ¡Tienes envío gratis!"
                : `Te faltan ${formatMoney(FREE_SHIPPING_THRESHOLD_USD - cartTotal)} para el envío gratis`}
            </p>
            <div className="shipping-bar" aria-hidden="true">
              <span
                style={{ width: `${Math.min(100, (cartTotal / FREE_SHIPPING_THRESHOLD_USD) * 100)}%` }}
              />
            </div>
          </div>
          {cartLines.length === 0 ? (
            <p className="meta">Agrega kits del catálogo para preparar tu compra.</p>
          ) : (
            <div className="cart-lines">
              {cartLines.map(({ product, quantity }) => (
                <div className="cart-line" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{formatMoney(product.priceUsd * quantity)}</span>
                  </div>
                  <div className="cart-line-actions">
                    <div className="quantity-control">
                      <button type="button" onClick={() => updateCartQuantity(product.id, quantity - 1)}>
                        -
                      </button>
                      <span>{quantity}</span>
                      <button
                        type="button"
                        disabled={quantity >= product.stock}
                        onClick={() => updateCartQuantity(product.id, quantity + 1)}
                      >
                        +
                      </button>
                    </div>
                    <button
                      className="remove-line-button"
                      type="button"
                      onClick={() => updateCartQuantity(product.id, 0)}
                      aria-label={`Eliminar ${product.name} del carrito`}
                      title="Eliminar"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button
            className="button button-primary"
            type="button"
            disabled={cartCount === 0 || checkingOut}
            onClick={() => void checkoutCart()}
          >
            {checkingOut ? "Redirigiendo..." : "Comprar carrito"}
          </button>
          {checkoutError ? <p className="status-error">{checkoutError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function RootLayout({ children, cart }: { children: React.ReactNode; cart: StorefrontCart }) {
  const clerkReady = isClerkConfigured();
  const { user } = useUser();
  const role = getUserRole(user);
  const adminAppUrl = getAdminAppUrl();
  const { themeMode, toggleThemeMode } = useThemeMode();

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="Ir al inicio de UrbanSprout">
            <span aria-hidden="true">🌿</span>
            UrbanSprout
          </Link>
          <div className="nav-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleThemeMode}
              aria-label={themeMode === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              title={themeMode === "dark" ? "Modo claro" : "Modo oscuro"}
            >
              <span aria-hidden="true">{themeMode === "dark" ? "☀" : "☾"}</span>
            </button>
            <CartDropdown
              cartLines={cart.cartLines}
              cartCount={cart.cartCount}
              cartTotal={cart.cartTotal}
              checkoutError={cart.checkoutError}
              checkingOut={cart.checkingOut}
              openCartSignal={cart.openCartSignal}
              updateCartQuantity={cart.updateCartQuantity}
              checkoutCart={cart.checkoutCart}
            />
            {clerkReady && user ? (
              <>
                <Link to="/dashboard" className="button button-outline">
                  Panel
                </Link>
                {role === "admin" ? (
                  <a href={adminAppUrl} className="button button-outline" target="_blank" rel="noreferrer">
                    Admin
                  </a>
                ) : null}
                <UserButton />
              </>
            ) : clerkReady ? (
              <SignInButton mode="modal">
                <button className="button button-outline" type="button">
                  Iniciar sesión
                </button>
              </SignInButton>
            ) : (
              <button className="button button-outline" type="button" disabled>
                Configura Clerk para login
              </button>
            )}
          </div>
        </div>
      </header>
      {children}
      <SiteFooter />
    </>
  );
}

function HomePage({
  products,
  loadingProducts,
  addToCart,
  cartLines,
  lastAddedProductId,
  viewCart,
  authAction,
}: StorefrontCart & { authAction?: React.ReactNode }) {
  return (
    <main>
      <Hero authAction={authAction} />
      <TrustMarquee />
      <StatsBar />
      <ValueProps />
      <HowItWorks />

      <section id="catalogo" className="products">
        <div className="container">
          <p className="section-kicker">Catálogo</p>
          <div className="catalog-header">
            <h2 className="section-title">Kits para arrancar en una tarde</h2>
            <p className="meta catalog-note">
              Todos incluyen envío en 24–48 h y garantía de germinación de 30 días.
            </p>
          </div>
          {loadingProducts ? (
            <p className="loading-text">Cargando productos...</p>
          ) : (
            <div className="grid">
              {products.map((product) => {
                const productInCart = cartLines.some((line) => line.product.id === product.id);
                const justAdded = lastAddedProductId === product.id;

                return (
                  <article
                    className={`product glass ${justAdded ? "product-added" : ""}`}
                    key={product.id}
                  >
                    <Link to={`/producto/${product.id}`} className="product-image">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} />
                      ) : (
                        <span className="product-image-fallback" aria-hidden="true">
                          🌿
                        </span>
                      )}
                    </Link>
                    <div className="product-pills">
                      {product.tag ? <span className="pill">{product.tag}</span> : null}
                      <span className={`stock-pill ${product.stock <= 0 ? "stock-empty" : ""}`}>
                        {getStockLabel(product)}
                      </span>
                    </div>
                    <h3>
                      <Link to={`/producto/${product.id}`}>{product.name}</Link>
                    </h3>
                    <p className="meta">{product.description}</p>
                    <p className="price">${product.priceUsd.toFixed(2)} USD</p>
                    <div className="product-actions">
                      <button
                        className="button button-primary"
                        type="button"
                        disabled={product.stock <= 0}
                        onClick={() => (productInCart ? viewCart() : addToCart(product))}
                      >
                        {product.stock <= 0
                          ? "Sin stock"
                          : productInCart
                            ? "Ver en carrito"
                            : "Agregar al carrito"}
                      </button>
                      <Link className="button button-outline" to={`/producto/${product.id}`}>
                        Ver detalles
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <Testimonials />
      <FaqSection />
      <FinalCta />
    </main>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function DashboardPage() {
  const { user } = useUser();
  const role = getUserRole(user);
  const location = useLocation();
  const adminAppUrl = getAdminAppUrl();
  const payment = useMemo(() => new URLSearchParams(location.search).get("payment"), [location.search]);

  return (
    <main className="container" style={{ paddingBlock: "2rem" }}>
      <section className="stack panel" style={{ maxWidth: "760px" }}>
        <h1 className="section-title">Mi cuenta</h1>
        <p className="role-badge">Tipo de usuario: {role}</p>
        {payment === "success" ? (
          <p>Pago completado. Tu kit está en preparación 🌿</p>
        ) : payment === "cancelled" ? (
          <p>Pago cancelado. Puedes intentarlo otra vez cuando quieras.</p>
        ) : (
          <p>Desde aquí gestionas tus compras y accesos.</p>
        )}
        <div className="cta-row">
          <Link className="button button-primary" to="/">
            Volver al catálogo
          </Link>
          {role === "admin" ? (
            <a className="button button-outline" href={adminAppUrl} target="_blank" rel="noreferrer">
              Ir al backoffice
            </a>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function CustomerDashboardPage() {
  const { user } = useUser();
  const role = getUserRole(user);
  const location = useLocation();
  const adminAppUrl = getAdminAppUrl();
  const payment = useMemo(() => new URLSearchParams(location.search).get("payment"), [location.search]);
  const [purchases, setPurchases] = useState<CustomerPurchase[]>([]);
  const [loadingPurchases, setLoadingPurchases] = useState(true);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);

  useEffect(() => {
    const userId = user?.id;
    const userEmail = user?.primaryEmailAddress?.emailAddress ?? null;
    if (!userId) return;
    const currentUserId = userId;
    const currentUserEmail = userEmail;

    async function loadPurchases() {
      setLoadingPurchases(true);
      setPurchaseError(null);
      try {
        const data = await fetchCustomerPurchases(currentUserId, currentUserEmail);
        setPurchases(data);
      } catch (error) {
        const message = error instanceof Error ? error.message : "No se pudieron cargar tus compras.";
        setPurchaseError(message);
      } finally {
        setLoadingPurchases(false);
      }
    }

    void loadPurchases();
  }, [user?.id, user?.primaryEmailAddress?.emailAddress]);

  const paidPurchases = purchases.filter((purchase) => purchase.status === "paid");
  const pendingPurchases = purchases.filter((purchase) => purchase.status === "pending");
  const totalSpent = paidPurchases.reduce((sum, purchase) => sum + purchase.amountUsd, 0);

  return (
    <main className="container dashboard-page">
      <section className="stack panel dashboard-hero">
        <div className="dashboard-heading">
          <div>
            <h1 className="section-title">Mi cuenta</h1>
            <p className="meta">Gestiona tus compras, estados de pago y accesos de UrbanSprout.</p>
          </div>
          <p className="role-badge">Tipo de usuario: {role}</p>
        </div>

        {payment === "success" ? (
          <p className="success-message">Pago completado. Tu kit está en preparación.</p>
        ) : payment === "cancelled" ? (
          <p className="status-error">Pago cancelado. Puedes intentarlo otra vez cuando quieras.</p>
        ) : null}

        <div className="account-summary">
          <div>
            <span>Compras totales</span>
            <strong>{purchases.length}</strong>
          </div>
          <div>
            <span>Accesos activos</span>
            <strong>{paidPurchases.length}</strong>
          </div>
          <div>
            <span>Pendientes</span>
            <strong>{pendingPurchases.length}</strong>
          </div>
          <div>
            <span>Total pagado</span>
            <strong>{formatMoney(totalSpent)}</strong>
          </div>
        </div>

        <div className="cta-row">
          <Link className="button button-primary" to="/">
            Volver al catálogo
          </Link>
          {role === "admin" ? (
            <a className="button button-outline" href={adminAppUrl} target="_blank" rel="noreferrer">
              Ir al backoffice
            </a>
          ) : null}
        </div>
      </section>

      <section className="panel stack">
        <div className="section-inline-header">
          <div>
            <h2 className="compact-title">Mis compras</h2>
            <p className="meta">Historial completo de órdenes asociadas a tu cuenta.</p>
          </div>
        </div>

        {loadingPurchases ? <p className="loading-text">Cargando compras...</p> : null}
        {purchaseError ? <p className="status-error">{purchaseError}</p> : null}

        {!loadingPurchases && !purchaseError && purchases.length === 0 ? (
          <div className="empty-state">
            <h3>No tienes compras registradas</h3>
            <p>Cuando compres un kit, aparecerá aquí con su estado y acceso.</p>
            <Link className="button button-primary" to="/">
              Explorar catálogo
            </Link>
          </div>
        ) : null}

        {!loadingPurchases && purchases.length > 0 ? (
          <div className="purchase-list">
            {purchases.map((purchase) => (
              <article className="purchase-card" key={purchase.id}>
                {purchase.productImageUrl ? (
                  <img src={purchase.productImageUrl} alt={purchase.productName ?? purchase.productId} />
                ) : (
                  <div className="purchase-image-fallback" aria-hidden="true">
                    US
                  </div>
                )}
                <div className="purchase-main">
                  <div className="purchase-title-row">
                    <h3>{purchase.productName ?? purchase.productId}</h3>
                    <span className={`status-pill status-${purchase.status}`}>
                      {purchaseStatusLabels[purchase.status]}
                    </span>
                  </div>
                  <p className="meta">{purchase.productDescription ?? "Kit UrbanSprout"}</p>
                  <div className="purchase-meta-grid">
                    <span>Orden: {purchase.id.slice(0, 8)}</span>
                    <span>Fecha: {formatDate(purchase.createdAt)}</span>
                    <span>Cantidad: {purchase.quantity}</span>
                    <span>Monto: {formatMoney(purchase.amountUsd)}</span>
                    <span>Acceso: {getPurchaseAccessText(purchase.status)}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <h2 className="compact-title">Mis accesos</h2>
        {paidPurchases.length === 0 ? (
          <p className="meta">Tus accesos se activan automáticamente cuando una compra queda pagada.</p>
        ) : (
          <div className="access-grid">
            {paidPurchases.map((purchase) => (
              <article className="access-card" key={`access-${purchase.id}`}>
                <span className="pill">Activo</span>
                <h3>{purchase.productName ?? purchase.productId}</h3>
                <p className="meta">Guía inicial, seguimiento de preparación y soporte básico.</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function CheckoutSuccessPage() {
  const location = useLocation();
  const sessionId = useMemo(() => new URLSearchParams(location.search).get("session_id"), [location.search]);

  return (
    <main className="container" style={{ paddingBlock: "2rem" }}>
      <section className="stack panel" style={{ maxWidth: "760px" }}>
        <h1 className="section-title">¡Gracias por tu compra!</h1>
        <p>Tu pago se procesó correctamente y tu kit ya está en preparación.</p>
        {sessionId ? <p className="meta">Referencia de pago: {sessionId.slice(0, 16)}...</p> : null}
        <div className="stack">
          <h3>Próximos pasos</h3>
          <ul>
            <li>Vas a recibir la confirmación y el seguimiento de tu pedido en tu panel.</li>
            <li>Preparamos tu kit y coordinamos el envío o retiro según corresponda.</li>
            <li>Podés revisar el estado de tu compra cuando quieras desde "Mi cuenta".</li>
          </ul>
        </div>
        <div className="cta-row">
          <Link className="button button-primary" to="/dashboard">
            Ir a mi cuenta
          </Link>
          <Link className="button button-outline" to="/">
            Volver al catálogo
          </Link>
        </div>
      </section>
    </main>
  );
}

function CheckoutCancelledPage() {
  return (
    <main className="container" style={{ paddingBlock: "2rem" }}>
      <section className="stack panel" style={{ maxWidth: "760px" }}>
        <h1 className="section-title">Pago cancelado</h1>
        <p>No se completó el cobro. Tu carrito sigue disponible para intentarlo de nuevo.</p>
        <div className="stack">
          <h3>Motivos comunes</h3>
          <ul>
            <li>Cerraste o volviste atrás en la ventana de pago de Stripe.</li>
            <li>La tarjeta fue rechazada por el banco emisor.</li>
            <li>La sesión de pago expiró por inactividad.</li>
          </ul>
        </div>
        <div className="cta-row">
          <Link className="button button-primary" to="/">
            Volver al catálogo
          </Link>
        </div>
      </section>
    </main>
  );
}

function AdminBridgePage() {
  const adminAppUrl = getAdminAppUrl();
  return (
    <main className="container" style={{ paddingBlock: "2rem" }}>
      <section className="panel stack" style={{ maxWidth: "720px" }}>
        <h1 className="section-title">Backoffice separado</h1>
        <p>El panel admin de UrbanSprout corre en una app independiente de React + Vite.</p>
        <div className="stack">
          <a className="button button-primary" href={adminAppUrl} target="_blank" rel="noreferrer">
            Abrir backoffice
          </a>
          <Link className="button button-outline" to="/dashboard">
            Volver a mi cuenta
          </Link>
        </div>
      </section>
    </main>
  );
}

function SignInPage() {
  return (
    <main className="container auth-center">
      <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" />
    </main>
  );
}

function SignUpPage() {
  return (
    <main className="container auth-center">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </main>
  );
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  if (user) return <>{children}</>;

  return (
    <main className="container" style={{ paddingBlock: "2rem" }}>
      <section className="stack panel" style={{ maxWidth: "760px" }}>
        <h1 className="section-title">Mi cuenta</h1>
        <p>Debes iniciar sesión para continuar.</p>
        <Link className="button button-primary" to="/sign-in">
          Ir a iniciar sesión
        </Link>
      </section>
    </main>
  );
}

function AppWithClerk() {
  const { user } = useUser();
  const cart = useStorefrontCart(
    user?.id ?? null,
    user?.primaryEmailAddress?.emailAddress ?? null,
  );

  const authAction = user ? (
    <Link className="button button-outline" to="/dashboard">
      Mi cuenta
    </Link>
  ) : (
    <Link to="/sign-up" className="button button-outline">
      Crear cuenta
    </Link>
  );

  return (
    <RootLayout cart={cart}>
      <Routes>
        <Route path="/" element={<HomePage {...cart} authAction={authAction} />} />
        <Route path="/producto/:id" element={<ProductDetailPage {...cart} />} />
        <Route path="/sign-in" element={<SignInPage />} />
        <Route path="/sign-up" element={<SignUpPage />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <CustomerDashboardPage />
            </RequireAuth>
          }
        />
        <Route path="/admin" element={<AdminBridgePage />} />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/checkout/cancelled" element={<CheckoutCancelledPage />} />
        <Route path="/terminos" element={<TerminosPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="/devoluciones" element={<DevolucionesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RootLayout>
  );
}

function AppWithoutClerk() {
  const adminAppUrl = getAdminAppUrl();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const cart = useStorefrontCart(null, null);

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="Ir al inicio de UrbanSprout">
            <span aria-hidden="true">🌿</span>
            UrbanSprout
          </Link>
          <div className="nav-actions">
            <button
              className="theme-toggle"
              type="button"
              onClick={toggleThemeMode}
              aria-label={themeMode === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              title={themeMode === "dark" ? "Modo claro" : "Modo oscuro"}
            >
              <span aria-hidden="true">{themeMode === "dark" ? "☀" : "☾"}</span>
            </button>
            <CartDropdown
              cartLines={cart.cartLines}
              cartCount={cart.cartCount}
              cartTotal={cart.cartTotal}
              checkoutError={cart.checkoutError}
              checkingOut={cart.checkingOut}
              openCartSignal={cart.openCartSignal}
              updateCartQuantity={cart.updateCartQuantity}
              checkoutCart={cart.checkoutCart}
            />
            <button className="button button-outline" type="button" disabled>
              Configura Clerk para login
            </button>
          </div>
        </div>
      </header>
      <Routes>
        <Route
          path="/"
          element={
            <HomePage
              {...cart}
              authAction={
                <button className="button button-outline" type="button" disabled>
                  Habilita Clerk para registro
                </button>
              }
            />
          }
        />
        <Route path="/producto/:id" element={<ProductDetailPage {...cart} />} />
        <Route
          path="/sign-in"
          element={
            <main className="container auth-center">
              <section className="panel stack" style={{ maxWidth: "560px", width: "100%" }}>
                <h1 className="section-title">Iniciar sesión</h1>
                <p>Configura Clerk para habilitar inicio de sesión.</p>
              </section>
            </main>
          }
        />
        <Route
          path="/sign-up"
          element={
            <main className="container auth-center">
              <section className="panel stack" style={{ maxWidth: "560px", width: "100%" }}>
                <h1 className="section-title">Crear cuenta</h1>
                <p>Configura Clerk para habilitar registro.</p>
              </section>
            </main>
          }
        />
        <Route
          path="/dashboard"
          element={
            <main className="container" style={{ paddingBlock: "2rem" }}>
              <section className="stack panel" style={{ maxWidth: "760px" }}>
                <h1 className="section-title">Mi cuenta</h1>
                <p>Activa Clerk con tus llaves reales para usar autenticación y panel de usuario.</p>
              </section>
            </main>
          }
        />
        <Route
          path="/admin"
          element={
            <main className="container" style={{ paddingBlock: "2rem" }}>
              <section className="panel stack" style={{ maxWidth: "720px" }}>
                <h1 className="section-title">Backoffice separado</h1>
                <p>El panel admin de UrbanSprout corre en una app independiente de React + Vite.</p>
                <a className="button button-primary" href={adminAppUrl} target="_blank" rel="noreferrer">
                  Abrir backoffice
                </a>
              </section>
            </main>
          }
        />
        <Route path="/checkout/success" element={<CheckoutSuccessPage />} />
        <Route path="/checkout/cancelled" element={<CheckoutCancelledPage />} />
        <Route path="/terminos" element={<TerminosPage />} />
        <Route path="/privacidad" element={<PrivacidadPage />} />
        <Route path="/devoluciones" element={<DevolucionesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <SiteFooter />
    </>
  );
}

export default function App() {
  return isClerkConfigured() ? <AppWithClerk /> : <AppWithoutClerk />;
}
