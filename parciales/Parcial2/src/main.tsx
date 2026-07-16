import { ClerkProvider } from "@clerk/clerk-react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/App";
import { getClerkPublishableKey, isClerkConfigured, validateStorefrontEnvironment } from "@/lib/env";
import "@/styles.css";

validateStorefrontEnvironment();
const publishableKey = getClerkPublishableKey();
const clerkEnabled = import.meta.env.VITE_E2E !== "true" && isClerkConfigured();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
  </StrictMode>,
);
