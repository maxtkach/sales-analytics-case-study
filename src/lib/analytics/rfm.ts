import { SalesRow, RFMScore } from '../types';
import { daysBetween } from '../utils';

export function calcRFM(data: SalesRow[]): RFMScore[] {
  const customerMap = new Map<string, { dates: Date[]; orders: Set<string>; revenue: number }>();

  for (const r of data) {
    if (!r.customer || !r.orderId || r.date.getTime() === 0) continue;
    let c = customerMap.get(r.customer);
    if (!c) { c = { dates: [], orders: new Set(), revenue: 0 }; customerMap.set(r.customer, c); }
    c.dates.push(r.date);
    c.orders.add(r.orderId);
    c.revenue += r.amount;
  }

  if (customerMap.size < 5) return []; // Not enough data

  // Determine reference date: latest transaction date in data, or now if data is recent
  const now = new Date();
  let maxTimestamp = 0;
  for (const c of customerMap.values()) {
    for (const d of c.dates) {
      if (d.getTime() > maxTimestamp) maxTimestamp = d.getTime();
    }
  }
  const latestDate = maxTimestamp > 0 ? new Date(maxTimestamp) : now;
  const refDate = (now.getTime() - latestDate.getTime() < 7 * 86400000) ? now : latestDate;

  const customers = [...customerMap.entries()].map(([name, c]) => {
    c.dates.sort((a, b) => b.getTime() - a.getTime());
    return {
      name,
      recency: Math.max(0, daysBetween(c.dates[0], refDate)),
      frequency: c.orders.size,
      monetary: c.revenue,
    };
  });

  // Calculate quintiles with tied rank handling
  function quintile(values: number[], value: number, reverse = false): number {
    const sorted = [...values].sort((a, b) => a - b);
    const firstIdx = sorted.indexOf(value);
    const lastIdx = sorted.lastIndexOf(value);
    const midIdx = (firstIdx + lastIdx) / 2;
    const pct = (midIdx + 0.5) / sorted.length;
    const score = Math.min(5, Math.max(1, Math.floor(pct * 5) + 1));
    return reverse ? 6 - score : score;
  }

  const recencies = customers.map(c => c.recency);
  const frequencies = customers.map(c => c.frequency);
  const monetaries = customers.map(c => c.monetary);

  return customers.map(c => {
    const rScore = quintile(recencies, c.recency, true); // lower recency = higher score
    const fScore = quintile(frequencies, c.frequency);
    const mScore = quintile(monetaries, c.monetary);

    let segment = 'Прочие';
    const rfmAvg = (rScore + fScore + mScore) / 3;
    if (rScore >= 4 && fScore >= 4 && mScore >= 4) segment = 'VIP / Ключевые';
    else if (rScore >= 4 && fScore >= 3) segment = 'Постоянные';
    else if (rScore >= 4 && fScore <= 2) segment = 'Новые клиенты';
    else if (rScore <= 2 && fScore >= 3) segment = 'В зоне риска';
    else if (rScore <= 2 && fScore <= 2 && mScore >= 3) segment = 'Спящие VIP';
    else if (rScore <= 2) segment = 'Ушедшие (отток)';
    else if (rfmAvg >= 3) segment = 'Перспективные';

    return { customer: c.name, recency: c.recency, frequency: c.frequency, monetary: c.monetary, rScore, fScore, mScore, segment };
  }).sort((a, b) => (b.rScore + b.fScore + b.mScore) - (a.rScore + a.fScore + a.mScore));
}
