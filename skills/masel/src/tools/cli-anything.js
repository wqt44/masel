/**
 * CLI-Anything Integration for MASEL
 * 
 * 将 CLI-Anything 的 CLI 工具集成到 MASEL 工作流中
 * 支持 GIMP、Blender、LibreOffice 等应用
 */

const { execSync } = require('child_process');
const path = require('path');

const CLI_ANYTHING_VENV = path.join(process.cwd(), 'venv-cli-anything');
const BIN_PATH = path.join(CLI_ANYTHING_VENV, 'bin');

/**
 * 执行 CLI-Anything 命令
 * @param {string} app - 应用名 (gimp, blender, libreoffice)
 * @param {string[]} args - 命令参数
 * @param {Object} options - 选项
 * @returns {Object} 解析后的结果
 */
function execCliAnything(app, args, options = {}) {
  const cliName = `cli-anything-${app}`;
  const cliPath = path.join(BIN_PATH, cliName);
  
  const cmd = `${cliPath} --json ${args.join(' ')}`;
  
  try {
    const output = execSync(cmd, {
      encoding: 'utf8',
      timeout: options.timeout || 30000,
      env: {
        ...process.env,
        PATH: `${BIN_PATH}:${process.env.PATH}`
      }
    });
    
    // 尝试解析 JSON 输出
    try {
      return JSON.parse(output);
    } catch {
      return { success: true, output: output.trim() };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      stderr: error.stderr?.toString()
    };
  }
}

/**
 * GIMP 操作封装
 */
const gimp = {
  listProfiles: () => execCliAnything('gimp', ['project', 'profiles']),
  
  createProject: (name, profile = 'hd1080p') => 
    execCliAnything('gimp', ['project', 'new', '--name', name, '--profile', profile]),
  
  openProject: (filepath) => 
    execCliAnything('gimp', ['project', 'open', filepath]),
  
  export: (format = 'png', output) => 
    execCliAnything('gimp', ['export', format, '--output', output]),
  
  listLayers: () => execCliAnything('gimp', ['layer', 'list']),
  
  addLayer: (name) => execCliAnything('gimp', ['layer', 'add', name]),
  
  // 画布操作
  createCanvas: (width, height, mode = 'RGB') =>
    execCliAnything('gimp', ['canvas', 'create', '--width', width, '--height', height, '--mode', mode]),
  
  // 滤镜
  applyFilter: (filterName, ...args) =>
    execCliAnything('gimp', ['filter', 'apply', filterName, ...args])
};

/**
 * Blender 操作封装
 */
const blender = {
  listObjects: () => execCliAnything('blender', ['object', 'list']),
  
  addCube: (name = 'Cube') => 
    execCliAnything('blender', ['object', 'add', 'cube', '--name', name]),
  
  addCamera: (name = 'Camera') => 
    execCliAnything('blender', ['camera', 'add', '--name', name]),
  
  render: (output, format = 'PNG') => 
    execCliAnything('blender', ['render', 'image', '--output', output, '--format', format]),
  
  setResolution: (width, height) => 
    execCliAnything('blender', ['render', 'resolution', width, height])
};

/**
 * LibreOffice 操作封装
 */
const libreoffice = {
  // Writer 文档操作
  writer: {
    list: () => execCliAnything('libreoffice', ['writer', 'list']),
    addParagraph: (text) => execCliAnything('libreoffice', ['writer', 'add-paragraph', text]),
    addHeading: (text, level = 1) => execCliAnything('libreoffice', ['writer', 'add-heading', text, '--level', level]),
    addList: (items) => execCliAnything('libreoffice', ['writer', 'add-list', ...items]),
    addTable: (rows, cols) => execCliAnything('libreoffice', ['writer', 'add-table', '--rows', rows, '--cols', cols]),
    addPageBreak: () => execCliAnything('libreoffice', ['writer', 'add-page-break']),
    setText: (index, text) => execCliAnything('libreoffice', ['writer', 'set-text', index, text]),
    remove: (index) => execCliAnything('libreoffice', ['writer', 'remove', index])
  },
  
  // Calc 表格操作
  calc: {
    list: () => execCliAnything('libreoffice', ['calc', 'list']),
    addSheet: (name) => execCliAnything('libreoffice', ['calc', 'add-sheet', name]),
    setCell: (sheet, cell, value) => execCliAnything('libreoffice', ['calc', 'set-cell', sheet, cell, value]),
    getCell: (sheet, cell) => execCliAnything('libreoffice', ['calc', 'get-cell', sheet, cell]),
    addFormula: (sheet, cell, formula) => execCliAnything('libreoffice', ['calc', 'add-formula', sheet, cell, formula]),
    addChart: (sheet, range, type) => execCliAnything('libreoffice', ['calc', 'add-chart', sheet, range, type])
  },
  
  // Impress 演示文稿操作
  impress: {
    list: () => execCliAnything('libreoffice', ['impress', 'list']),
    addSlide: (layout) => execCliAnything('libreoffice', ['impress', 'add-slide', layout]),
    setSlideText: (slide, text) => execCliAnything('libreoffice', ['impress', 'set-slide-text', slide, text]),
    addShape: (slide, shape) => execCliAnything('libreoffice', ['impress', 'add-shape', slide, shape]),
    setTransition: (slide, transition) => execCliAnything('libreoffice', ['impress', 'set-transition', slide, transition])
  },
  
  // 文档管理
  document: {
    info: () => execCliAnything('libreoffice', ['document', 'info']),
    save: (path) => execCliAnything('libreoffice', ['document', 'save', path]),
    open: (path) => execCliAnything('libreoffice', ['document', 'open', path]),
    close: () => execCliAnything('libreoffice', ['document', 'close'])
  },
  
  // 导出
  export: {
    pdf: (output) => execCliAnything('libreoffice', ['export', 'pdf', '--output', output]),
    docx: (output) => execCliAnything('libreoffice', ['export', 'docx', '--output', output]),
    xlsx: (output) => execCliAnything('libreoffice', ['export', 'xlsx', '--output', output]),
    pptx: (output) => execCliAnything('libreoffice', ['export', 'pptx', '--output', output])
  }
};

