import {unproxifyError} from './proxify'

export class Owning {
    protected owners: WeakMap<Object, Object> = new WeakMap()

    protected hasDestructor(obj: any): obj is {destructor(): void} {
        return (
            obj &&
            typeof obj === 'object' &&
            typeof unproxifyError(obj).destructor === 'function'
        )
    }

    add(actual: Object, owner: Object) {
        if (this.hasDestructor(actual) && !this.owners.has(actual))
            this.owners.set(actual, owner)
    }

    /**
     * @throws Promise or Error
     */
    destruct(actual: any, owner: Object) {
        const owners = this.owners
        if (owners.get(actual) !== owner) return
        actual.destructor()
        owners.delete(actual)
    }

    static current: Owning = new Owning()
}
