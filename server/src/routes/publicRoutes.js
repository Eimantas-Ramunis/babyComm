// Public (no-auth) endpoints consumed by the frontend.

import { Router } from 'express';
import { getSettings } from '../services/settingsService.js';
import { getPregnancyStatus, trimesterForWeek } from '../services/pregnancyService.js';
import { getOrCreateCardForDate, getHistory } from '../services/cardService.js';
import { getMemories } from '../services/memoryService.js';
import { todayInTimezone } from '../utils/dateUtils.js';
import { serializeCard, serializeMemory } from '../utils/serializers.js';

const router = Router();

// GET /api/today — current pregnancy status + today's card (fallback if none).
router.get('/today', (req, res) => {
  const settings = getSettings();
  const today = todayInTimezone(settings.timezone);
  const status = getPregnancyStatus(settings, today);
  // Reuse the already-computed today/settings so the card describes the same day as
  // the status (avoids a midnight-boundary mismatch and a redundant settings read).
  const card = getOrCreateCardForDate(today, settings);

  res.json({
    babyNickname: settings.baby_nickname,
    // Derive trimester from the card's week so the displayed week and trimester always agree.
    trimester: trimesterForWeek(card.gestational_week),
    daysRemaining: status.daysRemaining,
    isDueDatePassed: status.isDueDatePassed,
    ...serializeCard(card),
  });
});

// GET /api/history — saved cards, newest first.
router.get('/history', (req, res) => {
  res.json(getHistory().map(serializeCard));
});

// GET /api/memories — memories, newest first.
router.get('/memories', (req, res) => {
  res.json(getMemories().map(serializeMemory));
});

export default router;
