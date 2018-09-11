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

    get size(): number {
        return this.fibers ? this.fibers.size : 0
    }

    /**
     * Creates or returns cached fiber.
     * Key is unique in cell scope.
     *
     * @param key Unique cache lookup key
     */
    fiber<K, R>(key: K, controller: FiberController, async?: boolean): Fiber<R> {
        const fibers = this.fibers
 
        let fiber = fibers.get(key)
        if (!fiber) {
            fiber = new Fiber(
                `${controller}.fiber('${String(key)}')`,
                controller,
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
    }
}
