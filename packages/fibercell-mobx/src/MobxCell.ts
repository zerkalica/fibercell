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
        get: () => V,
        /**
         * @throws Promise<V> | Error
         **/
        set: (next: V) => void,
        host: Object,
        dispose?: () => void,
    ) {
        super(displayName, get, set, host, dispose)
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
