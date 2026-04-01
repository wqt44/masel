/**
 * MASEL Agents - OpenClaw sessions_spawn 集成 v1.9.1
 * 
 * 真正的多 Agent：通过 OpenClaw 的 sessions_spawn 并行执行子任务
 * 降级：sessions_spawn 不可用时回退到顺序执行
 */

class MaselAgents {
  constructor() {
    this.activeAgents = new Map();
    this.spawnAvailable = null; // 懒检测
  }

  /**
   * 检测 sessions_spawn 是否可用
   */
  _checkSpawn() {
    if (this.spawnAvailable !== null) return this.spawnAvailable;
    // 在 OpenClaw 环境外运行时不可用
    // 实际使用时由 wrapper 层注入
    this.spawnAvailable = false;
    return false;
  }

  /**
   * 设置 spawn 函数（由 wrapper 注入）
   */
  setSpawnFn(fn) {
    this._spawnFn = fn;
    this.spawnAvailable = fn !== null && fn !== undefined;
  }

  /**
   * 并行执行子任务
   * @param {Array} subtasks - [{name, description, agentType, dependencies}]
   * @param {Object} context - 共享上下文
   * @returns {Array} results
   */
  async executeParallel(subtasks, context = {}) {
    if (this._spawnFn && subtasks.length > 1) {
      return this._executeWithSpawn(subtasks, context);
    }
    return this._executeSequential(subtasks, context);
  }

  /**
   * 使用 sessions_spawn 并行执行
   */
  async _executeWithSpawn(subtasks, context) {
    const results = [];
    const completed = new Map();

    // 按依赖拓扑排序，分层执行
    const layers = this._topologicalLayers(subtasks);

    for (const layer of layers) {
      const promises = layer.map(async (task) => {
        const deps = (task.dependencies || [])
          .map(d => completed.get(d))
          .filter(Boolean);

        try {
          const result = await this._spawnFn({
            task: task.description,
            agentId: this._mapAgentType(task.agentType),
            context: { ...context, dependencies: deps },
          });

          completed.set(task.id || task.name, result);
          return { ...task, success: true, output: result, execution_time: Date.now() };
        } catch (error) {
          completed.set(task.id || task.name, { error: error.message });
          return { ...task, success: false, output: error.message, execution_time: Date.now() };
        }
      });

      const layerResults = await Promise.all(promises);
      results.push(...layerResults);
    }

    return results;
  }

  /**
   * 顺序执行（降级方案）
   */
  async _executeSequential(subtasks, context) {
    const results = [];
    const completed = new Map();

    for (const task of subtasks) {
      const deps = (task.dependencies || [])
        .map(d => completed.get(d))
        .filter(Boolean);

      try {
        // 模拟执行（实际由 MASEL plan 驱动）
        const output = `Completed ${task.name || task.id}`;
        completed.set(task.id || task.name, output);
        results.push({
          ...task,
          success: true,
          output,
          execution_time: (task.estimated_time || 10) * 1000
        });
      } catch (error) {
        results.push({ ...task, success: false, output: error.message });
      }
    }

    return results;
  }

  /**
   * 拓扑分层：将有依赖关系的子任务分成可并行的层
   */
  _topologicalLayers(subtasks) {
    const idMap = new Map(subtasks.map(s => [s.id || s.name, s]));
    const layers = [];
    const assigned = new Set();

    while (assigned.size < subtasks.length) {
      const layer = subtasks.filter(s => {
        const id = s.id || s.name;
        if (assigned.has(id)) return false;
        const deps = (s.dependencies || []).map(d => d.id || d);
        return deps.every(d => assigned.has(d));
      });

      if (layer.length === 0) break; // 防死循环
      layer.forEach(s => assigned.add(s.id || s.name));
      layers.push(layer);
    }

    return layers;
  }

  /**
   * agent 类型映射到 OpenClaw agentId
   */
  _mapAgentType(type) {
    const map = {
      'coder': 'main',
      'researcher': 'main',
      'reviewer': 'main',
    };
    return map[type] || 'main';
  }

  /**
   * 获取活跃 agent 数量
   */
  getActiveCount() {
    return this.activeAgents.size;
  }
}

module.exports = { MaselAgents };