function detectCreativeSuite(taskDescription) {
  const task = taskDescription.toLowerCase();

  const hasGimp = (
    task.includes('图像') || task.includes('图片') || task.includes('photo') ||
    task.includes('image') || task.includes('resize') || task.includes('filter') ||
    task.includes('海报') || task.includes('poster') || task.includes('修图') ||
    task.includes('抠图') || task.includes('retouch') || task.includes('加字')
  );

  const hasBlender = (
    task.includes('3d') || task.includes('渲染') || task.includes('模型') ||
    task.includes('blender') || task.includes('animation') || task.includes('render') ||
    task.includes('mesh') || task.includes('材质') || task.includes('scene') ||
    task.includes('场景') || task.includes('cube') || task.includes('sphere')
  );

  const hasOffice = (
    task.includes('文档') || task.includes('word') || task.includes('excel') ||
    task.includes('ppt') || task.includes('pdf') || task.includes('document') ||
    task.includes('spreadsheet') || task.includes('presentation') ||
    task.includes('writer') || task.includes('calc') || task.includes('impress') ||
    task.includes('报告') || task.includes('提案') || task.includes('表格') ||
    task.includes('演示')
  );

  const apps = [];
  if (hasGimp) apps.push('gimp');
  if (hasBlender) apps.push('blender');
  if (hasOffice) apps.push('libreoffice');

  return {
    suite: 'local-creative-mcp-suite',
    apps,
    multiApp: apps.length > 1,
    primaryApp: apps[0] || null
  };
}

/**
 * 智能任务路由
 * 根据任务描述自动选择合适的创作工具，并支持 Local Creative MCP Suite 多工具路由
 */
async function routeTask(taskDescription, memory) {
  const suite = detectCreativeSuite(taskDescription);
  const task = taskDescription.toLowerCase();

  if (suite.multiApp) {
    memory?.recordContext?.('local_creative_mcp_suite', {
      route: suite,
      task
    });
    return {
      app: suite.primaryApp,
      handler: suite.primaryApp === 'gimp' ? gimp : suite.primaryApp === 'blender' ? blender : libreoffice,
      suite: suite.suite,
      apps: suite.apps,
      workflowType: 'multi-app'
    };
  }

  if (suite.primaryApp === 'gimp') {
    memory?.recordContext?.('cli_anything', { app: 'gimp', task, suite: suite.suite });
    return { app: 'gimp', handler: gimp, suite: suite.suite, apps: suite.apps, workflowType: 'single-app' };
  }

  if (suite.primaryApp === 'blender') {
    memory?.recordContext?.('cli_anything', { app: 'blender', task, suite: suite.suite });
    return { app: 'blender', handler: blender, suite: suite.suite, apps: suite.apps, workflowType: 'single-app' };
  }

  if (suite.primaryApp === 'libreoffice') {
    memory?.recordContext?.('cli_anything', { app: 'libreoffice', task, suite: suite.suite });
    return { app: 'libreoffice', handler: libreoffice, suite: suite.suite, apps: suite.apps, workflowType: 'single-app' };
  }

  return { app: null, handler: null, suite: suite.suite, apps: [], workflowType: 'unmatched' };
}

/**
 * 执行工作流
 * 示例：
 * await cliAnythingWorkflow([
 *   { app: 'gimp', action: 'createProject', args: ['project1', 'hd1080p'] },
 *   { app: 'gimp', action: 'export', args: ['png', '/tmp/output.png'] }
 * ]);
 */
async function cliAnythingWorkflow(steps, memory) {
  const results = [];
  const appsUsed = [...new Set(steps.map(step => step.app).filter(Boolean))];
  const suite = appsUsed.length > 1 ? 'local-creative-mcp-suite' : null;

  for (const step of steps) {
    const { app, action, args = [] } = step;

    let handler;
    switch (app) {
      case 'gimp': handler = gimp; break;
      case 'blender': handler = blender; break;
      case 'libreoffice': handler = libreoffice; break;
      default: throw new Error(`Unknown app: ${app}`);
    }

    if (!handler[action]) {
      throw new Error(`Unknown action: ${action} for ${app}`);
    }

    const result = await handler[action](...args);
    results.push({ step, result, suite });

    memory?.recordSuccess?.(
      suite ? 'local_creative_mcp_suite_workflow' : 'cli_anything_workflow',
      { step, result, suite, appsUsed }
    );
  }

  return {
    success: true,
    suite,
    appsUsed,
    steps: results.length,
    results
  };
}

module.exports = {
  execCliAnything,
  gimp,
  blender,
  libreoffice,
  detectCreativeSuite,
  routeTask,
  cliAnythingWorkflow
};
