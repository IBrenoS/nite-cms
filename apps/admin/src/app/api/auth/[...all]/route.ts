import { toNextJsHandler } from "better-auth/next-js";

import { readAdminConfiguration } from "@/lib/auth-config";
import { getAuth } from "@/lib/auth";

async function handle(request: Request) {
  const configuration = readAdminConfiguration(process.env);
  if (!configuration.configured) {
    return Response.json(
      { error: "Autenticação administrativa não configurada." },
      { status: 503 },
    );
  }

  const handlers = toNextJsHandler(getAuth(configuration.configuration));
  const method = request.method as keyof typeof handlers;
  const handler = handlers[method];
  return handler ? handler(request) : new Response(null, { status: 405 });
}

export {
  handle as GET,
  handle as POST,
  handle as PATCH,
  handle as PUT,
  handle as DELETE,
};
