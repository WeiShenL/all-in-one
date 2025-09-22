'use client';

import { trpc } from './lib/trpc'; // use client util
import { useState } from 'react';

export default function Home() {
  const getTrpcSample = trpc.trpcRouteSample.getTrpcSampleUsers.useQuery();

  // State for create comment form
  const [newComment, setNewComment] = useState({
    content: '',
    taskId: '',
    userId: '',
  });

  // State for update comment
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  // tRPC queries and mutations
  const { data: comments, refetch: refetchComments } =
    trpc.comments.getAllComments.useQuery();
  const createCommentMutation = trpc.comments.createComment.useMutation({
    onSuccess: () => {
      refetchComments();
      setNewComment({ content: '', taskId: '', userId: '' });
    },
  });
  const updateCommentMutation = trpc.comments.updateComment.useMutation({
    onSuccess: () => {
      refetchComments();
      setEditingId(null);
      setEditContent('');
    },
  });
  const deleteCommentMutation = trpc.comments.deleteComment.useMutation({
    onSuccess: () => {
      refetchComments();
    },
  });

  const handleCreateComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (newComment.content && newComment.taskId && newComment.userId) {
      createCommentMutation.mutate(newComment);
    }
  };

  const handleUpdateComment = (id: string) => {
    if (editContent.trim()) {
      updateCommentMutation.mutate({ id, content: editContent });
    }
  };

  const handleDeleteComment = (id: string) => {
    if (confirm('Are you sure you want to delete this comment?')) {
      deleteCommentMutation.mutate({ id });
    }
  };

  const startEditing = (comment: any) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  return (
    <main style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <h1>All-in-One Project</h1>
      <p>Next.js application with TypeScript, ESLint, and App Router.</p>
      <p>Ready for development!</p>

      <h2>This is local tRPC</h2>
      <div
        style={{
          backgroundColor: '#f5f5f5',
          padding: '10px',
          borderRadius: '5px',
          marginBottom: '20px',
        }}
      >
        <h3>Sample Data:</h3>
        <pre>{JSON.stringify(getTrpcSample.data, null, 2)}</pre>
      </div>

      <h2>tRPC accessing DB (using Prisma) - Comments Only</h2>

      {/* CREATE */}
      <div
        style={{
          marginBottom: '30px',
          border: '1px solid #ddd',
          padding: '15px',
          borderRadius: '5px',
        }}
      >
        <h3>Create New Comment</h3>
        <form onSubmit={handleCreateComment}>
          <div style={{ marginBottom: '10px' }}>
            <label>Content:</label>
            <br />
            <textarea
              value={newComment.content}
              onChange={e =>
                setNewComment({ ...newComment, content: e.target.value })
              }
              placeholder='Enter comment content'
              style={{ width: '100%', minHeight: '60px', padding: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>Task ID:</label>
            <br />
            <input
              type='text'
              value={newComment.taskId}
              onChange={e =>
                setNewComment({ ...newComment, taskId: e.target.value })
              }
              placeholder='Enter task ID'
              style={{ width: '100%', padding: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '10px' }}>
            <label>User ID:</label>
            <br />
            <input
              type='text'
              value={newComment.userId}
              onChange={e =>
                setNewComment({ ...newComment, userId: e.target.value })
              }
              placeholder='Enter user ID'
              style={{ width: '100%', padding: '5px' }}
            />
          </div>
          <button
            type='submit'
            disabled={createCommentMutation.isPending}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
            }}
          >
            {createCommentMutation.isPending ? 'Creating...' : 'Create Comment'}
          </button>
        </form>
      </div>

      {/* READ */}
      <div style={{ marginBottom: '30px' }}>
        <h3>All Comments ({comments?.length || 0})</h3>
        {comments && comments.length > 0 ? (
          <div>
            {comments.map(comment => (
              <div
                key={comment.id}
                style={{
                  border: '1px solid #eee',
                  padding: '15px',
                  marginBottom: '10px',
                  borderRadius: '5px',
                }}
              >
                {editingId === comment.id ? (
                  // UPDATE form
                  <div>
                    <textarea
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      style={{
                        width: '100%',
                        minHeight: '60px',
                        padding: '5px',
                        marginBottom: '10px',
                      }}
                    />
                    <button
                      onClick={() => handleUpdateComment(comment.id)}
                      disabled={updateCommentMutation.isPending}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        marginRight: '5px',
                      }}
                    >
                      {updateCommentMutation.isPending ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{
                        padding: '5px 10px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div>
                    <p>
                      <strong>Content:</strong> {comment.content}
                    </p>
                    <p>
                      <strong>ID:</strong> {comment.id}
                    </p>
                    <p>
                      <strong>Task ID:</strong> {comment.taskId}
                    </p>
                    <p>
                      <strong>User ID:</strong> {comment.userId}
                    </p>
                    <p>
                      <strong>Created:</strong>{' '}
                      {new Date(comment.createdAt).toLocaleString()}
                    </p>
                    <div style={{ marginTop: '10px' }}>
                      <button
                        onClick={() => startEditing(comment)}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#ffc107',
                          color: 'black',
                          border: 'none',
                          borderRadius: '3px',
                          marginRight: '5px',
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteComment(comment.id)}
                        disabled={deleteCommentMutation.isPending}
                        style={{
                          padding: '5px 10px',
                          backgroundColor: '#dc3545',
                          color: 'white',
                          border: 'none',
                          borderRadius: '3px',
                        }}
                      >
                        {deleteCommentMutation.isPending
                          ? 'Deleting...'
                          : 'Delete'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p>No comments found. Create your first comment above!</p>
        )}
      </div>

      {/* Status messages */}
      {createCommentMutation.error && (
        <div
          style={{
            color: 'red',
            padding: '10px',
            backgroundColor: '#ffe6e6',
            borderRadius: '5px',
            marginBottom: '10px',
          }}
        >
          Create Error: {createCommentMutation.error.message}
        </div>
      )}
      {updateCommentMutation.error && (
        <div
          style={{
            color: 'red',
            padding: '10px',
            backgroundColor: '#ffe6e6',
            borderRadius: '5px',
            marginBottom: '10px',
          }}
        >
          Update Error: {updateCommentMutation.error.message}
        </div>
      )}
      {deleteCommentMutation.error && (
        <div
          style={{
            color: 'red',
            padding: '10px',
            backgroundColor: '#ffe6e6',
            borderRadius: '5px',
            marginBottom: '10px',
          }}
        >
          Delete Error: {deleteCommentMutation.error.message}
        </div>
      )}
    </main>
  );
}
