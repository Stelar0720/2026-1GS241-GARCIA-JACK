import { Link, createRootRoute } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { API_URL } from '~/lib/api-client';
import { equipSkin, getEquippedSkin, getOwnedSkins } from '~/lib/skin-storage';
import { skins, type SkinId } from '~/lib/skins';

export const Route = createRootRoute({
  component: ShopPage,
});

function ShopPage() {
  const [ownedSkins, setOwnedSkins] = useState<SkinId[]>(['classic']);
  const [equippedSkin, setEquippedSkin] = useState<SkinId>('classic');
  const [buyingSkin, setBuyingSkin] = useState<SkinId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [clerkId, setClerkId] = useState<string | null>(null);

  useEffect(() => {
    const savedClerkId = localStorage.getItem('clerkId');
    setClerkId(savedClerkId);
    setOwnedSkins(getOwnedSkins(savedClerkId));
    setEquippedSkin(getEquippedSkin(savedClerkId));
  }, []);

  const handleEquip = (skinId: SkinId) => {
    equipSkin(skinId, clerkId);
    setEquippedSkin(getEquippedSkin(clerkId));
  };

  const handleBuy = async (skinId: SkinId) => {
    if (!clerkId) {
      setError('Debes iniciar sesion para comprar skins.');
      return;
    }

    try {
      setBuyingSkin(skinId);
      setError(null);
      const response = await fetch(`${API_URL}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skinId, clerkId }),
      });
      const data = await response.json();

      if (!response.ok || !data.url) {
        throw new Error(data.error || 'No se pudo crear la sesion de pago');
      }

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al iniciar el pago');
      setBuyingSkin(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between gap-4 mb-6">
          <Link to="/" className="peak-button text-sm">Volver</Link>
          <h1 className="peak-title text-3xl text-amber-900 text-center">Tienda de Skins</h1>
          <div className="peak-paper peak-border px-4 py-2">
            <p className="peak-text text-sm">Equipada: {skins.find((skin) => skin.id === equippedSkin)?.name}</p>
          </div>
        </div>

        {error && (
          <div className="peak-paper peak-border p-4 mb-6">
            <p className="peak-text text-red-700">{error}</p>
          </div>
        )}

        {!clerkId && (
          <div className="peak-paper peak-border p-4 mb-6">
            <p className="peak-text text-amber-900">Inicia sesion para comprar skins. La skin Classic sigue disponible por defecto.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {skins.map((skin) => {
            const isOwned = ownedSkins.includes(skin.id);
            const isEquipped = equippedSkin === skin.id;

            return (
              <article key={skin.id} className="peak-paper peak-border p-4">
                <div className="relative mb-4">
                  <img
                    src={skin.assets.preview}
                    alt={`Vista previa de ${skin.name}`}
                    className="w-full aspect-square object-contain bg-amber-950/10 rounded"
                  />
                  {isEquipped && (
                    <span className="absolute top-2 right-2 peak-text bg-green-700 text-white px-3 py-1 rounded">
                      Equipada
                    </span>
                  )}
                </div>
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <h2 className="peak-title text-xl text-amber-950">{skin.name}</h2>
                    <p className="peak-text text-gray-700">{skin.price === 0 ? 'Gratis' : '$2.99 USD'}</p>
                  </div>
                  <img
                    src={isOwned ? '/assets/shop/skin_unlocked.png' : '/assets/shop/skin_locked.png'}
                    alt={isOwned ? 'Desbloqueada' : 'Bloqueada'}
                    className="w-10 h-10 object-contain"
                  />
                </div>

                {isOwned ? (
                  <button
                    className="peak-button w-full disabled:opacity-60 disabled:cursor-default"
                    disabled={isEquipped}
                    onClick={() => handleEquip(skin.id)}
                  >
                    {isEquipped ? 'Equipada' : 'Equipar'}
                  </button>
                ) : (
                  <button
                    className="peak-button w-full disabled:opacity-60"
                    disabled={buyingSkin === skin.id}
                    onClick={() => handleBuy(skin.id)}
                  >
                    {buyingSkin === skin.id ? 'Abriendo Checkout...' : 'Comprar $2.99'}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
