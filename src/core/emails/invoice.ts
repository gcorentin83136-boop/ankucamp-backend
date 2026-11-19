import PDFDocument from "pdfkit";
import { AppError } from "../errors/AppError";

// ============================================================
// TYPES
// ============================================================

interface InvoiceItem {
  productName: string;
  quantity: number;
  unitPrice: string; // ex: "49.90"
}

interface InvoiceData {
  invoiceNumber: string;
  orderId: number;
  date: Date;
  buyerName: string;
  buyerEmail: string;
  sellerName: string;
  sellerEmail: string;
  sellerAddress?: string | null;
  items: InvoiceItem[];
  totalPrice: string;
  deliveryMethod: string;
  deliveryAddress: string | null;
  paymentIntentId: string;
  applicationFeeAmount: string;
  sellerAmount: string;
  platformFeePercent: number;
}

// ============================================================
// COULEURS (thème ANKU)
// ============================================================

const COLORS = {
  primary: "#6366f1",
  dark: "#1f2937",
  gray: "#6b7280",
  lightGray: "#f3f4f6",
  border: "#e5e7eb",
  green: "#10b981",
  red: "#ef4444",
};

// ============================================================
// GÉNÉRATION DU PDF
// ============================================================

export async function generateInvoicePdf(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // HEADER
      doc
        .fillColor(COLORS.primary)
        .fontSize(28)
        .font("Helvetica-Bold")
        .text("ANKU", 50, 50);

      doc
        .fillColor(COLORS.dark)
        .fontSize(20)
        .font("Helvetica-Bold")
        .text(`Facture n°${data.invoiceNumber}`, 300, 55, {
          align: "right",
          width: 250,
        });

      doc
        .fillColor(COLORS.gray)
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Émise le ${data.date.toLocaleDateString("fr-FR")}`,
          300,
          80,
          { align: "right", width: 250 }
        );

      doc
        .moveTo(50, 110)
        .lineTo(545, 110)
        .strokeColor(COLORS.primary)
        .lineWidth(2)
        .stroke();

      // INFOS CLIENT + VENDEUR
      let y = 130;

      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("CLIENT", 50, y);

      doc
        .fillColor(COLORS.dark)
        .fontSize(10)
        .font("Helvetica")
        .text(data.buyerName, 50, y + 15)
        .text(data.buyerEmail, 50, y + 30);

      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("VENDEUR", 300, y);

      doc
        .fillColor(COLORS.dark)
        .fontSize(10)
        .font("Helvetica")
        .text(data.sellerName, 300, y + 15)
        .text(data.sellerEmail, 300, y + 30);

      if (data.sellerAddress) {
        doc.text(data.sellerAddress, 300, y + 45);
      }

      y += 100;

      // DÉTAIL DE LA COMMANDE
      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("DÉTAIL DE LA COMMANDE", 50, y);

      y += 20;

      doc.rect(50, y, 495, 25).fillColor(COLORS.lightGray).fill();

      doc
        .fillColor(COLORS.dark)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("Produit", 60, y + 8)
        .text("Qté", 350, y + 8, { width: 50, align: "center" })
        .text("Prix U.", 400, y + 8, { width: 70, align: "right" })
        .text("Total", 480, y + 8, { width: 60, align: "right" });

      y += 25;

      doc.font("Helvetica").fontSize(10);

      for (const item of data.items) {
        const unitPrice = Number(item.unitPrice);
        const lineTotal = unitPrice * item.quantity;

        doc
          .fillColor(COLORS.dark)
          .text(item.productName, 60, y + 8)
          .text(String(item.quantity), 350, y + 8, {
            width: 50,
            align: "center",
          })
          .text(`${unitPrice.toFixed(2)} €`, 400, y + 8, {
            width: 70,
            align: "right",
          })
          .text(`${lineTotal.toFixed(2)} €`, 480, y + 8, {
            width: 60,
            align: "right",
          });

        doc
          .moveTo(50, y + 25)
          .lineTo(545, y + 25)
          .strokeColor(COLORS.border)
          .lineWidth(0.5)
          .stroke();

        y += 25;
      }

      y += 15;

      // TOTAUX
      const totalPrice = Number(data.totalPrice);

      doc
        .fillColor(COLORS.dark)
        .fontSize(11)
        .font("Helvetica-Bold")
        .text("TOTAL PAYÉ PAR LE CLIENT", 300, y, {
          width: 245,
          align: "right",
        });

      doc
        .fontSize(16)
        .fillColor(COLORS.primary)
        .text(`${totalPrice.toFixed(2)} €`, 300, y + 18, {
          width: 245,
          align: "right",
        });

      y += 40;

      // LIVRAISON + PAIEMENT
      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("LIVRAISON", 50, y);

      doc
        .fillColor(COLORS.dark)
        .fontSize(10)
        .font("Helvetica")
        .text(`Mode : ${data.deliveryMethod}`, 50, y + 15);

      if (data.deliveryAddress) {
        doc.text(`Adresse : ${data.deliveryAddress}`, 50, y + 30);
      }

      y += 60;

      doc
        .fillColor(COLORS.gray)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("PAIEMENT", 50, y);

      doc
        .fillColor(COLORS.dark)
        .fontSize(9)
        .font("Helvetica")
        .text(`Transaction Stripe : ${data.paymentIntentId}`, 50, y + 15)
        .text(`Commande : #${data.orderId}`, 50, y + 30);

      // FOOTER
      doc
        .fillColor(COLORS.gray)
        .fontSize(8)
        .font("Helvetica")
        .text(
          `© ${new Date().getFullYear()} ANKU — Tous droits réservés`,
          50,
          770,
          { align: "center", width: 495 }
        );

      doc.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur PDF";
      reject(new AppError(`Échec génération facture : ${message}`, 500));
    }
  });
}

export function generateInvoiceNumber(orderId: number, date = new Date()): string {
  const year = date.getFullYear();
  const padded = String(orderId).padStart(4, "0");
  return `F-${year}-${padded}`;
}