/**
 * MASEL Security Service
 * 代码安全审查与沙箱保护
 */

import { exec } from "../utils/openclaw-api.js";

// ============================================================================
// 安全配置
// ============================================================================

interface SecurityConfig {
  enable_code_scan: boolean;      // 启用代码扫描
  enable_sandbox: boolean;        // 启用沙箱执行
  forbidden_patterns: string[];   // 禁止的模式
  allowed_commands: string[];     // 允许的命令白名单
  max_file_size_mb: number;       // 最大文件大小
  max_execution_time_sec: number; // 最大执行时间
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  enable_code_scan: true,
  enable_sandbox: true,
  forbidden_patterns: [
    // 危险系统调用
    'rm -rf /',
    'rm -rf /*',
    'dd if=/dev/zero',
    'mkfs.',
    '>:',
    'format ',
    // 网络攻击
    'nc -e',
    'netcat -e',
    'bash -i',
    'sh -i',
    '/dev/tcp/',
    '/dev/udp/',
    // 权限提升
    'chmod 777 /',
    'chmod +s ',
    'sudo ',
    'su -',
    // 敏感文件访问
    '/etc/passwd',
    '/etc/shadow',
    '~/.ssh/',
    '.bash_history',
    // 危险编码
    'eval(',
    'exec(',
    'system(',
    'subprocess.call(',
    'os.system(',
    '__import__("os").system',
    // 反序列化攻击
    'pickle.loads',
    'yaml.load(',
    'yaml.unsafe_load',
    // 其他
    'curl | bash',
    'wget | bash',
    'fetch | bash'
  ],
  allowed_commands: [
    'ls', 'cat', 'grep', 'find', 'head', 'tail',
    'mkdir', 'touch', 'cp', 'mv', 'rm', 'rmdir',
    'git', 'npm', 'node', 'python', 'python3',
    'pip', 'pip3', 'npx', 'tsc', 'eslint',
    'curl', 'wget', 'tar', 'zip', 'unzip',
    'echo', 'printf', 'pwd', 'cd', 'which',
    'chmod', 'chown'  // 但有限制
  ],
  max_file_size_mb: 10,
  max_execution_time_sec: 300
};

// ============================================================================
// 代码扫描
// ============================================================================

interface ScanResult {
  safe: boolean;
  threats: Threat[];
  sanitized_code?: string;
}

interface Threat {
  level: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  pattern: string;
  line?: number;
  message: string;
}

/**
 * 扫描代码安全性
 */
export async function scanCode(
  code: string,
  language: 'javascript' | 'typescript' | 'python' | 'shell' | 'unknown' = 'unknown',
  config: Partial<SecurityConfig> = {}
): Promise<ScanResult> {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };
  const threats: Threat[] = [];

  if (!cfg.enable_code_scan) {
    return { safe: true, threats: [] };
  }

  // 1. 检查禁止模式
  for (const pattern of cfg.forbidden_patterns) {
    if (code.includes(pattern)) {
      threats.push({
        level: 'critical',
        type: 'forbidden_pattern',
        pattern,
        message: `发现禁止模式: ${pattern}`
      });
    }
  }

  // 2. 语言特定检查
  const langThreats = await languageSpecificScan(code, language);
  threats.push(...langThreats);

  // 3. 检查动态代码执行
  const dynamicThreats = checkDynamicExecution(code);
  threats.push(...dynamicThreats);

  // 4. 检查网络操作
  const networkThreats = checkNetworkOperations(code);
  threats.push(...networkThreats);

  // 5. 检查文件系统操作
  const fsThreats = checkFileSystemOperations(code);
  threats.push(...fsThreats);

  const criticalCount = threats.filter(t => t.level === 'critical').length;
  const highCount = threats.filter(t => t.level === 'high').length;

  return {
    safe: criticalCount === 0 && highCount === 0,
    threats,
    sanitized_code: criticalCount === 0 ? code : undefined
  };
}

/**
 * 语言特定扫描
 */
