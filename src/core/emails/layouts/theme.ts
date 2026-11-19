/**
 * Thème visuel ANKU pour les emails transactionnels.
 * Basé sur le design : vert émeraude + olive, fond blanc épuré.
 */

export const BRAND = {
  // Identité visuelle
  logoUrl:
    "https://res.cloudinary.com/tco89xfh/image/upload/v1790589317/anku/branding/logo-anku.png",
  name: "ANKU",

  // Contact & liens
  website: "https://ankucamp.com",
  contactEmail: "contact@ankucamp.com",
  cguUrl: "https://ankucamp.com/cgu",
  privacyUrl: "https://ankucamp.com/confidentialite",
} as const;

export const COLORS = {
  // Marque
  brandGreen: "#10b981", // Vert émeraude (boutons CTA)
  brandOlive: "#7c9d3f", // Vert olive (logo)

  // Fonds
  bgLight: "#f4f4f4", // Fond page
  bgWhite: "#ffffff", // Carte
  bgNeutral: "#f9fafb", // Zones neutres (header tableau, encadré)
  bgInfo: "#eef2ff", // Encadré info (violet clair)

  // Textes
  textDark: "#1f2937",
  textBody: "#4b5563",
  textMuted: "#9ca3af",

  // Bordures
  border: "#e5e7eb",

  // Statuts
  success: "#10b981",
  info: "#6366f1",
  warning: "#f59e0b",
  danger: "#ef4444",
} as const;

export const FONT = {
  family:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
} as const;

export const SIZE = {
  cardWidth: 600,
  cardRadius: 12,
  buttonRadius: 30,
  buttonPaddingY: 14,
  buttonPaddingX: 32,
  logoWidth: 120,
  bodyPadding: 40,
  sectionPadding: 24,
} as const;