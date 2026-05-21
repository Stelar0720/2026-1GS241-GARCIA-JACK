import { render } from 'preact';
import { ClerkProvider } from '@clerk/clerk-react';
import { useUser } from '@clerk/clerk-react';
import { App } from './App';
import './styles/global.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkConfigured = Boolean(
  clerkPublishableKey &&
    !clerkPublishableKey.includes('your_clerk') &&
    clerkPublishableKey !== 'pk_test_placeholder'
);

function ClerkAwareApp() {
  const { isLoaded, user } = useUser();
  if (!isLoaded) {
    return (
      <div class="app-container">
        <div class="ds-panel" style={{ textAlign: 'center' }}>
          <p style={{ fontSize: '10px' }}>Cargando sesion...</p>
        </div>
      </div>
    );
  }

  const name =
    user?.fullName ||
    user?.username ||
    user?.primaryEmailAddress?.emailAddress?.split('@')[0] ||
    '';

  return (
    <App
      authEnabled
      authenticatedUser={user ? {
        id: user.id,
        name,
        email: user.primaryEmailAddress?.emailAddress || '',
      } : null}
    />
  );
}

render(
  clerkConfigured ? (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <ClerkAwareApp />
    </ClerkProvider>
  ) : (
    <App authEnabled={false} authenticatedUser={null} />
  ),
  document.getElementById('app')!
);
