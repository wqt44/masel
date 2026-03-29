/**
 * OpenClaw Dashboard Server
 * 监控仪表板后端服务器
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 配置
const PORT = process.env.DASHBOARD_PORT || 3456;
const PUBLIC_DIR = path.join(__dirname, 'public');

// 状态缓存
let statusCache = {
  timestamp: Date.now(),
  health: 85,
  uptime: '0d 0h',
  cycles: 0,
  skills: 0,
  improvements: 0
};

/**
 * 读取静态文件
 */
function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const contentType = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg'
  }[ext] || 'text/plain';
  
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

/**
 * API 路由处理
 */
function handleAPI(pathname, req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  switch (pathname) {
    case '/api/status':
      // 获取系统状态
      updateStatusCache();
      res.writeHead(200);
      res.end(JSON.stringify(statusCache));
      break;
      
    case '/api/health':
      // 获取健康详情
      const health = getHealthDetails();
      res.writeHead(200);
      res.end(JSON.stringify(health));
      break;
      
    case '/api/skills':
      // 获取技能列表
      const skills = getSkillsList();
      res.writeHead(200);
      res.end(JSON.stringify(skills));
      break;
      
    case '/api/logs':
      // 获取最近日志
      const logs = getRecentLogs();
      res.writeHead(200);
      res.end(JSON.stringify(logs));
      break;
      
    case '/api/metrics':
      // 获取指标
      const metrics = getMetrics();
      res.writeHead(200);
      res.end(JSON.stringify(metrics));
      break;
      
    default:
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'API not found' }));
  }
}

/**
 * 更新状态缓存
 */
function updateStatusCache() {
  try {
    // 读取 OAC 状态
    const oacStatePath = path.join(__dirname, '../../memory/oac/state.json');
    if (fs.existsSync(oacStatePath)) {
      const state = JSON.parse(fs.readFileSync(oacStatePath, 'utf-8'));
      statusCache.cycles = state.cycles || 0;
    }
    
    // 读取技能数量
    const skillsPath = path.join(__dirname, '../../skills');
    if (fs.existsSync(skillsPath)) {
      const skills = fs.readdirSync(skillsPath).filter(f => 
        fs.statSync(path.join(skillsPath, f)).isDirectory()
      );
      statusCache.skills = skills.length;
    }
    
    // 计算运行时间
    const startTime = statusCache.startTime || Date.now();
    const uptime = Date.now() - startTime;
    const days = Math.floor(uptime / (24 * 60 * 60 * 1000));
    const hours = Math.floor((uptime % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    statusCache.uptime = `${days}d ${hours}h`;
    
    statusCache.timestamp = Date.now();
    
  } catch (e) {
    console.error('Error updating status cache:', e.message);
  }
}

/**
 * 获取健康详情
 */
function getHealthDetails() {
  return {
    overall: { score: 85, status: 'healthy' },
    systems: {
      memory: { score: 90, status: 'healthy' },
      skills: { score: 88, status: 'healthy' },
      oac: { score: 85, status: 'healthy' },
      pipeline: { score: 82, status: 'healthy' }
    }
  };
}

/**
 * 获取技能列表
 */
function getSkillsList() {
  const skillsPath = path.join(__dirname, '../../skills');
  
  if (!fs.existsSync(skillsPath)) {
    return [];
  }
  
  return fs.readdirSync(skillsPath)
    .filter(f => fs.statSync(path.join(skillsPath, f)).isDirectory())
    .map(name => ({ name, status: 'active' }));
}

/**
 * 获取最近日志
 */
function getRecentLogs() {
  const logs = [];
  
  // 读取 OAC 日志
  const oacLogPath = path.join(__dirname, '../../memory/oac/automation.log');
  if (fs.existsSync(oacLogPath)) {
    try {
      const content = fs.readFileSync(oacLogPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l);
      
      for (const line of lines.slice(-10)) {
        try {
          const entry = JSON.parse(line);
          logs.push({
            time: new Date(entry.timestamp).toLocaleTimeString(),
            level: 'info',
            message: `[${entry.event}] ${JSON.stringify(entry.data).substring(0, 50)}`
          });
        } catch (e) {
          // 忽略解析错误
        }
      }
    } catch (e) {
      // 忽略读取错误
    }
  }
  
  return logs;
}

/**
 * 获取指标
 */
function getMetrics() {
  return {
    memory: {
      reads: 100,
      writes: 50,
      hitRate: '85%'
    },
    errors: {
      total: 2,
      last24h: 0
    },
    performance: {
      avgResponseTime: '120ms',
      uptime: '99.5%'
    }
  };
}

/**
 * 创建 HTTP 服务器
 */
const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  
  // API 路由
  if (pathname.startsWith('/api/')) {
    handleAPI(pathname, req, res);
    return;
  }
  
  // 静态文件
  let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);
  
  // 防止目录遍历
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  serveStatic(filePath, res);
});

/**
 * 启动服务器
 */
function start() {
  // 确保 public 目录存在
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    
    // 创建默认 index.html
    const defaultHtml = `<!DOCTYPE html>
<html>
<head>
  <title>OpenClaw Dashboard</title>
  <style>
    body { font-family: sans-serif; padding: 40px; background: #0f172a; color: #e2e8f0; }
    h1 { color: #60a5fa; }
    .status { padding: 20px; background: #1e293b; border-radius: 8px; margin: 20px 0; }
  </style>
</head>
<body>
  <h1>🦾 OpenClaw Dashboard</h1>
  <div class="status">
    <h2>System Status</h2>
    <p>Dashboard is running. Please create the full dashboard UI.</p>
  </div>
</body>
</html>`;
    
    fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'), defaultHtml);
  }
  
  // 记录启动时间
  statusCache.startTime = Date.now();
  
  server.listen(PORT, () => {
    console.log(`[Dashboard] Server running at http://localhost:${PORT}`);
    console.log(`[Dashboard] Public directory: ${PUBLIC_DIR}`);
  });
}

/**
 * 停止服务器
 */
function stop() {
  server.close(() => {
    console.log('[Dashboard] Server stopped');
  });
}

// 导出
module.exports = { start, stop, server };

// 如果直接运行
if (require.main === module) {
  start();
  
  // 优雅退出
  process.on('SIGINT', () => {
    stop();
    process.exit(0);
  });
}
