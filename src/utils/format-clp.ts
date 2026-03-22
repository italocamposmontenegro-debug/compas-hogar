// ============================================
// Casa Clara — Formato CLP
// ============================================

const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/**
 * Formatea un monto en CLP: $1.234.567
 */
export function formatCLP(amount: number): string {
  return clpFormatter.format(amount);
}

/**
 * Formatea un monto abreviado: $1.2M, $500K
 */
export function formatCLPShort(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 100_000) {
    return `$${Math.round(amount / 1_000)}K`;
  }
  return formatCLP(amount);
}

/**
 * Parsea un string numérico a entero CLP
 */
export function parseCLP(value: string): number {
  const cleaned = value.replace(/[^0-9-]/g, '');
  return parseInt(cleaned, 10) || 0;
}
