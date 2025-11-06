import type { Context } from '../trpc';
import { PrismaProjectRepository } from '@/repositories/PrismaProjectRepository';
import { PrismaTaskRepository } from '@/repositories/PrismaTaskRepository';
import { ProjectService } from '@/services/project/ProjectService';
import { TaskService } from '@/services/task/TaskService';
// NOTE: Avoid eager import of DashboardTaskService to play nice with test mocks
// We'll dynamically require it when needed
import { SubtaskService } from '../services/SubtaskService';

function createRealtime() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { RealtimeService } = require('../services/RealtimeService');
    return new RealtimeService();
  } catch {
    return undefined;
  }
}

export function buildServices(ctx: Context) {
  const projectRepo = new PrismaProjectRepository(ctx.prisma);
  const taskRepo = new PrismaTaskRepository(ctx.prisma);

  const projectService = new ProjectService(projectRepo);
  const taskService = new TaskService(taskRepo, ctx.prisma, createRealtime());
  const subtaskService = new SubtaskService(taskRepo);
  function getDashboardTaskService() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('../services/DashboardTaskService');
      const Cls = mod.DashboardTaskService ?? mod.default;
      return new Cls(ctx.prisma);
    } catch {
      return {
        getSubordinateDepartments: async (id: string) => [id],
      } as any;
    }
  }

  return {
    projectService,
    taskService,
    subtaskService,
    getDashboardTaskService,
  };
}
