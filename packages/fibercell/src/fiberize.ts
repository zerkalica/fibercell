import {Fiber} from './Fiber'

export type RequestInitExt = RequestInit & {abort?: AbortSignal}
declare function fetch(url: string | Request, init?: RequestInitExt): Promise<Response>

/**
 * Add fiber cache to fetch-like function.
 */
export function fiberize<Res, Result, Init extends {method?: string}>(
    fetchFn: (url: string, init?: Init & {abort?: AbortSignal}) => Promise<Res>,
    normalize: (r: Res) => Promise<Result>
): (
    url: string,
    init?: Init
) => Result {
    return function fiberizedFetch(
        url: string,
        init?: Init
    ) {
        const fiber: Fiber<Result> = Fiber.create(`${(init && init.method) || 'GET'} ${url}`)

        return fiber.value() || fiber.value(
            fetchFn(
                url,
                {
                    ...init as any,
                    abort: fiber.signal
                }
            )
                .then(normalize)
        )
    }
}
