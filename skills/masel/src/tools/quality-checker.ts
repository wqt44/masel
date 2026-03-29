/**
 * MASEL 质量保障工具
 * 
 * 提供代码检查、测试、验证功能
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export interface QualityCheckOptions {
  projectPath: string;
  strict?: boolean;
  autoFix?: boolean;
}

export interface QualityCheckResult {
  passed: boolean;
  score: number;
  issues: QualityIssue[];
  summary: string;
}

export interface QualityIssue {
  type: 'ERROR' | 'WARNING' | 'INFO';
  category: 'TYPE' | 'LINT' | 'TEST' | 'SECURITY' | 'PERFORMANCE';
  file: string;
  line?: number;
  message: string;
  suggestion?: string;
  autoFixable?: boolean;
}

/**
 * 代码质量检查器
 */
export class QualityChecker {
  private options: QualityCheckOptions;

  constructor(options: QualityCheckOptions) {
    this.options = options;
  }

  /**
   * 执行完整质量检查
   */
  async check(): Promise<QualityCheckResult> {
    const issues: QualityIssue[] = [];

    // 1. 类型检查
    const typeIssues = await this.checkTypes();
    issues.push(...typeIssues);

    // 2. 代码规范检查
    const lintIssues = await this.checkLint();
    issues.push(...lintIssues);

    // 3. 安全检查
    const securityIssues = await this.checkSecurity();
    issues.push(...securityIssues);

    // 4. 性能检查
    const performanceIssues = await this.checkPerformance();
    issues.push(...performanceIssues);

    // 5. 测试检查
    const testIssues = await this.checkTests();
    issues.push(...testIssues);

    // 计算分数
    const score = this.calculateScore(issues);
    const passed = score >= (this.options.strict ? 90 : 70);

    return {
      passed,
      score,
      issues,
      summary: this.generateSummary(issues, score)
    };
  }

