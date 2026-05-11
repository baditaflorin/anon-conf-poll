import { useEffect, useState } from "react";
import QRCode from "qrcode";

/**
 * Renders a QR code for a string as an inline SVG. The QR encoder runs locally
 * — nothing leaves the browser. SVG is preferred over canvas because it scales
 * crisply and prints well (useful for in-person events).
 */
export function QrCode({
  text,
  size = 220,
  className,
}: {
  text: string;
  size?: number;
  className?: string;
}) {
  const [svg, setSvg] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    void QRCode.toString(text, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: size,
      color: { dark: "#0f4c45", light: "#fffaf1" },
    }).then((result) => {
      if (!cancelled) setSvg(result);
    });
    return () => {
      cancelled = true;
    };
  }, [text, size]);

  if (!svg) {
    return (
      <div
        className={className}
        style={{ width: size, height: size, background: "var(--surface)", borderRadius: 8 }}
      />
    );
  }

  return (
    <div
      className={className}
      style={{ width: size, height: size, lineHeight: 0 }}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: svg }}
      aria-label="QR code"
      role="img"
    />
  );
}
