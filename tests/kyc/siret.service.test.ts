import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isValidSiretFormat,
  verifySiret,
} from "../../src/core/api/kyc/siret.service";

const VALID_SIRET = "35600000000048";

describe("siret.service - isValidSiretFormat", () => {
  it("accepte un SIRET valide avec Luhn OK", () => {
    expect(isValidSiretFormat(VALID_SIRET)).toBe(true);
  });

  it("refuse un SIRET trop court", () => {
    expect(isValidSiretFormat("12345")).toBe(false);
  });

  it("refuse un SIRET avec lettres", () => {
    expect(isValidSiretFormat("1234567890ABCD")).toBe(false);
  });

  it("accepte un SIRET avec espaces (nettoyage)", () => {
    expect(isValidSiretFormat("356 000 000 00048")).toBe(true);
  });
});

describe("siret.service - verifySiret", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("retourne invalide si format KO (pas d'appel API)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    const result = await verifySiret("invalid");
    expect(result.valid).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("retourne invalide si API renvoie 0 resultat", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ results: [], total_results: 0 }), {
        status: 200,
      })
    );
    const result = await verifySiret(VALID_SIRET);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/introuvable/i);
  });

  it("retourne valide si API renvoie un etablissement actif", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              siren: "356000000",
              nom_complet: "LA POSTE",
              nom_raison_sociale: "LA POSTE",
              siege: {
                siret: VALID_SIRET,
                activite_principale: "53.10Z",
                etat_administratif: "A",
                date_creation: "1991-01-01",
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    const result = await verifySiret(VALID_SIRET);
    expect(result.valid).toBe(true);
    expect(result.etablissement?.nom_complet).toBe("LA POSTE");
  });

  it("retourne invalide si etablissement cesse", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              siren: "356000000",
              nom_complet: "LA POSTE",
              siege: {
                siret: VALID_SIRET,
                etat_administratif: "C",
              },
            },
          ],
        }),
        { status: 200 }
      )
    );
    const result = await verifySiret(VALID_SIRET);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/cesse/i);
  });

  it("retourne invalide si API 500", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response("", { status: 500 })
    );
    const result = await verifySiret(VALID_SIRET);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/indisponible/i);
  });

  it("gere le timeout reseau", async () => {
    vi.spyOn(global, "fetch").mockRejectedValue(
      Object.assign(new Error("timeout"), { name: "TimeoutError" })
    );
    const result = await verifySiret(VALID_SIRET);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/delai/i);
  });
});