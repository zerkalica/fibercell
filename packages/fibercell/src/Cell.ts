import {schedule, conform, Owning, Logger, rethrow} from './utils'
import {Fiber} from './Fiber'
import {ArrayPool, Pull} from './Pool'

const cellKey = Symbol('Cell')

interface Free {
    /**
     * @throws Error | Promise
     */
    destructor(): void
}

interface Value {
    /**
     * @throws Error | Promise
     */
    start(): any
}

class CellScheduler extends Fiber {
    protected frees: Free[] = []
    protected roots: Value[] = []
    protected timer: number | void = undefined

    protected startBinded: () => void = this.start.bind(this)

    mayBeFree(cell: Free) {
        this.frees.push(cell)
        if (this.timer === undefined) this.timer = schedule(this.startBinded)
    }

    evaluate(cell: Value) {
        this.roots.push(cell)
        if (this.timer === undefined) this.timer = schedule(this.startBinded)
    }

    protected freesPos = 0
    protected rootsPos = 0

    /**
     * @throws Error | Promise
     */
    protected pull() {
        const {roots, frees} = this

        for (let i = this.rootsPos, l = roots.length; i < l; i++) {
            roots[i].start()
            this.rootsPos++
        }
        this.rootsPos = 0
        while (roots.length) roots.pop()
        // this.roots.length = 0

        for (let i = this.freesPos, l = frees.length; i < l; i++) {
            frees[i].destructor()
            this.freesPos++
        }
        this.freesPos = 0
        while (frees.length) frees.pop()
        // this.frees.length = 0
        this.timer = undefined
    }
}

const scheduler = new CellScheduler('CellScheduller')

export enum CellStatus {
    OBSOLETE = 'OBSOLETE',
    COMPUTE = 'COMPUTE',
    CHECK = 'CHECK',
    ACTUAL = 'ACTUAL'
}

class Calc extends Fiber {
    owner: Cell | void = undefined
}

const idsPool = new ArrayPool<number>(0)

export class Cell<Value = any, Next = Value> extends Fiber {
    protected status: CellStatus = CellStatus.OBSOLETE

    protected slaves: Cell[] = []
    protected masters: Cell[] = []

    constructor(
        protected host: Object,
        getPropName: string,
        protected setPropName: string,
        protected key?: any,
        /**
         * @throws Promise<Value> | Error
         **/
        protected dispose: ((key?: any) => void) | void = undefined
    ) {
        super(getPropName)
    }

    get [Symbol.toStringTag]() { return this.toString() }

    private debugId: string

    toString() {
        return (
            this.debugId ||
            (this.debugId = `${this.host}.${this.name.substring(
                0,
                this.name.length - 3
            )}${this.key ? `(${this.key})` : ''}`)
        )
    }

    /**
     * @throws Error | Promise
     */
    value(): Value {
        // @todo: store result in parent fiber for actions

        let slave: any = Fiber.current
        // If this master called from Fiber - lookup Fiber owner cell.
        if (slave instanceof Calc) slave = slave.owner
        if (slave instanceof Cell) {
            const {pool} = slave
            if (this.poolId === pool.id) {
                this.poolId = -pool.id
            } else if (this.poolId !== -pool.id) {
                pool.items.push(this.poolId)
                this.poolId = -pool.id
                slave.masters.push(this)
                this.actualSlaves().push(slave)
            }
        }

        if (this.status === CellStatus.ACTUAL) {
            if (this.result instanceof Error) rethrow(this.result)
            return this.result as Value
        }
        this.start()

        return this.result as Value
    }

    protected result: Value | Error | void = undefined

    /**
     * Called from fiber on throw Error
     */
    protected fail(error: Error) {
        if (this.status === CellStatus.ACTUAL) return
        if (this.pool) {
            this.pool.release()
            this.pool = undefined
        }

        this.result = error

        this.status = CellStatus.ACTUAL
        for (let slave of this.actualSlaves()) slave.obsolete()

        if (error[cellKey] === undefined) {
            error[cellKey] = this
            error.message = `[${this}]: ${error.message}`
        }
    }

    static getCell<V>(error: any): Cell<V> | void {
        return error[cellKey]
    }

    /**
     * @throws Error | Promise
     */
    reset(): Value {
        this.obsolete()
        return this.value()
    }

    protected poolId = 0
    protected slaveDeleteIndex = 0

    protected pool: Pull<number> = undefined

