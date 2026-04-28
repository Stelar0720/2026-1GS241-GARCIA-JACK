import { SignIn, SignInButton, SignUp, UserButton, useUser } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { CheckoutButton } from "@/components/checkout-button";
import { fetchProductsFromApi, fallbackProducts, Product } from "@/lib/catalog";
import { getAdminAppUrl, getApiUrl, isClerkConfigured } from "@/lib/env";
import { getUserRole } from "@/lib/roles";

type PurchaseStatus = "pending" | "paid" | "cancelled";
type ThemeMode = "light" | "dark";

type CustomerPurchase = {
  id: string;
  checkoutSessionId: string;
  productId: string;
  buyerId: string;
  buyerEmail?: string | null;
  status: PurchaseStatus;
  amountUsd: number;
  createdAt: string;
  updatedAt: string;
  productName?: string | null;
  productDescription?: string | null;
  productImageUrl?: string | null;
};

const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  cancelled: "Cancelada",
};

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
  if (product.stock <= product.minimumStock) return `Quedan ${product.stock}`;
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

function RootLayout({ children }: { children: React.ReactNode }) {
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
            <button className="button button-outline theme-toggle" type="button" onClick={toggleThemeMode}>
              {themeMode === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
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
      <footer className="footer">
        <div className="container">
          <p>UrbanSprout · by Los Extraditables 😈 NJA</p>
        </div>
      </footer>
    </>
  );
}

function HomePage() {
  const { user } = useUser();
  const clerkReady = isClerkConfigured();
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      setLoadingProducts(true);
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
    void loadProducts();
  }, []);

  return (
    <main>
      <section className="hero">
        <div className="container hero-grid">
          <div>
            <span className="hero-badge">Sostenible sin salir de casa</span>
            <h1>Tu mini huerto en casa, aunque vivas en un apartamento.</h1>
            <p>
              Kits pequeños de cultivo con semillas, sustrato y guía práctica para cosechar en
              espacios reducidos o zonas con poco acceso a tierra fértil.
            </p>
            <div className="cta-row">
              <a className="button button-primary" href="#catalogo">
                Empezar a cultivar hoy
              </a>
              {!user ? (
                clerkReady ? (
                  <Link to="/sign-up" className="button button-outline">
                    Crear cuenta
                  </Link>
                ) : (
                  <button className="button button-outline" type="button" disabled>
                    Habilita Clerk para registro
                  </button>
                )
              ) : (
                <Link className="button button-outline" to="/dashboard">
                  Mi cuenta
                </Link>
              )}
            </div>
          </div>
          <div className="hero-card">
            <h3>¿Qué incluye cada kit?</h3>
            <ul>
              <li>Semillas para microcultivos de ciclo corto.</li>
              <li>Macetas compactas y sustrato ligero.</li>
              <li>Guía de riego y luz para espacios pequeños.</li>
              <li>Soporte básico para primeras 2 semanas.</li>
            </ul>
          </div>
        </div>
      </section>

      <section id="catalogo" className="products">
        <div className="container">
          <h2 className="section-title">Kits para arrancar en una tarde</h2>
          {loadingProducts ? (
            <p className="loading-text">Cargando productos...</p>
          ) : (
            <div className="grid">
              {products.map((product) => (
                <article className="product" key={product.id}>
                  {product.imageUrl && (
                    <div className="product-image">
                      <img src={product.imageUrl} alt={product.name} />
                    </div>
                  )}
                  <span className="pill">{product.tag}</span>
                  <h3>{product.name}</h3>
                  <p className="meta">{product.description}</p>
                  <span className={`stock-pill ${product.stock <= 0 ? "stock-empty" : ""}`}>
                    {getStockLabel(product)}
                  </span>
                  <p className="price">${product.priceUsd.toFixed(2)} USD</p>
                  <CheckoutButton
                    productId={product.id}
                    userId={user?.id ?? null}
                    userEmail={user?.primaryEmailAddress?.emailAddress ?? null}
                    disabled={product.stock <= 0}
                  />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
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
  return (
    <RootLayout>
      <Routes>
        <Route path="/" element={<HomePage />} />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </RootLayout>
  );
}

function AppWithoutClerk() {
  const adminAppUrl = getAdminAppUrl();
  const { themeMode, toggleThemeMode } = useThemeMode();
  const [products, setProducts] = useState<Product[]>(fallbackProducts);
  const [loadingProducts, setLoadingProducts] = useState(true);

  useEffect(() => {
    async function loadProducts() {
      setLoadingProducts(true);
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
    void loadProducts();
  }, []);

  return (
    <>
      <header className="nav">
        <div className="container nav-inner">
          <Link to="/" className="brand" aria-label="Ir al inicio de UrbanSprout">
            <span aria-hidden="true">🌿</span>
            UrbanSprout
          </Link>
          <div className="nav-actions">
            <button className="button button-outline theme-toggle" type="button" onClick={toggleThemeMode}>
              {themeMode === "dark" ? "Modo claro" : "Modo oscuro"}
            </button>
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
            <main>
              <section className="hero">
                <div className="container hero-grid">
                  <div>
                    <span className="hero-badge">Sostenible sin salir de casa</span>
                    <h1>Tu mini huerto en casa, aunque vivas en un apartamento.</h1>
                    <p>
                      Kits pequeños de cultivo con semillas, sustrato y guía práctica para cosechar
                      en espacios reducidos o zonas con poco acceso a tierra fértil.
                    </p>
                  </div>
                  <div className="hero-card">
                    <h3>¿Qué incluye cada kit?</h3>
                    <ul>
                      <li>Semillas para microcultivos de ciclo corto.</li>
                      <li>Macetas compactas y sustrato ligero.</li>
                      <li>Guía de riego y luz para espacios pequeños.</li>
                      <li>Soporte básico para primeras 2 semanas.</li>
                    </ul>
                  </div>
                </div>
              </section>

              <section id="catalogo" className="products">
                <div className="container">
                  <h2 className="section-title">Kits para arrancar en una tarde</h2>
                  {loadingProducts ? (
                    <p className="loading-text">Cargando productos...</p>
                  ) : (
                    <div className="grid">
                      {products.map((product) => (
                        <article className="product" key={product.id}>
                          {product.imageUrl && (
                            <div className="product-image">
                              <img src={product.imageUrl} alt={product.name} />
                            </div>
                          )}
                          <span className="pill">{product.tag}</span>
                          <h3>{product.name}</h3>
                          <p className="meta">{product.description}</p>
                          <span className={`stock-pill ${product.stock <= 0 ? "stock-empty" : ""}`}>
                            {getStockLabel(product)}
                          </span>
                          <p className="price">${product.priceUsd.toFixed(2)} USD</p>
                          <CheckoutButton
                            productId={product.id}
                            userId={null}
                            userEmail={null}
                            disabled={product.stock <= 0}
                          />
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            </main>
          }
        />
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <footer className="footer">
        <div className="container">
          <p>UrbanSprout · by Los Extraditables 😈 NJA</p>
        </div>
      </footer>
    </>
  );
}

export default function App() {
  return isClerkConfigured() ? <AppWithClerk /> : <AppWithoutClerk />;
}
