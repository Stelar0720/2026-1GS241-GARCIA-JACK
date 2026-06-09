import { Link, createRootRoute } from '@tanstack/react-start';
import { useEffect, useState } from 'react';
import { addOwnedSkin, equipSkin } from '~/lib/skin-storage';
import { getSkinById, type SkinId } from '~/lib/skins';

export const Route = createRootRoute({
  component: ShopSuccessPage,
});

function ShopSuccessPage() {
  const [skinName, setSkinName] = useState('Skin');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const clerkId = localStorage.getItem('clerkId');
    const skin = getSkinById(params.get('skinId'));
    const skinId = skin.id as SkinId;

    if (skinId !== 'classic' && clerkId) {
      addOwnedSkin(skinId, clerkId);
      equipSkin(skinId, clerkId);
    }

    setSkinName(skin.name);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-100 to-amber-200 p-4 flex items-center justify-center">
      <div className="peak-paper peak-border p-8 text-center max-w-md">
        <img src="/assets/shop/payment_success.png" alt="Pago exitoso" className="w-24 h-24 object-contain mx-auto mb-4" />
        <h1 className="peak-title text-2xl text-amber-900 mb-3">Compra exitosa</h1>
        <p className="peak-text text-lg mb-6">{skinName} fue desbloqueada y equipada.</p>
        <div className="flex gap-3 justify-center">
          <Link to="/shop" className="peak-button">Tienda</Link>
          <Link to="/game" className="peak-button">Jugar</Link>
        </div>
      </div>
    </div>
  );
}
