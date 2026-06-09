import { Link, createRootRoute } from '@tanstack/react-start';

export const Route = createRootRoute({
  component: ShopCancelPage,
});

function ShopCancelPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4 flex items-center justify-center">
      <div className="peak-paper peak-border p-8 text-center max-w-md">
        <img src="/assets/shop/payment_failed.png" alt="Pago cancelado" className="w-24 h-24 object-contain mx-auto mb-4" />
        <h1 className="peak-title text-2xl text-amber-900 mb-3">Pago cancelado</h1>
        <p className="peak-text text-lg mb-6">No se desbloqueo ninguna skin.</p>
        <Link to="/shop" className="peak-button">Volver a la tienda</Link>
      </div>
    </div>
  );
}
