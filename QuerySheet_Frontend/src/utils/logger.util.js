/**
 * Lightweight logger that compiles to no-ops in production builds.
 * Vite replaces `import.meta.env.DEV` at build time, so dead-code
 * elimination strips these calls entirely from prod bundles.
 *
 * Usage:
 *   import { log } from '@/utils/logger.util'
 *   const apiLog = log.scope('apiClient')
 *   apiLog.info('request →', url)
 *   apiLog.group('response', () => { apiLog.info(data) })
 */

const enabled = import.meta.env.DEV

function noop() {}

function makeLogger(prefix = '') {
  if (!enabled) {
    return {
      info: noop,
      warn: noop,
      error: noop,
      group: noop,
      groupCollapsed: noop,
      groupEnd: noop,
      time: noop,
      timeEnd: noop,
      scope: () => makeLogger(prefix),
    }
  }

  const tag = prefix ? `[${prefix}]` : ''

  return {
    info: (...args) => console.log(tag, ...args),
    warn: (...args) => console.warn(tag, ...args),
    error: (...args) => console.error(tag, ...args),
    group: (label, fn) => {
      console.group(`${tag} ${label}`)
      try {
        if (typeof fn === 'function') fn()
      } finally {
        console.groupEnd()
      }
    },
    groupCollapsed: (label, fn) => {
      console.groupCollapsed(`${tag} ${label}`)
      try {
        if (typeof fn === 'function') fn()
      } finally {
        console.groupEnd()
      }
    },
    groupEnd: () => console.groupEnd(),
    time: (label) => console.time(`${tag} ${label}`),
    timeEnd: (label) => console.timeEnd(`${tag} ${label}`),
    scope: (childPrefix) =>
      makeLogger(prefix ? `${prefix}:${childPrefix}` : childPrefix),
  }
}

export const log = makeLogger()
export default log
