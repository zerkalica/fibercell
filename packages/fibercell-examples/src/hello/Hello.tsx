import * as React from 'react'

export interface HelloProps {
    id: string
    _: {}
}

export class Hello extends React.Component<HelloProps> {
    render() {
        const {
            props: {
                id
            }
        } = this

        return <div id={id}>
            test
        </div>
    }
}
