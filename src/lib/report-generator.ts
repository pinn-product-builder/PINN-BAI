import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Branding white-label do PDF. Resolvido pelo caller a partir de
 * organizations.settings.pdf_branding (override) com fallback p/ os dados da
 * própria org (name/primary_color). Sem isso, o relatório saía sempre "PINN".
 */
export interface ReportBranding {
    brandName?: string;       // título da marca no header (default: nome da org)
    brandSubtitle?: string;   // linha sob a marca (default: vazio)
    brandColorHex?: string;   // cor de destaque '#RRGGBB' (default: cor da org)
    footerText?: string;      // rodapé esquerdo→direito (default: 'Confidencial')
}

export interface ReportOptions {
    title: string;
    organizationName: string;
    aiSnapshot?: string;
    fileName?: string;
    branding?: ReportBranding;
}

/** '#RRGGBB' | '#RGB' → [r,g,b]; null se inválido. */
function hexToRgb(hex?: string): [number, number, number] | null {
    if (!hex) return null;
    const m = hex.trim().replace(/^#/, '');
    const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
    if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
    return [
        parseInt(full.slice(0, 2), 16),
        parseInt(full.slice(2, 4), 16),
        parseInt(full.slice(4, 6), 16),
    ];
}

export class ReportGenerator {
    /**
     * Generates a branded PDF report from a dashboard element
     * @param elementId The ID of the HTML element to capture
     * @param options Configuration for the report
     */
    static async generateDashboardPDF(elementId: string, options: ReportOptions): Promise<void> {
        const element = document.getElementById(elementId);
        if (!element) {
            throw new Error(`Element with id ${elementId} not found`);
        }

        // Optimization: Add a temporary class for PDF rendering if needed
        element.classList.add('rendering-pdf');

        try {
            const canvas = await html2canvas(element, {
                scale: 2, // Higher quality
                useCORS: true,
                backgroundColor: '#050505', // Match our Deep Space theme
                logging: false,
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4',
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = pdf.internal.pageSize.getHeight();

            const imgProps = pdf.getImageProperties(imgData);
            const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;

            // --- Branding resolvido (white-label) ---
            const b = options.branding ?? {};
            const brandName = (b.brandName || options.organizationName || 'Relatório').toUpperCase();
            const brandSubtitle = b.brandSubtitle ?? '';
            const [br, bg, bb] = hexToRgb(b.brandColorHex) ?? [255, 107, 53];
            const footerText = b.footerText || 'Confidencial';

            // --- Header ---
            pdf.setFillColor(5, 5, 5); // #050505
            pdf.rect(0, 0, pdfWidth, 40, 'F');

            pdf.setTextColor(br, bg, bb); // cor de destaque da org
            pdf.setFontSize(22);
            pdf.setFont('helvetica', 'bold');
            pdf.text(brandName, 15, 20);

            if (brandSubtitle) {
                pdf.setTextColor(255, 255, 255);
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'normal');
                pdf.text(brandSubtitle, 15, 25);
            }

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(14);
            pdf.text(options.title.toUpperCase(), pdfWidth - 15, 20, { align: 'right' });
            pdf.setFontSize(10);
            pdf.text(options.organizationName, pdfWidth - 15, 28, { align: 'right' });

            // --- AI Snapshot Section ---
            if (options.aiSnapshot) {
                pdf.setFillColor(20, 20, 20); // Slightly lighter dark
                pdf.roundedRect(10, 45, pdfWidth - 20, 35, 3, 3, 'F');

                pdf.setTextColor(br, bg, bb);
                pdf.setFontSize(9);
                pdf.setFont('helvetica', 'bold');
                pdf.text('AI EXECUTIVE BRIEFING', 15, 52);

                pdf.setTextColor(230, 230, 230);
                pdf.setFontSize(10);
                pdf.setFont('helvetica', 'italic');

                // Wrap text
                const splitText = pdf.splitTextToSize(options.aiSnapshot, pdfWidth - 30);
                pdf.text(splitText, 15, 60);
            }

            // --- Dashboard Image ---
            const contentY = options.aiSnapshot ? 85 : 45;
            pdf.addImage(imgData, 'PNG', 10, contentY, pdfWidth - 20, imgHeight * ((pdfWidth - 20) / pdfWidth));

            // --- Footer ---
            const footerY = pdfHeight - 10;
            pdf.setFontSize(8);
            pdf.setTextColor(100, 100, 100);
            pdf.text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, 15, footerY);
            pdf.text(footerText, pdfWidth - 15, footerY, { align: 'right' });

            pdf.save(options.fileName || `Relatorio-${options.organizationName}-${Date.now()}.pdf`);
        } finally {
            element.classList.remove('rendering-pdf');
        }
    }
}
