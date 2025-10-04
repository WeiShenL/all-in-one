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
        },
        select: expect.any(Object),
      });

      expect(result.email).toBe('newuser@example.com');
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
        departmentId: 'dept1',
      };

      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue({
        id: 'dept1',
      });

      (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(null);

      const mockCreated = {
        id: 'new-user-id',
        email: input.email,
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

      expect(result.role).toBe('STAFF');
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

      expect(result.name).toBe('New Name');
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

      expect(result.isActive).toBe(false);
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
      expect(result[0].role).toBe('MANAGER');
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

      expect(result.departmentId).toBe(departmentId);
    });

    it('should throw error when department not found', async () => {
      (mockPrisma.department.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.assignToDepartment('user1', 'nonexistent')
      ).rejects.toThrow('Department not found');
    });
  });
});