async function languageSpecificScan(
  code: string,
  language: string
): Promise<Threat[]> {
  const threats: Threat[] = [];

  switch (language) {
    case 'javascript':
    case 'typescript':
      // 检查 eval、Function、setTimeout 字符串
      if (/eval\s*\(/.test(code)) {
        threats.push({
          level: 'high',
          type: 'dynamic_execution',
          pattern: 'eval()',
          message: '使用 eval() 存在代码注入风险'
        });
      }
      if (/new\s+Function\s*\(/.test(code)) {
        threats.push({
          level: 'high',
          type: 'dynamic_execution',
          pattern: 'new Function()',
          message: '使用 new Function() 存在代码注入风险'
        });
      }
      break;

    case 'python':
      // 检查 exec、eval、compile
      if (/\bexec\s*\(/.test(code)) {
        threats.push({
          level: 'high',
          type: 'dynamic_execution',
          pattern: 'exec()',
          message: '使用 exec() 存在代码注入风险'
        });
      }
      if (/\beval\s*\(/.test(code)) {
        threats.push({
          level: 'medium',
          type: 'dynamic_execution',
          pattern: 'eval()',
          message: '使用 eval() 需谨慎'
        });
      }
      // 检查 pickle
      if (/pickle\.loads?\s*\(/.test(code)) {
        threats.push({
          level: 'high',
          type: 'deserialization',
          pattern: 'pickle.loads',
          message: 'pickle 反序列化存在安全风险'
        });
      }
      break;

    case 'shell':
      // 检查命令注入
      if (/\$\{.*\}/.test(code) || /\$\(.*\)/.test(code)) {
        threats.push({
          level: 'medium',
          type: 'command_substitution',
          pattern: '$() or ${}',
          message: '命令替换可能被利用'
        });
      }
      break;
  }

  return threats;
}

/**
 * 检查动态代码执行
 */
function checkDynamicExecution(code: string): Threat[] {
  const threats: Threat[] = [];
  const patterns = [
    { pattern: /eval\s*\(/, level: 'high', type: 'eval' },
    { pattern: /Function\s*\(/, level: 'high', type: 'Function' },
    { pattern: /setTimeout\s*\(\s*["']/, level: 'medium', type: 'setTimeout string' },
    { pattern: /setInterval\s*\(\s*["']/, level: 'medium', type: 'setInterval string' },
    { pattern: /exec\s*\(/, level: 'high', type: 'exec' },
    { pattern: /compile\s*\(/, level: 'medium', type: 'compile' }
  ];

  for (const { pattern, level, type } of patterns) {
    if (pattern.test(code)) {
      threats.push({
        level: level as any,
        type: 'dynamic_execution',
        pattern: type,
        message: `发现动态代码执行: ${type}`
      });
    }
  }

  return threats;
}

/**
 * 检查网络操作
 */
function checkNetworkOperations(code: string): Threat[] {
  const threats: Threat[] = [];

  // 检查反向 shell
  const reverseShellPatterns = [
    /nc\s+-e/,
    /netcat\s+-e/,
    /bash\s+-i/,
    /sh\s+-i/,
    /\/dev\/tcp\//,
    /socket\.socket\s*\(\s*\)/
  ];

  for (const pattern of reverseShellPatterns) {
    if (pattern.test(code)) {
      threats.push({
        level: 'critical',
        type: 'reverse_shell',
        pattern: pattern.toString(),
        message: '发现可能的反向 shell 代码'
      });
    }
  }

  return threats;
}

/**
 * 检查文件系统操作
 */
function checkFileSystemOperations(code: string): Threat[] {
  const threats: Threat[] = [];

  // 检查递归删除
  if (/rm\s+-rf\s+\/|rm\s+-rf\s+\*|rm\s+-fr\s+\//.test(code)) {
    threats.push({
      level: 'critical',
      type: 'recursive_delete',
      pattern: 'rm -rf /',
      message: '发现递归删除根目录命令'
    });
  }

  // 检查敏感文件访问
  const sensitiveFiles = [
    '/etc/passwd',
    '/etc/shadow',
    '~/.ssh/',
    '.bash_history',
    '.zsh_history'
  ];

  for (const file of sensitiveFiles) {
    if (code.includes(file)) {
      threats.push({
        level: 'high',
        type: 'sensitive_file_access',
        pattern: file,
        message: `访问敏感文件: ${file}`
      });
    }
  }

  return threats;
}

// ============================================================================
// 命令白名单检查
// ============================================================================

/**
 * 检查命令是否在白名单中
 */
export function checkCommandWhitelist(
  command: string,
  allowedCommands: string[] = DEFAULT_SECURITY_CONFIG.allowed_commands
): { allowed: boolean; reason?: string } {
  const cmd = command.trim().split(' ')[0];

  if (!allowedCommands.includes(cmd)) {
    return {
      allowed: false,
      reason: `命令 "${cmd}" 不在白名单中`
    };
  }

  // 特殊检查：chmod/chown 不能操作系统目录
  if ((cmd === 'chmod' || cmd === 'chown') && /\s+\/(etc|bin|sbin|usr|lib)/.test(command)) {
    return {
      allowed: false,
      reason: `不能 ${cmd} 系统目录`
    };
  }

  return { allowed: true };
}

// ============================================================================
// 沙箱执行
// ============================================================================

interface SandboxOptions {
  workdir?: string;
  timeout_sec?: number;
  max_memory_mb?: number;
  network_access?: boolean;
  file_system_access?: 'readonly' | 'workdir' | 'full';
}

/**
 * 在沙箱中执行命令
 */
export async function executeInSandbox(
  command: string,
  options: SandboxOptions = {}
): Promise<{
  success: boolean;
  stdout: string;
  stderr: string;
  exit_code: number;
  security_violations: string[];
}> {
  const {
    workdir = 'workspace/sandbox',
    timeout_sec = 60,
    max_memory_mb = 512,
    network_access = false,
    file_system_access = 'workdir'
  } = options;

  const securityViolations: string[] = [];

  // 1. 检查命令白名单
  const whitelistCheck = checkCommandWhitelist(command);
  if (!whitelistCheck.allowed) {
    securityViolations.push(whitelistCheck.reason!);
    return {
      success: false,
      stdout: '',
      stderr: `Security violation: ${whitelistCheck.reason}`,
      exit_code: 1,
      security_violations: securityViolations
    };
  }

  // 2. 扫描命令中的危险模式
  const scanResult = await scanCode(command, 'shell');
  if (!scanResult.safe) {
    const criticalThreats = scanResult.threats.filter(t => t.level === 'critical');
    if (criticalThreats.length > 0) {
      securityViolations.push(...criticalThreats.map(t => t.message));
      return {
        success: false,
        stdout: '',
        stderr: `Security violation: ${criticalThreats.map(t => t.message).join(', ')}`,
        exit_code: 1,
        security_violations: securityViolations
      };
    }
  }

  // 3. 构建沙箱命令
  let sandboxedCommand = command;

  // 使用 timeout 限制执行时间
  sandboxedCommand = `timeout ${timeout_sec}s ${sandboxedCommand}`;

  // 限制网络访问
  if (!network_access) {
    // 使用 unshare 或 firejail 隔离网络（如果可用）
    sandboxedCommand = `unshare -n ${sandboxedCommand} 2>/dev/null || ${sandboxedCommand}`;
  }

  // 限制文件系统访问
  if (file_system_access === 'readonly') {
    // 使用 chroot 或 bind mount 只读
    // 简化版：检查命令不包含写操作
    if (/\s*(>|>>|cp|mv|rm|mkdir|rmdir|touch)\s+/.test(command)) {
      securityViolations.push('只读模式下不允许写操作');
      return {
        success: false,
        stdout: '',
        stderr: 'Security violation: Write operation not allowed in readonly mode',
        exit_code: 1,
        security_violations: securityViolations
      };
    }
  }

  // 4. 执行命令
  try {
    const { stdout, stderr, exitCode } = await exec({
      command: sandboxedCommand,
      timeout: (timeout_sec + 5) * 1000,  // 稍微多一点时间
      workdir
    });

    return {
      success: exitCode === 0,
      stdout,
      stderr,
      exit_code: exitCode || 0,
      security_violations: []
    };
  } catch (error) {
    return {
      success: false,
      stdout: '',
      stderr: error instanceof Error ? error.message : String(error),
      exit_code: 1,
      security_violations: []
    };
  }
}

// ============================================================================
// 子代理代码审查
// ============================================================================

/**
 * 审查子代理生成的代码
 */
export async function reviewSubAgentCode(
  code: string,
  agentType: string,
  taskDescription: string
): Promise<{
  approved: boolean;
  threats: Threat[];
  sanitized_code?: string;
  review_notes: string[];
}> {
  const reviewNotes: string[] = [];

  // 1. 自动扫描
  const language = detectLanguage(code);
  const scanResult = await scanCode(code, language);

  // 2. 根据代理类型调整策略
  if (agentType === 'coder') {
    // 编码代理允许更多操作，但仍需检查
    const criticalThreats = scanResult.threats.filter(t => t.level === 'critical');
    if (criticalThreats.length > 0) {
      reviewNotes.push(`发现 ${criticalThreats.length} 个严重安全问题`);
      return {
        approved: false,
        threats: scanResult.threats,
        review_notes: reviewNotes
      };
    }

    // 高风险警告但不阻止
    const highThreats = scanResult.threats.filter(t => t.level === 'high');
    if (highThreats.length > 0) {
      reviewNotes.push(`警告: ${highThreats.length} 个高风险操作`);
      reviewNotes.push('建议人工审核');
    }
  }

  // 3. 任务相关性检查
  if (taskDescription.includes('read') && !taskDescription.includes('write')) {
    // 只读任务，检查是否有写操作
    const writePatterns = /(writeFile|fs\.write|>|>>|rm\s|mv\s|cp\s)/;
    if (writePatterns.test(code)) {
      reviewNotes.push('警告: 只读任务中发现写操作');
    }
  }

  return {
    approved: scanResult.safe || scanResult.threats.every(t => t.level !== 'critical'),
    threats: scanResult.threats,
    sanitized_code: scanResult.sanitized_code,
    review_notes: reviewNotes
  };
}

/**
 * 检测代码语言
 */
function detectLanguage(code: string): 'javascript' | 'typescript' | 'python' | 'shell' | 'unknown' {
  if (/^\s*import\s+.*\s+from\s+['"]|^\s*const\s+.*\s*=\s*require\s*\(/.test(code)) {
    return code.includes(':') && code.includes('interface') ? 'typescript' : 'javascript';
  }
  if (/^\s*import\s+\w+|^\s*from\s+\w+\s+import|^\s*def\s+\w+\s*\(/.test(code)) {
    return 'python';
  }
  if (/^\s*#!/bin/(ba)?sh|^\s*echo\s|^\s*ls\s/.test(code)) {
    return 'shell';
  }
  return 'unknown';
}

// ============================================================================
// 导出
// ============================================================================

export default {
  scanCode,
  checkCommandWhitelist,
  executeInSandbox,
  reviewSubAgentCode,
  DEFAULT_SECURITY_CONFIG
};
