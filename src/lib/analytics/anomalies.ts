import { SalesRow, Anomaly, TargetCurrency } from '../types';
import { formatCurrency, formatDate, avg, percentile } from '../utils';

let anomalyId = 0;
function makeId() { return `anomaly_${++anomalyId}`; }

export function detectAnomalies(
  currentData: SalesRow[],
  allData: SalesRow[],
  currency: TargetCurrency = 'UAH'
): Anomaly[] {
  anomalyId = 0;
  const anomalies: Anomaly[] = [];

  // 1. Unusually large orders
  const orderTotals = new Map<string, number>();
  for (const r of currentData) {
    const key = r.orderId || `row_${r._rowIndex}`;
    orderTotals.set(key, (orderTotals.get(key) || 0) + r.amount);
  }
  const orderValues = [...orderTotals.values()];
  if (orderValues.length >= 5) {
    const p95 = percentile(orderValues, 95);
    const avgVal = avg(orderValues);
    for (const [orderId, total] of orderTotals) {
      if (total > p95 && total > avgVal * 3) {
        // Find customer
        const row = currentData.find(r => r.orderId === orderId);
        anomalies.push({
          id: makeId(),
          type: 'large_order',
          title: `Необычно крупный заказ`,
          description: `Заказ ${orderId} на сумму ${formatCurrency(total, currency)} — в ${(total / avgVal).toFixed(1)}x раз больше среднего чека.`,
          value: total,
          baseline: avgVal,
          difference: total - avgVal,
          period: row ? formatDate(row.date) : '',
          entity: row?.customer || orderId,
        });
      }
    }
  }

  return anomalies.slice(0, 10);
}
