// Read/update the single settings row (id = 1).

import db from '../db/database.js';

export function getSettings() {
  return db.prepare('SELECT * FROM settings WHERE id = 1').get();
}

/**
 * Update settings. Accepts camelCase fields from the API and writes snake_case columns.
 * Only provided fields are changed.
 */
export function updateSettings(patch) {
  const current = getSettings();
  const merged = {
    baby_nickname: patch.babyNickname ?? current.baby_nickname,
    due_date: patch.dueDate ?? current.due_date,
    pregnancy_start_date:
      patch.pregnancyStartDate !== undefined ? patch.pregnancyStartDate : current.pregnancy_start_date,
    timezone: patch.timezone ?? current.timezone,
    personality: patch.personality ?? current.personality,
    tone: patch.tone ?? current.tone,
    updated_at: new Date().toISOString(),
  };

  db.prepare(
    `UPDATE settings SET
       baby_nickname = @baby_nickname,
       due_date = @due_date,
       pregnancy_start_date = @pregnancy_start_date,
       timezone = @timezone,
       personality = @personality,
       tone = @tone,
       updated_at = @updated_at
     WHERE id = 1`,
  ).run(merged);

  return getSettings();
}
