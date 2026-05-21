// Sinnoh Edition - Battle Pass Cancel Screen
export function BattlePassCancel() {
  return (
    <div class="screen battle-pass-cancel">
      <div class="ds-panel" style={{ textAlign: 'center', maxWidth: '400px', margin: '0 auto' }}>
        <div style={{ fontSize: '48px', marginBottom: '20px', opacity: 0.7 }}>
          👁️
        </div>
        
        <h2 style={{ 
          fontSize: '14px', 
          color: '#8090b0', 
          marginBottom: '16px'
        }}>
          PAGO CANCELADO
        </h2>
        
        <div class="ds-textbox" style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '10px', lineHeight: 2 }}>
            Pago cancelado.
          </p>
          <p style={{ fontSize: '9px', color: '#8090b0', marginTop: '12px' }}>
            Arceus sigue observando desde otra dimensión.
          </p>
        </div>
        
        <div style={{ 
          background: 'var(--sinnoh-navy)',
          border: '2px solid var(--sinnoh-border)',
          borderRadius: '4px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <p style={{ fontSize: '8px', color: '#8090b0' }}>
            ¿Qué te perderás?
          </p>
          <ul style={{ textAlign: 'left', fontSize: '8px', listStyle: 'none', padding: 0, marginTop: '12px' }}>
            <li style={{ marginBottom: '6px', opacity: 0.6 }}>✗ Sprites shiny de Pokémon</li>
            <li style={{ marginBottom: '6px', opacity: 0.6 }}>✗ Arceus canónicamente correcto</li>
            <li style={{ opacity: 0.6 }}>✗ Mensaje especial al final de la batalla</li>
          </ul>
        </div>
        
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
          <button 
            class="ds-button"
            onClick={() => { window.location.href = '/'; }}
          >
            VOLVER AL INICIO
          </button>
          <button 
            class="ds-button gold"
            onClick={() => { window.location.href = '/?buy=battle-pass'; }}
          >
            INTENTAR DE NUEVO
          </button>
        </div>
      </div>
    </div>
  );
}
