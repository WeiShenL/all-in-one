import { DepartmentService } from '@/app/server/services/DepartmentService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  department: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('DepartmentService', () => {
  let service: DepartmentService;

  beforeEach(() => {
    service = new DepartmentService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('getAll', () => {
    it('should get all active departments with hierarchy', async () => {
      const mockDepartments = [
        { id: '1', name: 'Engineering', parentId: null },
        { id: '2', name: 'Frontend', parentId: '1' },
        { id: '3', name: 'Backend', parentId: '1' },
      ];

      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue(
        mockDepartments
      );

      const result = await service.getAll();

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        select: { id: true, name: true, parentId: true },
        where: { isActive: true },
      });

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({
        id: '1',
        name: 'Engineering',
        parentId: null,
        level: 0,
      });
      expect(result[1].level).toBe(1); // Frontend is child
      expect(result[2].level).toBe(1); // Backend is child
    });

    it('should return empty array when no departments exist', async () => {
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('getById', () => {
    it('should get department by ID with related data', async () => {
      const mockDepartment = {
        id: '1',
        name: 'Engineering',
        parentId: null,
        manager: {
          id: 'user1',
          name: 'John Doe',
          email: 'john@example.com',
          role: 'MANAGER',
        },
        children: [{ id: '2', name: 'Frontend' }],
        members: [
          {
            id: 'user2',
            name: 'Jane',
            email: 'jane@example.com',
            role: 'STAFF',
          },
        ],
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(
        mockDepartment
      );

      const result = await service.getById('1');

      expect(mockPrisma.department.findUnique).toHaveBeenCalledWith({
        where: { id: '1' },
        include: expect.any(Object),
      });

      expect(result).toEqual(mockDepartment);
    });

    it('should return null when department not found', async () => {
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error when ID is empty', async () => {
      await expect(service.getById('')).rejects.toThrow(
        'Department ID is required'
      );
    });
  });

  describe('create', () => {
    it('should create a new department', async () => {
      const input = {
        name: 'Sales',
        parentId: undefined,
        managerId: undefined,
      };

      const mockCreated = {
        id: 'new-id',
        name: 'Sales',
        parentId: null,
        managerId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.department.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.create(input);

      expect(mockPrisma.department.create).toHaveBeenCalledWith({
        data: {
          name: 'Sales',
          parentId: undefined,
          managerId: undefined,
        },
      });

      expect(result).toEqual(mockCreated);
    });

    it('should create department with parent', async () => {
      const input = {
        name: 'Mobile',
        parentId: 'eng-id',
      };

      // Mock parent exists
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'eng-id',
        name: 'Engineering',
      });

      const mockCreated = {
        id: 'new-id',
        name: 'Mobile',
        parentId: 'eng-id',
        managerId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.department.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.create(input);

      expect(result.parentId).toBe('eng-id');
    });

    it('should throw error when parent department not found', async () => {
      const input = {
        name: 'Mobile',
        parentId: 'nonexistent',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input)).rejects.toThrow(
        'Parent department not found'
      );
    });
  });

  describe('update', () => {
    it('should update department', async () => {
      const existingDept = {
        id: '1',
        name: 'Engineering',
        parentId: null,
      };

      const updateData = {
        name: 'Engineering Department',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(
        existingDept
      );

      const mockUpdated = {
        ...existingDept,
        ...updateData,
        updatedAt: new Date(),
      };

      (mockPrisma.department.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await service.update('1', updateData);

      expect(mockPrisma.department.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: updateData,
      });

      expect(result.name).toBe('Engineering Department');
    });

    it('should throw error when department not found', async () => {
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow('Department not found');
    });

    it('should throw error when trying to set itself as parent', async () => {
      const existingDept = {
        id: '1',
        name: 'Engineering',
        parentId: null,
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(
        existingDept
      );

      await expect(service.update('1', { parentId: '1' })).rejects.toThrow(
        'Department cannot be its own parent'
      );
    });
  });

  describe('delete', () => {
    it('should soft delete department (set isActive to false)', async () => {
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([]); // No children

      const mockDeleted = {
        id: '1',
        name: 'Old Department',
        isActive: false,
        updatedAt: new Date(),
      };

      (mockPrisma.department.update as jest.Mock).mockResolvedValue(
        mockDeleted
      );

      const result = await service.delete('1');

      expect(mockPrisma.department.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { isActive: false },
      });

      expect(result.isActive).toBe(false);
    });

    it('should throw error when department has active children', async () => {
      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue([
        {
          id: 'child1',
          name: 'Child Department',
          parentId: '1',
          isActive: true,
        },
      ]);

      await expect(service.delete('1')).rejects.toThrow(
        'Cannot delete department with active child departments'
      );
    });
  });

  describe('getByManager', () => {
    it('should get departments managed by a user', async () => {
      const mockDepartments = [
        {
          id: '1',
          name: 'Engineering',
          managerId: 'manager1',
          members: [],
        },
      ];

      (mockPrisma.department.findMany as jest.Mock).mockResolvedValue(
        mockDepartments
      );

      const result = await service.getByManager('manager1');

      expect(mockPrisma.department.findMany).toHaveBeenCalledWith({
        where: {
          managerId: 'manager1',
          isActive: true,
        },
        include: expect.any(Object),
      });

      expect(result).toEqual(mockDepartments);
    });
  });
});
