import { logger } from "../../../config/logger";

export interface SiretEtablissement {
  siret: string;
  siren: string;
  nom_complet: string;
  nom_raison_sociale: string | null;
  sigle: string | null;
  activite_principale: string | null;
  etat_administratif: "A" | "C";
  date_creation: string | null;
  date_fermeture: string | null;
  adresse: string | null;
  code_postal: string | null;
  ville: string | null;
  departement: string | null;
  region: string | null;
}

export interface VerifySiretResult {
  valid: boolean;
  etablissement?: SiretEtablissement;
  error?: string;
}

export function isValidSiretFormat(siret: string): boolean {
  const cleaned = siret.replace(/\s/g, "");
  if (!/^\d{14}$/.test(cleaned)) return false;
  return luhnCheck(cleaned.slice(0, 9));
}

function luhnCheck(digits: string): boolean {
  let sum = 0;
  let alternate = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }
  return sum % 10 === 0;
}

const API_URL = "https://recherche-entreprises.api.gouv.fr/search";
const TIMEOUT_MS = 8000;

export async function verifySiret(siret: string): Promise<VerifySiretResult> {
  const cleaned = siret.replace(/\s/g, "");

  if (!isValidSiretFormat(cleaned)) {
    return { valid: false, error: "Format SIRET invalide" };
  }

  try {
    const url = API_URL + "?q=" + encodeURIComponent(cleaned) + "&page=1&per_page=1";
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      logger.warn({ status: res.status, siret: cleaned }, "SIRET API non-OK");
      return { valid: false, error: "API gouvernementale indisponible" };
    }

    const data = (await res.json()) as {
      results?: Array<Record<string, unknown>>;
    };

    if (!data.results || data.results.length === 0) {
      return { valid: false, error: "SIRET introuvable dans la base Sirene" };
    }

    const hit = data.results[0];
    const siege = (hit.siege ?? {}) as Record<string, unknown>;
    const siren = (hit.siren as string | undefined) ?? cleaned.slice(0, 9);

    if (siren !== cleaned.slice(0, 9)) {
      return { valid: false, error: "SIRET non trouve" };
    }

    const etablissement: SiretEtablissement = {
      siret: (siege.siret as string | undefined) ?? cleaned,
      siren,
      nom_complet: (hit.nom_complet as string) ?? "",
      nom_raison_sociale: (hit.nom_raison_sociale as string | null) ?? null,
      sigle: (hit.sigle as string | null) ?? null,
      activite_principale: (siege.activite_principale as string | null) ?? null,
      etat_administratif:
        (siege.etat_administratif as string | undefined) === "C" ? "C" : "A",
      date_creation: (siege.date_creation as string | null) ?? null,
      date_fermeture: (siege.date_fermeture as string | null) ?? null,
      adresse: (siege.adresse as string | null) ?? null,
      code_postal: (siege.code_postal as string | null) ?? null,
      ville: (siege.libelle_commune as string | null) ?? null,
      departement: (siege.departement as string | null) ?? null,
      region: (siege.region as string | null) ?? null,
    };

    if (etablissement.etat_administratif === "C") {
      return { valid: false, etablissement, error: "Etablissement cesse" };
    }

    return { valid: true, etablissement };
  } catch (err) {
    logger.error({ err, siret: cleaned }, "Erreur appel API Sirene");
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    return {
      valid: false,
      error: isTimeout ? "API : delai depasse" : "API injoignable",
    };
  }
}
