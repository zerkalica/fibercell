import {Fiber, fiberize, mem} from 'fibercell'
import {autorun} from 'mobx'

function run(done: () => void, cb: () => void) {
    autorun(() => {
        let wasException = false
        try {
            cb()
        } catch (e) {
            wasException = true
        }
        if (!wasException) done()
    })
}

describe('mem.base', () => {
    it('oops', (done) => {
        run(done, () => {
        })
    })
})

