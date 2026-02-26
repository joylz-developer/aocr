import * as pdfjsLib from 'pdfjs-dist';
// Use a CDN for the worker to avoid complex bundler configuration issues in this environment
// Alternatively, we could use the local worker if we can guarantee the path
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export const convertPdfToImage = async (base64Pdf: string): Promise<string> => {
    try {
        // Decode base64 to binary
        const binaryString = window.atob(base64Pdf);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Load the document
        const loadingTask = pdfjsLib.getDocument({ data: bytes });
        const pdf = await loadingTask.promise;

        // Get the first page
        const page = await pdf.getPage(1);

        // Set scale for better quality (e.g., 2.0)
        const scale = 2.0;
        const viewport = page.getViewport({ scale });

        // Prepare canvas using OffscreenCanvas if available, or create a canvas element
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        
        if (!context) {
            throw new Error('Canvas context not available');
        }

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        // Render PDF page into canvas context
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        await page.render(renderContext).promise;

        // Convert canvas to base64 JPEG image
        // Remove the data URL prefix to match the expected format in aiService
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        const base64Image = dataUrl.split(',')[1];

        return base64Image;
    } catch (error) {
        console.error('Error converting PDF to image:', error);
        throw new Error('Failed to convert PDF to image: ' + (error as Error).message);
    }
};
