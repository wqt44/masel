/**
 * MASEL Status Tool
 * 
 * Monitor task execution status and system health
 */

import { read, exec } from "../utils/openclaw-api.js";
import { VikingManager } from "../memory/viking-store.js";

interface StatusOptions {
  task_id?: string;
  show_all?: boolean;
}

interface TaskStatus {
  task_id: string;
  status: "running" | "completed" | "failed" | "unknown";
  progress: {
    total_subtasks: number;
    completed: number;
    failed: number;
    pending: number;
  };
  execution_time: number;
  current_subtask?: string;
  last_updated: string;
}

interface SystemStatus {
  version: string;
  uptime: number;
  active_tasks: number;
  completed_tasks: number;
  failed_tasks: number;
  memory_stats: {
    hot_errors: number;
    warm_errors_today: number;
    total_errors: number;
  };
  agent_stats: Record<string, {
    tasks_completed: number;
    success_rate: number;
    common_errors: string[];
  }>;
}

const viking = new VikingManager();

/**
 * Get task status
 */
export async function maselStatus(options: StatusOptions): Promise<TaskStatus | SystemStatus> {
  if (options.task_id) {
    return getTaskStatus(options.task_id);
  } else {
    return getSystemStatus();
  }
}

/**
 * Get specific task status
 */
async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  console.log(`📊 Task Status: ${taskId}`);
  
  try {
    // Try to read execution result
    const resultPath = `memory/executions/${taskId}.json`;
    const content = await read({ path: resultPath });
    const execution = JSON.parse(content);
    
    const completed = execution.results.filter((r: any) => r.success).length;
    const failed = execution.results.filter((r: any) => !r.success).length;
    
    return {
      task_id: taskId,
      status: execution.status,
      progress: {
        total_subtasks: execution.results.length,
        completed,
        failed,
        pending: 0
      },
      execution_time: execution.total_execution_time,
      last_updated: new Date().toISOString()
    };
  } catch {
    // Check if plan exists (task not started)
    try {
      const planPath = `memory/plans/${taskId}.json`;
      await read({ path: planPath });
      
      return {
        task_id: taskId,
        status: "unknown",
        progress: {
          total_subtasks: 0,
          completed: 0,
          failed: 0,
          pending: 0
        },
        execution_time: 0,
        last_updated: new Date().toISOString()
      };
    } catch {
      throw new Error(`Task ${taskId} not found`);
    }
  }
}

/**
 * Get system-wide status
 */
async function getSystemStatus(): Promise<SystemStatus> {
  console.log("📊 System Status");
  
  // Get memory statistics
  const memStats = await viking.getStatistics();
  
  // Count tasks
  const { stdout: planFiles } = await exec({
    command: "ls memory/plans/*.json 2>/dev/null | wc -l || echo 0",
    timeout: 5000
  });
  
  const { stdout: execFiles } = await exec({
    command: "ls memory/executions/*.json 2>/dev/null | wc -l || echo 0",
    timeout: 5000
  });
  
  return {
    version: "1.0.0",
    uptime: Date.now(), // TODO: Track actual uptime
    active_tasks: 0, // TODO: Track active
    completed_tasks: parseInt(execFiles.trim()) || 0,
    failed_tasks: memStats.total_today, // Approximation
    memory_stats: {
      hot_errors: memStats.hot_count,
      warm_errors_today: memStats.warm_today_count,
      total_errors: memStats.total_today
    },
    agent_stats: {
      coder: {
        tasks_completed: 0,
        success_rate: 0,
        common_errors: []
      },
      researcher: {
        tasks_completed: 0,
        success_rate: 0,
        common_errors: []
      },
      reviewer: {
        tasks_completed: 0,
        success_rate: 0,
        common_errors: []
      }
    }
  };
}

export default maselStatus;
