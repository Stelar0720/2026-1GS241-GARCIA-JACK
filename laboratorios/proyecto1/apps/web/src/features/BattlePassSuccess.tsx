// Sinnoh Edition - Battle Pass Success Screen
import { useEffect, useState } from 'preact/hooks';
import { verifyBattlePassPurchase } from '../lib/api';

interface BattlePassSuccessProps {
  authUserId: string | null;
}

export function BattlePassSuccess({ authUserId }: BattlePassSuccessProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const verifyPurchase = async () => {
      if (!authUserId) {
        setError('Inicia sesion para activar el Battle Pass en tu usuario.');
        setLoading(false);
        return;
      }

      const searchParams = new URLSearchParams(window.location.search);
      const sessionId = searchParams.get('session_id');
      
      if (sessionId) {
        // Verify with backend
        const success = await verifyBattlePassPurchase(sessionId, authUserId);
        if (success) {
          setLoading(false);
          return;
        }
      }
      
      setError('No se pudo verificar la transaccion del Battle Pass para este usuario.');
      setLoading(false);
    };

    verifyPurchase();
  }, [authUserId]);

  if (loading) {
    return (
      <div class="screen battle-pass-success">
        <div class="ds-panel" style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
          <div class="loading-spinner" style={{ margin: '0 auto 20px' }} />
          <p style={{ fontSize: '10px' }}>Activando Battle Pass...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div class="screen battle-pass-success">
        <div class="ds-panel" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '16px', color: 'var(--sinnoh-danger)', marginBottom: '16px' }}>
            NO SE PUDO ACTIVAR
          </h2>
          <div class="ds-textbox" style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', lineHeight: 2, color: 'var(--sinnoh-danger)' }}>{error}</p>
          </div>
          <button
            class="ds-button gold"
            onClick={() => { window.location.href = '/'; }}
            style={{ marginTop: '10px' }}
          >
            VOLVER AL INICIO
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="screen battle-pass-success">
      <div class="ds-panel" style={{ textAlign: 'center', maxWidth: '500px', margin: '0 auto' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px' }}>
          ⚡
        </div>
        
        <h2 style={{ 
          fontSize: '16px', 
          color: '#d9c25f', 
          marginBottom: '16px',
          textShadow: '0 0 10px rgba(217, 194, 95, 0.5)'
        }}>
          BATTLE PASS ACTIVADO
        </h2>
        
        <div class="ds-textbox" style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '10px', lineHeight: 2 }}>
            El espacio-tiempo empieza a romperse.
          </p>
          <p style={{ fontSize: '9px', color: '#6ea8ff', marginTop: '12px' }}>
            Ahora puedes usar Pokémon shiny y acceder al Arceus canónicamente correcto.
          </p>
        </div>
        
        <div style={{ 
          background: 'var(--sinnoh-navy)',
          border: '2px solid var(--sinnoh-gold)',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '8px', color: '#6ea8ff', marginBottom: '8px' }}>
            CONTENIDO DESBLOQUEADO:
          </p>
          <ul style={{ textAlign: 'left', fontSize: '8px', listStyle: 'none', padding: 0 }}>
            <li style={{ marginBottom: '6px' }}>✓ Sprites shiny de Pokémon</li>
            <li style={{ marginBottom: '6px' }}>✓ Arceus canónicamente correcto</li>
            <li>✓ Mensaje especial al final de la batalla</li>
          </ul>
        </div>
        
        <button 
          class="ds-button gold"
          onClick={() => { window.location.href = '/'; }}
          style={{ marginTop: '10px' }}
        >
          VOLVER AL INICIO
        </button>
      </div>
    </div>
  );
}
