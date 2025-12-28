// Bot protection utilities

// List of common disposable email domains
const disposableDomains = [
  'tempmail.com', 'throwaway.com', 'guerrillamail.com', 'mailinator.com',
  'yopmail.com', '10minutemail.com', 'temp-mail.org', 'fakeinbox.com',
  'trashmail.com', 'getnada.com', 'mailnesia.com', 'dispostable.com',
  'tempinbox.com', 'mailcatch.com', 'mintemail.com', 'tempmailaddress.com',
  'throwawaymail.com', 'sharklasers.com', 'spam4.me', 'grr.la',
  'guerrillamail.info', 'guerrillamail.biz', 'guerrillamail.de',
  'pokemail.net', 'tempail.com', 'mohmal.com', 'maildrop.cc'
];

// Bot email patterns (name####name@domain)
const botPatterns = [
  /^[a-z]+[0-9]{3,}[a-z]+@/i,           // name123name@
  /^[a-z]+\.[0-9]{3,}\.[a-z]+@/i,       // name.123.name@
  /^[a-z]+_[0-9]{3,}_?[a-z]+@/i,        // name_123_name@
  /^[a-z]{2,}[0-9]{4,}@/i,              // name1234@
  /^[0-9]+[a-z]+[0-9]+@/i,              // 123name456@
];

// Common passwords to block
const commonPasswords = [
  'password', 'password1', 'password123', '123456', '12345678', 'qwerty',
  'abc123', 'monkey', 'letmein', 'dragon', 'master', 'admin', 'welcome',
  'login', 'princess', 'sunshine', 'passw0rd', 'shadow', 'michael', 'football'
];

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validateEmail(email: string): ValidationResult {
  const emailLower = email.toLowerCase().trim();
  
  // Basic format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailLower)) {
    return { valid: false, error: 'Please enter a valid email address' };
  }

  // Extract domain
  const domain = emailLower.split('@')[1];
  
  // Check disposable domains
  if (disposableDomains.includes(domain)) {
    return { valid: false, error: 'Please use a permanent email address' };
  }

  // Check bot patterns
  for (const pattern of botPatterns) {
    if (pattern.test(emailLower)) {
      return { valid: false, error: 'Please use a valid email address' };
    }
  }

  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters' };
  }

  if (!/[0-9]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character' };
  }

  const passwordLower = password.toLowerCase();
  for (const common of commonPasswords) {
    if (passwordLower.includes(common)) {
      return { valid: false, error: 'This password is too common. Please choose a stronger one.' };
    }
  }

  return { valid: true };
}

export function checkHoneypot(honeypotValue: string): boolean {
  // If honeypot is filled, it's a bot
  return honeypotValue.trim().length > 0;
}

export function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  let score = 0;
  
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[!@#$%^&*(),.?":{}|<>_\-+=]/.test(password)) score++;
  
  if (score <= 3) return 'weak';
  if (score <= 5) return 'medium';
  return 'strong';
}
