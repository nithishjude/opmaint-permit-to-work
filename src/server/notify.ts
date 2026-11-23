// Notifications are out of scope. This stub marks every place a real system
// would push an email / SMS / app notification, and to whom.
export function notify(recipients: string[] | string, message: string): void {
  const to = Array.isArray(recipients) ? recipients.join(", ") : recipients;
  console.info(`[notify] would notify ${to || "(nobody)"}: ${message}`);
}
