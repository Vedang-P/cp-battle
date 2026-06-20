-- CreateIndex
CREATE INDEX "User_elo_wins_idx" ON "User"("elo", "wins");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
