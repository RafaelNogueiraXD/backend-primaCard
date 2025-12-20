-- AlterTable
ALTER TABLE `users` ADD COLUMN `referralCode` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `users_referralCode_key` ON `users`(`referralCode`);
