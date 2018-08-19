import {Fiber, FiberController, FiberHost} from '../Fiber'
import {FiberCache} from '../FiberCache'
import {rollback} from '../utils'

export interface TaskController {
    retry(task?: Task): void
    abort(task?: Task): void
}

export class Task implements FiberController, FiberHost {
    protected error: Error | Promise<any> | void = undefined

    constructor(
        public readonly name: string,
        protected readonly controller: TaskController,
        protected readonly handler: () => void
    ) {}

    run(): void | Promise<any> | Error {
        if (this.error) return this.error

        const oldHost = Fiber.host
        Fiber.host = this
        const fiber: Fiber<boolean> = this.fiber(this)
        const fibers = this.fibers || new FiberCache()
        const size = fibers.size
        try {
            this.error = undefined
            fiber.value() || fiber.value(this.handler() || true)
            if (size !== fibers.size) {
                this.error = Promise.resolve()
            } else {
                this.obsolete()
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

    protected obsolete() {
        if (this.fibers) this.fibers.destructor()
        this.fibers = undefined
    }

    reset() {
        this.error = undefined
    }

    retry(fiber?: Fiber<any>) {
        if (!fiber) this.obsolete()
        this.controller.retry(this)
    }

    abort(fiber?: Fiber<any>) {
        if (!fiber) this.obsolete()
        this.controller.abort(this)
    }

    destructor() {
        rollback(this.error)
        this.obsolete()
        this.error = undefined
    }
}
