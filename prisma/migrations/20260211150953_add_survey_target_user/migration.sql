-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_surveys" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "targetAudience" TEXT NOT NULL DEFAULT 'ALL',
    "questions" TEXT NOT NULL,
    "targetUserId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "surveys_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "surveys_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_surveys" ("createdAt", "createdById", "description", "id", "isActive", "questions", "targetAudience", "title", "updatedAt") SELECT "createdAt", "createdById", "description", "id", "isActive", "questions", "targetAudience", "title", "updatedAt" FROM "surveys";
DROP TABLE "surveys";
ALTER TABLE "new_surveys" RENAME TO "surveys";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
