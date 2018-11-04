import {schedule, isPromise, rethrow} from './utils'
import {ArrayPool, Pull} from './Pool'

type Shedullable = () => void

class FiberScheduler {
    protected scheduled: number | void = undefined
    protected queuePos = 0
    protected queue: Shedullable[] = []
    protected quant = 8
    protected deadline = 0

    protected tick() {
        this.deadline = Date.now() + this.quant
        const {queue} = this
        for (let i = this.queuePos; i < queue.length; i++) {
            const resolve = queue[i]
            this.queuePos++
            resolve()
        }
        while (queue.length) queue.pop()
        this.queuePos = 0
    }

    warp() {
        while (this.queue.length > 0) this.tick()
    }

    protected runBinded = this.run.bind(this)
    protected resolver(done: Shedullable) {
        this.queue.push(done)
        if (!this.scheduled) this.scheduled = schedule(this.runBinded)
    }

    protected resolverBinded = this.resolver.bind(this)

    protected schedule(): Promise<void> {
        return new Promise(this.resolverBinded)
    }

    protected run() {
        this.scheduled = undefined
        this.tick()
    }

    limit(deadline: boolean): Promise<void> | void {
        const now = Date.now()
        if (now <= this.deadline) return

        if (deadline && this.queue.length === 0) {
            this.deadline = now + this.quant
            return
        }

        rethrow(this.schedule())
    }
}

const scheduler = new FiberScheduler()

const fiberPool = new ArrayPool<Fiber>({} as any as Fiber)

export class Fiber {
    protected cursor: number = -1
    protected masterFibers: Pull<Fiber> | void = undefined
    static current: Fiber = undefined
    static inAction: boolean = false

    constructor(
        protected name: string,
        protected slave?: Fiber | void
    ) {
        if (slave) slave.masterFibers[this.cursor] = this
    }

    toString() { return this.slave ? `${this.slave.fiberId}:${this.name}` : this.name }

    protected get fiberId() { return `${this}[${this.cursor}]` }

    /**
     * @example
     * ```ts
     *   (Fiber.step() || new Fiber('some'))
     * ```
     */
    static step(): Fiber | void {
        const current = Fiber.current
        if (current) return current.step()
    }

    step(): Fiber | void {
        const cursor = ++this.cursor
        if (this.masterFibers) return this.masterFibers.items[cursor]
        this.masterFibers = fiberPool.take()
    }

    /**
     * @throws Error | Promise
     */
    start() {
        const current = Fiber.current
        Fiber.current = this
        this.cursor = -1
        try {
            scheduler.limit(!current)
            this.pull()
        } catch (error) {
            if (isPromise(error)) {
                if (!current) {
                    const start = this.start.bind(this)
                    error = error.then(start, start)
                }
                error = this.wait(error)
            } else {
                this.destructFibers()
                this.fail(error)
            }
            rethrow(error)
        } finally {
            Fiber.current = current
        }
    }

    protected wait(promise: Promise<any>): Promise<any> { return promise }

    protected fail(error: Error) {}

    /**
     * @throws Promise | Error
     */
    protected pull() { }

    protected destructFibers() {
        const {masterFibers} = this
        if (!masterFibers) return
        const {items} = masterFibers
        while (items.length !== 0) {
            items.pop().destructFibers()
        }
        masterFibers.release()
        this.masterFibers = undefined
    }
}
