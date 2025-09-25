import {
  PrismaClient,
  UserRole,
  TaskPriority,
  TaskStatus,
} from '@prisma/client';

import departments from './data/1_departments.json' assert { type: 'json' };
import users from './data/2_users.json' assert { type: 'json' };
import projects from './data/3_projects.json' assert { type: 'json' };
import tasks from './data/4_tasks.json' assert { type: 'json' };
import taskAssignments from './data/5_task_assignments.json' assert { type: 'json' };
import tags from './data/6_tags.json' assert { type: 'json' };
import taskTags from './data/7_task_tags.json' assert { type: 'json' };
import comments from './data/8_comments.json' assert { type: 'json' };
import taskLogs from './data/9_task_logs.json' assert { type: 'json' };

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Clear tables to avoid unique constraint conflicts. Order matters due to FK relationships.
  console.log('🧹 Clearing existing data...');
  await prisma.taskLog.deleteMany({});
  await prisma.taskFile.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.taskTag.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.taskAssignment.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.userProfile.deleteMany({});
  await prisma.department.deleteMany({});

  // 1. Departments
  console.log('📁 Seeding departments...');
  await prisma.department.createMany({ data: departments });

  // 2. Users
  console.log('👤 Seeding users...');
  const transformedUsers = users.map(u => ({
    ...u,
    role: u.role as UserRole,
  }));
  await prisma.userProfile.createMany({ data: transformedUsers });

  // 3. Projects (add createdById if missing)
  console.log('📋 Seeding projects...');
  const transformedProjects = projects.map(p => ({
    ...p,
  }));

  await prisma.project.createMany({ data: transformedProjects });

  // 4. Tasks (cast enums)
  console.log('✓ Seeding tasks...');
  const transformedTasks = tasks.map(t => ({
    ...t,
    priority: t.priority as TaskPriority,
    status: t.status as TaskStatus,
  }));
  await prisma.task.createMany({ data: transformedTasks });

  // 5. Task Assignments (add assignedById if missing)
  console.log('🔗 Seeding task assignments...');
  const transformedTaskAssignments = taskAssignments.map(a => ({
    ...a,
  }));
  await prisma.taskAssignment.createMany({ data: transformedTaskAssignments });

  // 6. Tags
  console.log('🏷️  Seeding tags...');
  await prisma.tag.createMany({ data: tags });

  // 7. Task Tags
  console.log('🔖 Seeding task tags...');
  await prisma.taskTag.createMany({ data: taskTags });

  // 8. Comments
  console.log('💬 Seeding comments...');
  await prisma.comment.createMany({ data: comments });

  // 9. Task Logs
  console.log('📝 Seeding task logs...');
  await prisma.taskLog.createMany({ data: taskLogs });

  console.log('✅ Database seeded successfully!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async e => {
    console.error('❌ Error seeding database:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
