// src/app/server/routers/comments.ts
import { z } from 'zod';
import { router, publicProcedure } from '../trpc';

export const commentsRouter = router({
  // READ - Get all comments
  getAllComments: publicProcedure.query(async ({ ctx }) => {
    return await ctx.prisma.comment.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }),

  // READ - Get comment by ID
  getCommentById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      return await ctx.prisma.comment.findUnique({
        where: { id: input.id },
      });
    }),

  // CREATE - Create a new comment
  createComment: publicProcedure
    .input(
      z.object({
        content: z.string().min(1),
        taskId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.comment.create({
        data: {
          content: input.content,
          taskId: input.taskId,
          userId: input.userId,
        },
      });
    }),

  // UPDATE - Update a comment
  updateComment: publicProcedure
    .input(
      z.object({
        id: z.string(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.comment.update({
        where: { id: input.id },
        data: { content: input.content },
      });
    }),

  // DELETE - Delete a comment
  deleteComment: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      return await ctx.prisma.comment.delete({
        where: { id: input.id },
      });
    }),
});
