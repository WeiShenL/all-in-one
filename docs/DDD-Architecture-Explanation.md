# DDD Architecture: OLD vs NEW Explained

## 🎓 Understanding Domain-Driven Design (DDD)

---

## **OLD Architecture (Non-DDD):**

```
┌─────────────────────────────────────────┐
│         TaskService (OLD)               │
│  ┌────────────────────────────────────┐ │
│  │ Business Logic + Database Access   │ │
│  │                                    │ │
│  │ async create(data) {               │ │
│  │   // 1. Validate owner             │ │
│  │   const owner = await              │ │
│  │     this.prisma.userProfile...     │ │
│  │                                    │ │
│  │   // 2. Validate department        │ │
│  │   const dept = await               │ │
│  │     this.prisma.department...      │ │
│  │                                    │ │
│  │   // 3. Business rules             │ │
│  │   if (!owner.isActive) throw...    │ │
│  │                                    │ │
│  │   // 4. Save to database           │ │
│  │   await this.prisma.task.create... │ │
│  │ }                                  │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
         ↓ (talks directly to)
┌─────────────────────────────────────────┐
│            Prisma ORM                   │
│         (Database Layer)                │
└─────────────────────────────────────────┘
```

**Problem with OLD approach:**

- ❌ **Everything mixed together** - validation, business logic, database queries
- ❌ **Hard to test** - must mock Prisma for every test
- ❌ **Tight coupling** - can't change database without rewriting service
- ❌ **No business rules isolation** - priority validation scattered everywhere

---

## **NEW Architecture (DDD - Domain-Driven Design):**

```
┌──────────────────────────────────────────────────────────────┐
│                    DOMAIN LAYER (Task.ts)                     │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Business Logic ONLY (Pure Functions)            │ │
│  │                                                         │ │
│  │  class Task {                                          │ │
│  │    updatePriority(newPriority: number) {              │ │
│  │      // RULE: Priority must be 1-10                   │ │
│  │      if (newPriority < 1 || newPriority > 10) {      │ │
│  │        throw new InvalidPriorityError();              │ │
│  │      }                                                 │ │
│  │      this.priority = newPriority;                     │ │
│  │    }                                                   │ │
│  │  }                                                     │ │
│  │                                                         │ │
│  │  NO DATABASE CODE HERE! ✅                             │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↑ uses
┌──────────────────────────────────────────────────────────────┐
│                   SERVICE LAYER (TaskService.ts)              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Orchestration + External Validations            │ │
│  │                                                         │ │
│  │  class TaskService {                                   │ │
│  │    async updateTaskPriority(taskId, priority, user) { │ │
│  │      // 1. Get task from repository                   │ │
│  │      const task = await repo.getTaskById(taskId);     │ │
│  │                                                         │ │
│  │      // 2. Check authorization                         │ │
│  │      if (!task.isAssigned(user.id)) throw...          │ │
│  │                                                         │ │
│  │      // 3. Use DOMAIN to apply business rule           │ │
│  │      task.updatePriority(priority); // ← Domain!      │ │
│  │                                                         │ │
│  │      // 4. Save via repository                         │ │
│  │      await repo.updateTask(taskId, {                  │ │
│  │        priority: task.getPriority()                    │ │
│  │      });                                               │ │
│  │    }                                                   │ │
│  │  }                                                     │ │
│  │                                                         │ │
│  │  NO BUSINESS RULES HERE! ✅                            │ │
│  │  NO DIRECT DATABASE ACCESS! ✅                         │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓ uses
┌──────────────────────────────────────────────────────────────┐
│              REPOSITORY LAYER (ITaskRepository.ts +           │
│                         PrismaTaskRepository.ts)              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │         Database Access ONLY (Data In/Out)              │ │
│  │                                                         │ │
│  │  interface ITaskRepository {                           │ │
│  │    updateTask(taskId, data): Promise<void>            │ │
│  │  }                                                     │ │
│  │                                                         │ │
│  │  class PrismaTaskRepository implements ITaskRepo {    │ │
│  │    async updateTask(taskId, data) {                   │ │
│  │      await this.prisma.task.update({                  │ │
│  │        where: { id: taskId },                         │ │
│  │        data: data                                      │ │
│  │      });                                               │ │
│  │    }                                                   │ │
│  │  }                                                     │ │
│  │                                                         │ │
│  │  NO BUSINESS RULES HERE! ✅                            │ │
│  │  JUST PRISMA QUERIES! ✅                               │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
                              ↓ uses
┌──────────────────────────────────────────────────────────────┐
│                       Prisma ORM → Database                   │
└──────────────────────────────────────────────────────────────┘
```

