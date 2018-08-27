import {setupCellClass} from 'fibercell'
import {MobxCell} from 'fibercell-mobx'
import {render} from 'react-dom'
import * as React from 'react'
import {App} from './App'
import { Deps } from './common'

setupCellClass(MobxCell)

const _: Deps<typeof App> = {
    fetchFn: fetch,
    location: window.location,
    history: window.history
}

render(<App id="app" _={_}/>, document.body)
