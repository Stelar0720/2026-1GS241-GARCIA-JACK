import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

// ============================================
// TYPES
// ============================================

type Order = {
  id: string;
  checkoutSessionId: string;
  productId: string;
  buyerId: string;
  status: "pending" | "paid" | "cancelled";
  amountUsd: number;
  createdAt: string;
  updatedAt: string;
};

type InventoryItem = {
  sku: string;
  stock: number;
  minimumStock: number;
  updatedAt: string;
};

type Product = {
  id: string;
  name: string;
  description: string;
  priceUsd: number;
  tag: string;
  imageUrl: string;
  active: number;
  createdAt: string;
  updatedAt: string;
};

type ProductFormData = {
  name: string;
  description: string;
  priceUsd: string;
  tag: string;
  imageUrl: string;
};

// ============================================
// CONSTANTS
// ============================================

const ORDER_STATUSES: Order["status"][] = ["pending", "paid", "cancelled"];
const ORDER_STATUS_LABELS: Record<Order["status"], string> = {
  pending: "Pendiente (sin pago)",
  paid: "Pagada",
  cancelled: "Cancelada",
};

// ============================================
// MAIN APP COMPONENT
// ============================================

function App({ clerkEnabled }: { clerkEnabled: boolean }) {
  const apiBaseUrl = useMemo(() => import.meta.env.VITE_API_URL ?? "http://localhost:4000", []);
  const [orders, setOrders] = useState<Order[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState<string | null>(null);
  const [savingSku, setSavingSku] = useState<string | null>(null);
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
  });

  const loadData = useCallback(async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [ordersResponse, inventoryResponse, productsResponse] = await Promise.all([
        fetch(`${apiBaseUrl}/orders`),
        fetch(`${apiBaseUrl}/inventory`),
        fetch(`${apiBaseUrl}/products?includeInactive=true`),
      ]);

      if (!ordersResponse.ok || !inventoryResponse.ok || !productsResponse.ok) {
        throw new Error("No se pudo cargar la información del backoffice.");
      }

      const ordersBody = (await ordersResponse.json()) as { data: Order[] };
      const inventoryBody = (await inventoryResponse.json()) as { data: InventoryItem[] };
      const productsBody = (await productsResponse.json()) as { data: Product[] };

      setOrders(ordersBody.data);
      setInventory(inventoryBody.data);
      setProducts(productsBody.data);
    } catch (fetchError) {
      const message =
        fetchError instanceof Error
          ? fetchError.message
          : "Ocurrió un error desconocido al cargar el backoffice.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadData();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadData]);

  // ============================================
  // ORDER HANDLERS
  // ============================================

  async function updateOrderStatus(orderId: string, status: Order["status"]) {
    setSavingOrder(orderId);
    try {
      const response = await fetch(`${apiBaseUrl}/orders/${orderId}`, {
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

  // ============================================
  // INVENTORY HANDLERS
  // ============================================

  async function updateInventoryStock(sku: string, stock: number, minimumStock: number) {
    setSavingSku(sku);
    try {
      const response = await fetch(`${apiBaseUrl}/inventory/${encodeURIComponent(sku)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stock, minimumStock }),
      });

      if (!response.ok) {
        throw new Error("No se pudo actualizar el inventario.");
      }

      await loadData();
    } catch (updateError) {
      const message =
        updateError instanceof Error ? updateError.message : "Error al actualizar inventario.";
      setError(message);
    } finally {
      setSavingSku(null);
    }
  }

  // ============================================
  // PRODUCT HANDLERS
  // ============================================

  function openNewProductForm() {
    setEditingProduct(null);
    setProductFormData({ name: "", description: "", priceUsd: "", tag: "", imageUrl: "" });
    setShowProductForm(true);
  }

  function openEditProductForm(product: Product) {
    setEditingProduct(product);
    setProductFormData({
      name: product.name,
      description: product.description,
      priceUsd: product.priceUsd.toString(),
      tag: product.tag,
      imageUrl: product.imageUrl,
    });
    setShowProductForm(true);
  }

  function closeProductForm() {
    setShowProductForm(false);
    setEditingProduct(null);
    setProductFormData({ name: "", description: "", priceUsd: "", tag: "", imageUrl: "" });
  }

  async function handleSaveProduct() {
    const price = parseFloat(productFormData.priceUsd);
    if (isNaN(price) || price <= 0) {
      setError("El precio debe ser un número positivo.");
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

      const response = await fetch(url, {
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
        const errorData = (await response.json()) as { error?: string };
        throw new Error(errorData.error ?? "No se pudo guardar el producto.");
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
      const response = await fetch(`${apiBaseUrl}/products/${productId}`, {
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

      const response = await fetch(`${apiBaseUrl}/uploads/product-image`, {
        method: "POST",
        body: formData,
      });

      const body = (await response.json()) as { imageUrl?: string; error?: string };
      if (!response.ok || !body.imageUrl) {
        throw new Error(body.error ?? "No se pudo cargar la imagen del producto.");
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
            <div className="table">
              <div className="table-row table-head">
                <span>ID</span>
                <span>Producto</span>
                <span>Comprador</span>
                <span>Monto</span>
                <span>Estado</span>
              </div>
              {orders.length === 0 ? (
                <p className="empty">No hay órdenes registradas.</p>
              ) : (
                orders.map((order) => (
                  <div className="table-row" key={order.id}>
                    <span className="order-id">{order.id.substring(0, 8)}...</span>
                    <span>{order.productId}</span>
                    <span className="buyer-id">{order.buyerId}</span>
                    <span className="amount">${order.amountUsd.toFixed(2)}</span>
                    <span>
                      <select
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
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          {/* ============================================ */}
          {/* INVENTORY SECTION */}
          {/* ============================================ */}
          <section className="panel">
            <h2>Inventario</h2>
            <div className="table">
              <div className="table-row table-head">
                <span>SKU</span>
                <span>Stock</span>
                <span>Mínimo</span>
                <span>Acción</span>
              </div>
              {inventory.length === 0 ? (
                <p className="empty">No hay ítems de inventario registrados.</p>
              ) : (
                inventory.map((item) => (
                  <InventoryRow
                    key={`${item.sku}-${item.stock}-${item.minimumStock}`}
                    item={item}
                    saving={savingSku === item.sku}
                    onSave={(stock, minimumStock) =>
                      void updateInventoryStock(item.sku, stock, minimumStock)
                    }
                  />
                ))
              )}
            </div>
          </section>
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
                onChange={(e) =>
                  setProductFormData({ ...productFormData, name: e.target.value })
                }
                placeholder="Ej.: Kit balcón básico"
              />
            </div>

            <div className="form-group">
              <label htmlFor="product-description">Descripción *</label>
              <textarea
                id="product-description"
                value={productFormData.description}
                onChange={(e) =>
                  setProductFormData({ ...productFormData, description: e.target.value })
                }
                placeholder="Describe el producto..."
                rows={3}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="product-price">Precio (USD) *</label>
                <input
                  id="product-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={productFormData.priceUsd}
                  onChange={(e) =>
                    setProductFormData({ ...productFormData, priceUsd: e.target.value })
                  }
                  placeholder="24.99"
                />
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
                disabled={savingProduct !== null}
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

// ============================================
// INVENTORY ROW COMPONENT
// ============================================

function InventoryRow({
  item,
  saving,
  onSave,
}: {
  item: InventoryItem;
  saving: boolean;
  onSave: (stock: number, minimumStock: number) => void;
}) {
  const [stock, setStock] = useState(item.stock);
  const [minimumStock, setMinimumStock] = useState(item.minimumStock);

  const lowStock = stock <= minimumStock;

  return (
    <div className="table-row">
      <span className="sku">{item.sku}</span>
      <span>
        <input
          type="number"
          value={stock}
          min={0}
          onChange={(event) => setStock(Number(event.target.value))}
        />
      </span>
      <span>
        <input
          type="number"
          value={minimumStock}
          min={0}
          onChange={(event) => setMinimumStock(Number(event.target.value))}
        />
      </span>
      <span className="inventory-actions">
        <button
          className="button button-primary"
          disabled={saving}
          onClick={() => onSave(stock, minimumStock)}
        >
          {saving ? "..." : "Guardar"}
        </button>
        {lowStock ? <small className="low-stock">Stock bajo</small> : null}
      </span>
    </div>
  );
}

export default App;
