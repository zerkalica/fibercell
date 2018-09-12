import {Fiber, FiberController} from './Fiber'

export class FiberCache {
    /**
     * Used for aborting all pended async operations in fibers on cell destruction.
     */
    protected abortController: AbortController = new AbortController()

    /**
     * Fibers cache, live only when cell is pending or error.
     */
    protected fibers: Map<any, Fiber<any>> = new Map()

    constructor(
        protected controller: FiberController
    ) {}

    toString() { return `${String(this.controller)}.fibers` }

    get size(): number {
        return this.fibers ? this.fibers.size : 0
    }

    /**
     * Creates or returns cached fiber.
     * Key is unique in cell scope.
     *
     * @param key Unique cache lookup key
     */
    fiber<K, R>(key: K, async?: boolean): Fiber<R> {
        const fibers = this.fibers

        let fiber = fibers.get(key)
        if (!fiber) {
            fiber = new Fiber(
                `fiber('${String(key)}')`,
                this.controller,
                this.abortController.signal,
                async
            )
            fibers.set(key, fiber)
        }

        return fiber
    }

    destructor() {
        this.abortController.abort()
        this.abortController = undefined
        this.fibers = undefined
        this.controller = undefined
    }
}
