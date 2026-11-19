import { logger } from "../../../config/logger";
import { AppError } from "../../errors/AppError";

export interface GeocodeResult {
  latitude: number;
  longitude: number;
  label: string;
  city: string;
  postal_code: string;
  score: number;
}

const API_URL = "https://api-adresse.data.gouv.fr/search";
const TIMEOUT_MS = 8000;

export async function geocodeAddress(
  address: string
): Promise<GeocodeResult> {
  const url = `${API_URL}/?q=${encodeURIComponent(address)}&limit=1`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      logger.warn(
        { status: res.status, address },
        "Geocoding API non-OK"
      );
      throw new AppError(
        `API gouvernementale indisponible (${res.status})`,
        502
      );
    }

    const data = (await res.json()) as {
      features?: Array<{
        properties: {
          label: string;
          city: string;
          postcode: string;
          score: number;
        };
        geometry: { coordinates: [number, number] };
      }>;
    };

    if (!data.features || data.features.length === 0) {
      throw new AppError("Adresse introuvable", 404);
    }

    const hit = data.features[0];
    const [lng, lat] = hit.geometry.coordinates;

    return {
      latitude: lat,
      longitude: lng,
      label: hit.properties.label,
      city: hit.properties.city,
      postal_code: hit.properties.postcode,
      score: hit.properties.score,
    };
  } catch (err) {
    if (err instanceof AppError) throw err;

    logger.error({ err, address }, "Erreur API geocoding");
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    throw new AppError(
      isTimeout
        ? "API geocoding : délai dépassé"
        : "Impossible de contacter l'API geocoding",
      502
    );
  }
}