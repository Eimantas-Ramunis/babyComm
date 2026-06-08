// Scheduled notifications (F5, §8) — Phase 4. Not implemented in Phase 1.
//
// Phase 4 will run a per-minute cron that evaluates notification_schedules and sends
// pushes via pushService, guarding against duplicate sends with last_run_at.

export const NOT_IMPLEMENTED = 'The notification scheduler is not implemented in Phase 1.';

export function startScheduler() {
  // Intentionally a no-op in Phase 1.
}
