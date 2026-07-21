import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";
import { AdminUsers } from "./AdminUsers";
import { DataSecurityPanel } from "./DataSecurityPanel";
import { PerformancePanel } from "./PerformancePanel";
import { getApiErrorMessage, type ApiErrorBody } from "./api-error";

// ============================================
// TYPES
// ============================================

type OrderRefund = { refundId: string; amountUsd: number; reason: string; createdAt: string };

type Order = {
  id: string;
  checkoutSessionId: string;
  productId: string;
  buyerId: string;
  status: "pending" | "paid" | "cancelled" | "refunded";
  quantity: number;
  amountUsd: number;
  createdAt: string;
  updatedAt: string;
  refund?: OrderRefund | null;
};

type Product = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  tag: string;
  imageUrl: string;
  active: number;
  stock: number;
  minimumStock: number;
  inventoryUpdatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type ProductFormData = {
  name: string;
  description: string;
  priceUsd: string;
  tag: string;
  imageUrl: string;
  stock: string;
  minimumStock: string;
};

type StockAlert = { sku: string; stock: number; minimumStock: number; deficit: number };
type ProductField = keyof Pick<ProductFormData, "name" | "description" | "priceUsd" | "stock" | "minimumStock">;

function validateProduct(data: ProductFormData): Partial<Record<ProductField, string>> {
  const errors: Partial<Record<ProductField, string>> = {};
  if (!data.name.trim()) errors.name = "El nombre del producto es requerido.";
  if (!data.description.trim()) errors.description = "La descripción del producto es requerida.";
  const price = Number(data.priceUsd);
  if (!data.priceUsd.trim() || !Number.isFinite(price) || price <= 0) errors.priceUsd = "El precio debe ser mayor que cero.";
  const stock = Number(data.stock);
  if (!data.stock.trim() || !Number.isInteger(stock) || stock < 0) errors.stock = "El stock debe ser un entero igual o mayor que cero.";
  const minimumStock = Number(data.minimumStock);
  if (!data.minimumStock.trim() || !Number.isInteger(minimumStock) || minimumStock < 0) errors.minimumStock = "El stock mínimo debe ser un entero igual o mayor que cero.";
  return errors;
}

// ============================================
// CONSTANTS
// ============================================

// 'refunded' no está en el dropdown a propósito: un reembolso se procesa contra
// Stripe con el botón dedicado (HU-030), no cambiando el estado a mano.
const ORDER_STATUSES: Order["status"][] = ["pending", "paid", "cancelled"];
const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Pendiente (sin pago)",
  paid: "Pagada",
  cancelled: "Cancelada",
  refunded: "Reembolsada",
};

// ============================================
// MAIN APP COMPONENT
// ============================================

