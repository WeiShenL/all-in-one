import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // 1. Departments
  console.log("📁 Seeding departments...");
  const departments = require("./data/1_departments.json");
  await prisma.department.createMany({
    data: departments,
  });

  // 2. Users
  console.log("👤 Seeding users...");
  const users = require("./data/2_users.json");
  await prisma.userProfile.createMany({
    data: users,
  });

  // 3. Projects
  console.log("📋 Seeding projects...");
  const projects = require("./data/3_projects.json");
  await prisma.project.createMany({
    data: projects,
  });

  // 4. Tasks
  console.log("✓ Seeding tasks...");
  const tasks = require("./data/4_tasks.json");
  await prisma.task.createMany({
    data: tasks,
  });

  // 5. Task Assignments
  console.log("🔗 Seeding task assignments...");
  const taskAssignments = require("./data/5_task_assignments.json");
  await prisma.taskAssignment.createMany({
    data: taskAssignments,
  });

  // 6. Tags
  console.log("🏷️  Seeding tags...");
  const tags = require("./data/6_tags.json");
  await prisma.tag.createMany({
    data: tags,
  });

  // 7. Task Tags
  console.log("🔖 Seeding task tags...");
  const taskTags = require("./data/7_task_tags.json");
  await prisma.taskTag.createMany({
    data: taskTags,
  });

  // 8. Comments
  console.log("💬 Seeding comments...");
  const comments = require("./data/8_comments.json");
  await prisma.comment.createMany({
    data: comments,
  });

  // 9. Task Logs
  console.log("📝 Seeding task logs...");
  const taskLogs = require("./data/9_task_logs.json");
  await prisma.taskLog.createMany({
    data: taskLogs,
  });

  console.log("✅ Database seeded successfully!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Error seeding database:", e);
    await prisma.$disconnect();
    process.exit(1);
  });