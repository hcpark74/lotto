import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { Bindings } from '../types/app'

type AppContext = Context<{ Bindings: Bindings }>
type AppRouteHandler = (c: AppContext) => Response | Promise<Response>
type ErrorStatusResolver = (error: unknown, message: string) => ContentfulStatusCode
type ErrorBodyResolver = (message: string, error: unknown) => Record<string, unknown>

type RouteHandlerOptions = {
  errorStatus?: ContentfulStatusCode | ErrorStatusResolver
  errorBody?: ErrorBodyResolver
  logLabel?: string
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === 'string') return error
  return '알 수 없는 오류가 발생했습니다.'
}

// 정수가 아니면 fallback, 정수면 [min, max] 로 자른다
export function parseIntQuery(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value)
  if (value == null || value === '' || !Number.isInteger(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

// 회차 번호. 없으면 undefined, 양의 정수가 아니면 null
export function parseDrawNoQuery(value: string | undefined) {
  if (value == null) return undefined
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null
}

export function badRequest(c: AppContext, message: string) {
  return c.json({ error: message }, 400)
}

export function notFound(c: AppContext, message: string) {
  return c.json({ error: message }, 404)
}

export function withRouteErrorHandling(handler: AppRouteHandler, options: RouteHandlerOptions = {}): AppRouteHandler {
  return async (c) => {
    try {
      return await handler(c)
    } catch (error) {
      if (options.logLabel) {
        console.error(`${options.logLabel}:`, error)
      }

      const message = getErrorMessage(error)
      const status: ContentfulStatusCode = typeof options.errorStatus === 'function'
        ? options.errorStatus(error, message)
        : (options.errorStatus ?? 500)

      return c.json(options.errorBody?.(message, error) ?? { error: message }, status)
    }
  }
}
