import {observer as mobxObserver} from 'mobx-react'
import {ErrorHandler} from './ErrorHandler'
import * as React from 'react'

const oldContent: WeakMap<Object, React.ReactChild> = new WeakMap()

function newRender(oldRender, arg1, arg2) {
    try {
        const content = oldRender.call(this, arg1, arg2)
        oldContent.set(this, content)
        return content
    } catch (error) {
        const id = (arg1 && arg1.id) || (this && this.props && this.props.id) || 'default'

        return <ErrorHandler
            id={`${id}-error`}
            error={error}
        >
            {oldContent.get(this) || null}
        </ErrorHandler>
    }
}

export function observer(cl: any) {
    if (cl.prototype.render) {
        const oldRender = cl.prototype.render
        cl.prototype.render = function newRenderWrap(arg1, arg2) {
            return newRender.call(this, oldRender, arg1, arg2)
        }
    }

    return mobxObserver(cl)
}