---

## **WHY 3 LAYERS? Understanding the Separation**

### Each layer has **different responsibilities**:

### **1. DOMAIN (Task.ts)** - "What are the rules?"

```typescript
// DOMAIN: Pure business logic, no database
class Task {
  updatePriority(newPriority: number) {
    if (newPriority < 1 || newPriority > 10) {
      throw new InvalidPriorityError(); // ← BUSINESS RULE
    }
    this.priority = newPriority;
  }
}
```

**Job**: Enforce business rules (TM016, TM023, priority 1-10, etc.)

---

### **2. SERVICE (TaskService.ts)** - "How do we coordinate?"

```typescript
// SERVICE: Orchestration, authorization, external validation
class TaskService {
  async updateTaskPriority(
    taskId: string,
    priority: number,
    user: UserContext
  ) {
    // External validation: Does task exist?
    const task = await this.repository.getTaskById(taskId);

    // Authorization: Is user allowed?
    if (!task.isAssigned(user.id)) {
      throw new UnauthorizedError();
    }

    // Business logic: Let DOMAIN validate & update
    task.updatePriority(priority);

    // Persistence: Save changes
    await this.repository.updateTask(taskId, {
      priority: task.getPriority(),
    });

    // Logging: Track action
    await this.repository.logTaskAction(taskId, user.id, 'UPDATED_PRIORITY');
  }
}
```

**Job**: Coordinate everything (authorization, calling domain, saving, logging)

---

### **3. REPOSITORY (PrismaTaskRepository.ts)** - "How do we save/load?"

```typescript
// REPOSITORY: Database queries ONLY
class PrismaTaskRepository implements ITaskRepository {
  async updateTask(taskId: string, data: Partial<TaskData>) {
    await this.prisma.task.update({
      where: { id: taskId },
      data: data,
    });
  }

  async getTaskById(taskId: string) {
    return await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { assignments: true, tags: true },
    });
  }
}
```

**Job**: Talk to database (Prisma queries only)

---

## **🎯 THE KEY DIFFERENCE:**

### **OLD way:**

```typescript
// Everything in one method - MIXED CONCERNS
async updateStatus(id, status) {
  // Database query
  const task = await this.prisma.task.findUnique(...);

  // Business validation
  if (!task) throw new Error('Task not found');

  // More database queries
  if (status === 'COMPLETED' && task.recurringInterval) {
    await this.generateNextRecurringTask(task);
  }

  // Database save
  await this.prisma.task.update(...);
}
```

### **NEW way (DDD):**

```typescript
// DOMAIN: Business rules
class Task {
  updateStatus(newStatus: TaskStatus) {
    this.status = newStatus; // Simple assignment
  }
}

// SERVICE: Orchestration
class TaskService {
  async updateTaskStatus(taskId, newStatus, user) {
    const task = await this.repository.getTaskById(taskId); // ← Repository
    task.updateStatus(newStatus);                            // ← Domain
    await this.repository.updateTask(taskId, {...});        // ← Repository

    // Recurring logic
    if (newStatus === 'COMPLETED' && task.isRecurring()) {
      await this.generateNextRecurringInstance(task);       // ← Service orchestration
    }
  }
}

// REPOSITORY: Database only
class PrismaTaskRepository {
  async updateTask(taskId, data) {
    await this.prisma.task.update({...}); // Just Prisma
  }
}
```

---

## **💡 BENEFITS OF DDD (Why it's better):**

### **1. Easy Testing**

```typescript
// OLD: Must mock entire Prisma
const mockPrisma = {
  task: { findUnique: jest.fn(), update: jest.fn() },
  userProfile: { findMany: jest.fn() },
  // ... 20+ more mocks
};

// NEW: Just mock the interface
const mockRepository: ITaskRepository = {
  getTaskById: jest.fn(),
  updateTask: jest.fn(),
};
```

### **2. Business Rules in ONE Place**

