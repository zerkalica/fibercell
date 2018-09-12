import {Fiber, FiberController, FiberHost} from '../fibers/Fiber'
import {FiberCache} from '../fibers/FiberCache'
import {rollback, Logger} from '../utils'

export interface TaskController {
    remove(task: Task): void
    pull(): void
}

export type ActionId = Function
const pending = Promise.resolve()

export class Task implements FiberController, FiberHost {
    protected error: Error | Promise<any> | void = undefined

    constructor(
        protected displayName: string,
        public actionId: ActionId,
        public actionGroup: ActionId | void,
        protected controller: TaskController | void,
        protected handler: (task: Task) => void
    ) {}

    toString() { return this.displayName }

    value(): Error | Promise<any> | void {
        if (!this.controller) return
        if (this.error) return this.error

        const oldHost = Fiber.host
        Fiber.host = this
        const fibers = this.fibers || new FiberCache(this)
        const size = fibers.size
        const oldError = this.error
        try {
            this.error = pending
            this.handler(this)
            if (size === fibers.size) {
                if (this.resolve) this.resolve()
                this.reject = undefined
                this.resolve = undefined
                this.destructor()
            }
        } catch (error) {
            this.error = error
        }
        Fiber.host = oldHost
        Logger.current.changed(this, oldError, this.error)

        return this.error
    }

    protected fibers: FiberCache | void = undefined

    fiber<K, V>(key: K, async?: boolean): Fiber<V> {
        if (!this.fibers) this.fibers = new FiberCache(this)
        return this.fibers.fiber(key, async)
    }

    protected reset() {
        if (this.fibers) this.fibers.destructor()
        this.fibers = undefined
        this.error = undefined
    }

    retry() {
        if (!this.controller) return
        this.error = undefined
        this.controller.pull()
    }

    abort() {
        this.destructor()
    }

    protected resolve: (() => void) | void = undefined
    protected reject: ((e: Error) => void) | void = undefined

    wait() {
        if (!this.controller) return
        const fiber: Fiber<void> = Fiber.create(this)
        return fiber.value() || fiber.value(
            new Promise((resolve: () => void, reject: (e: Error) => void) => {
                this.resolve = resolve
                this.reject = reject
            })
        )
    }

    destructor() {
        const {error, controller} = this
        if (!controller) return
        this.controller = undefined
        this.error = undefined
        if (error) rollback(error)
        this.reset()
        if (this.reject) this.reject(new Error(`${this} destructor called`))
        this.resolve = undefined
        this.reject = undefined
        this.actionId = undefined
        this.actionGroup = undefined
        this.handler = undefined
        controller.remove(this)
    }
}
