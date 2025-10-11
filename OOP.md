# Backend Architecture Guide: OOP and Domain-Driven Design (DDD)

## Overview

This document outlines two architectural approaches used in our tRPC backend:

1. **OOP Service Layer Pattern** - For simpler domains with straightforward CRUD operations
2. **Domain-Driven Design (DDD)** - For complex domains with rich business logic

Both patterns coexist in the codebase, applied based on domain complexity.

---

## Table of Contents

1. [When to Use Which Pattern](#when-to-use-which-pattern)
2. [OOP Service Layer Pattern](#oop-service-layer-pattern)
3. [Domain-Driven Design Pattern](#domain-driven-design-pattern)
4. [Testing Strategies](#testing-strategies)

---

## When to Use Which Pattern

### Use OOP Service Layer When:

- ✅ Simple CRUD operations
- ✅ Few business rules to enforce
- ✅ Entities are mostly data containers
- ✅ Read-heavy workloads
- ✅ Straightforward validation

**Examples**: Department hierarchy, User profiles, Team management

### Use DDD When:

- ✅ Complex business rules and invariants
- ✅ Rich entity behavior and lifecycle
- ✅ Many validation requirements
- ✅ Domain concepts require explicit modeling
- ✅ High complexity business logic

**Examples**: Task management (priority buckets, recurring tasks, subtask limits), Order processing, Workflow management

---

## OOP Service Layer Pattern

### Architecture

```
src/app/server/
├── services/              # Business Logic Layer (OOP Classes)
│   ├── BaseService.ts          # Abstract base with common CRUD
│   ├── DepartmentService.ts    # Department operations
│   ├── UserProfileService.ts   # User profile operations
│   ├── TeamService.ts          # Team operations
│   ├── ProjectService.ts       # Project operations
│   └── index.ts
├── routers/               # API Layer (tRPC)
│   ├── department.ts           # Thin wrapper → DepartmentService
│   ├── userProfile.ts          # Thin wrapper → UserProfileService
│   └── _app.ts
└── types/                 # Shared TypeScript types
    └── index.ts
```

### OOP Principles Applied

1. **Encapsulation**: Business logic encapsulated within service classes
2. **Inheritance**: All services extend `BaseService` abstract class
3. **Single Responsibility**: Each service manages ONE entity type
4. **Dependency Injection**: Services receive PrismaClient via constructor
5. **Polymorphism**: Services can override base class methods

### Example Implementation

#### BaseService (Abstract Class)

```typescript
// services/BaseService.ts
export abstract class BaseService {
  constructor(protected prisma: PrismaClient) {}

  protected async validateExists(id: string, model: string): Promise<void> {
    const record = await (this.prisma as any)[model].findUnique({
      where: { id },
    });
    if (!record) {
      throw new Error(`${model} not found`);
    }
  }

  protected handleError(error: unknown, operation: string): never {
    console.error(`Error in ${operation}:`, error);
    throw error instanceof Error ? error : new Error(`Failed to ${operation}`);
  }
}
```

#### Service Class Example

```typescript
// services/DepartmentService.ts
export class DepartmentService extends BaseService {
  constructor(prisma: PrismaClient) {
    super(prisma);
  }

  /**
   * Get all active departments with hierarchical structure
   */
  async getAll(): Promise<DepartmentWithLevel[]> {
    const departments = await this.prisma.department.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });

    return this.buildHierarchy(departments);
  }

  /**
   * Create new department
   */
  async createDepartment(data: CreateDepartmentInput): Promise<Department> {
    // Validation
    if (data.parentId) {
      await this.validateExists(data.parentId, 'department');
    }

    return this.prisma.department.create({
      data: {
        name: data.name,
        parentId: data.parentId,
        managerId: data.managerId,
      },
    });
  }

  /**
   * Build hierarchical department tree
   * @private
   */
  private buildHierarchy(departments: Department[]): DepartmentWithLevel[] {
    const result: DepartmentWithLevel[] = [];

    const addDepartmentAndChildren = (
      parentId: string | null,
      level: number
    ) => {
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

    addDepartmentAndChildren(null, 0);
    return result;
  }
}
```

#### tRPC Router (Thin Wrapper)

```typescript
// routers/department.ts
import { DepartmentService } from '../services/DepartmentService';
import { router, publicProcedure } from '../trpc';
import { z } from 'zod';

export const departmentRouter = router({
  getAll: publicProcedure.query(({ ctx }) => {
    const service = new DepartmentService(ctx.prisma);
    return service.getAll();
  }),

  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      return service.getById(input.id);
    }),

  create: publicProcedure
    .input(
      z.object({
        name: z.string(),
        parentId: z.string().optional(),
        managerId: z.string().optional(),
      })
    )
    .mutation(({ ctx, input }) => {
      const service = new DepartmentService(ctx.prisma);
      return service.createDepartment(input);
    }),
});
```

### Benefits of OOP Service Pattern

✅ **Clear Separation**: API layer (routers) separated from business logic (services)
✅ **Reusability**: Services can be used outside tRPC context
✅ **Testability**: Services can be unit tested with mocked Prisma
✅ **Maintainability**: Easy to locate and modify business logic
✅ **Consistency**: All services follow same pattern via BaseService

### Limitations

❌ **Anemic Domain Model**: Data structures lack behavior
❌ **Business Logic Scattered**: Logic spread across service methods
❌ **Tight Coupling**: Services directly depend on Prisma schema
❌ **Invariant Enforcement**: Hard to guarantee domain rules always followed

**For complex domains with many rules, use DDD instead.**

---

## Domain-Driven Design Pattern

### Why DDD?

When a domain has complex business rules, the OOP Service pattern becomes insufficient. DDD provides:

✅ **Rich Domain Models**: Entities encapsulate behavior and enforce invariants
✅ **Ubiquitous Language**: Code matches business terminology
✅ **Better Testing**: Domain logic testable without database
✅ **Flexibility**: Infrastructure (database) can be swapped easily
✅ **Scalability**: Complex rules managed within bounded contexts

### DDD Architecture (4 Layers)

```
┌─────────────────────────────────────────────┐
│   Presentation Layer (tRPC Routers)        │ ← API Endpoints
├─────────────────────────────────────────────┤
│   Application Layer (Services)             │ ← Use Case Orchestration
├─────────────────────────────────────────────┤
│   Domain Layer (Entities)                  │ ← Business Logic & Rules
├─────────────────────────────────────────────┤
│   Infrastructure Layer (Repositories)      │ ← Data Persistence
└─────────────────────────────────────────────┘
```

### Example: Task Management Domain

```
src/
├── domain/task/                    # DOMAIN LAYER
│   ├── Task.ts                     # Aggregate Root (Rich Entity)
│   ├── PriorityBucket.ts          # Value Object
│   └── errors/
│       └── TaskErrors.ts          # Domain Errors
│
├── services/task/                  # APPLICATION LAYER
│   └── TaskService.ts             # Use Case Orchestration
│
├── repositories/                   # INFRASTRUCTURE LAYER
│   ├── ITaskRepository.ts         # Repository Interface (Port)
│   └── PrismaTaskRepository.ts    # Prisma Implementation (Adapter)
│
└── app/server/routers/             # PRESENTATION LAYER
    └── task.ts                    # tRPC Router
```

### Layer 1: Domain Layer (Pure Business Logic)

**Purpose**: Encapsulate business rules, no dependencies on frameworks

#### Aggregate Root Example

```typescript
// domain/task/Task.ts
export class Task {
  private constructor(private data: TaskData) {
    // Private constructor - only factory methods create tasks
  }

  /**
   * Factory method to create new task with validation
   */
  static create(data: Omit<TaskData, 'id' | 'createdAt' | 'updatedAt'>): Task {
    // Enforce business invariants
    if (data.assignments.size < 1) {
      throw new MinAssigneeRequiredError('Task must have at least 1 assignee');
    }
    if (data.assignments.size > 5) {
      throw new MaxAssigneesReachedError(
        'Task cannot have more than 5 assignees'
      );
    }
    if (data.priorityBucket < 1 || data.priorityBucket > 10) {
      throw new InvalidPriorityError('Priority must be between 1 and 10');
    }

    return new Task({
      ...data,
      id: generateId(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  /**
   * Business logic method - Update task title
   */
  updateTitle(newTitle: string): void {
    if (!newTitle || newTitle.trim().length === 0) {
      throw new InvalidTitleError('Title cannot be empty');
    }
    if (newTitle.length > 255) {
      throw new InvalidTitleError('Title cannot exceed 255 characters');
    }

    this.data.title = newTitle;
    this.data.updatedAt = new Date();
  }

  /**
   * Business logic method - Add assignee
   */
  addAssignee(userId: string): void {
    if (this.data.assignments.size >= 5) {
      throw new MaxAssigneesReachedError('Cannot add more than 5 assignees');
    }
    if (this.data.assignments.has(userId)) {
      throw new Error('User already assigned to this task');
    }

    this.data.assignments.add(userId);
    this.data.updatedAt = new Date();
  }

  /**
   * Business logic method - Remove assignee
   */
  removeAssignee(userId: string): void {
    if (this.data.assignments.size <= 1) {
      throw new MinAssigneeRequiredError('Task must have at least 1 assignee');
    }
    if (!this.data.assignments.has(userId)) {
      throw new Error('User not assigned to this task');
    }

    this.data.assignments.delete(userId);
    this.data.updatedAt = new Date();
  }

  // Getters (read-only access to internal state)
  getId(): string {
    return this.data.id;
  }
  getTitle(): string {
    return this.data.title;
  }
  getPriority(): PriorityBucket {
    return this.data.priorityBucket;
  }
  getAssignees(): Set<string> {
    return new Set(this.data.assignments);
  }
  getUpdatedAt(): Date {
    return this.data.updatedAt;
  }
}
```

#### Value Object Example

```typescript
// domain/task/PriorityBucket.ts
export class PriorityBucket {
  private constructor(private readonly level: number) {}

  static fromLevel(level: number): PriorityBucket {
    if (level < 1 || level > 10) {
      throw new InvalidPriorityError('Priority must be between 1 and 10');
    }
    return new PriorityBucket(level);
  }

  getLevel(): number {
    return this.level;
  }

  getBucket(): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (this.level <= 3) return 'LOW';
    if (this.level <= 6) return 'MEDIUM';
    if (this.level <= 8) return 'HIGH';
    return 'CRITICAL';
  }

  equals(other: PriorityBucket): boolean {
    return this.level === other.level;
  }
}
```

### Layer 2: Application Layer (Use Case Orchestration)

**Purpose**: Coordinate domain objects and infrastructure

```typescript
// services/task/TaskService.ts
export interface UserContext {
  userId: string;
  role: 'STAFF' | 'MANAGER' | 'HR_ADMIN';
  departmentId: string;
}

export class TaskService {
  constructor(private taskRepository: ITaskRepository) {}

  /**
   * Use Case: Create Task
   * Orchestrates domain creation and persistence
   */
  async createTask(
    data: CreateTaskInput,
    creator: UserContext
  ): Promise<{ id: string }> {
    // 1. Validate external dependencies (database checks)
    if (data.projectId) {
      const projectExists = await this.taskRepository.validateProjectExists(
        data.projectId
      );
      if (!projectExists) {
        throw new Error('Project not found');
      }
    }

    if (data.parentTaskId) {
      const parentTask = await this.taskRepository.getParentTaskDepth(
        data.parentTaskId
      );
      if (!parentTask) {
        throw new Error('Parent task not found');
      }
      if (parentTask.parentTaskId) {
        throw new Error('Maximum subtask depth is 2 levels');
      }
    }

    const validAssignees = await this.taskRepository.validateAssignees(
      data.assigneeIds
    );
    if (!validAssignees.allExist) {
      throw new Error('One or more assignees not found');
    }

    // 2. Create domain entity (business rules enforced here)
    const task = Task.create({
      title: data.title,
      description: data.description,
      priorityBucket: data.priority,
      dueDate: data.dueDate,
      status: TaskStatus.TO_DO,
      ownerId: creator.userId,
      departmentId: creator.departmentId,
      projectId: data.projectId || null,
      parentTaskId: data.parentTaskId || null,
      recurringInterval: data.recurringInterval || null,
      isArchived: false,
      assignments: new Set(data.assigneeIds),
      tags: new Set(data.tags || []),
    });

    // 3. Persist via repository
    const result = await this.taskRepository.createTask({
      id: task.getId(),
      title: task.getTitle(),
      description: task.getDescription(),
      priority: task.getPriority().getLevel(),
      // ... map domain to persistence model
    });

    // 4. Log action
    await this.taskRepository.logTaskAction(
      result.id,
      creator.userId,
      'CREATED',
      { title: data.title }
    );

    return result;
  }

  /**
   * Use Case: Update Task Title
   */
  async updateTaskTitle(
    taskId: string,
    newTitle: string,
    user: UserContext
  ): Promise<Task> {
    // 1. Fetch task data
    const taskData = await this.taskRepository.getTaskByIdFull(taskId);
    if (!taskData) {
      throw new Error('Task not found');
    }

    // 2. Reconstruct domain entity from persistence
    const task = this.reconstructTaskFromData(taskData);

    // 3. Authorization check
    this.ensureUserCanModifyTask(task, user);

    // 4. Execute domain operation (business logic enforced by domain)
    task.updateTitle(newTitle);

    // 5. Persist changes
    await this.taskRepository.updateTask(taskId, {
      title: task.getTitle(),
      updatedAt: task.getUpdatedAt(),
    });

    // 6. Log action
    await this.taskRepository.logTaskAction(
      taskId,
      user.userId,
      'TITLE_CHANGED',
      { oldTitle: taskData.title, newTitle }
    );

    return task;
  }

  private reconstructTaskFromData(data: any): Task {
    return new Task({
      id: data.id,
      title: data.title,
      description: data.description,
      priorityBucket: data.priority,
      dueDate: data.dueDate,
      // ... full reconstruction
    });
  }

  private ensureUserCanModifyTask(task: Task, user: UserContext): void {
    const isOwner = task.getOwnerId() === user.userId;
    const isAssigned = task.getAssignees().has(user.userId);

    if (!isOwner && !isAssigned) {
      throw new Error(
        'Unauthorized: You must be owner or assigned to modify this task'
      );
    }
  }
}
```

### Layer 3: Infrastructure Layer (Persistence)

**Purpose**: Abstract database details, implement repository pattern

#### Repository Interface (Port)

```typescript
// repositories/ITaskRepository.ts
export interface ITaskRepository {
  // Create
  createTask(data: CreateTaskData): Promise<{ id: string }>;

  // Read
  getTaskById(taskId: string): Promise<BasicTaskData | null>;
  getTaskByIdFull(taskId: string): Promise<TaskWithRelations | null>;
  getUserTasks(userId: string, includeArchived: boolean): Promise<TaskData[]>;

  // Update
  updateTask(taskId: string, data: Partial<TaskData>): Promise<void>;

  // Validation (external dependencies)
  validateProjectExists(projectId: string): Promise<boolean>;
  validateAssignees(userIds: string[]): Promise<{
    allExist: boolean;
    allActive: boolean;
  }>;

  // Actions
  logTaskAction(
    taskId: string,
    userId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void>;
}
```

#### Prisma Adapter Implementation

```typescript
// repositories/PrismaTaskRepository.ts
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private prisma: PrismaClient) {}

  async createTask(data: CreateTaskData): Promise<{ id: string }> {
    const task = await this.prisma.task.create({
      data: {
        id: data.id,
        title: data.title,
        description: data.description,
        priority: data.priority,
        dueDate: data.dueDate,
        ownerId: data.ownerId,
        departmentId: data.departmentId,
        // ... map domain data to Prisma schema
      },
    });

    // Create assignments
    if (data.assigneeIds && data.assigneeIds.length > 0) {
      await this.prisma.taskAssignment.createMany({
        data: data.assigneeIds.map(userId => ({
          taskId: task.id,
          userId,
          assignedById: data.ownerId,
        })),
      });
    }

    return { id: task.id };
  }

  async getTaskByIdFull(taskId: string): Promise<TaskWithRelations | null> {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignments: true,
        tags: { include: { tag: true } },
        comments: true,
        files: true,
      },
    });
  }

  async validateProjectExists(projectId: string): Promise<boolean> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });
    return project !== null;
  }

  async logTaskAction(
    taskId: string,
    userId: string,
    action: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    await this.prisma.taskLog.create({
      data: {
        taskId,
        userId,
        action,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
  }
}
```

### Layer 4: Presentation Layer (API)

**Purpose**: Expose domain operations via tRPC API

```typescript
// app/server/routers/task.ts
import { router, publicProcedure } from '../trpc';
import { TaskService } from '../../../services/task/TaskService';
import { PrismaTaskRepository } from '../../../repositories/PrismaTaskRepository';
import { z } from 'zod';

export const taskRouter = router({
  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1),
        description: z.string(),
        priority: z.number().min(1).max(10),
        dueDate: z.coerce.date(),
        assigneeIds: z.array(z.string().uuid()).min(1).max(5),
        projectId: z.string().uuid().optional(),
        parentTaskId: z.string().uuid().optional(),
        tags: z.array(z.string()).optional(),
        recurringInterval: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const user = await getUserContext(ctx);

      return await service.createTask(input, user);
    }),

  updateTitle: publicProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        title: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const repository = new PrismaTaskRepository(ctx.prisma);
      const service = new TaskService(repository);
      const user = await getUserContext(ctx);

      const task = await service.updateTaskTitle(
        input.taskId,
        input.title,
        user
      );

      // Serialize domain object to JSON for tRPC
      return serializeTask(task);
    }),
});
```

### Key DDD Patterns

#### 1. Aggregate Root

**Task** is an Aggregate Root - controls access to related entities

```typescript
class Task {
  // Comments must go through Task aggregate
  addCommentToTask(content: string, authorId: string): void {
    const comment = {
      id: generateId(),
      content,
      authorId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.data.comments.push(comment);
  }

  // Only comment author can edit
  updateComment(commentId: string, newContent: string, userId: string): void {
    const comment = this.data.comments.find(c => c.id === commentId);
    if (!comment) throw new CommentNotFoundError();
    if (comment.authorId !== userId) throw new UnauthorizedError();

    comment.content = newContent;
    comment.updatedAt = new Date();
  }
}
```

#### 2. Value Objects

**PriorityBucket** is immutable, identified by value

```typescript
const p1 = PriorityBucket.fromLevel(8);
const p2 = PriorityBucket.fromLevel(8);
// p1.equals(p2) === true (value equality)
```

#### 3. Repository Pattern (Ports & Adapters)

Dependency Inversion: Domain depends on interface, not Prisma

```typescript
// Application depends on interface
class TaskService {
  constructor(private taskRepository: ITaskRepository) {} // ← Interface
}

// Infrastructure provides implementation
const prismaRepo = new PrismaTaskRepository(prisma); // ← Prisma adapter
const service = new TaskService(prismaRepo);

// OR for testing
const mockRepo = new InMemoryTaskRepository(); // ← Test adapter
const service = new TaskService(mockRepo);
```

### Benefits of DDD

✅ **Invariant Protection**: Impossible to create invalid domain objects
✅ **Testability**: Domain logic testable without database
✅ **Maintainability**: Business rules centralized in domain layer
✅ **Flexibility**: Can swap Prisma for another ORM easily
✅ **Ubiquitous Language**: Code matches business terminology
✅ **Complexity Management**: Clear boundaries between layers

---

## Testing Strategies

### OOP Service Testing

```typescript
// tests/unit/services/DepartmentService.test.ts
describe('DepartmentService', () => {
  let service: DepartmentService;
  let mockPrisma: jest.Mocked<PrismaClient>;

  beforeEach(() => {
    mockPrisma = {
      department: {
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    } as any;

    service = new DepartmentService(mockPrisma);
  });

  it('should get all departments', async () => {
    mockPrisma.department.findMany.mockResolvedValue([
      { id: '1', name: 'Engineering', parentId: null },
      { id: '2', name: 'Backend', parentId: '1' },
    ]);

    const result = await service.getAll();

    expect(result).toHaveLength(2);
    expect(result[0].level).toBe(0); // Top level
    expect(result[1].level).toBe(1); // Child level
  });
});
```

### DDD Testing (3-Layer Approach)

#### Layer 1: Domain Tests (Pure Unit Tests)

```typescript
// tests/unit/domain/task/Task.create.test.ts
describe('Task.create', () => {
  const validData = {
    title: 'Test Task',
    description: 'Description',
    priorityBucket: 5,
    dueDate: new Date(),
    status: TaskStatus.TO_DO,
    ownerId: 'user-1',
    departmentId: 'dept-1',
    projectId: null,
    parentTaskId: null,
    recurringInterval: null,
    isArchived: false,
    assignments: new Set(['user-1']),
    tags: new Set(),
  };

  it('should create task with valid data', () => {
    const task = Task.create(validData);

    expect(task.getTitle()).toBe('Test Task');
    expect(task.getPriority().getLevel()).toBe(5);
  });

  it('should enforce minimum 1 assignee', () => {
    expect(() =>
      Task.create({
        ...validData,
        assignments: new Set(), // Empty
      })
    ).toThrow(MinAssigneeRequiredError);
  });

  it('should enforce maximum 5 assignees', () => {
    expect(() =>
      Task.create({
        ...validData,
        assignments: new Set(['u1', 'u2', 'u3', 'u4', 'u5', 'u6']),
      })
    ).toThrow(MaxAssigneesReachedError);
  });
});
```

#### Layer 2: Service Tests (Mock Repository)

```typescript
// tests/unit/services/TaskService.test.ts
describe('TaskService', () => {
  let service: TaskService;
  let mockRepository: jest.Mocked<ITaskRepository>;

  beforeEach(() => {
    mockRepository = {
      createTask: jest.fn(),
      getTaskByIdFull: jest.fn(),
      updateTask: jest.fn(),
      validateProjectExists: jest.fn(),
      validateAssignees: jest.fn(),
      logTaskAction: jest.fn(),
    } as any;

    service = new TaskService(mockRepository);
  });

  it('should create task via domain model', async () => {
    mockRepository.validateAssignees.mockResolvedValue({
      allExist: true,
      allActive: true,
    });
    mockRepository.createTask.mockResolvedValue({ id: 'task-1' });

    const result = await service.createTask(
      {
        title: 'New Task',
        description: 'Description',
        priority: 8,
        dueDate: new Date(),
        assigneeIds: ['user-1'],
      },
      { userId: 'user-1', role: 'STAFF', departmentId: 'dept-1' }
    );

    expect(result.id).toBe('task-1');
    expect(mockRepository.createTask).toHaveBeenCalled();
  });
});
```

#### Layer 3: Integration Tests (Real Database)

```typescript
// tests/integration/task/task-creation.test.ts
describe('Task Creation - Integration', () => {
  let taskService: TaskService;
  let prisma: PrismaClient;

  beforeAll(async () => {
    prisma = new PrismaClient();
    const repository = new PrismaTaskRepository(prisma);
    taskService = new TaskService(repository);
  });

  it('should persist task to database', async () => {
    const result = await taskService.createTask(
      {
        title: 'Integration Test Task',
        description: 'Test Description',
        priority: 7,
        dueDate: new Date('2025-12-31'),
        assigneeIds: [testUser.id],
      },
      testUser
    );

    const saved = await prisma.task.findUnique({
      where: { id: result.id },
    });

    expect(saved).toBeDefined();
    expect(saved!.title).toBe('Integration Test Task');
  });
});
```

---

## Summary

| Aspect             | OOP Services       | DDD                       |
| ------------------ | ------------------ | ------------------------- |
| **Complexity**     | Low-Medium         | High                      |
| **Business Logic** | In Service Methods | In Domain Entities        |
| **Data**           | Prisma Types       | Domain Types              |
| **Validation**     | Service Layer      | Domain Layer              |
| **Testing**        | Mock Prisma        | Mock Repository Interface |
| **Flexibility**    | Tied to Prisma     | Database-Agnostic         |
| **Use Cases**      | Simple CRUD        | Complex Business Rules    |

**Both patterns are valid and useful** - choose based on domain complexity.

---

**For detailed testing guidelines and project structure, see [DEVELOPMENT.md](./DEVELOPMENT.md)**
