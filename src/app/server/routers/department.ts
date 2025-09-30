import { router, publicProcedure } from '../trpc';

interface DepartmentWithLevel {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
}

// Helper function to build hierarchical department tree
function buildDepartmentHierarchy(
  departments: Array<{ id: string; name: string; parentId: string | null }>
): DepartmentWithLevel[] {
  const result: DepartmentWithLevel[] = [];

  // Add departments with their levels
  const addDepartmentAndChildren = (parentId: string | null, level: number) => {
    const children = departments
      .filter(d => d.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const child of children) {
      result.push({
        id: child.id,
        name: child.name,
        parentId: child.parentId,
        level,
      });
      addDepartmentAndChildren(child.id, level + 1);
    }
  };

  // Start from root (departments with no parent)
  addDepartmentAndChildren(null, 0);

  return result;
}

export const departmentRouter = router({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const departments = await ctx.prisma.department.findMany({
      select: {
        id: true,
        name: true,
        parentId: true,
      },
      where: {
        isActive: true,
      },
    });

    return buildDepartmentHierarchy(departments);
  }),
});
