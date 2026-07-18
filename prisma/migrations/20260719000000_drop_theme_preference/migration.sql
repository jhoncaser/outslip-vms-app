-- Drop the per-user theme preference; the app is light-only now.
ALTER TABLE "User" DROP COLUMN "themePreference";

-- Drop the now-unused enum type.
DROP TYPE "Theme";
