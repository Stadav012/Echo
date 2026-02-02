/**
 * Survey AI Backend Server
 * 
 * This is the main entry point for the Survey AI backend.
 * It sets up an HTTP server using Bun that handles API requests.
 */

const PORT = process.env.PORT || 3001;

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);

    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    // Health check endpoint
    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", message: "Survey AI Backend is running" }),
        { headers }
      );
    }

    // API routes
    if (url.pathname === "/api/survey") {
      if (req.method === "GET") {
        return new Response(
          JSON.stringify({
            message: "Survey endpoint",
            surveys: [],
          }),
          { headers }
        );
      }

      if (req.method === "POST") {
        const body = await req.json();
        return new Response(
          JSON.stringify({
            message: "Survey created",
            data: body,
          }),
          { headers, status: 201 }
        );
      }
    }

    // Voice endpoint placeholder
    if (url.pathname === "/api/voice") {
      return new Response(
        JSON.stringify({
          message: "Voice processing endpoint - coming soon",
        }),
        { headers }
      );
    }

    // 404 handler
    return new Response(
      JSON.stringify({ error: "Not found" }),
      { headers, status: 404 }
    );
  },
});

console.log(`🚀 Survey AI Backend running at http://localhost:${server.port}`);
