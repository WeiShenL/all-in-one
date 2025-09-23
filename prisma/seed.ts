import { PrismaClient } from '@prisma/client';
import departments from './data/1_departments.json';
import users from './data/2_users.json';
import projects from './data/3_projects.json';
import tasks from './data/4_tasks.json';
import taskAssignments from './data/5_task_assignments.json';
import tags from './data/6_tags.json';
import taskTags from './data/7_task_tags.json';
import comments from './data/8_comments.json';
import taskLogs from './data/9_task_logs.json';

const prisma = new PrismaClient();

async function main() {
  console.warn('🌱 Starting database seed...');

  // 1. Departments
  console.warn('📁 Seeding departments...');
  await prisma.department.createMany({
    data: departments,
  });

  // 2. Users
  console.warn('👤 Seeding users...');
  await prisma.userProfile.createMany({
    data: users,
  });

  // 3. Projects
  console.warn('📋 Seeding projects...');
  await prisma.project.createMany({
    data: projects,
  });

  // 4. Tasks
  console.warn('✓ Seeding tasks...');
  await prisma.task.createMany({
    data: tasks,
  });

  // 5. Task Assignments
  console.warn('🔗 Seeding task assignments...');
  await prisma.taskAssignment.createMany({
    data: taskAssignments,
  });

  // 6. Tags
  console.warn('🏷️  Seeding tags...');
  await prisma.tag.createMany({
    data: tags,
  });

  // 7. Task Tags
  console.warn('🔖 Seeding task tags...');
  await prisma.taskTag.createMany({
    data: taskTags,
  });

  // 8. Comments
  console.warn('💬 Seeding comments...');
  await prisma.comment.createMany({
    data: comments,
  });

  // 9. Task Logs
  console.warn('📝 Seeding task logs...');
  await prisma.taskLog.createMany({
    data: taskLogs,
  });

  console.warn('✅ Database seeded successfully!');
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
