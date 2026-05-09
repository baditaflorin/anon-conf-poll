export function downloadTextFile(filename: string, content: string, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(content: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard is unavailable. Select the text and copy it manually.");
  }

  await navigator.clipboard.writeText(content);
}

export async function readClipboardText(): Promise<string> {
  if (!navigator.clipboard?.readText) {
    throw new Error("Clipboard read is unavailable. Paste the text into the field instead.");
  }

  return navigator.clipboard.readText();
}

export function printReport(): void {
  window.print();
}
