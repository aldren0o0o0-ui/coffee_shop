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
  const baseReceiptUrl = getReceiptUrl(receiptPdfUrl);
  if (!baseReceiptUrl) return;
  const fullUrl = baseReceiptUrl.includes("?")
    ? `${baseReceiptUrl}&download=1`
    : `${baseReceiptUrl}?download=1`;

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

export async function printReceipt(receiptPdfUrl) {
  const fullUrl = getReceiptUrl(receiptPdfUrl);
  if (!fullUrl) return;

  try {
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error(`Failed to fetch receipt PDF (HTTP ${response.status})`);
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.src = blobUrl;

    const cleanup = () => {
      setTimeout(() => {
        try {
          if (iframe.parentNode) document.body.removeChild(iframe);
          window.URL.revokeObjectURL(blobUrl);
        } catch {
          // ignore cleanup errors
        }
      }, 3000);
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch (printErr) {
        console.warn("Iframe print error, falling back to open tab:", printErr);
        window.open(blobUrl, "_blank");
      } finally {
        cleanup();
      }
    };

    document.body.appendChild(iframe);
  } catch (err) {
    console.error("Print receipt fallback due to fetch error:", err);
    window.open(fullUrl, "_blank");
  }
}

export function printThermalReceipt() {
  window.print();
}

