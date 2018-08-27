import {mem} from 'fibercell'

export class LocationStore {
    // constructor(
    //     protected location: Location,
    //     protected history: History,
    //     protected ns: string = 'app'
    // ) {}

    constructor(
        protected _: {
            location: Location,
            history: History,
        },
        protected ns: string = 'app'
    ) {}

    protected params(): URLSearchParams {
        return new URLSearchParams(this._.location.search)
    }

    protected paramsToString(params: URLSearchParams): string {
        return params.toString()
    }

    toUrl(newParams: {[id: string]: string} = {}, hash?: string): string {
        const params = this.params()
        const keys = Object.keys(newParams)
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i]
            const val = newParams[key]
            if (val === null || val === undefined) {
                params.delete(key)
            } else {
                params.set(key, val)
            }
        }
        const q = this.paramsToString(params)
        return `${this._.location.origin}${q ? `?${q}` : ''}${hash ? `#${hash}` : ''}`
    }

    toString() {
        return this.toUrl()
    }

    @mem.key value<V>(key: string, value?: V): V {
        const params = this.params()
        if (value === undefined) return params.get(key) as any

        params.set(key, String(value))
        this._.history.pushState(null, this.ns, `?${this.paramsToString(params)}`)

        return value
    }
}