```typescript
// OLD: Priority validation scattered everywhere
// - In create()
// - In update()
// - In multiple places

// NEW: ONE place in Domain
class Task {
  updatePriority(priority: number) {
    if (priority < 1 || priority > 10) {
      throw new InvalidPriorityError();
    }
  }
}
```

### **3. Can Change Database Easily**

```typescript
// Want to switch from Prisma to MongoDB?
// Just create MongoTaskRepository implementing ITaskRepository
// NO CHANGES to Service or Domain! ✅

class MongoTaskRepository implements ITaskRepository {
  async updateTask(taskId, data) {
    await this.mongoClient.tasks.updateOne({...});
  }
}
```

### **4. Clear Separation**

- **Domain** = Business rules (priority 1-10, max 5 assignees)
- **Service** = Workflow (auth, validation, orchestration, logging)
- **Repository** = Data (save, load, query)

---

## **📊 ANALOGY:**

Think of building a restaurant:

### **OLD way (Everything in one class):**

```
Chef does EVERYTHING:
- Takes orders from customers ❌
- Validates if ingredients exist ❌
- Cooks the food ✅
- Serves the food ❌
- Washes dishes ❌
- Manages inventory ❌
```

**Problem**: Chef is overwhelmed, hard to replace, can't test cooking separately

### **NEW way (DDD):**

```
Domain (Recipe):
- "To make pasta: boil water, add salt, cook 8 mins"
- Pure cooking instructions, no customer interaction

Service (Waiter/Coordinator):
- Takes order from customer
- Checks if ingredients available
- Tells chef to cook using Recipe
- Serves to customer
- Logs the order

Repository (Kitchen Storage):
- Get ingredients from storage
- Save leftovers
- Check inventory
```

**Result**: Each person has clear job, easy to test, easy to replace

---

## **🎯 Repository vs Service: What's the Difference?**

### **They DON'T have same code:**

**Repository**: "How do I save/load from database?"

```typescript
async updateTask(taskId, data) {
  await this.prisma.task.update({ where: { id: taskId }, data });
}
```

**Service**: "What needs to happen when updating a task?"

```typescript
async updateTaskPriority(taskId, priority, user) {
  // 1. Load task
  const task = await this.repository.getTaskById(taskId);

  // 2. Check authorization
  if (!authorized) throw error;

  // 3. Apply business rule (domain)
  task.updatePriority(priority);

  // 4. Save changes (repository)
  await this.repository.updateTask(taskId, { priority });

  // 5. Log action (repository)
  await this.repository.logTaskAction(...);

  return task;
}
```

**See the difference?** Repository is **one line** (database query), Service is **orchestrating 5 steps**.

---

## **📋 Summary Table**

| Layer          | Responsibility | Example                               | NO Allowed                                                  |
| -------------- | -------------- | ------------------------------------- | ----------------------------------------------------------- |
| **Domain**     | Business rules | `if (priority < 1) throw error`       | ❌ Database queries<br>❌ Authorization<br>❌ External APIs |
| **Service**    | Orchestration  | Load → Validate → Update → Save → Log | ❌ Business rules<br>❌ Direct Prisma                       |
| **Repository** | Data access    | `prisma.task.update(...)`             | ❌ Business rules<br>❌ Authorization                       |

---

## **🚀 Benefits Recap**

1. ✅ **Testability** - Easy to mock, isolated tests
2. ✅ **Maintainability** - Business rules in one place
3. ✅ **Flexibility** - Can swap database without touching business logic
4. ✅ **Clarity** - Each layer has single responsibility
5. ✅ **Reusability** - Domain logic can be used anywhere

---

## **📁 File Structure in Our Project**

```
src/
├── domain/
│   └── task/
│       ├── Task.ts                    # Domain: Business rules
│       ├── PriorityBucket.ts          # Domain: Value object
│       └── errors/TaskErrors.ts       # Domain: Custom errors
│
├── services/
│   └── task/
│       └── TaskService.ts             # Service: Orchestration
│
└── repositories/
    ├── ITaskRepository.ts             # Repository: Interface
    └── PrismaTaskRepository.ts        # Repository: Implementation
```

---

_This architecture ensures clean, testable, maintainable code that follows SOLID principles and Domain-Driven Design best practices._
