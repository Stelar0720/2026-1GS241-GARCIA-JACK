import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { getClerkPublishableKey, isClerkConfigured, validateStorefrontEnvironment } from "@/lib/env";
import { LocaleProvider } from "@/components/locale";
import { resolveInitialLocale } from "@/lib/i18n";
import "@/styles.css";

validateStorefrontEnvironment();
const publishableKey = getClerkPublishableKey();
const clerkEnabled = import.meta.env.VITE_E2E !== "true" && isClerkConfigured();

// El atributo lang debe reflejar el idioma elegido desde el primer render:
// lectores de pantalla y traductores automáticos se guían por él.
document.documentElement.lang = resolveInitialLocale();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <LocaleProvider>
      {clerkEnabled && publishableKey ? (
        <ClerkProvider publishableKey={publishableKey}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </ClerkProvider>
      ) : (
        <BrowserRouter>
          <App />
        </BrowserRouter>
      )}
    </LocaleProvider>
  </StrictMode>,
);
