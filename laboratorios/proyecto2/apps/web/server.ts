// Simple static file server with Bun
const distDir = "./dist";
const publicDir = "./public";
const port = parseInt(process.env.PORT || "5173");

function readRootEnv(key: string) {
  try {
    const envText = Bun.file("../../.env").text();
    return envText.then(text => {
      const line = text.split(/\r?\n/).find(entry => entry.startsWith(`${key}=`));
      return line?.slice(key.length + 1).trim() || "";
    });
  } catch {
    return Promise.resolve("");
  }
}

const clerkPublishableKey =
  process.env.VITE_CLERK_PUBLISHABLE_KEY ||
  await readRootEnv("VITE_CLERK_PUBLISHABLE_KEY");
const stripePublicKey =
  process.env.VITE_STRIPE_PUBLIC_KEY ||
  await readRootEnv("VITE_STRIPE_PUBLIC_KEY");

const publicEnv = {
  VITE_CLERK_PUBLISHABLE_KEY: clerkPublishableKey,
  VITE_STRIPE_PUBLIC_KEY: stripePublicKey
};

async function htmlResponse(filePath: string) {
  const html = await Bun.file(filePath).text();
  return new Response(
    html.replace("__PUBLIC_ENV_JSON__", JSON.stringify(publicEnv).replace(/</g, "\\u003c")),
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    let filePath = distDir + url.pathname;

    if (url.pathname.startsWith("/assets/")) {
      const publicFilePath = publicDir + url.pathname;
      const publicFile = Bun.file(publicFilePath);

      if (publicFile.size > 0) {
        const headers = new Headers();
        if (publicFilePath.endsWith(".png")) {
          headers.set("Content-Type", "image/png");
        }
        return new Response(publicFile, { headers });
      }
    }
    
    if (url.pathname === "/") {
      filePath = distDir + "/index.html";
    }
    
    const file = Bun.file(filePath);
    
    if (file.size > 0) {
      const headers = new Headers();
      
      if (filePath.endsWith(".html")) {
        return htmlResponse(filePath);
      } else if (filePath.endsWith(".css")) {
        headers.set("Content-Type", "text/css");
      } else if (filePath.endsWith(".js")) {
        headers.set("Content-Type", "application/javascript");
      } else if (filePath.endsWith(".ico")) {
        headers.set("Content-Type", "image/x-icon");
      }
      
      return new Response(file, { headers });
    }
    
    // Fallback to index.html for SPA routing
    return htmlResponse(distDir + "/index.html");
  }
});

console.log("====================================");
console.log("  CHECKERS - Frontend Server");
console.log(`  http://localhost:${port}`);
console.log("====================================");
