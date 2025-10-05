import { CommentService } from '@/app/server/services/CommentService';
import { PrismaClient } from '@prisma/client';

// Mock Prisma Client
const mockPrisma = {
  comment: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  task: {
    findUnique: jest.fn(),
  },
  userProfile: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('CommentService', () => {
  let service: CommentService;

  beforeEach(() => {
    service = new CommentService(mockPrisma);
    jest.clearAllMocks();
  });

  describe('CRUD Operations', () => {
    describe('Create', () => {
      it('should create a new comment', async () => {
        const input = {
          content: 'This is a comment',
          taskId: 'task1',
          userId: 'user1',
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
          id: 'task1',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        const mockCreated = {
          id: 'comment1',
          ...input,
          createdAt: new Date(),
          updatedAt: new Date(),
          user: {
            id: 'user1',
            name: 'User',
            email: 'user@example.com',
          },
        };

        (mockPrisma.comment.create as jest.Mock).mockResolvedValue(mockCreated);

        const result = await service.create(input);

        expect(mockPrisma.comment.create).toHaveBeenCalledWith({
          data: {
            content: input.content,
            taskId: input.taskId,
            userId: input.userId,
          },
          include: expect.any(Object),
        });

        expect(result.content).toBe('This is a comment');
      });

      it('should throw error when task not found', async () => {
        const input = {
          content: 'Comment',
          taskId: 'nonexistent',
          userId: 'user1',
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(service.create(input)).rejects.toThrow('Task not found');
      });

      it('should throw error when user not found or inactive', async () => {
        const input = {
          content: 'Comment',
          taskId: 'task1',
          userId: 'nonexistent',
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
          id: 'task1',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue(
          null
        );

        await expect(service.create(input)).rejects.toThrow(
          'User not found or inactive'
        );
      });

      it('should throw error when content is empty', async () => {
        const input = {
          content: '   ',
          taskId: 'task1',
          userId: 'user1',
        };

        (mockPrisma.task.findUnique as jest.Mock).mockResolvedValue({
          id: 'task1',
        });

        (mockPrisma.userProfile.findUnique as jest.Mock).mockResolvedValue({
          id: 'user1',
          isActive: true,
        });

        await expect(service.create(input)).rejects.toThrow(
          'Comment content cannot be empty'
        );
      });
    });

    describe('Read', () => {
      it('should get all comments for a task', async () => {
        const mockComments = [
          {
            id: 'comment1',
            content: 'Comment 1',
            taskId: 'task1',
            userId: 'user1',
            createdAt: new Date(),
            user: {
              id: 'user1',
              name: 'User 1',
              email: 'user1@example.com',
              role: 'STAFF',
            },
          },
          {
            id: 'comment2',
            content: 'Comment 2',
            taskId: 'task1',
            userId: 'user2',
            createdAt: new Date(),
            user: {
              id: 'user2',
              name: 'User 2',
              email: 'user2@example.com',
              role: 'STAFF',
            },
          },
        ];

        (mockPrisma.comment.findMany as jest.Mock).mockResolvedValue(
          mockComments
        );

        const result = await service.getByTask('task1');

        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith({
          where: { taskId: 'task1' },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(2);
        expect(result[0].content).toBe('Comment 1');
      });

      it('should get comment by ID', async () => {
        const mockComment = {
          id: 'comment1',
          content: 'This is a comment',
          user: {
            id: 'user1',
            name: 'User',
            email: 'user@example.com',
          },
          task: {
            id: 'task1',
            title: 'Task',
          },
        };

        (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(
          mockComment
        );

        const result = await service.getById('comment1');

        expect(mockPrisma.comment.findUnique).toHaveBeenCalledWith({
          where: { id: 'comment1' },
          include: expect.any(Object),
        });

        expect(result?.content).toBe('This is a comment');
      });

      it('should get all comments by a user', async () => {
        const mockComments = [
          {
            id: 'comment1',
            content: 'Comment 1',
            userId: 'user1',
            task: {
              id: 'task1',
              title: 'Task 1',
            },
          },
          {
            id: 'comment2',
            content: 'Comment 2',
            userId: 'user1',
            task: {
              id: 'task2',
              title: 'Task 2',
            },
          },
        ];

        (mockPrisma.comment.findMany as jest.Mock).mockResolvedValue(
          mockComments
        );

        const result = await service.getByUser('user1');

        expect(mockPrisma.comment.findMany).toHaveBeenCalledWith({
          where: { userId: 'user1' },
          include: expect.any(Object),
          orderBy: { createdAt: 'desc' },
        });

        expect(result).toHaveLength(2);
      });

      it('should return null when comment not found', async () => {
        (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(null);

        const result = await service.getById('nonexistent');

        expect(result).toBeNull();
      });
    });

    describe('Update', () => {
      it('should update a comment', async () => {
        const existingComment = {
          id: 'comment1',
          content: 'Old content',
        };

        const updateData = {
          content: 'Updated content',
        };

        (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(
          existingComment
        );

        const mockUpdated = {
          ...existingComment,
          ...updateData,
          updatedAt: new Date(),
          user: {
            id: 'user1',
            name: 'User',
            email: 'user@example.com',
          },
        };

        (mockPrisma.comment.update as jest.Mock).mockResolvedValue(mockUpdated);

        const result = await service.update('comment1', updateData);

        expect(mockPrisma.comment.update).toHaveBeenCalledWith({
          where: { id: 'comment1' },
          data: { content: updateData.content },
          include: expect.any(Object),
        });

        expect(result.content).toBe('Updated content');
      });

      it('should throw error when comment not found', async () => {
        (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(null);

        await expect(
          service.update('nonexistent', { content: 'New content' })
        ).rejects.toThrow('Comment not found');
      });

      it('should throw error when content is empty', async () => {
        const existingComment = {
          id: 'comment1',
          content: 'Old content',
        };

        (mockPrisma.comment.findUnique as jest.Mock).mockResolvedValue(
          existingComment
        );

        await expect(
          service.update('comment1', { content: '  ' })
        ).rejects.toThrow('Comment content cannot be empty');
      });
    });

    describe('Delete', () => {
      it('should delete a comment', async () => {
        const mockDeleted = {
          id: 'comment1',
          content: 'Comment',
          taskId: 'task1',
          userId: 'user1',
        };

        (mockPrisma.comment.delete as jest.Mock).mockResolvedValue(mockDeleted);

        const result = await service.delete('comment1');

        expect(mockPrisma.comment.delete).toHaveBeenCalledWith({
          where: { id: 'comment1' },
        });

        expect(result.id).toBe('comment1');
      });
    });
  });
});
