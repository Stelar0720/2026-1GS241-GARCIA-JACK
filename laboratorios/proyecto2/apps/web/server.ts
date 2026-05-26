// Simple static file server with Bun
const distDir = "./dist";
const port = parseInt(process.env.PORT || "5173");

Bun.serve({
  port,
  fetch(req) {
    const url = new URL(req.url);
    let filePath = distDir + url.pathname;
    
    if (url.pathname === "/") {
      filePath = distDir + "/index.html";
    }
    
    const file = Bun.file(filePath);
    
    if (file.size > 0) {
      const headers = new Headers();
      
      if (filePath.endsWith(".html")) {
        headers.set("Content-Type", "text/html; charset=utf-8");
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
    const indexFile = Bun.file(distDir + "/index.html");
    return new Response(indexFile, {
      headers: { "Content-Type": "text/html; charset=utf-8" }
    });
  }
});

console.log("====================================");
console.log("  CHECKERS - Frontend Server");
console.log(`  http://localhost:${port}`);
console.log("====================================");
