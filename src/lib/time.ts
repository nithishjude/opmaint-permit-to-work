// All plants are in India, so every time shown or typed is IST (UTC+05:30,
// no daylight saving). Storing UTC in the DB and pinning display to the plant
// timezone means a server in us-east-1 and a phone in Chennai agree.

export const PLANT_TZ = "Asia/Kolkata";
const IST_OFFSET = "+05:30";

const dateTimeFmt = new Intl.DateTimeFormat("en-IN", {
  timeZone: PLANT_TZ,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: PLANT_TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return dateTimeFmt.format(new Date(d));
}

export function formatTime(d: Date | string): string {
  return timeFmt.format(new Date(d));
}

/** Date → "YYYY-MM-DDTHH:mm" in plant time, for <input type="datetime-local">. */
export function toPlantInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const ist = new Date(new Date(d).getTime() + 330 * 60_000);
  return ist.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" typed in plant time → ISO string with offset. */
export function fromPlantInput(v: string): string | undefined {
  if (!v) return undefined;
  const d = new Date(`${v}:00${IST_OFFSET}`);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

export function formatDuration(ms: number): string {
  const sign = ms < 0 ? "-" : "";
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  if (h >= 24) return `${sign}${Math.floor(h / 24)}d ${h % 24}h`;
  if (h > 0) return `${sign}${h}h ${String(m).padStart(2, "0")}m`;
  const s = Math.floor((abs % 60_000) / 1000);
  return `${sign}${m}m ${String(s).padStart(2, "0")}s`;
}