function App({ clerkEnabled }: { clerkEnabled: boolean }) {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL ?? "http://localhost:4000", []);
  const storefrontUrl = useMemo(() => import.meta.env.VITE_STOREFRONT_URL ?? "http://localhost:3000", []);
  const [adminKey, setAdminKey] = useState(() =>
    sessionStorage.getItem("urbansprout-admin-key") ??
    (import.meta.env.VITE_E2E === "true" ? import.meta.env.VITE_E2E_ADMIN_KEY ?? "" : ""),
  );
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState<string | null>(null);
  const [refundDrafts, setRefundDrafts] = useState<Record<string, { amountUsd?: string; reason?: string }>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [uploadingProductImage, setUploadingProductImage] = useState(false);

  // Product form state
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productFormData, setProductFormData] = useState<ProductFormData>({
    name: "",
    description: "",
    priceUsd: "",
    tag: "",
    imageUrl: "",
    stock: "0",
    minimumStock: "0",
  });
  const [touchedProductFields, setTouchedProductFields] = useState<Partial<Record<ProductField, boolean>>>({});
  const productErrors = validateProduct(productFormData);
  const productFormInvalid = Object.keys(productErrors).length > 0;
  const touchProductField = (field: ProductField) => setTouchedProductFields((current) => ({ ...current, [field]: true }));

  const apiFetch = useCallback((input: string, init: RequestInit = {}) => fetch(input, {
    ...init,
    headers: {
      ...(adminKey ? { Authorization: `Bearer ${adminKey}` } : {}),
      ...init.headers,
    },
  }), [adminKey]);

  const loadData = useCallback(async function loadData() {
    setLoading(true);
    setError(null);
    if (!adminKey) {
      setLoading(false);
      return;
    }
    try {
      const [ordersResponse, productsResponse, alertsResponse] = await Promise.all([
        apiFetch(`${apiBaseUrl}/orders`),
        apiFetch(`${apiBaseUrl}/products?includeInactive=true`),
        apiFetch(`${apiBaseUrl}/inventory/alerts`),
      ]);

      if ([ordersResponse, productsResponse, alertsResponse].some((response) => response.status === 401)) {
        throw new Error("La clave administrativa no es válida. Verifícala e intenta nuevamente.");
      }

      if ([ordersResponse, productsResponse, alertsResponse].some((response) => response.status === 403)) {
        throw new Error("La clave no tiene permisos suficientes para cargar el backoffice.");
      }

      if (!ordersResponse.ok || !productsResponse.ok || !alertsResponse.ok) {
        throw new Error("No se pudo cargar la información del backoffice.");
      }

      const ordersBody = (await ordersResponse.json()) as { data: Order[] };
      const productsBody = (await productsResponse.json()) as { data: Product[] };
      const alertsBody = (await alertsResponse.json()) as { data: StockAlert[] };

      setOrders(ordersBody.data);
      setProducts(productsBody.data);
      setStockAlerts(alertsBody.data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Ocurrió un error desconocido al cargar el backoffice.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, apiFetch]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const refreshKey = () => setAdminKey(sessionStorage.getItem("urbansprout-admin-key") ?? "");
    window.addEventListener("urbansprout-admin-key", refreshKey);
    return () => window.removeEventListener("urbansprout-admin-key", refreshKey);
  }, []);

  // ============================================
  // ORDER HANDLERS
  // ============================================

  async function updateOrderStatus(orderId: string, status: Order["status"]) {
    setSavingOrder(orderId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el estado de la orden.");
      }

      await loadData();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Error al actualizar la orden.";
      setError(message);
    } finally {
      setSavingOrder(null);
    }
  }

  // Reembolso total o parcial contra Stripe (HU-030).
  async function refundOrder(order: Order) {
    const raw = refundDrafts[order.id] ?? {};
    const amount = raw.amountUsd?.trim() ? Number(raw.amountUsd) : undefined;
    if (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || amount > order.amountUsd)) {
      setError(`El monto a reembolsar debe estar entre 0 y ${order.amountUsd.toFixed(2)}.`);
      return;
    }

    setSavingOrder(order.id);
    setError(null);
    try {
      const response = await apiFetch(`${apiBaseUrl}/orders/${order.id}/refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(amount !== undefined ? { amountUsd: amount } : {}),
          reason: raw.reason?.trim() || "Solicitado por el cliente",
        }),
      });
      if (!response.ok) {
        throw new Error(getApiErrorMessage(await response.json().catch(() => null), "No se pudo procesar el reembolso."));
      }
      setRefundDrafts((current) => ({ ...current, [order.id]: {} }));
      await loadData();
    } catch (refundError) {
      setError(refundError instanceof Error ? refundError.message : "Error al reembolsar la orden.");
    } finally {
      setSavingOrder(null);
    }
  }

  // ============================================
  // PRODUCT HANDLERS
  // ============================================

  function openNewProductForm() {
    setTouchedProductFields({});
    setEditingProduct(null);
    setProductFormData({
      name: "",
      description: "",
      priceUsd: "",
      tag: "",
      imageUrl: "",
      stock: "0",
      minimumStock: "0",
    });
    setShowProductForm(true);
  }

  function openEditProductForm(product: Product) {
    setTouchedProductFields({});
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      description: product.description,
      priceUsd: product.priceUsd.toString(),
      tag: product.tag,
      imageUrl: product.imageUrl,
      stock: product.stock.toString(),
      minimumStock: product.minimumStock.toString(),
    });
    setShowProductForm(true);
  }

  function closeProductForm() {
    setTouchedProductFields({});
    setShowProductForm(false);
    setEditingProduct(null);
    setProductFormData({
      name: "",
      description: "",
      priceUsd: "",
      tag: "",
      imageUrl: "",
      stock: "0",
      minimumStock: "0",
    });
  }

  async function handleSaveProduct() {
    setTouchedProductFields({ name: true, description: true, priceUsd: true, stock: true, minimumStock: true });
    if (productFormInvalid) return;
    const price = parseFloat(productFormData.priceUsd);
    const stock = Number(productFormData.stock);
    const minimumStock = Number(productFormData.minimumStock);
    if (isNaN(price) || price <= 0) {
      setError("El precio debe ser un número positivo.");
      return;
    }

    if (!Number.isInteger(stock) || stock < 0) {
      setError("El stock debe ser un número entero positivo.");
      return;
    }

    if (!Number.isInteger(minimumStock) || minimumStock < 0) {
      setError("El stock mínimo debe ser un número entero positivo.");
      return;
    }

    if (!productFormData.name.trim()) {
      setError("El nombre del producto es requerido.");
      return;
    }

    if (!productFormData.description.trim()) {
      setError("La descripción del producto es requerida.");
      return;
    }

    setSavingProduct(editingProduct?.id ?? "new");

    try {
      const url = editingProduct
        ? `${apiBaseUrl}/products/${editingProduct.id}`
        : `${apiBaseUrl}/products`;
      const method = editingProduct ? "PATCH" : "POST";

      const response = await apiFetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: productFormData.name.trim(),
          description: productFormData.description.trim(),
          priceUsd: price,
          tag: productFormData.tag.trim(),
          imageUrl: productFormData.imageUrl.trim(),
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json()) as ApiErrorBody;
        throw new Error(getApiErrorMessage(errorData, "No se pudo guardar el producto."));
      }

      const savedProductBody = (await response.json()) as { data?: Product };
      const savedProductId = savedProductBody.data?.id ?? editingProduct?.id;
      if (savedProductId) {
        const inventoryResponse = await apiFetch(`${apiBaseUrl}/inventory/${encodeURIComponent(savedProductId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stock, minimumStock }),
        });

        if (!inventoryResponse.ok) {
          const errorData = (await inventoryResponse.json()) as ApiErrorBody;
          throw new Error(getApiErrorMessage(errorData, "El producto se guardó, pero no se pudo actualizar el stock."));
        }
      }

      closeProductForm();
      await loadData();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Error al guardar el producto.";
      setError(message);
    } finally {
      setSavingProduct(null);
    }
  }

  async function handleDeleteProduct(productId: string) {
    if (!confirm("¿Estás seguro de eliminar este producto?")) {
      return;
    }

    setSavingProduct(productId);
    try {
      const response = await apiFetch(`${apiBaseUrl}/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("No se pudo eliminar el producto.");
      }

      await loadData();
    } catch (deleteError) {
      const message =
        deleteError instanceof Error ? deleteError.message : "Error al eliminar el producto.";
      setError(message);
    } finally {
      setSavingProduct(null);
    }
  }

  async function handleProductImageUpload(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado debe ser una imagen.");
      return;
    }

    setUploadingProductImage(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await apiFetch(`${apiBaseUrl}/uploads/product-image`, {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as { imageUrl?: string } & ApiErrorBody;
      if (!response.ok || !body.imageUrl) {
        throw new Error(getApiErrorMessage(body, "No se pudo cargar la imagen del producto."));
      }

      setProductFormData((current) => ({ ...current, imageUrl: body.imageUrl ?? "" }));
    } catch (uploadError) {
      const message =
        uploadError instanceof Error ? uploadError.message : "Error al cargar la imagen.";
      setError(message);
    } finally {
      setUploadingProductImage(false);
    }
  }

  // ============================================
  // RENDER
  // ============================================

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <h1>UrbanSprout Backoffice</h1>
          <p>Gestión de órdenes, inventario y productos.</p>
        </div>
        <div className="topbar-actions">
          <span className="stock-alert-badge" aria-label={`${stockAlerts.length} alertas de stock mínimo`}>
            Stock bajo: {stockAlerts.length}
          </span>
          <a className="button button-outline" href={storefrontUrl}>
            Ver tienda
          </a>
          <button type="button" className="button button-outline" onClick={() => void loadData()}>
            Recargar
          </button>
          {clerkEnabled ? (
            <>
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="button button-primary" type="button">
                    Iniciar sesión admin
                  </button>
                </SignInButton>
              </SignedOut>
              <SignedIn>
                <UserButton />
              </SignedIn>
            </>
          ) : (
            <span className="auth-disabled">Auth admin no configurada</span>
          )}
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      ) : null}
      {!adminKey ? (
        <div className="auth-notice" role="status">
          <span>Ingresa la clave administrativa para cargar productos, órdenes e inventario.</span>
          <a className="button button-outline" href="#admin-access">Configurar acceso</a>
        </div>
      ) : null}
      {loading ? <p className="loading-text">Cargando datos del backoffice...</p> : null}

      {!loading ? (
        <>
          {/* ============================================ */}
          {/* PRODUCTS SECTION */}
          {/* ============================================ */}
          <section className="panel">
            <div className="section-header">
              <h2>Productos</h2>
              <button
                type="button"
                className="button button-primary"
                onClick={() => openNewProductForm()}
              >
                + Nuevo producto
              </button>
            </div>

            {products.length === 0 ? (
              <p className="empty">No hay productos registrados.</p>
            ) : (
              <div className="product-grid">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={`product-card ${product.active === 0 ? "inactive" : ""}`}
                  >
                    <div className="product-image">
                      {product.imageUrl ? (
                        <img src={product.imageUrl} alt={product.name} />
                      ) : (
                        <div className="product-image-placeholder">Sin imagen</div>
                      )}
                    </div>
                    <div className="product-info">
                      <h3>{product.name}</h3>
                      <p className="product-price">${product.priceUsd.toFixed(2)} USD</p>
                      <p className="product-stock">
                        Stock: <strong>{product.stock}</strong>
                      </p>
                      {product.stock < product.minimumStock ? (
                        <span className="low-stock" role="status">Stock mínimo: {product.minimumStock}</span>
                      ) : null}
                      <p className="product-description">{product.description}</p>
                      <div className="product-tags">
                        {product.tag && <span className="pill">{product.tag}</span>}
                        {product.active === 0 && (
                          <span className="pill pill-inactive">Inactivo</span>
                        )}
                      </div>
                    </div>
                    <div className="product-actions">
                      <button
                        type="button"
                        className="button button-outline"
                        onClick={() => openEditProductForm(product)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="button button-danger"
                        disabled={savingProduct === product.id}
                        onClick={() => void handleDeleteProduct(product.id)}
                      >
                        {savingProduct === product.id ? "..." : "Eliminar"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ============================================ */}
          {/* ORDERS SECTION */}
          {/* ============================================ */}
          <section className="panel">
            <h2>Órdenes</h2>
            <div className="table orders-table">
              <div className="table-row table-head">
                <span>ID</span>
                <span>Producto</span>
                <span>Comprador</span>
                <span>Cantidad</span>
                <span>Monto</span>
                <span>Estado</span>
                <span>Reembolso</span>
              </div>
              {orders.length === 0 ? (
                <p className="empty">No hay órdenes registradas.</p>
              ) : (
                orders.map((order) => (
                  <div className="table-row" key={order.id}>
                    <span className="order-id">{order.id.substring(0, 8)}...</span>
                    <span>{order.productId}</span>
                    <span className="buyer-id">{order.buyerId}</span>
                    <span>{order.quantity}</span>
                    <span className="amount">${order.amountUsd.toFixed(2)}</span>
                    <span>
                      {order.status === "refunded" ? (
                        <strong className="refund-badge">{ORDER_STATUS_LABELS.refunded}</strong>
                      ) : (
                        <select
                          aria-label={`Estado de la orden ${order.id}`}
                          disabled={savingOrder === order.id}
                          value={order.status}
                          onChange={(event) =>
                            void updateOrderStatus(order.id, event.target.value as Order["status"])
                          }
                        >
                          {ORDER_STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {ORDER_STATUS_LABELS[status]}
                            </option>
                          ))}
                        </select>
                      )}
                    </span>
                    <span>
                      {order.refund ? (
                        <span className="refund-badge">
                          ${order.refund.amountUsd.toFixed(2)}
                          <small>{order.refund.reason}</small>
                        </span>
                      ) : order.status === "paid" ? (
                        <span className="refund-cell">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            max={order.amountUsd}
                            placeholder="Total"
                            aria-label={`Monto a reembolsar de la orden ${order.id}`}
                            value={refundDrafts[order.id]?.amountUsd ?? ""}
                            onChange={(event) =>
                              setRefundDrafts((current) => ({
                                ...current,
                                [order.id]: { ...current[order.id], amountUsd: event.target.value },
                              }))
                            }
                          />
                          <input
                            type="text"
                            placeholder="Motivo"
                            aria-label={`Motivo del reembolso de la orden ${order.id}`}
                            value={refundDrafts[order.id]?.reason ?? ""}
                            onChange={(event) =>
                              setRefundDrafts((current) => ({
                                ...current,
                                [order.id]: { ...current[order.id], reason: event.target.value },
                              }))
                            }
                          />
                          <button type="button" disabled={savingOrder === order.id} onClick={() => void refundOrder(order)}>
                            Reembolsar
                          </button>
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <AdminUsers apiBaseUrl={apiBaseUrl} />
          <PerformancePanel apiBaseUrl={apiBaseUrl} />
          <DataSecurityPanel apiBaseUrl={apiBaseUrl} />

        </>
      ) : null}

      {/* ============================================ */}
      {/* PRODUCT FORM MODAL */}
      {/* ============================================ */}
      {showProductForm ? (
        <div className="modal-overlay" onClick={() => closeProductForm()}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>{editingProduct ? "Editar producto" : "Nuevo producto"}</h2>

            <div className="form-group">
              <label htmlFor="product-name">Nombre del producto *</label>
              <input
                id="product-name"
                type="text"
                value={productFormData.name}
                aria-invalid={touchedProductFields.name && Boolean(productErrors.name)}
                aria-describedby={touchedProductFields.name && productErrors.name ? "product-name-error" : undefined}
                onBlur={() => touchProductField("name")}
                onChange={(e) =>
                  setProductFormData({ ...productFormData, name: e.target.value })
                }
                placeholder="Ej.: Kit balcón básico"
              />
              {touchedProductFields.name && productErrors.name ? <span id="product-name-error" className="form-error" role="alert">{productErrors.name}</span> : null}
            </div>

            <div className="form-group">
              <label htmlFor="product-description">Descripción *</label>
              <textarea
                id="product-description"
                value={productFormData.description}
                aria-invalid={touchedProductFields.description && Boolean(productErrors.description)}
                aria-describedby={touchedProductFields.description && productErrors.description ? "product-description-error" : undefined}
                onBlur={() => touchProductField("description")}
                onChange={(e) =>
                  setProductFormData({ ...productFormData, description: e.target.value })
                }
                placeholder="Describe el producto..."
                rows={3}
              />
              {touchedProductFields.description && productErrors.description ? <span id="product-description-error" className="form-error" role="alert">{productErrors.description}</span> : null}
            </div>

            <div className="form-group">
              <div className="form-group">
                <label htmlFor="product-price">Precio (USD) *</label>
                <input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productFormData.priceUsd}
                  aria-invalid={touchedProductFields.priceUsd && Boolean(productErrors.priceUsd)}
                  aria-describedby={touchedProductFields.priceUsd && productErrors.priceUsd ? "product-price-error" : undefined}
                  onBlur={() => touchProductField("priceUsd")}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, priceUsd: e.target.value })
                  }
                  placeholder="24.99"
                />
                {touchedProductFields.priceUsd && productErrors.priceUsd ? <span id="product-price-error" className="form-error" role="alert">{productErrors.priceUsd}</span> : null}
              </div>

              <div className="form-group">
                <label htmlFor="product-tag">Etiqueta</label>
                <input
                  id="product-tag"
                  type="text"
                  value={productFormData.tag}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, tag: e.target.value })
                  }
                  placeholder="Ej.: Más vendido, premium"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="product-stock">Stock disponible</label>
                <input
                  id="product-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={productFormData.stock}
                  aria-invalid={touchedProductFields.stock && Boolean(productErrors.stock)}
                  aria-describedby={touchedProductFields.stock && productErrors.stock ? "product-stock-error" : undefined}
                  onBlur={() => touchProductField("stock")}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, stock: e.target.value })
                  }
                />
                {touchedProductFields.stock && productErrors.stock ? <span id="product-stock-error" className="form-error" role="alert">{productErrors.stock}</span> : null}
              </div>
              <div className="form-group">
                <label htmlFor="product-minimum-stock">Stock mínimo</label>
                <input
                  id="product-minimum-stock"
                  type="number"
                  min="0"
                  step="1"
                  value={productFormData.minimumStock}
                  aria-invalid={touchedProductFields.minimumStock && Boolean(productErrors.minimumStock)}
                  aria-describedby={touchedProductFields.minimumStock && productErrors.minimumStock ? "product-minimum-stock-error" : undefined}
                  onBlur={() => touchProductField("minimumStock")}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, minimumStock: e.target.value })
                  }
                />
                {touchedProductFields.minimumStock && productErrors.minimumStock ? <span id="product-minimum-stock-error" className="form-error" role="alert">{productErrors.minimumStock}</span> : null}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="product-image-file">Imagen del producto</label>
              {editingProduct?.imageUrl ? (
                <p className="form-help">Foto actual. Puedes conservarla o cargar una nueva.</p>
              ) : (
                <p className="form-help">Carga una imagen desde tu equipo o pega una URL externa.</p>
              )}
              <input
                id="product-image-file"
                type="file"
                accept="image/*"
                disabled={uploadingProductImage}
                onChange={(e) => void handleProductImageUpload(e.target.files?.[0] ?? null)}
              />
              {uploadingProductImage ? <p className="form-help">Cargando imagen...</p> : null}
            </div>

            <div className="form-group">
              <label htmlFor="product-image">URL de imagen</label>
              <input
                id="product-image"
                type="url"
                value={productFormData.imageUrl}
                onChange={(e) =>
                  setProductFormData({ ...productFormData, imageUrl: e.target.value })
                }
                placeholder="https://images.unsplash.com/..."
              />
              {productFormData.imageUrl && (
                <div className="image-preview">
                  <img
                    src={productFormData.imageUrl}
                    alt="Vista previa del producto"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              )}
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="button button-outline"
                onClick={() => closeProductForm()}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="button button-primary"
                disabled={savingProduct !== null || productFormInvalid}
                onClick={() => void handleSaveProduct()}
              >
                {savingProduct !== null ? "Guardando..." : "Guardar producto"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default App;
