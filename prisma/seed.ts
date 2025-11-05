/* eslint-disable no-console */
import { PrismaClient, TaskPriority, TaskStatus } from '@prisma/client';
import { createClient } from '@supabase/supabase-js';

import departments from './data/1_departments.json' assert { type: 'json' };
import users from './data/2_users.json' assert { type: 'json' };
import projects from './data/3_projects.json' assert { type: 'json' };
import tasks from './data/4_tasks.json' assert { type: 'json' };
import taskAssignments from './data/5_task_assignments.json' assert { type: 'json' };
import tags from './data/6_tags.json' assert { type: 'json' };
import taskTags from './data/7_task_tags.json' assert { type: 'json' };
import comments from './data/8_comments.json' assert { type: 'json' };
import taskLogs from './data/9_task_logs.json' assert { type: 'json' };
import projectCollaborators from './data/10_project_collaborator.json' assert { type: 'json' };

const prisma = new PrismaClient();

// Default password for all seeded accounts (works for local/staging/production)
const DEFAULT_PASSWORD = 'Password123!';

// Initialize Supabase Admin Client for creating auth users
const supabaseUrl = process.env.API_EXTERNAL_URL || 'http://localhost:8000';
const supabaseServiceKey = process.env.SERVICE_ROLE_KEY || '';
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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
  await prisma.projectCollaborator.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.teamMember.deleteMany({});
  await prisma.team.deleteMany({});
  await prisma.userProfile.deleteMany({});
  await prisma.department.deleteMany({});

  // 1. Departments
  console.log('📁 Seeding departments...');
  await prisma.department.createMany({ data: departments });

  // 2. Create Supabase Auth Users (triggers auto-create user profiles)
  console.log('🔐 Seeding Supabase Auth users...');
  for (const user of users) {
    try {
      // Delete existing auth user if exists (for re-seeding)
      const { data: existingUser } = await supabase.auth.admin.getUserById(
        user.id
      );
      if (existingUser?.user) {
        await supabase.auth.admin.deleteUser(user.id);
        console.log(`  ↻ Deleted existing auth user: ${user.email}`);
      }

      // Create new auth user with the same UUID from JSON
      // The trigger will auto-create the user profile from user_metadata
      const { error: authError } = await supabase.auth.admin.createUser({
        id: user.id, // Use the same UUID as in the JSON
        email: user.email,
        password: DEFAULT_PASSWORD,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          name: user.name,
          role: user.role,
          departmentId: user.departmentId,
          isHrAdmin: user.isHrAdmin || false,
        },
      });

      if (authError) {
        console.error(
          `  ❌ Failed to create auth user ${user.email}:`,
          authError.message
        );
      } else {
        console.log(`  ✓ Created auth user: ${user.email}`);
      }
    } catch (error) {
      console.error(`  ❌ Error creating auth user ${user.email}:`, error);
    }
  }

  // User profiles are now auto-created by the database trigger
  console.log('👤 User profiles auto-created by database trigger');

  // Update profiles with additional fields not handled by trigger (e.g., isHrAdmin)
  console.log('📝 Updating user profiles with additional fields...');
  for (const user of users) {
    if (user.isHrAdmin) {
      await prisma.userProfile.update({
        where: { id: user.id },
        data: { isHrAdmin: true },
      });
      console.log(`  ✓ Updated HR admin: ${user.email}`);
    }
  }

  // 4. Projects (add createdById if missing)
  console.log('📋 Seeding projects...');
  const transformedProjects = projects.map(p => ({
    ...p,
  }));

  await prisma.project.createMany({ data: transformedProjects });

  // 4b. Project Collaborators
  console.log('🔒 Seeding project collaborators...');
  // Get the list of valid project IDs from the seeded projects
  const validProjectIds = new Set(projects.map(p => p.id));

  // Filter collaborators to only include those for projects that exist
  const validCollaborators = projectCollaborators.filter(pc =>
    validProjectIds.has(pc.projectId)
  );

  if (validCollaborators.length > 0) {
    await prisma.projectCollaborator.createMany({
      data: validCollaborators.map(pc => ({
        projectId: pc.projectId,
        userId: pc.userId,
        departmentId: pc.departmentId,
        addedAt: new Date(pc.assignedAt),
      })),
    });
    console.log(`✅ Seeded ${validCollaborators.length} project collaborators`);
  } else {
    console.log(
      '⚠️  No valid project collaborators to seed (no matching projects)'
    );
  }

  // 5. Tasks (cast enums)
  console.log('✓ Seeding tasks...');
  const transformedTasks = tasks.map(t => ({
    ...t,
    priority: t.priority as TaskPriority,
    status: t.status as TaskStatus,
  }));
  await prisma.task.createMany({ data: transformedTasks });

  // 6. Task Assignments (add assignedById if missing)
  console.log('🔗 Seeding task assignments...');
  const transformedTaskAssignments = taskAssignments.map(a => ({
    ...a,
  }));
  await prisma.taskAssignment.createMany({ data: transformedTaskAssignments });

  // 7. Tags
  console.log('🏷️  Seeding tags...');
  await prisma.tag.createMany({ data: tags });

  // 8. Task Tags
  console.log('🔖 Seeding task tags...');
  await prisma.taskTag.createMany({ data: taskTags });

  // 9. Comments
  console.log('💬 Seeding comments...');
  await prisma.comment.createMany({ data: comments });

  // 10. Task Logs
  console.log('📝 Seeding task logs...');
  await prisma.taskLog.createMany({ data: taskLogs });

  console.log('✅ Database seeded successfully!');
  console.log('');
  console.log('🔑 Login credentials for all seeded accounts:');
  console.log(`   Password: ${DEFAULT_PASSWORD}`);
  console.log('   Example: jack.sim@allinone.com / Password123!');
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
