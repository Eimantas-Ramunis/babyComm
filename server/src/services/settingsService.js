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
    // notifications master switch (boolean from API -> 0/1)
    notifications_enabled:
      patch.notificationsEnabled !== undefined
        ? patch.notificationsEnabled
          ? 1
          : 0
        : current.notifications_enabled,
    // Gemini config (secrets stay server-side; never returned raw to the client).
    // An empty string clears the key; undefined leaves it unchanged.
    gemini_api_key:
      patch.geminiApiKey !== undefined ? patch.geminiApiKey || null : current.gemini_api_key,
    gemini_text_model:
      patch.geminiTextModel !== undefined
        ? patch.geminiTextModel || null
        : current.gemini_text_model,
    gemini_image_model:
      patch.geminiImageModel !== undefined
        ? patch.geminiImageModel || null
        : current.gemini_image_model,
    // Daily pre-generation of the next day's card.
    auto_generate_enabled:
      patch.autoGenerateEnabled !== undefined
        ? patch.autoGenerateEnabled
          ? 1
          : 0
        : current.auto_generate_enabled,
    auto_generate_time: patch.autoGenerateTime ?? current.auto_generate_time,
    randomize_personality:
      patch.randomizePersonality !== undefined
        ? patch.randomizePersonality
          ? 1
          : 0
        : current.randomize_personality,
    // 'girl' | 'boy' | null (surprise). Empty string clears back to surprise.
    baby_gender: patch.babyGender !== undefined ? patch.babyGender || null : current.baby_gender,
    // Delivery-day mode (F12). Empty strings clear a field; undefined leaves it unchanged.
    baby_arrived:
      patch.babyArrived !== undefined ? (patch.babyArrived ? 1 : 0) : current.baby_arrived,
    birth_date: patch.birthDate !== undefined ? patch.birthDate || null : current.birth_date,
    birth_time: patch.birthTime !== undefined ? patch.birthTime || null : current.birth_time,
    birth_weight:
      patch.birthWeight !== undefined ? patch.birthWeight || null : current.birth_weight,
    birth_name: patch.birthName !== undefined ? patch.birthName || null : current.birth_name,
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
       notifications_enabled = @notifications_enabled,
       gemini_api_key = @gemini_api_key,
       gemini_text_model = @gemini_text_model,
       gemini_image_model = @gemini_image_model,
       auto_generate_enabled = @auto_generate_enabled,
       auto_generate_time = @auto_generate_time,
       randomize_personality = @randomize_personality,
       baby_gender = @baby_gender,
       baby_arrived = @baby_arrived,
       birth_date = @birth_date,
       birth_time = @birth_time,
       birth_weight = @birth_weight,
       birth_name = @birth_name,
       updated_at = @updated_at
     WHERE id = 1`,
  ).run(merged);

  return getSettings();
}
