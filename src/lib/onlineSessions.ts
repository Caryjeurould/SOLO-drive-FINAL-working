// The Operator's online sessions: one record per "Go online" → "Stop", with a
// start time (started_at) and an end time (ended_at, null while still online).
// Every read and write of them goes through this file, and nowhere else.
//
// The visitor demo keeps them in memory (seeded with the demo week, cleared
// when the demo restarts; never stored or sent anywhere). The real app swaps
// these four functions for the operator_shifts table, whose rows already have
// this exact shape:
//   activeSession  → select * from operator_shifts where operator_id = me and ended_at is null
//   sessionsSince  → select * from operator_shifts where operator_id = me and started_at >= weekStart
//   startSession   → insert into operator_shifts (operator_id, service_type) (started_at defaults to now())
//   endSession     → update operator_shifts set ended_at = now() where id = …
import type { OperatorShift, ShiftServiceType } from "@/hooks/useOperatorShift";

let sessions: OperatorShift[] = [];
let seq = 0;

/** The open session (still online), or null while offline. */
export function activeSession(): OperatorShift | null {
  return sessions.find((s) => s.ended_at == null) ?? null;
}

/** Every session that started at or after `since`, oldest first. */
export function sessionsSince(since: Date): OperatorShift[] {
  return sessions.filter((s) => new Date(s.started_at) >= since);
}

/** Go online: opens a session starting now (the open one, if there already is one). */
export function startSession(operatorId: string, serviceType: ShiftServiceType, now = new Date()): OperatorShift {
  const open = activeSession();
  if (open) return open;
  const s: OperatorShift = {
    id: `session-${++seq}`,
    operator_id: operatorId,
    service_type: serviceType,
    started_at: now.toISOString(),
    ended_at: null,
    last_lat: null,
    last_lng: null,
    last_location_at: null,
  };
  sessions = [...sessions, s];
  return s;
}

/** Stop: closes the session, ending now. */
export function endSession(id: string, now = new Date()) {
  sessions = sessions.map((s) => (s.id === id && s.ended_at == null ? { ...s, ended_at: now.toISOString() } : s));
}

/** Demo only: start over with these (already closed) sessions. */
export function resetSessions(seed: OperatorShift[] = []) {
  sessions = seed;
}
