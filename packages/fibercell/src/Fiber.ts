import {isPromise, proxify} from './utils'

const fiberKey = Symbol('Fiber')

export interface FiberController {
    retry(fiber?: Fiber<any>): void
    abort(fiber?: Fiber<any>): void
}

export interface FiberHost {
    fiber<K, V>(key: K, async?: boolean): Fiber<V>
}

/**
 * Caches value, while action / handler restarts.
 */
export class Fiber<V> {
    protected actual: V
    protected catched: Error | Promise<V> | void = undefined

    static host: FiberHost = undefined

    /**
     * Cell related cache. Used for converting async calls to sync.
     * Use inside mem values or mem.action methods.
     * For fetch use ``` fiberize ``` helper from this library.
     * 
     * Low level @example:
     * ```ts
     * function fetchSyncJson(url: string, init?: RequestInit): R {
     *   const fiber: Fiber<R> = Fiber.create(`${(init && init.method) || 'GET'} ${url}`)
     *   return fiber.value() || fiber.value(fetch(
     *     url,
     *     {...init as any, abort: fiber.signal}
     *   ).then(r => r.json()))
     * }
     * 
     * class Store {
     *   get todos(): Todo[] { return fetchSync('/todos') }
     * }
     * ```
     *
     * Fiberize @example:
     * ```ts
     * import {fiberize} from 'fiberize'
     * const fetchSyncJson = fiberize(fetch, r => r.json())
     * class Store {
     *   get todos(): Todo[] { return fetchSyncJson('/todos') }
     * }
     * ```
     */
    static create<K, V>(key: K, async?: boolean): Fiber<V> {
        const host = Fiber.host
        if (!host) throw new Error('No fiber host')

        return host.fiber(key, async)
    }

    constructor(
        protected displayName: string,
        protected controller: FiberController,
        /**
         * Signal to stop all pending operations, can be used in fetch(url, {abort: signal})
         */
        public readonly signal: AbortSignal,
        protected readonly async: boolean = false
    ) {}

    get pending(): boolean {
        return isPromise(this.catched)
    }

    get error(): Error | void {
        return isPromise(this.catched) ? undefined : this.catched
    }

    toString() { return this.displayName }

    /**
     * Returns the fiber in which the error occurred.
     * Used to retry/abort suspended async fiber.
     *
     * @example ```ts
     * function MyView({store}: {store: Store}) {
     *   try {
     *     return <div>store.todos</div>
     *   } catch (e) {
     *     const fiber = Fiber.from(e)
     *     return <div>
     *       {e instanceof Promise && <div>Loading...</div>}
     *       {e instanceof Error && e.message}
     *       {fiber && <button onClick={() => fiber.reset()}>Retry</button>}
     *       {fiber && <button onClick={() => fiber.abort()}>Abort</button>}
     *     </div>
     *   }
     * }
     */
    static from<V>(e: Error | Promise<V>): Fiber<V> | void {
        return e[fiberKey]
    }

    /**
     * Get / set cached value
     *
     * @throws Error | Promise<V>
     */
    value(next?: Promise<V> | V | Error): V {
        if (isPromise(next)) {
            if (next[fiberKey]) throw new Error(
                `Fetch returns same promise twice, check ${this.displayName}.value(${String(next)})`
            )
            next[fiberKey] = this
            this.catched = next
            next.then(this.success.bind(this), this.fail.bind(this))
        } else if (next !== undefined) {
            if (next instanceof Error) this.catched = next
            else this.actual = next
        }

        if (this.catched) {
            if (this.async) return (this.catched = proxify(this.catched as any))
            throw this.catched
        }

        return this.actual
    }

    protected success(actual: V): void {
        if (this.signal.aborted) return
        this.actual = actual
        this.catched = undefined
        this.controller.retry()
    }

    protected fail(error: Error): void {
        if (this.signal.aborted) return
        if (error[fiberKey] === undefined) error[fiberKey] = this
        this.catched = error
        this.controller.retry()
    }

    /**
     * Reset fiber and invalidate parent cell. Do not touches other async operations in cell.
     */
    retry(all?: boolean) {
        this.catched = undefined
        this.actual = undefined
        this.controller.retry(all ? undefined : this)
    }

    /**
     * Aborts all pended async operations and invalidates parent cell.
     */
    abort(all?: boolean) {
        this.catched = undefined
        this.actual = undefined
        this.controller.abort(all ? undefined : this)
    }
}
