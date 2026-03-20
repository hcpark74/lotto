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
