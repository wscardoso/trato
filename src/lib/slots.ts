import { DateTime, Interval } from "luxon";

export type DayOfWeekCode =
  | "MON"
  | "TUE"
  | "WED"
  | "THU"
  | "FRI"
  | "SAT"
  | "SUN";

export interface AvailabilityRuleInput {
  dayOfWeek: DayOfWeekCode;
  startTime: string;
  endTime: string;
  breakStart?: string | null;
  breakEnd?: string | null;
  isActive: boolean;
}

export interface AvailabilityExceptionInput {
  date: string;
  isDayOff: boolean;
  startTime?: string | null;
  endTime?: string | null;
}

export interface ExistingBookingInput {
  blockStartsAt: Date;
  blockEndsAt: Date;
  status: string;
}

export interface SlotInput {
  dateLocal: string;
  timezone: string;
  serviceDurationMin: number;
  serviceBufferAfterMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  slotIntervalMin: number;
  minLeadMin: number;
  rules: AvailabilityRuleInput[];
  exceptions: AvailabilityExceptionInput[];
  bookings: ExistingBookingInput[];
  now?: Date;
}

export interface AvailableSlot {
  startsAt: string;
  endsAt: string;
  label: string;
}

const DOW: DayOfWeekCode[] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];

const ACTIVE_STATUSES = new Set([
  "PENDING_PAYMENT",
  "CONFIRMED",
  "CHECKED_IN",
]);

function parseLocalOnDate(
  dateLocal: string,
  hhmm: string,
  tz: string,
): DateTime {
  const [h, m] = hhmm.split(":").map(Number);
  return DateTime.fromISO(dateLocal, { zone: tz }).set({
    hour: h,
    minute: m,
    second: 0,
    millisecond: 0,
  });
}

function workingWindows(input: SlotInput): Interval[] {
  const { dateLocal, timezone, rules, exceptions } = input;
  const day = DateTime.fromISO(dateLocal, { zone: timezone });
  const dow = DOW[day.weekday - 1];

  const ex = exceptions.find((e) => e.date === dateLocal);
  if (ex?.isDayOff) return [];

  let windows: { start: string; end: string }[] = [];

  if (ex?.startTime && ex?.endTime) {
    windows = [{ start: ex.startTime, end: ex.endTime }];
  } else {
    windows = rules
      .filter((r) => r.isActive && r.dayOfWeek === dow)
      .map((r) => ({ start: r.startTime, end: r.endTime }));
  }

  const intervals: Interval[] = [];
  for (const w of windows) {
    const start = parseLocalOnDate(dateLocal, w.start, timezone);
    const end = parseLocalOnDate(dateLocal, w.end, timezone);
    if (end <= start) continue;

    const rule = rules.find(
      (r) => r.dayOfWeek === dow && r.startTime === w.start,
    );
    if (rule?.breakStart && rule?.breakEnd) {
      const bs = parseLocalOnDate(dateLocal, rule.breakStart, timezone);
      const be = parseLocalOnDate(dateLocal, rule.breakEnd, timezone);
      if (bs > start) intervals.push(Interval.fromDateTimes(start, bs));
      if (be < end) intervals.push(Interval.fromDateTimes(be, end));
    } else {
      intervals.push(Interval.fromDateTimes(start, end));
    }
  }
  return intervals;
}

export function computeAvailableSlots(input: SlotInput): AvailableSlot[] {
  const now = DateTime.fromJSDate(input.now ?? new Date()).toUTC();
  const earliest = now.plus({ minutes: input.minLeadMin });

  const busy = input.bookings
    .filter((b) => ACTIVE_STATUSES.has(b.status))
    .map((b) =>
      Interval.fromDateTimes(
        DateTime.fromJSDate(b.blockStartsAt, { zone: "utc" }),
        DateTime.fromJSDate(b.blockEndsAt, { zone: "utc" }),
      ),
    );

  const slots: AvailableSlot[] = [];
  const grid = input.slotIntervalMin;

  for (const window of workingWindows(input)) {
    if (!window.start || !window.end) continue;

    let cursor = window.start;
    const rem = cursor.minute % grid;
    if (rem !== 0) cursor = cursor.plus({ minutes: grid - rem });

    while (true) {
      const serviceStart = cursor;
      const serviceEnd = serviceStart.plus({
        minutes: input.serviceDurationMin,
      });
      const blockStart = serviceStart.minus({
        minutes: input.bufferBeforeMin,
      });
      const blockEnd = serviceStart.plus({
        minutes:
          input.serviceDurationMin +
          input.serviceBufferAfterMin +
          input.bufferAfterMin,
      });

      if (serviceEnd > window.end) break;

      if (blockEnd > window.end || blockStart < window.start) {
        cursor = cursor.plus({ minutes: grid });
        continue;
      }

      if (serviceStart.toUTC() < earliest) {
        cursor = cursor.plus({ minutes: grid });
        continue;
      }

      const candidate = Interval.fromDateTimes(
        blockStart.toUTC(),
        blockEnd.toUTC(),
      );
      const overlaps = busy.some((b) => b.overlaps(candidate));
      if (!overlaps) {
        const startsAt = serviceStart.toUTC().toISO();
        const endsAt = serviceEnd.toUTC().toISO();
        if (startsAt && endsAt) {
          slots.push({
            startsAt,
            endsAt,
            label: serviceStart.setZone(input.timezone).toFormat("HH:mm"),
          });
        }
      }

      cursor = cursor.plus({ minutes: grid });
    }
  }

  return slots;
}

export function computeBlockWindow(params: {
  startsAt: Date;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  serviceBufferAfterMin: number;
}): { endsAt: Date; blockStartsAt: Date; blockEndsAt: Date } {
  const starts = DateTime.fromJSDate(params.startsAt, { zone: "utc" });
  const endsAt = starts
    .plus({ minutes: params.durationMin })
    .toJSDate();
  const blockStartsAt = starts
    .minus({ minutes: params.bufferBeforeMin })
    .toJSDate();
  const blockEndsAt = starts
    .plus({
      minutes:
        params.durationMin +
        params.serviceBufferAfterMin +
        params.bufferAfterMin,
    })
    .toJSDate();
  return { endsAt, blockStartsAt, blockEndsAt };
}
