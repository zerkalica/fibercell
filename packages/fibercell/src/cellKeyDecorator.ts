import {setFunctionName} from './utils'
import { cellDecoratorState } from './cellDecorator'
import { Cell } from './Cell'
import {toValueMap} from './toValueMap'

function cleanMap<K, V>(
    key: K,
    cellMap: Map<K, V>,
    cells: WeakMap<Object, Map<K, V>>,
    valueDestructor?: void | ((key: K) => void),
    destructor?: void | (() => void)
) {
    try {
        cellMap.delete(key)
        if (valueDestructor) valueDestructor.call(this, key)
        if (cellMap.size === 0) {
            if (destructor) destructor.call(this)
            cells.delete(this)
        }
    } catch (error) {
        console.warn(error)
    }
}

export type CellKeyMethod<K, V> = (key: K, next?: V) => V

export type CellKeyMethodDecorator<K, V> = <Method extends CellKeyMethod<K, V>>(
    proto: Object,
    name: string | symbol,
    descr: TypedPropertyDescriptor<Method>
) => TypedPropertyDescriptor<Method>

const objToString = Object.prototype.toString

function cellKeyMethodDecorator<K, V, Method extends CellKeyMethod<K, V>>(
    proto: Object,
    name: string | symbol,
    descr: TypedPropertyDescriptor<Method>,
    valueDestructor?: void | ((key: K) => void),
    destructor?: (() => void) | void
): TypedPropertyDescriptor<Method> {
    const propName = String(name)
    const staticName = `${proto.constructor.name}.${propName}`

    const cells: WeakMap<Object, Map<K, Cell<V>>> = new WeakMap()
    const cf = cellDecoratorState
    const handler: Method = descr.value

    function value(key: K, next?: V): V {
        let cellMap = cells.get(this)
        if (cellMap === undefined) {
            cellMap = new Map()
            cells.set(this, cellMap)
        }
        let cell = cellMap.get(key)

        if (cell === undefined) {
            const cellName = `${this.toString === objToString ? staticName : String(this)}.${propName}('${String(key)}')`

            cell = new cf.FiberCell(
                cellName,
                setFunctionName(handler.bind(this, key), `${cellName}$handler`),
                cleanMap.bind(this, key, cellMap, cells, valueDestructor, destructor)
            )
            cellMap.set(key, cell)
        }

        if (cf.returnCell) {
            cf.returnCell = false
            return cell as any
        } else if (cf.returnMap) {
            cf.returnMap = false
            return cellMap as any
        }

        return cell.value(next)
    }

    setFunctionName(value, `${staticName}$cell.key`)

    return {
        enumerable: descr.enumerable,
        configurable: descr.configurable,
        value: value as Method,
    }
}

export interface CellKeyDecorator {
    <K, V, Method extends CellKeyMethod<K, V>>(
        proto: Object,
        name: string | symbol,
        descr: TypedPropertyDescriptor<Method>
    ): TypedPropertyDescriptor<Method>

    <K, V>(valueDestructor: (key: K) => void, destructor?: (() => void) | void): CellKeyMethodDecorator<K, V>

    map<K, V>(method: CellKeyMethod<K, V>): ReadonlyMap<K, V>
}

export const cellKeyDecorator = ((...args: any[]) => {
    const destructorOrProto = args[0]
    const arg = args[1]
    if (!arg || typeof arg === 'function') {
        return (
            proto: Object,
            name: string,
            descr
        ) => cellKeyMethodDecorator(proto, name, descr, destructorOrProto, arg)
    }

    return cellKeyMethodDecorator(destructorOrProto, arg, args[2])
}) as CellKeyDecorator

Object.defineProperties(cellKeyDecorator, {
    map: {
        get() {
            cellDecoratorState.returnMap = true
            return toValueMap
        }
    }
})
