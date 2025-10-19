-- CreateIndex
CREATE INDEX "notification_userId_isRead_createdAt_idx" ON "public"."notification"("userId", "isRead", "createdAt");
