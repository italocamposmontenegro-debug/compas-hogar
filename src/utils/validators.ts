// ============================================
// Casa Clara — Validadores de formularios
// ============================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  if (!email.trim()) return { valid: false, error: 'El email es obligatorio' };
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return { valid: false, error: 'Email no válido' };
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, error: 'La contraseña es obligatoria' };
  if (password.length < 8) return { valid: false, error: 'Mínimo 8 caracteres' };
  return { valid: true };
}

export function validateRequired(value: string, fieldName: string): ValidationResult {
  if (!value.trim()) return { valid: false, error: `${fieldName} es obligatorio` };
  return { valid: true };
}

export function validateAmount(value: number | string): ValidationResult {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  if (isNaN(num)) return { valid: false, error: 'Ingresa un monto válido' };
  if (num <= 0) return { valid: false, error: 'El monto debe ser mayor a $0' };
  if (num > 999_999_999) return { valid: false, error: 'El monto es demasiado alto' };
  return { valid: true };
}

export function validateDate(value: string): ValidationResult {
  if (!value) return { valid: false, error: 'La fecha es obligatoria' };
  const d = new Date(value);
  if (isNaN(d.getTime())) return { valid: false, error: 'Fecha no válida' };
  return { valid: true };
}

export function validateHouseholdName(name: string): ValidationResult {
  if (!name.trim()) return { valid: false, error: 'El nombre del hogar es obligatorio' };
  if (name.trim().length < 2) return { valid: false, error: 'Mínimo 2 caracteres' };
  if (name.trim().length > 60) return { valid: false, error: 'Máximo 60 caracteres' };
  return { valid: true };
}
