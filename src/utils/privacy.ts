/**
 * MASEL Privacy Service
 * 敏感信息脱敏处理
 */

// ============================================================================
// 敏感信息模式
// ============================================================================

interface PrivacyPattern {
  type: string;
  pattern: RegExp;
  replacement: string;
  description: string;
}

const PRIVACY_PATTERNS: PrivacyPattern[] = [
  // API Keys & Tokens
  {
    type: 'api_key',
    pattern: /(api[_-]?key|apikey)\s*[:=]\s*["']?[a-zA-Z0-9_-]{16,}["']?/gi,
    replacement: '$1: [REDACTED_API_KEY]',
    description: 'API Key'
  },
  {
    type: 'bearer_token',
    pattern: /bearer\s+[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/gi,
    replacement: 'Bearer [REDACTED_JWT]',
    description: 'Bearer Token / JWT'
  },
  {
    type: 'access_token',
    pattern: /(access[_-]?token|auth[_-]?token)\s*[:=]\s*["']?[a-zA-Z0-9_-]{8,}["']?/gi,
    replacement: '$1: [REDACTED_TOKEN]',
    description: 'Access Token'
  },
  
  // Passwords & Secrets
  {
    type: 'password',
    pattern: /(password|passwd|pwd)\s*[:=]\s*["']?[^\s"']{4,}["']?/gi,
    replacement: '$1: [REDACTED_PASSWORD]',
    description: 'Password'
  },
  {
    type: 'secret',
    pattern: /(secret|private[_-]?key)\s*[:=]\s*["']?[a-zA-Z0-9_-]{8,}["']?/gi,
    replacement: '$1: [REDACTED_SECRET]',
    description: 'Secret / Private Key'
  },
  
  // Credentials
  {
    type: 'credential',
    pattern: /(username|user|email)\s*[:=]\s*["']?[^\s"']+@[^\s"']+["']?/gi,
    replacement: '$1: [REDACTED_EMAIL]',
    description: 'Email / Username'
  },
  
  // IP Addresses
  {
    type: 'ip_address',
    pattern: /\b(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: '[REDACTED_IP]',
    description: 'IP Address'
  },
  
  // File Paths (potentially sensitive)
  {
    type: 'home_path',
    pattern: /\/home\/[^/\s]+/g,
    replacement: '/home/[REDACTED_USER]',
    description: 'Home directory path'
  },
  {
    type: 'ssh_key_path',
    pattern: /~\/\.ssh\/[^\s"']+/g,
    replacement: '~/.ssh/[REDACTED_KEYFILE]',
    description: 'SSH key path'
  },
  
  // Database connections
  {
    type: 'db_connection',
    pattern: /(mongodb|mysql|postgresql|redis):\/\/[^\s"']+/gi,
    replacement: '$1://[REDACTED_CONNECTION_STRING]',
    description: 'Database connection string'
  },
  
  // Credit Cards (basic pattern)
  {
    type: 'credit_card',
    pattern: /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g,
    replacement: '[REDACTED_CREDIT_CARD]',
    description: 'Credit Card number'
  },
  
  // Phone numbers (basic)
  {
    type: 'phone',
    pattern: /\b\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
    replacement: '[REDACTED_PHONE]',
    description: 'Phone number'
  }
];

// ============================================================================
// 脱敏配置
// ============================================================================

interface PrivacyConfig {
  enable_redaction: boolean;
  patterns: PrivacyPattern[];
  preserve_length: boolean;  // 是否保留长度信息（如 ****）
  log_original: boolean;     // 是否记录原始值（仅用于调试）
}

const DEFAULT_PRIVACY_CONFIG: PrivacyConfig = {
  enable_redaction: true,
  patterns: PRIVACY_PATTERNS,
  preserve_length: false,
  log_original: false
};

// ============================================================================
// 主脱敏函数
// ============================================================================

interface RedactionResult {
  sanitized: string;
  redacted_count: number;
  redacted_types: string[];
  has_sensitive_data: boolean;
}

/**
 * 脱敏处理文本
 */
export function sanitize(
  text: string,
  config: Partial<PrivacyConfig> = {}
): RedactionResult {
  const cfg = { ...DEFAULT_PRIVACY_CONFIG, ...config };
  
  if (!cfg.enable_redaction || !text) {
    return {
      sanitized: text,
      redacted_count: 0,
      redacted_types: [],
      has_sensitive_data: false
    };
  }
  
  let sanitized = text;
  const redactedTypes = new Set<string>();
  let totalRedacted = 0;
  
  for (const pattern of cfg.patterns) {
    const matches = sanitized.match(pattern.pattern);
    if (matches) {
      redactedTypes.add(pattern.type);
      totalRedacted += matches.length;
      sanitized = sanitized.replace(pattern.pattern, pattern.replacement);
    }
  }
  
  return {
    sanitized,
    redacted_count: totalRedacted,
    redacted_types: Array.from(redactedTypes),
    has_sensitive_data: totalRedacted > 0
  };
}

/**
 * 脱敏错误记录
 */
export function sanitizeErrorRecord(error: any): any {
  if (!error) return error;
  
  const sanitized: any = { ...error };
  
  // 脱敏错误消息
  if (error.error_message) {
    const result = sanitize(error.error_message);
    sanitized.error_message = result.sanitized;
    sanitized._privacy_meta = {
      redacted_count: result.redacted_count,
      redacted_types: result.redacted_types
    };
  }
  
  // 脱敏堆栈跟踪
  if (error.error_stack) {
    sanitized.error_stack = sanitize(error.error_stack).sanitized;
  }
  
  // 脱敏上下文
  if (error.context) {
    sanitized.context = sanitizeObject(error.context);
  }
  
  // 脱敏输入
  if (error.inputs) {
    sanitized.inputs = sanitizeObject(error.inputs);
  }
  
  return sanitized;
}

/**
 * 脱敏对象（递归）
 */
function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitize(obj).sanitized;
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // 对 key 也进行敏感词检查
      const sanitizedKey = sanitize(key).sanitized;
      sanitized[sanitizedKey] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * 脱敏执行结果
 */
export function sanitizeExecutionResult(result: any): any {
  if (!result) return result;
  
  const sanitized = { ...result };
  
  // 脱敏输出
  if (result.output) {
    sanitized.output = sanitize(result.output).sanitized;
  }
  
  // 脱敏错误
  if (result.error) {
    sanitized.error = sanitize(result.error).sanitized;
  }
  
  // 脱敏结果列表
  if (result.results) {
    sanitized.results = result.results.map((r: any) => sanitizeExecutionResult(r));
  }
  
  return sanitized;
}

// ============================================================================
// 特定场景脱敏
// ============================================================================

/**
 * 脱敏用于存储的错误记录
 */
export function sanitizeForStorage(error: any): any {
  const sanitized = sanitizeErrorRecord(error);
  
  // 添加脱敏标记
  sanitized._sanitized = true;
  sanitized._sanitized_at = new Date().toISOString();
  
  return sanitized;
}

/**
 * 脱敏用于显示的日志
 */
export function sanitizeForDisplay(text: string): string {
  const result = sanitize(text);
  
  if (result.has_sensitive_data) {
    return `[PRIVACY: ${result.redacted_count} items redacted] ${result.sanitized}`;
  }
  
  return result.sanitized;
}

/**
 * 脱敏用于学习的文本（保留更多上下文）
 */
export function sanitizeForLearning(text: string): string {
  // 学习场景下，保留类型信息但脱敏具体值
  const cfg: Partial<PrivacyConfig> = {
    enable_redaction: true,
    preserve_length: true  // 保留长度，帮助学习模式
  };
  
  return sanitize(text, cfg).sanitized;
}

// ============================================================================
// 敏感数据检测
// ============================================================================

/**
 * 检测是否包含敏感数据
 */
export function containsSensitiveData(text: string): boolean {
  return sanitize(text).has_sensitive_data;
}

/**
 * 获取敏感数据类型列表
 */
export function getSensitiveDataTypes(text: string): string[] {
  return sanitize(text).redacted_types;
}

// ============================================================================
// 导出
// ============================================================================

export default {
  sanitize,
  sanitizeErrorRecord,
  sanitizeExecutionResult,
  sanitizeForStorage,
  sanitizeForDisplay,
  sanitizeForLearning,
  containsSensitiveData,
  getSensitiveDataTypes,
  PRIVACY_PATTERNS
};
