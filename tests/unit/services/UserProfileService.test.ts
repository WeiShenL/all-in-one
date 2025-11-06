import { UserProfileService } from '@/app/server/services/UserProfileService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  userProfile: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  department: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('UserProfileService', () => {
  let service: UserProfileService;

  beforeEach(() => {
    service = new UserProfileService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('getById', () => {
    it('should get user profile by ID', async () => {
      const mockUser = {
        id: 'user1',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'STAFF' as const,
        departmentId: 'dept1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: {
          id: 'dept1',
          name: 'Engineering',
        },
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        mockUser
      );

      const result = await service.getById('user1');

      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { id: 'user1' },
        select: expect.any(Object),
      });

      expect(result).toEqual(mockUser);
    });

    it('should return null when user not found', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.getById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getByEmail', () => {
    it('should get user profile by email', async () => {
      const mockUser = {
        id: 'user1',
        email: 'john@example.com',
        name: 'John Doe',
        role: 'STAFF' as const,
        departmentId: 'dept1',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        department: {
          id: 'dept1',
          name: 'Engineering',
        },
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        mockUser
      );

      const result = await service.getByEmail('john@example.com');

      expect(mockPrisma.userProfile.findUnique).toHaveBeenCalledWith({
        where: { email: 'john@example.com' },
        select: expect.any(Object),
      });

      expect(result?.email).toBe('john@example.com');
    });

    it('should throw error when email is empty', async () => {
      await expect(service.getByEmail('')).rejects.toThrow('Email is required');
    });
  });

  describe('create', () => {
    it('should create a new user profile', async () => {
      const input = {
        email: 'newuser@example.com',
        name: 'New User',
        role: 'STAFF' as const,
        departmentId: 'dept1',
      };

      // Mock department exists
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
        name: 'Engineering',
      });

      // Mock email doesn't exist
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreated = {
        id: 'new-user-id',
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.userProfile.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.create(input);

      expect(mockPrisma.userProfile.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          departmentId: input.departmentId,
          isHrAdmin: false, // Default value added
        },
        select: expect.any(Object),
      });

      expect(result!.email).toBe('newuser@example.com');
    });

    it('should throw error when department not found', async () => {
      const input = {
        email: 'newuser@example.com',
        name: 'New User',
        departmentId: 'nonexistent',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.create(input)).rejects.toThrow(
        'Department not found'
      );
    });

    it('should throw error when email already exists', async () => {
      const input = {
        email: 'existing@example.com',
        name: 'User',
        departmentId: 'dept1',
      };

      // Mock department exists
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
        name: 'Engineering',
      });

      // Mock email already exists
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-user',
        email: 'existing@example.com',
      });

      await expect(service.create(input)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should use default role STAFF when not provided', async () => {
      const input = {
        email: 'newuser@example.com',
        name: 'New User',
        departmentId: 'dept1',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreated = {
        id: 'new-user-id',
        email: input.email,
        name: input.name,
        role: 'STAFF',
        departmentId: input.departmentId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.userProfile.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.create(input);

      expect(result!.role).toBe('STAFF');
    });
  });

  describe('update', () => {
    it('should update user profile', async () => {
      const existingUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'Old Name',
        role: 'STAFF' as const,
        departmentId: 'dept1',
      };

      const updateData = {
        name: 'New Name',
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        existingUser
      );

      const mockUpdated = {
        ...existingUser,
        ...updateData,
        updatedAt: new Date(),
      };

      (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await service.update('user1', updateData);

      expect(mockPrisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: updateData,
        select: expect.any(Object),
      });

      expect(result!.name).toBe('New Name');
    });

    it('should throw error when user not found', async () => {
      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { name: 'New Name' })
      ).rejects.toThrow('User not found');
    });
  });

  describe('deactivate', () => {
    it('should deactivate a user (soft delete)', async () => {
      const mockDeactivated = {
        id: 'user1',
        email: 'user@example.com',
        name: 'User',
        isActive: false,
      };

      (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(
        mockDeactivated
      );

      const result = await service.deactivate('user1');

      expect(mockPrisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: { isActive: false },
        select: expect.any(Object),
      });

      expect(result!.isActive).toBe(false);
    });
  });

  describe('getByDepartment', () => {
    it('should get all users in a department', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'STAFF' as const,
          departmentId: 'dept1',
          isActive: true,
          createdAt: new Date(),
        },
        {
          id: 'user2',
          email: 'user2@example.com',
          name: 'User 2',
          role: 'MANAGER' as const,
          departmentId: 'dept1',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue(
        mockUsers
      );

      const result = await service.getByDepartment('dept1');

      expect(mockPrisma.userProfile.findMany).toHaveBeenCalledWith({
        where: {
          departmentId: 'dept1',
          isActive: true,
        },
        select: expect.any(Object),
        orderBy: {
          name: 'asc',
        },
      });

      expect(result).toHaveLength(2);
    });
  });

  describe('getByRole', () => {
    it('should get all users with a specific role', async () => {
      const mockManagers = [
        {
          id: 'manager1',
          email: 'manager1@example.com',
          name: 'Manager 1',
          role: 'MANAGER' as const,
          departmentId: 'dept1',
          department: {
            id: 'dept1',
            name: 'Engineering',
          },
        },
      ];

      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue(
        mockManagers
      );

      const result = await service.getByRole('MANAGER');

      expect(mockPrisma.userProfile.findMany).toHaveBeenCalledWith({
        where: {
          role: 'MANAGER',
          isActive: true,
        },
        select: expect.any(Object),
        orderBy: {
          name: 'asc',
        },
      });

      expect(result).toHaveLength(1);
      expect(result![0].role).toBe('MANAGER');
    });
  });

  describe('assignToDepartment', () => {
    it('should assign user to a department', async () => {
      const userId = 'user1';
      const departmentId = 'dept2';

      // Mock department exists
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: departmentId,
        name: 'Sales',
      });

      const mockUpdated = {
        id: userId,
        email: 'user@example.com',
        name: 'User',
        role: 'STAFF' as const,
        departmentId: departmentId,
        department: {
          id: departmentId,
          name: 'Sales',
        },
      };

      (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await service.assignToDepartment(userId, departmentId);

      expect(mockPrisma.userProfile.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { departmentId },
        select: expect.any(Object),
      });

      expect(result!.departmentId).toBe(departmentId);
    });

    it('should throw error when department not found', async () => {
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.assignToDepartment('user1', 'nonexistent')
      ).rejects.toThrow('Department not found');
    });

    it('should throw error when userId is empty', async () => {
      await expect(service.assignToDepartment('', 'dept1')).rejects.toThrow(
        'User ID'
      );
    });

    it('should throw error when departmentId is empty', async () => {
      await expect(service.assignToDepartment('user1', '')).rejects.toThrow(
        'Department ID'
      );
    });
  });

  describe('getAll', () => {
    it('should get all active users', async () => {
      const mockUsers = [
        {
          id: 'user1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'STAFF' as const,
          departmentId: 'dept1',
          isActive: true,
          isHrAdmin: false,
          createdAt: new Date('2025-10-01'),
          department: {
            id: 'dept1',
            name: 'Engineering',
          },
        },
        {
          id: 'user2',
          email: 'user2@example.com',
          name: 'User 2',
          role: 'MANAGER' as const,
          departmentId: 'dept2',
          isActive: true,
          isHrAdmin: true,
          createdAt: new Date('2025-10-02'),
          department: {
            id: 'dept2',
            name: 'Sales',
          },
        },
      ];

      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue(
        mockUsers
      );

      const result = await service.getAll();

      expect(mockPrisma.userProfile.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
        },
        select: expect.any(Object),
        orderBy: {
          createdAt: 'desc',
        },
      });

      expect(result).toHaveLength(2);
      expect(result![0].email).toBe('user1@example.com');
    });

    it('should return empty array when no users exist', async () => {
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });
  });

  describe('update - Additional Edge Cases', () => {
    it('should allow updating email to unique value', async () => {
      const existingUser = {
        id: 'user1',
        email: 'old@example.com',
        name: 'User',
        role: 'STAFF' as const,
        departmentId: 'dept1',
      };

      (mockPrisma.userProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingUser) // First call - check user exists
        .mockResolvedValueOnce(null); // Second call - check new email doesn't exist

      const mockUpdated = {
        ...existingUser,
        email: 'new@example.com',
      };

      (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await service.update('user1', {
        email: 'new@example.com',
      });

      expect(result!.email).toBe('new@example.com');
    });

    it('should throw error when updating email to existing email', async () => {
      const existingUser = {
        id: 'user1',
        email: 'user1@example.com',
        name: 'User 1',
      };

      const otherUser = {
        id: 'user2',
        email: 'taken@example.com',
        name: 'User 2',
      };

      (mockPrisma.userProfile.findUnique as jest.Mock)
        .mockResolvedValueOnce(existingUser) // First call - check user exists
        .mockResolvedValueOnce(otherUser); // Second call - email already taken

      await expect(
        service.update('user1', { email: 'taken@example.com' })
      ).rejects.toThrow('User with this email already exists');
    });

    it('should allow updating department', async () => {
      const existingUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'User',
        role: 'STAFF' as const,
        departmentId: 'dept1',
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        existingUser
      );

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept2',
        name: 'New Department',
      });

      const mockUpdated = {
        ...existingUser,
        departmentId: 'dept2',
      };

      (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await service.update('user1', { departmentId: 'dept2' });

      expect(result!.departmentId).toBe('dept2');
    });

    it('should throw error when updating to non-existent department', async () => {
      const existingUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'User',
        departmentId: 'dept1',
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        existingUser
      );

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update('user1', { departmentId: 'nonexistent' })
      ).rejects.toThrow('Department not found');
    });

    it('should allow updating role', async () => {
      const existingUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'User',
        role: 'STAFF' as const,
        departmentId: 'dept1',
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        existingUser
      );

      const mockUpdated = {
        ...existingUser,
        role: 'MANAGER' as const,
      };

      (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await service.update('user1', { role: 'MANAGER' });

      expect(result!.role).toBe('MANAGER');
    });

    it('should allow updating isHrAdmin', async () => {
      const existingUser = {
        id: 'user1',
        email: 'user@example.com',
        name: 'User',
        role: 'STAFF' as const,
        departmentId: 'dept1',
        isHrAdmin: false,
      };

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
        existingUser
      );

      const mockUpdated = {
        ...existingUser,
        isHrAdmin: true,
      };

      (mockPrisma.userProfile.update as jest.Mock).mockResolvedValue(
        mockUpdated
      );

      const result = await service.update('user1', { isHrAdmin: true });

      expect(result!.isHrAdmin).toBe(true);
    });

    it('should throw error when updating with empty ID', async () => {
      await expect(service.update('', { name: 'New Name' })).rejects.toThrow(
        'User ID'
      );
    });
  });

  describe('create - Additional Edge Cases', () => {
    it('should create user with isHrAdmin true when specified', async () => {
      const input = {
        email: 'hr@example.com',
        name: 'HR Admin',
        role: 'HR_ADMIN' as const,
        departmentId: 'dept1',
        isHrAdmin: true,
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
        name: 'HR',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreated = {
        id: 'hr-user-id',
        ...input,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.userProfile.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.create(input);

      expect(result!.isHrAdmin).toBe(true);
      expect(mockPrisma.userProfile.create).toHaveBeenCalledWith({
        data: {
          email: input.email,
          name: input.name,
          role: input.role,
          departmentId: input.departmentId,
          isHrAdmin: true,
        },
        select: expect.any(Object),
      });
    });

    it('should create user with MANAGER role when specified', async () => {
      const input = {
        email: 'manager@example.com',
        name: 'Manager User',
        role: 'MANAGER' as const,
        departmentId: 'dept1',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreated = {
        id: 'manager-id',
        ...input,
        isHrAdmin: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (mockPrisma.userProfile.create as jest.Mock).mockResolvedValue(
        mockCreated
      );

      const result = await service.create(input);

      expect(result!.role).toBe('MANAGER');
    });
  });

  describe('getById - Edge Cases', () => {
    it('should throw error when ID is empty', async () => {
      await expect(service.getById('')).rejects.toThrow('User ID');
    });

    it('should throw error when ID is null', async () => {
      await expect(service.getById(null as any)).rejects.toThrow();
    });
  });

  describe('getByDepartment - Edge Cases', () => {
    it('should return empty array when department has no users', async () => {
      (mockPrisma.userProfile.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getByDepartment('empty-dept');

      expect(result).toEqual([]);
    });

    it('should throw error when departmentId is empty', async () => {
      await expect(service.getByDepartment('')).rejects.toThrow(
        'Department ID'
      );
    });
  });

  describe('deactivate - Edge Cases', () => {
    it('should throw error when user ID is empty', async () => {
      await expect(service.deactivate('')).rejects.toThrow('User ID');
    });
  });
});
