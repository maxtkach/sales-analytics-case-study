import { SalesRow, CoPurchasePair } from '../types';

export function calcCoPurchase(data: SalesRow[]): CoPurchasePair[] {
  // Group products by order
  const orderProducts = new Map<string, Set<string>>();
  for (const r of data) {
    if (!r.orderId || !r.product) continue;
    if (!orderProducts.has(r.orderId)) orderProducts.set(r.orderId, new Set());
    orderProducts.get(r.orderId)!.add(r.product);
  }

  // Only orders with 2+ products
  const multiProductOrders = [...orderProducts.entries()].filter(([, prods]) => prods.size >= 2);
  if (multiProductOrders.length === 0) return [];

  // Count co-occurrences
  const pairMap = new Map<string, { count: number; orders: string[] }>();
  for (const [orderId, prods] of multiProductOrders) {
    const prodList = [...prods].sort();
    for (let i = 0; i < prodList.length; i++) {
      for (let j = i + 1; j < prodList.length; j++) {
        const key = `${prodList[i]}|||${prodList[j]}`;
        let pair = pairMap.get(key);
        if (!pair) { pair = { count: 0, orders: [] }; pairMap.set(key, pair); }
        pair.count++;
        pair.orders.push(orderId);
      }
    }
  }

  return [...pairMap.entries()]
    .map(([key, val]) => {
      const [productA, productB] = key.split('|||');
      return { productA, productB, occurrences: val.count, orders: val.orders };
    })
    .filter(p => p.occurrences >= 2)
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, 30);
}
