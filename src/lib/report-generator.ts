import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

export interface ReportOptions {
    title: string;
    organizationName: string;
    aiSnapshot?: string;
    fileName?: string;
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

            // --- Header ---
            pdf.setFillColor(5, 5, 5); // #050505
            pdf.rect(0, 0, pdfWidth, 40, 'F');

            pdf.setTextColor(255, 105, 0); // Pinn Orange #FF6900
            pdf.setFontSize(22);
            pdf.setFont('helvetica', 'bold');
            pdf.text('PINN', 15, 20);

            pdf.setTextColor(255, 255, 255);
            pdf.setFontSize(10);
            pdf.setFont('helvetica', 'normal');
            pdf.text('PRODUCT BUILDER', 15, 25);

            pdf.setFontSize(14);
            pdf.text(options.title.toUpperCase(), pdfWidth - 15, 20, { align: 'right' });
            pdf.setFontSize(10);
            pdf.text(options.organizationName, pdfWidth - 15, 28, { align: 'right' });

            // --- AI Snapshot Section ---
            if (options.aiSnapshot) {
                pdf.setFillColor(20, 20, 20); // Slightly lighter dark
                pdf.roundedRect(10, 45, pdfWidth - 20, 35, 3, 3, 'F');

                pdf.setTextColor(255, 105, 0);
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
            pdf.text('pinn.com.br | Confidencial', pdfWidth - 15, footerY, { align: 'right' });

            pdf.save(options.fileName || `Relatorio-${options.organizationName}-${Date.now()}.pdf`);
        } finally {
            element.classList.remove('rendering-pdf');
        }
    }
}
