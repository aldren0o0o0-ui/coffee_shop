const BACKEND_BASE = (
  import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1"
).replace(/\/api\/v1\/?$/, "");

export function getReceiptUrl(url) {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${BACKEND_BASE}${cleanPath}`;
}

export async function downloadReceipt(receiptPdfUrl, orderId) {
  const fullUrl = getReceiptUrl(receiptPdfUrl);
  if (!fullUrl) return;
  try {
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error("Failed to fetch receipt PDF");
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `Receipt-Order-${orderId || "CoffeeShop"}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (err) {
    console.error("Failed to download receipt:", err);
    window.open(fullUrl, "_blank");
  }
}

export function printReceipt(receiptPdfUrl) {
  const fullUrl = getReceiptUrl(receiptPdfUrl);
  if (!fullUrl) return;
  const printWindow = window.open(fullUrl, "_blank");
  if (printWindow) {
    printWindow.focus();
    printWindow.onload = () => {
      try {
        printWindow.print();
      } catch (e) {
        console.error("Print receipt error:", e);
      }
    };
  }
}
