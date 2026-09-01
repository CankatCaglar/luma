function canShareFiles(file: File): boolean {
  try {
    return Boolean(navigator.share && navigator.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

export async function saveFileOnDevice(file: File): Promise<void> {
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file], title: file.name });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000);
}

function filenameFromHeader(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf?.[1]) {
    try {
      return decodeURIComponent(utf[1]);
    } catch {
      return fallback;
    }
  }
  const ascii = header.match(/filename="?([^"]+)"?/i);
  return ascii?.[1]?.trim() || fallback;
}

export async function downloadBrandFile(input: {
  fileId: string;
  fileName: string;
  mimeType?: string;
  token?: string | null;
}): Promise<void> {
  const headers: HeadersInit = {};
  if (input.token) headers.Authorization = `Bearer ${input.token}`;
  const response = await fetch(
    `/api/drive/download?fileId=${encodeURIComponent(input.fileId)}`,
    { cache: "no-store", headers },
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error || "Dosya indirilemedi");
  }

  const blob = await response.blob();
  const name = filenameFromHeader(response.headers.get("content-disposition"), input.fileName);
  const file = new File([blob], name, {
    type: blob.type || input.mimeType || "application/octet-stream",
  });
  await saveFileOnDevice(file);
}