  /**
   * TypeScript 类型检查
   */
  private async checkTypes(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    try {
      execSync('npx tsc --noEmit', {
        cwd: this.options.projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error: any) {
      const output = error.stdout || error.message;
      const lines = output.split('\n');

      for (const line of lines) {
        const match = line.match(/(.+)\((\d+),(\d+)\): error TS(\d+): (.+)/);
        if (match) {
          issues.push({
            type: 'ERROR',
            category: 'TYPE',
            file: match[1],
            line: parseInt(match[2]),
            message: match[5],
            suggestion: this.getTypeSuggestion(match[4], match[5]),
            autoFixable: false
          });
        }
      }
    }

    return issues;
  }

  /**
   * 代码规范检查
   */
  private async checkLint(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // 检查未使用的导入
    const unusedImports = this.checkUnusedImports();
    issues.push(...unusedImports);

    // 检查 console.log
    const consoleLogs = this.checkConsoleLogs();
    issues.push(...consoleLogs);

    // 检查 TODO/FIXME
    const todos = this.checkTODOs();
    issues.push(...todos);

    return issues;
  }

  /**
   * 检查未使用的导入
   */
  private checkUnusedImports(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    try {
      const result = execSync('npx eslint --rule "@typescript-eslint/no-unused-vars: error" --ext .ts,.tsx .', {
        cwd: this.options.projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });
    } catch (error: any) {
      const output = error.stdout || '';
      const lines = output.split('\n');

      for (const line of lines) {
        if (line.includes('no-unused-vars') || line.includes('is defined but never used')) {
          const match = line.match(/(.+):(\d+):(\d+):\s*(.+)/);
          if (match) {
            issues.push({
              type: 'WARNING',
              category: 'LINT',
              file: match[1],
              line: parseInt(match[2]),
              message: match[4],
              suggestion: '移除未使用的导入',
              autoFixable: true
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * 检查 console.log
   */
  private checkConsoleLogs(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    try {
      const result = execSync('grep -rn "console.log" --include="*.ts" --include="*.tsx" .', {
        cwd: this.options.projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const lines = result.split('\n');
      for (const line of lines) {
        const match = line.match(/(.+):(\d+):\s*(.+)/);
        if (match && !match[1].includes('node_modules')) {
          issues.push({
            type: 'INFO',
            category: 'LINT',
            file: match[1],
            line: parseInt(match[2]),
            message: '发现 console.log',
            suggestion: '生产环境应使用日志库替代 console.log',
            autoFixable: false
          });
        }
      }
    } catch (e) {
      // 没有 console.log 是正常的
    }

    return issues;
  }

  /**
   * 检查 TODO/FIXME
   */
  private checkTODOs(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    try {
      const result = execSync('grep -rn "TODO\\|FIXME\\|XXX" --include="*.ts" --include="*.tsx" .', {
        cwd: this.options.projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const lines = result.split('\n');
      for (const line of lines) {
        const match = line.match(/(.+):(\d+):\s*(.+)/);
        if (match && !match[1].includes('node_modules')) {
          issues.push({
            type: 'WARNING',
            category: 'LINT',
            file: match[1],
            line: parseInt(match[2]),
            message: '发现未完成的代码标记',
            suggestion: '完成 TODO 或移除标记',
            autoFixable: false
          });
        }
      }
    } catch (e) {
      // 没有 TODO 是正常的
    }

    return issues;
  }

  /**
   * 安全检查
   */
  private async checkSecurity(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // 检查硬编码密钥
    const hardcodedSecrets = this.checkHardcodedSecrets();
    issues.push(...hardcodedSecrets);

    // 检查 SQL 注入风险
    const sqlInjection = this.checkSQLInjection();
    issues.push(...sqlInjection);

    return issues;
  }

  /**
   * 检查硬编码密钥
   */
  private checkHardcodedSecrets(): QualityIssue[] {
    const issues: QualityIssue[] = [];
    const secretPatterns = [
      /api[_-]?key\s*[=:]\s*["']\w+["']/i,
      /password\s*[=:]\s*["']\w+["']/i,
      /secret\s*[=:]\s*["']\w+["']/i,
      /token\s*[=:]\s*["']\w+["']/i
    ];

    try {
      const result = execSync('find . -name "*.ts" -o -name "*.tsx" -o -name "*.js" | head -50', {
        cwd: this.options.projectPath,
        encoding: 'utf8'
      });

      const files = result.split('\n').filter(f => f && !f.includes('node_modules'));

      for (const file of files) {
        try {
          const content = readFileSync(path.join(this.options.projectPath, file), 'utf8');
          const lines = content.split('\n');

          lines.forEach((line, index) => {
            for (const pattern of secretPatterns) {
              if (pattern.test(line) && !line.includes('process.env')) {
                issues.push({
                  type: 'ERROR',
                  category: 'SECURITY',
                  file,
                  line: index + 1,
                  message: '可能的硬编码密钥',
                  suggestion: '使用环境变量存储敏感信息',
                  autoFixable: false
                });
              }
            }
          });
        } catch (e) {
          // 忽略无法读取的文件
        }
      }
    } catch (e) {
      // 忽略错误
    }

    return issues;
  }

  /**
   * 检查 SQL 注入风险
   */
  private checkSQLInjection(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // 检查字符串拼接 SQL
    try {
      const result = execSync('grep -rn "SELECT.*+\\|INSERT.*+\\|UPDATE.*+\\|DELETE.*+" --include="*.ts" .', {
        cwd: this.options.projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const lines = result.split('\n');
      for (const line of lines) {
        if (line.includes('+') && !line.includes('node_modules')) {
          const match = line.match(/(.+):(\d+):\s*(.+)/);
          if (match) {
            issues.push({
              type: 'ERROR',
              category: 'SECURITY',
              file: match[1],
              line: parseInt(match[2]),
              message: '可能的 SQL 注入风险',
              suggestion: '使用参数化查询或 ORM',
              autoFixable: false
            });
          }
        }
      }
    } catch (e) {
      // 没有 SQL 拼接是正常的
    }

    return issues;
  }

  /**
   * 性能检查
   */
  private async checkPerformance(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // 检查内存泄漏模式
    const memoryLeaks = this.checkMemoryLeaks();
    issues.push(...memoryLeaks);

    return issues;
  }

  /**
   * 检查内存泄漏
   */
  private checkMemoryLeaks(): QualityIssue[] {
    const issues: QualityIssue[] = [];

    // 检查 Map/Array 只增不减
    try {
      const result = execSync('grep -rn "new Map\\|new Set\\|new Array" --include="*.ts" .', {
        cwd: this.options.projectPath,
        encoding: 'utf8',
        stdio: 'pipe'
      });

      const files = result.split('\n').filter(f => f && !f.includes('node_modules'));

      for (const file of files) {
        const match = file.match(/(.+):(\d+):\s*(.+)/);
        if (match) {
          // 检查是否有清理逻辑
          const filePath = path.join(this.options.projectPath, match[1]);
          try {
            const content = readFileSync(filePath, 'utf8');
            if ((content.includes('.set(') || content.includes('.push(')) && 
                !content.includes('.delete(') && 
                !content.includes('.clear()') &&
                !content.includes('cleanup')) {
              issues.push({
                type: 'WARNING',
                category: 'PERFORMANCE',
                file: match[1],
                line: parseInt(match[2]),
                message: '可能的内存泄漏：数据只增不减',
                suggestion: '添加清理机制或限制容量',
                autoFixable: false
              });
            }
          } catch (e) {}
        }
      }
    } catch (e) {}

    return issues;
  }

  /**
   * 测试检查
   */
  private async checkTests(): Promise<QualityIssue[]> {
    const issues: QualityIssue[] = [];

    // 检查是否有测试文件
    const hasTestFiles = existsSync(path.join(this.options.projectPath, '__tests__')) ||
                        existsSync(path.join(this.options.projectPath, 'tests')) ||
                        existsSync(path.join(this.options.projectPath, 'test'));

    if (!hasTestFiles) {
      // 检查是否有 .test.ts 或 .spec.ts 文件
      try {
        const result = execSync('find . -name "*.test.ts" -o -name "*.spec.ts" | head -5', {
          cwd: this.options.projectPath,
          encoding: 'utf8',
          stdio: 'pipe'
        });

        if (!result.trim()) {
          issues.push({
            type: 'WARNING',
            category: 'TEST',
            file: 'project',
            message: '未找到测试文件',
            suggestion: '添加单元测试和集成测试',
            autoFixable: false
          });
        }
      } catch (e) {}
    }

    return issues;
  }

  /**
   * 计算质量分数
   */
  private calculateScore(issues: QualityIssue[]): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.type) {
        case 'ERROR':
          score -= 10;
          break;
        case 'WARNING':
          score -= 5;
          break;
        case 'INFO':
          score -= 1;
          break;
      }
    }

    return Math.max(0, score);
  }

  /**
   * 生成检查摘要
   */
  private generateSummary(issues: QualityIssue[], score: number): string {
    const errors = issues.filter(i => i.type === 'ERROR').length;
    const warnings = issues.filter(i => i.type === 'WARNING').length;
    const infos = issues.filter(i => i.type === 'INFO').length;

    if (score >= 90) {
      return `✅ 代码质量优秀 (分数: ${score}) - ${errors} 错误, ${warnings} 警告, ${infos} 提示`;
    } else if (score >= 70) {
      return `⚠️ 代码质量良好 (分数: ${score}) - ${errors} 错误, ${warnings} 警告, ${infos} 提示`;
    } else {
      return `❌ 代码质量需要改进 (分数: ${score}) - ${errors} 错误, ${warnings} 警告, ${infos} 提示`;
    }
  }

  /**
   * 获取类型错误建议
   */
  private getTypeSuggestion(code: string, message: string): string {
    const suggestions: Record<string, string> = {
      '2322': '类型不匹配，检查赋值类型',
      '2345': '参数类型错误，检查函数调用',
      '2304': '变量未定义，检查拼写或导入',
      '7006': '参数隐式为 any，添加类型注解',
      '2769': '无匹配的重载签名，检查参数类型'
    };

    return suggestions[code] || '检查 TypeScript 类型定义';
  }
}

/**
 * 快速质量检查
 */
export async function quickCheck(projectPath: string): Promise<QualityCheckResult> {
  const checker = new QualityChecker({ projectPath });
  return checker.check();
}

/**
 * 严格质量检查
 */
export async function strictCheck(projectPath: string): Promise<QualityCheckResult> {
  const checker = new QualityChecker({ projectPath, strict: true });
  return checker.check();
}

export default QualityChecker;
