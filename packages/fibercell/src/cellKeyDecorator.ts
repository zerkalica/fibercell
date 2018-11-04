import {setFunctionName} from './utils'
import { cellDecoratorState } from './cellDecorator'
import { Cell } from './Cell'
import {toValueMap} from './toValueMap'

/**
 * @throws Error | Promise
 */
function cleanMap<K, V>(
    cells: WeakMap<Object, Map<K, V>>,
    /**
     * @throws Error | Promise
     */
    destructor: void | (() => void),
    /**
     * @throws Error | Promise
     */
    valueDestructor: void | ((key: K) => void),
    cellMap: Map<K, V>,
    key: K
) {
    if (valueDestructor && cellMap.has(key)) valueDestructor.call(this, key)
    cellMap.delete(key)

    if (cellMap.size === 0 && cells.has(this)) {
        if (destructor) destructor.call(this)
        cells.delete(this)
    }
}

export type CellKeyMethod<K, V> = (key: K, next?: V) => V

export type CellKeyMethodDecorator<K, V> = <Method extends CellKeyMethod<K, V>>(
    proto: Object,
    name: string | symbol,
    descr: TypedPropertyDescriptor<Method>
) => TypedPropertyDescriptor<Method>

function cellKeyMethodDecorator<K, V, Method extends CellKeyMethod<K, V>>(
    proto: Object,
    name: string | symbol,
    descr: TypedPropertyDescriptor<Method>,
    valueDestructor?: void | ((key: K) => void),
    destructor?: (() => void) | void
): TypedPropertyDescriptor<Method> {
    const propName = String(name)

    const cells: WeakMap<Object, Map<K, Cell<V>>> = new WeakMap()
    const cf = cellDecoratorState

    const mapPropName = `${propName}#map`

    proto[mapPropName] = descr.value

    /**
     * @throws Error or Promise
     */
    function value(key: K, next?: V): V {
        let cellMap = cells.get(this)
        if (cellMap === undefined) {
            cellMap = new Map()
            cells.set(this, cellMap)
        }
        let cell = cellMap.get(key)

        if (cell === undefined) {
            cell = new cf.FiberCell(
                this,
                mapPropName,
                mapPropName,
                '' + key,
                cleanMap.bind(this, cells, destructor, valueDestructor, cellMap)
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

        return next === undefined ? cell.value() : cell.put(next)
    }

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
