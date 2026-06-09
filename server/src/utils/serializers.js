// Map snake_case DB rows to the camelCase shapes the frontend consumes.

export function serializeCard(card) {
  if (!card) return null;
  return {
    date: card.card_date,
    gestationalWeek: card.gestational_week,
    gestationalDay: card.gestational_day,
    sizeLabel: card.size_label,
    developmentFact: card.development_fact,
    title: card.title,
    shortNotification: card.short_notification,
    homepageMessage: card.homepage_message,
    mood: card.mood,
    imageUrl: card.image_url,
    generationStatus: card.generation_status,
  };
}

export function serializeMemory(memory) {
  if (!memory) return null;
  return {
    id: memory.id,
    memoryDate: memory.memory_date,
    memoryAt: memory.memory_at || memory.memory_date,
    gestationalWeek: memory.gestational_week,
    gestationalDay: memory.gestational_day,
    title: memory.title,
    body: memory.body,
    imageUrl: memory.image_url,
    createdAt: memory.created_at,
    updatedAt: memory.updated_at,
  };
}

export function serializeSettings(settings) {
  const key = settings.gemini_api_key;
  return {
    babyNickname: settings.baby_nickname,
    dueDate: settings.due_date,
    pregnancyStartDate: settings.pregnancy_start_date,
    timezone: settings.timezone,
    personality: settings.personality,
    tone: settings.tone,
    notificationsEnabled: Boolean(settings.notifications_enabled),
    autoGenerateEnabled: Boolean(settings.auto_generate_enabled),
    autoGenerateTime: settings.auto_generate_time,
    randomizePersonality: Boolean(settings.randomize_personality),
    babyArrived: Boolean(settings.baby_arrived),
    birthDate: settings.birth_date,
    birthTime: settings.birth_time,
    birthWeight: settings.birth_weight,
    birthName: settings.birth_name,
    geminiTextModel: settings.gemini_text_model,
    geminiImageModel: settings.gemini_image_model,
    // Never expose the raw key. Report only whether it is set + the last 4 chars.
    geminiApiKeySet: Boolean(key),
    geminiKeyLast4: key ? key.slice(-4) : null,
    updatedAt: settings.updated_at,
  };
}

export function serializeSchedule(schedule) {
  return {
    id: schedule.id,
    name: schedule.name,
    enabled: Boolean(schedule.enabled),
    type: schedule.type,
    timeOfDay: schedule.time_of_day,
    daysOfWeek: schedule.days_of_week,
    sendOnNewWeek: Boolean(schedule.send_on_new_week),
    lastRunAt: schedule.last_run_at,
  };
}

export function serializeDevice(device) {
  return {
    id: device.id,
    deviceName: device.device_name,
    userAgent: device.user_agent,
    active: Boolean(device.active),
    lastSuccessAt: device.last_success_at,
    lastFailureAt: device.last_failure_at,
    createdAt: device.created_at,
  };
}
