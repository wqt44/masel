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

/**
 * 智能任务路由
 * 根据任务描述自动选择合适的 CLI 工具
 */
async function routeTask(taskDescription, memory) {
  const task = taskDescription.toLowerCase();
  
  // 图像相关任务
  if (task.includes('图像') || task.includes('图片') || task.includes('photo') || 
      task.includes('image') || task.includes('resize') || task.includes('filter')) {
    memory?.recordContext?.('cli_anything', { app: 'gimp', task });
    return { app: 'gimp', handler: gimp };
  }
  
  // 3D/渲染相关任务
  if (task.includes('3d') || task.includes('渲染') || task.includes('模型') || 
      task.includes('blender') || task.includes('animation') || task.includes('render')) {
    memory?.recordContext?.('cli_anything', { app: 'blender', task });
    return { app: 'blender', handler: blender };
  }
  
  // 文档相关任务
  if (task.includes('文档') || task.includes('word') || task.includes('excel') || 
      task.includes('ppt') || task.includes('pdf') || task.includes('document') ||
      task.includes('spreadsheet') || task.includes('presentation')) {
    memory?.recordContext?.('cli_anything', { app: 'libreoffice', handler: libreoffice });
    return { app: 'libreoffice', handler: libreoffice };
  }
  
  return { app: null, handler: null };
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
    results.push({ step, result });
    
    // 记录到 Viking 记忆
    memory?.recordSuccess?.('cli_anything_workflow', { step, result });
  }
  
  return results;
}

module.exports = {
  execCliAnything,
  gimp,
  blender,
  libreoffice,
  routeTask,
  cliAnythingWorkflow
};
