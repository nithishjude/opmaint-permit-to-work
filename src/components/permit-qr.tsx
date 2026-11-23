import QRCode from "qrcode";
import { headers } from "next/headers";

/** Base URL for links that leave the app (QR codes). */
export async function publicBaseUrl(): Promise<string> {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * QR to the public status page — a safety walk-around can scan the permit
 * pinned at the job and see if it's really still valid, without logging in.
 */
export async function PermitQr({ permitId, number }: { permitId: string; number: string }) {
  const url = `${await publicBaseUrl()}/status/${permitId}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0f172a", light: "#ffffff" } });
  return (
    <figure className="text-center">
      <div className="mx-auto w-40 [&>svg]:h-auto [&>svg]:w-full" role="img" aria-label={`QR code for ${number}`} dangerouslySetInnerHTML={{ __html: svg }} />
      <figcaption className="mt-1 text-[13px] text-ink-muted">
        Scan for live status ·{" "}
        <a href={url} className="underline" target="_blank" rel="noreferrer">
          open
        </a>
      </figcaption>
    </figure>
  );
}