    /**
     * @throws Error | Promise
     */
    protected pull(): Value {
        const masters = this.masters
        if (this.status === CellStatus.CHECK) {
            for (let master of masters) master.value()
            if (this.status === CellStatus.CHECK) {
                this.status = CellStatus.ACTUAL
            }
        }

        if (this.status === CellStatus.ACTUAL) {
            if (this.result instanceof Error) rethrow(this.result)
            return this.result as Value
        }

        // assert(this.status === CellStatus.COMPUTE)
        // assert(this.status === CellStatus.OBSOLETE)

        const {items, id} = this.pool || (this.pool = idsPool.take())

        if (this.status === CellStatus.OBSOLETE) {
            for (let master of masters) {
                items.push(master.poolId)
                master.poolId = id
            }
        } else {
            // assert(this.status === CellStatus.COMPUTE)
            let i = masters.length
            while (i--) {
                const master = masters[i]
                const prevId = items[i]
                items[i] = master.poolId
                master.poolId = prevId
            }
        }

        // on throw Error calls this.fail
        // on throw Promise calls this.wait
        this.push(this.host[this.name](this.key))

        // No exceptions
        let i = masters.length
        while (i--) {
            const master = masters[i]
            if (master.poolId === id) master.dislead(this)
            master.poolId = items.pop()
        }
        this.pool.release()
        this.pool = undefined

        return this.result as Value
    }

    protected wait(p: Promise<any>): Promise<any> {
        const {
            masters,
            pool: {items}
        } = this
        let i = masters.length
        while (i--) {
            const master = masters[i]
            const prevId = items[i]
            items[i] = master.poolId
            master.poolId = prevId
        }

        return p
    }

    protected dislead(slave: Cell) {
        const slaves = this.slaves

        if (slaves.length === 1 && slaves[0] === slave) slaves.length = 0

        if (slaves.length === 0) return scheduler.mayBeFree(this)

        if (this.slaveDeleteIndex === 0) this.slaveDeleteIndex = slaves.length
        slaves.push(slave)

        if (slaves.length <= 2 * this.slaveDeleteIndex)
            scheduler.mayBeFree(this)
    }

    static suggested: any = undefined

    /**
     * @throws Error | Promise
     */
    put(next: Next): Value {
        const conformed = (conform(next, this.result) as any) as Value
        if (conformed === this.result) return conformed
        Cell.suggested = undefined
        let result =
            this.key === undefined
                ? this.host[this.setPropName]((conformed as any) as Next)
                : this.host[this.setPropName](
                      this.key,
                      (conformed as any) as Next
                  )
        if (result === undefined) result = Cell.suggested
        if (result === undefined) result = conformed
        Cell.suggested = undefined

        return this.push(result)
    }

    /**
     * @throws Error | Promise
     */
    protected push(next: Value): Value {
        const prev = this.result
        const value = conform(next, prev)
        if (value !== prev) {
            Owning.current.add(value, this)
            // Can throw Promise
            Owning.current.destruct(prev, this)
            Logger.current.changed(this, prev, value)
            this.result = value

            for (let slave of this.actualSlaves()) slave.obsolete()
        }
        this.status = CellStatus.ACTUAL
        this.destructFibers()

        return this.result as Value
    }

    obsolete() {
        const status = this.status
        if (status === CellStatus.OBSOLETE || status === CellStatus.COMPUTE)
            return
        // assert(status === CellStatus.ACTUAL)
        // assert(status === CellStatus.CHECK)
        this.status = CellStatus.OBSOLETE
        if (status === CellStatus.CHECK) return

        this.restart()
    }

    check() {
        if (
            this.status === CellStatus.ACTUAL ||
            this.status === CellStatus.COMPUTE
        ) {
            this.status = CellStatus.CHECK
        }

        this.restart()
    }

    protected deleted = false

    protected actualSlaves(): Cell[] {
        const {slaves, slaveDeleteIndex} = this
        if (slaveDeleteIndex === 0) return slaves

        let delta = slaves.length - slaveDeleteIndex
        while (delta--) {
            slaves.pop().deleted = true
        }
        let k = 0
 
        for (let i = 0; i < slaveDeleteIndex; i++) {
            const slave = slaves[i]
            if (!slave.deleted && k !== i) slaves[k++] = slave
            slave.deleted = false
        }
        slaves.length = k
        this.slaveDeleteIndex = 0

        return slaves
    }

    protected restart() {
        const slaves = this.actualSlaves()
        if (slaves.length === 0) return scheduler.evaluate(this)
        for (let slave of slaves) slave.check()
    }

    /**
     * @throws Error | Promise
     */
    destructor() {
        if (this.masters === undefined) return
        if (this.actualSlaves().length !== 0) return

        this.destructFibers()

        if (this.dispose) this.dispose(this.key)
        this.dispose = undefined

        Owning.current.destruct(this.result, this)

        Logger.current.free(this)

        if (this.pool) {
            this.pool.release()
            this.pool = undefined
        }

        this.result = undefined

        this.status = CellStatus.OBSOLETE
        this.slaves = undefined

        for (let master of this.masters) master.dislead(this)
        this.masters = undefined
    }
}
