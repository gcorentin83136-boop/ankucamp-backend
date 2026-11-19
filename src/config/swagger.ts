import fs from "fs";
import path from "path";
import YAML from "yaml";
import swaggerUi from "swagger-ui-express";
import type { Express } from "express";
import { env } from "./env";
import { logger } from "./logger";

/**
 * Monte Swagger UI sur /api-docs.
 * Charge le fichier src/docs/openapi.yaml.
 */
export function setupSwagger(app: Express) {
  const specPath = path.resolve(process.cwd(), "src/docs/openapi.yaml");

  if (!fs.existsSync(specPath)) {
    logger.warn(
      "⚠️  src/docs/openapi.yaml introuvable, /api-docs désactivé."
    );
    return;
  }

  const yamlContent = fs.readFileSync(specPath, "utf8");
  const spec = YAML.parse(yamlContent);

  // Renseigne dynamiquement l'URL du serveur selon l'environnement
  if (!spec.servers || spec.servers.length === 0) {
    spec.servers = [
      {
        url:
          env.NODE_ENV === "production"
            ? "https://api.ankucamp.com"
            : `http://localhost:${env.PORT}`,
        description:
          env.NODE_ENV === "production" ? "Production" : "Développement",
      },
    ];
  }

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(spec, {
      customCss: ".swagger-ui .topbar { display: none }",
      customSiteTitle: "ANKUCAMP API",
    })
  );

  // Endpoint JSON brut de la spec (utile pour Postman/Insomnia)
  app.get("/api-docs.json", (_req, res) => {
    res.json(spec);
  });

  logger.info("📖 Swagger UI monté sur /api-docs");
}