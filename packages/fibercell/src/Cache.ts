import { Fiber } from './Fiber'

export class Cache<Value> extends Fiber {
    result: Value | Error | void = undefined
    pull() {
        fetch('')
    }
}