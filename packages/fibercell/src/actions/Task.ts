import {Fiber, FiberController, FiberHost} from '../Fiber'
import {FiberCache} from '../FiberCache'
import {rollback, isPromise} from '../utils'

export interface TaskController {
    retry(task?: Task): void
    abort(task?: Task): void
}

export type TaskKey = Object | string

export class Task implements FiberController, FiberHost {
    protected error: Error | Promise<any> | void = undefined
    completed: boolean = false

    constructor(
        public readonly displayName: string,
        protected readonly controller: TaskController,
        protected readonly handler: () => void,
        public key: TaskKey,
        protected taskMap: Map<TaskKey, Task>
    ) {}

    toString() { return this.displayName }

    run(): Error | Promise<any> | void {
        if (this.completed) return
        if (this.error) return this.error

        const oldHost = Fiber.host
        Fiber.host = this
        const fibers = this.fibers || new FiberCache()
        const size = fibers.size
        try {
            this.handler()
            if (size === fibers.size) {
                this.completed = true
                this.error = undefined
                this.cleanFibers()
            } else {
                throw Promise.resolve()
            }
        } catch (error) {
            this.error = error
        }
        Fiber.host = oldHost

        return this.error
    }

    locked(): boolean {
        const {error} = this
        if (error instanceof Error) throw error

        return isPromise(error)
    }

    protected fibers: FiberCache | void = undefined

    fiber<K, V>(key: K, async?: boolean): Fiber<V> {
        if (!this.fibers) this.fibers = new FiberCache()
        return this.fibers.fiber(key, this, async)
    }

    protected cleanFibers() {
        if (this.fibers) this.fibers.destructor()
        this.fibers = undefined
    }

    reset() {
        this.error = undefined
    }

    retry(fiber?: Fiber<any>) {
        if (!fiber) this.cleanFibers()
        this.controller.retry(this)
    }

    abort(fiber?: Fiber<any>) {
        if (!fiber) this.cleanFibers()
        this.controller.abort(this)
    }

    destructor() {
        rollback(this.error)
        this.cleanFibers()
        this.taskMap.delete(this.key)
        this.taskMap = undefined
        this.error = undefined
    }
}
