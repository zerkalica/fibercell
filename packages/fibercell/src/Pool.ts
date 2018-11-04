
export class Pull<Item = any> {
    items: Item[] = []

    constructor(
        public id: number,
        protected parent: {release(): void},
        meanRowSize: number,
        init: Item
    ) {
        const items = this.items
        // Warm up items
        for (let i = 0; i < meanRowSize; i++) items.push(init)
        while (items.length) items.pop()
    }

    release() {
        const items = this.items
        while (items.length) items.pop()

        this.parent.release()
    }
}

export class ArrayPool<Item> {
    protected pools: Pull<Item>[] = []
    protected cursor = -1
    protected usage = 0
    protected lastId = 0

    constructor(
        protected init: Item,
        protected growSize = 17,
        protected maxSize = 1000,
        protected meanRowSize = 80,
    ) {
        this.grow()
    }

    protected grow() {
        const {growSize, meanRowSize, pools, init} = this
        if (pools.length >= this.maxSize) throw new Error(
            `Maximum pool size of ${this.maxSize} items reached`
        )

        for (let i = 0; i < growSize; i++) {
            pools.push(new Pull(++this.lastId, this, meanRowSize, init))
        }
    }

    take(): Pull<Item> {
        const pools = this.pools
        this.cursor++
        if (this.cursor >= pools.length) {
            let k: number = 0
            // Defragment array
            for (let i = 0; i < pools.length; i++) {
                const item = pools[i]
                if (item.items.length !== 0 && k !== i) {
                    pools[k++] = item
                }
            }
            // Grow, if array is full after defragmentation
            if (k >= pools.length) {
                k = pools.length
                this.grow()
            }
            this.cursor = k
        }
        this.usage++

        return pools[this.cursor]
    }

    release() {
        this.usage--
        if (this.usage === 0) {
            this.cursor = -1
        }
    }
}

