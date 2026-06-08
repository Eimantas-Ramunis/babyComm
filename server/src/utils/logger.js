// Tiny leveled logger. Controlled by LOG_LEVEL (error|warn|info|debug; default 'info').
// Set LOG_LEVEL=debug to see scheduler ticks, push sends, and AI request details.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const current = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function line(level, args) {
  return [`[${new Date().toISOString()}] ${level.toUpperCase()}`, ...args];
}

export const logger = {
  error: (...a) => current >= LEVELS.error && console.error(...line('error', a)),
  warn: (...a) => current >= LEVELS.warn && console.warn(...line('warn', a)),
  info: (...a) => current >= LEVELS.info && console.log(...line('info', a)),
  debug: (...a) => current >= LEVELS.debug && console.log(...line('debug', a)),
};
