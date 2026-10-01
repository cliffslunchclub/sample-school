import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { orderingCalendar } = require('../pb_hooks/school-calendar.js');
// Midnight Eastern on UTC hosts, plus the spring/fall DST boundaries.
for (const [instant, day, monday] of [
  ['2026-10-03T03:59:59Z', 5, '2026-10-05'],
  ['2026-10-03T04:00:00Z', 6, '2026-10-05'],
  ['2026-01-05T04:59:59Z', 0, '2026-01-05'],
  ['2026-01-05T05:00:00Z', 1, '2026-01-12'],
  ['2026-03-08T06:59:59Z', 0, '2026-03-09'],
  ['2026-03-08T07:00:00Z', 0, '2026-03-09'],
  ['2026-03-09T04:00:00Z', 1, '2026-03-16'],
  ['2026-11-01T05:59:59Z', 0, '2026-11-02'],
  ['2026-11-01T06:00:00Z', 0, '2026-11-02'],
  ['2026-11-02T04:59:59Z', 0, '2026-11-02'],
  ['2026-11-02T05:00:00Z', 1, '2026-11-09'],
]) {
  const result = orderingCalendar(new Date(instant));
  assert.equal(result.day, day, instant);
  assert.equal(result.keys[0], monday, instant);
  assert.equal(result.keys.length, 5);
}
console.log('PASS hosted Eastern ordering calendar, midnight and DST transitions');
