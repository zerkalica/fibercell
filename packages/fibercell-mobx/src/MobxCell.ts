import {IAtom, createAtom, Reaction} from 'mobx'
import {Cell} from 'fibercell'

export class MobxCell<V> extends Cell<V> {
    private atom: IAtom
    private reaction: Reaction
    protected actualizer: () => void = Cell.prototype.actualize.bind(this)

    constructor(
        displayName: string,
        /**
         * @throws Promise<V> | Error
         **/
        handler: (next?: V) => V,
        dispose?: () => void,
    ) {
        super(displayName, handler, dispose)
        this.atom = createAtom(name, undefined, this.destructor.bind(this))
        this.reaction = new Reaction(displayName, this.retry.bind(this))
    }

    reportObserved() {
        this.atom.reportObserved()
    }

    reportChanged() {
        this.atom.reportChanged()
    }

    actualize() {
        this.reaction.track(this.actualizer)
    }

    destructor() {
        super.destructor()
        this.reaction.dispose()
    }
}
