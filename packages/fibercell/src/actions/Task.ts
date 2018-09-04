import {Fiber, FiberController, FiberHost} from '../Fiber'
import {FiberCache} from '../FiberCache'
import {rollback} from '../utils'

export interface TaskController {
    remove(task: Task): void
    pull(): void
}

export type ActionId = Object | Function | symbol | string

export class Task implements FiberController, FiberHost {
    protected error: Error | Promise<any> | void = undefined

    constructor(
        public readonly actionId: ActionId,
        public readonly actionGroup: ActionId,
        protected controller: TaskController | void,
        protected readonly handler: (task: Task) => void
    ) {}

    toString() { return String(this.actionId) }

    status(): Error | Promise<any> | void {
        if (!this.controller) return
        if (this.error) return this.error

        const oldHost = Fiber.host
        Fiber.host = this
        const fibers = this.fibers || new FiberCache()
        const size = fibers.size
        try {
            this.handler(this)
            if (size === fibers.size) {
                this.done()
            } else {
                throw Promise.resolve()
            }
        } catch (error) {
            this.error = error
        }
        Fiber.host = oldHost

        return this.error
    }

    protected fibers: FiberCache | void = undefined

    fiber<K, V>(key: K, async?: boolean): Fiber<V> {
        if (!this.fibers) this.fibers = new FiberCache()
        return this.fibers.fiber(key, this, async)
    }

    protected reset() {
        if (this.fibers) this.fibers.destructor()
        this.fibers = undefined
        this.error = undefined
    }

    retry() {
        if (!this.controller) return
        this.reset()
        this.controller.pull()
    }

    abort() {
        this.destructor()
    }

    protected done() {
        if (this.resolve) this.resolve(true)
        this.reject = undefined
        this.resolve = undefined
        this.destructor()
    }

    protected resolve: ((v: boolean) => void) | void = undefined
    protected reject: ((e: Error) => void) | void = undefined

    wait(): boolean {
        const fiber: Fiber<boolean> = Fiber.create(this)
        return fiber.value() || fiber.value(
            new Promise((
                resolve: (v: boolean) => void,
                reject: (e: Error) => void
            ) => {
                this.resolve = resolve
                this.reject = reject
            })
        )
    }

    destructor() {
        if (!this.controller) return
        rollback(this.error)
        this.reset()
        this.controller.remove(this)
        this.controller = undefined
        if (this.reject) this.reject(new Error(`${this} destructor called`))
        this.resolve = undefined
        this.reject = undefined
    }
}
