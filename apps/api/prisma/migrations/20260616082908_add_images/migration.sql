-- AlterTable
ALTER TABLE `room_types` ADD COLUMN `image_url` VARCHAR(500) NULL;

-- AlterTable
ALTER TABLE `zones` ADD COLUMN `image_url` VARCHAR(500) NULL;

-- CreateTable
CREATE TABLE `room_images` (
    `id` VARCHAR(191) NOT NULL,
    `room_id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(500) NOT NULL,
    `caption` VARCHAR(200) NULL,
    `sort_order` INTEGER NOT NULL DEFAULT 0,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `room_images_room_id_idx`(`room_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `room_images` ADD CONSTRAINT `room_images_room_id_fkey` FOREIGN KEY (`room_id`) REFERENCES `rooms`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
