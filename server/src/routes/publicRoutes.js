// Public (no-auth) endpoints consumed by the frontend.

import { Router } from 'express';
import { getSettings } from '../services/settingsService.js';
import { getPregnancyStatus, trimesterForWeek } from '../services/pregnancyService.js';
import { getOrCreateCardForDate, getHistory } from '../services/cardService.js';
import { getMemories } from '../services/memoryService.js';
import {
  addReply,
  getRepliesForDate,
  getRepliesGroupedByDate,
} from '../services/replyService.js';
import { incrementKicks, getKicksForDate } from '../services/kickService.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { todayInTimezone, isValidDateString } from '../utils/dateUtils.js';
import { serializeCard, serializeMemory, serializeReply } from '../utils/serializers.js';

const router = Router();

const MAX_REPLY_CHARS = 1000;

// GET /api/today — current pregnancy status + today's card (fallback if none).
// Delivery-day mode (F12): once the baby has arrived, the reveal payload replaces the
// daily card entirely (no more pregnancy cards are created).
router.get('/today', (req, res) => {
  const settings = getSettings();

  if (settings.baby_arrived) {
    return res.json({
      babyArrived: true,
      babyNickname: settings.baby_nickname,
      birth: {
        name: settings.birth_name,
        date: settings.birth_date,
        time: settings.birth_time,
        weight: settings.birth_weight,
      },
    });
  }

  const today = todayInTimezone(settings.timezone);
  const status = getPregnancyStatus(settings, today);
  // Reuse the already-computed today/settings so the card describes the same day as
  // the status (avoids a midnight-boundary mismatch and a redundant settings read).
  const card = getOrCreateCardForDate(today, settings);

  res.json({
    babyArrived: false,
    babyNickname: settings.baby_nickname,
    // Derive trimester from the card's week so the displayed week and trimester always agree.
    trimester: trimesterForWeek(card.gestational_week),
    daysRemaining: status.daysRemaining,
    isDueDatePassed: status.isDueDatePassed,
    awaitingArrival: status.isDueDatePassed,
    ...serializeCard(card),
    replies: getRepliesForDate(today).map(serializeReply),
    kicks: getKicksForDate(today),
  });
});

// GET /api/history — saved cards, newest first, each with mom's replies.
router.get('/history', (req, res) => {
  const grouped = getRepliesGroupedByDate();
  res.json(
    getHistory().map((card) => ({
      ...serializeCard(card),
      replies: (grouped[card.card_date] || []).map(serializeReply),
    })),
  );
});

// POST /api/replies — mom answers the baby (public; the app is the family's private space).
router.post('/replies', rateLimit({ windowMs: 60_000, max: 20 }), (req, res) => {
  const { body, cardDate } = req.body ?? {};
  if (typeof body !== 'string' || body.trim() === '') {
    return res.status(400).json({ error: 'body must be a non-empty string.' });
  }
  if (body.trim().length > MAX_REPLY_CHARS) {
    return res.status(400).json({ error: `body must be at most ${MAX_REPLY_CHARS} characters.` });
  }

  const today = todayInTimezone(getSettings().timezone);
  let date = today;
  if (cardDate !== undefined) {
    if (!isValidDateString(cardDate) || cardDate > today) {
      return res.status(400).json({ error: 'cardDate must be a valid date, today or earlier.' });
    }
    date = cardDate;
  }

  const reply = addReply(date, body.trim());
  res.status(201).json({
    reply: serializeReply(reply),
    replies: getRepliesForDate(date).map(serializeReply),
  });
});

// POST /api/kicks — increment today's kick count (bursty by nature; generous limit).
router.post('/kicks', rateLimit({ windowMs: 60_000, max: 120 }), (req, res) => {
  const today = todayInTimezone(getSettings().timezone);
  res.json(incrementKicks(today));
});

// GET /api/memories — memories, newest first.
router.get('/memories', (req, res) => {
  res.json(getMemories().map(serializeMemory));
});

export default router;
