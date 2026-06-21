// Smart Rate engine — non-negotiable fare calculator
export type RateInputs = {
  pickupDistanceMi: number;
  dropoffDistanceMi: number;
  hour: number; // 0-23
  dayOfWeek: number; // 0=Sun
  gasPricePerGal: number; // national avg
  specialEvent?: boolean;
};

export type RateBreakdown = {
  base: number;
  distance: number;
  fuelAdj: number;
  peakAdj: number;
  weekendAdj: number;
  eventAdj: number;
  total: number;
  multiplier: number;
};

export function calculateSmartRate(i: RateInputs): RateBreakdown {
  const base = 4.5;
  const totalMi = i.pickupDistanceMi + i.dropoffDistanceMi;
  const perMile = 1.85;
  const distance = totalMi * perMile;

  // Fuel adjustment vs $3.50 baseline
  const fuelMult = Math.max(0.9, Math.min(1.4, i.gasPricePerGal / 3.5));
  const fuelAdj = (base + distance) * (fuelMult - 1);

  const isPeak = (i.hour >= 7 && i.hour <= 9) || (i.hour >= 16 && i.hour <= 19);
  const peakMult = isPeak ? 1.25 : 1;
  const peakAdj = (base + distance) * (peakMult - 1);

  const isWeekend = i.dayOfWeek === 0 || i.dayOfWeek === 6;
  const weekendMult = isWeekend ? 1.15 : 1;
  const weekendAdj = (base + distance) * (weekendMult - 1);

  const eventMult = i.specialEvent ? 1.3 : 1;
  const eventAdj = (base + distance) * (eventMult - 1);

  const total = base + distance + fuelAdj + peakAdj + weekendAdj + eventAdj;
  const multiplier = total / (base + distance);

  return {
    base: round(base),
    distance: round(distance),
    fuelAdj: round(fuelAdj),
    peakAdj: round(peakAdj),
    weekendAdj: round(weekendAdj),
    eventAdj: round(eventAdj),
    total: round(total),
    multiplier: Math.round(multiplier * 100) / 100,
  };
}

const round = (n: number) => Math.round(n * 100) / 100;
