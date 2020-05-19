if (Sk.builtin === undefined) {
    Sk.builtin = {};
}

/**
 * Create getters and setters for builtins
 * @constructor
 * @param {String} _name
 * @param {Function} get
 * @param {Function} set 
 * @param {String} doc
 */

Sk.GetSetDef = function (_name, get, set, doc) {
    this._name = _name;
    this.get = get;
    this.set = set;
    this.doc = doc;
};
Sk.exportSymbol("Sk.GetSetDef", Sk.GetSetDef);

/**
 *
 * @constructor
 * @description
 * we never call type directly
 * classes are created in the tp$call and tp$new methods 
 * combined with {@link Sk.abstr.setUpInheritance} (in src/abstract.js)
 */

Sk.builtin.type = function () {};
Sk.builtin.type.prototype.tp$doc = "type(object_or_name, bases, dict)\ntype(object) -> the object's type\ntype(name, bases, dict) -> a new type"


Sk.builtin.type.prototype.tp$call = function (args, kwargs) {
    if (this === Sk.builtin.type) {
        // check the args are 1 - only interested in the 1 argument form if 
        // if the nargs and nkewords != 1or3 and zero raise an error
        if (args.length == 1) {
            return args[0].ob$type;
        }
    }
    let obj, self = this;

    obj = this.prototype.tp$new(args, kwargs);

    return Sk.misceval.chain(obj, function (o) {
        obj = o;
        if (!obj.ob$type.$isSubType(self)) {
            // don't initialize an obj if it's type is not a subtype of this!
            return undefined;
        }
        if (obj.tp$init !== undefined) {
            return obj.tp$init(args, kwargs);
        }
    }, function () {
        return obj;
    });
};

Sk.builtin.type.prototype.tp$new = function (args, kwargs) {
    // currently skulpt does not support metatypes...
    // metatype.prototype = this
    if (args.length != 1 && args.length != 3) {
        throw new Sk.builtin.AttributeError("type() takes 1 or 3 arguments")
    }

    let $name, bases, dict;
    $name = args[0];
    bases = args[1];
    dict = args[2];
    // first check that we only have 3 args and they're of the correct type
    // argument dict must be of type dict
    if (dict.tp$name !== "dict") {
        throw new Sk.builtin.TypeError("type() argument 3 must be dict, not " + Sk.abstr.typeName(dict));
    }
    // checks if name must be string
    if (!Sk.builtin.checkString($name)) {
        throw new Sk.builtin.TypeError("type() argument 1 must be str, not " + Sk.abstr.typeName($name));
    }
    $name = $name.$jsstr();
    // argument bases must be of type tuple
    if (bases.tp$name !== "tuple") {
        throw new Sk.builtin.TypeError("type() argument 2 must be tuple, not " + Sk.abstr.typeName(bases));
    }

    // klass is essentially a function that gives its instances a dict
    const klass = function () {
        this.$d = new Sk.builtin.dict();
    };

    // todo: improve best_base algorithm to reflect layout conflicts as per python and check sk$acceptable_as_base_class
    const best_base = Sk.builtin.type.$bestBase(bases);

    // get the metaclass from kwargs
    let metaclass;
    if (kwargs) {
        const meta_idx = kwargs.indexOf("metaclass");
        if (meta_idx >= 0) {
            metaclass = kwargs[meta_idx+1];
            kwargs = kwargs.splice(meta_idx, 1);
        }
    }

    if (best_base !== undefined) {
        Sk.abstr.setUpInheritance($name, klass, best_base, metaclass)
    } else {
        // todo: create some sort of abstract base class that is like object but is not object
        Sk.abstr.setUpInheritance($name, klass, Sk.builtin.object, metaclass);
        klass.prototype.tp$base = Sk.builtin.none.none$;
    }

    klass.prototype.tp$bases = bases;
    klass.prototype.tp$mro = klass.$buildMRO();

    // some properties of klass objects and instances
    klass.prototype.hp$type = true;
    klass.sk$klass = true;

    // set __module__ 
    if (dict.mp$lookup(Sk.builtin.str.$module) === undefined) {
        dict.mp$ass_subscript(Sk.builtin.str.$module, Sk.globals["__name__"]);
    }

    // copy properties into klass.prototype 
    // uses python iter methods
    for (let it = dict.tp$iter(), k = it.tp$iternext(); k !== undefined; k = it.tp$iternext()) {
        v = dict.mp$subscript(k);
        if (v === undefined) {
            v = null;
        }
        klass.prototype[k.v] = v;
    }

    // assign __doc__
    if (klass.prototype.__doc__ === undefined) {
        klass.prototype.__doc__ = Sk.builtin.none.none$;
    }
    klass.prototype.tp$doc = klass.prototype.__doc__;

    if (klass.prototype.__dict__ === undefined) {
        klass.prototype.__dict__ = new Sk.builtin.getset_descriptor(
            klass,
            new Sk.GetSetDef("__dict__",
                function () {
                    return this["$d"];
                },
                function (value) {
                    const tp_name = Sk.abstr.typeName(value);
                    if (tp_name !== "dict") {
                        throw new Sk.builtin.TypeError("__dict__ must be set to a dictionary, not a '" + tp_name + "'");
                    }
                    this["$d"] = value;
                    return;
                },
                "dictionary for instance variables (if defined)"
            )
        );
    }

    klass.$allocateSlots()

    return klass;
};

Sk.builtin.type.prototype.tp$init = function (args, kwargs) {
    if (args && args.length == 1 && kwargs && kwargs.length) {
        throw new Sk.builtin.TypeError("type.__init__() takes no keyword arguments");
    } else if (args.length != 3 && args.length != 1) {
        throw new Sk.builtin.TypeError("type.__init__() takes 1 or 3 arguments");
    }
    // according to Cpython we just call the object init method here
    res = Sk.builtin.object.prototype.tp$init.call(this, []);
    return res;
};

Sk.builtin.type.prototype.$r = function () {
    let mod = this.prototype.__module__;
    let cname = "";
    let ctype = "class";
    if (mod && Sk.builtin.checkString(mod)) {
        cname = mod.v + ".";
    } else {
        mod = null;
    }
    if (!mod && !this.sk$klass && !Sk.__future__.class_repr) {
        ctype = "type";
    }
    return new Sk.builtin.str("<" + ctype + " '" + cname + this.prototype.tp$name + "'>");
};


Sk.builtin.type.prototype.tp$getattr = function (pyName, canSuspend) {
    // first check that the pyName is indeed a string
    let res;
    const jsName = pyName.$jsstr();

    const metatype = this.ob$type;

    // now check whether there is a descriptor down the prototypical chain
    // since we don't support metatypes yet this function will only ever be called by type objects
    // there is always a fast path for type objects
    // examples that would live down this path __dict__, __module__, __mro__, __name__
    // __class__ which is on the object.prototype is also here since type is an instance of object
    const meta_attribute = this[jsName];


    let meta_get;
    if (meta_attribute !== undefined) {
        meta_get = meta_attribute.tp$descr_get;
        if (meta_get !== undefined && Sk.builtin.checkDataDescr(meta_attribute)) {
            res = meta_get.call(meta_attribute, this, metatype);
            return res;
        }
    }

    const attribute = this.$typeLookup(jsName);

    if (attribute !== undefined) {
        const local_get = attribute.tp$descr_get;
        if (local_get !== undefined) {
            res = local_get.call(attribute, Sk.builtin.none.none$, this);
            return res;
        }
        return attribute;
    }

    // attribute was not found so use the meta_get if any
    if (meta_get !== undefined) {
        res = meta_get.call(meta_attribute, this, metatype);
        return res;
    }

    if (meta_attribute !== undefined) {
        return meta_attribute;
    }

    return undefined;
};

Sk.builtin.type.prototype.tp$setattr = function (pyName, value, canSuspend) {
    if (!this.sk$klass) {
        if (value !== undefined) {
            throw new Sk.builtin.TypeError("can't set attributes of built-in/extension type '" + this.prototype.tp$name + "'");
        } else {
            throw new Sk.builtin.TypeError("can't delete attributes on type object '" + this.prototype.tp$name + "'");
        }
    }

    const jsName = pyName.$jsstr();

    // meta types must follow single inheritance - we could change this and do
    // this.ob$type.$typeLookup(jsName)... but doesn't seem much point
    const descr = this[jsName];

    // if it's a data descriptor then call it
    if (descr !== undefined && descr !== null) {
        const f = descr.tp$descr_set;
        if (f) {
            return f.call(descr, this, value, canSuspend);
        }
    }

    // for delattr
    if (value === undefined) {
        if (!this.prototype.hasOwnProperty(jsName)) {
            throw new Sk.builtin.AttributeError("type objet '" + this.prototype.tp$name + "' has no attribute '" + jsName + "'");
        } else {
            delete this.prototype[jsName];
            // delete the slot_func if this object follows protypical inheritance
            const slot_name = Sk.dunderToSkulpt[jsName];
            if (Sk.prototype.prototypical && slot_name !== undefined) {
                delete this.prototype[slot_name];
            }
            return;
        }
    }

    this.prototype[jsName] = value;

    if (Sk.prototype.prototypical && jsName in Sk.dunderToSkulpt) {
       this.$allocateSlot(jsName);
    }
};

Sk.builtin.type.prototype.$typeLookup = function (pyName) {
    const jsName = pyName.$jsstr ? pyName.$jsstr() : pyName;

    if (this.prototype.sk$prototypical) {
        return this.prototype[jsName];
    }

    const mro = this.prototype.tp$mro;

    for (let i = 0; i < mro.v.length; ++i) {
        const base = mro.v[i];
        if (base.prototype.hasOwnProperty(jsName)) {
            return base.prototype[jsName];
        }
    }

    return undefined;
};


Sk.builtin.type.prototype.$mroMerge_ = function (seqs) {
    /*
     var tmp = [];
     for (var i = 0; i < seqs.length; ++i)
     {
     tmp.push(new Sk.builtin.list(seqs[i]));
     }
     print(Sk.builtin.repr(new Sk.builtin.list(tmp)).v);
     */
    this.prototype.sk$prototypical = true; // assume true to start with
    let seq, i, next, k, sseq, j, cand, cands, res = [];
    for (;;) {
        for (i = 0; i < seqs.length; ++i) {
            seq = seqs[i];
            if (seq.length !== 0) {
                break;
            }
        }
        if (i === seqs.length) { // all empty
            return res;
        }
        cands = [];
        for (i = 0; i < seqs.length; ++i) {
            seq = seqs[i];
            //print("XXX", Sk.builtin.repr(new Sk.builtin.list(seq)).v);
            if (seq.length !== 0) {
                cand = seq[0];
                //print("CAND", Sk.builtin.repr(cand).v);

                /* eslint-disable */
                OUTER:
                    for (j = 0; j < seqs.length; ++j) {
                        sseq = seqs[j];
                        for (k = 1; k < sseq.length; ++k) {
                            if (sseq[k] === cand) {
                                break OUTER;
                            }
                        }
                    }
                /* eslint-enable */

                // cand is not in any sequences' tail -> constraint-free
                if (j === seqs.length) {
                    cands.push(cand);
                }
            }
        }

        if (cands.length === 0) {
            throw new Sk.builtin.TypeError("Inconsistent precedences in type hierarchy");
        }

        next = cands[0];

        // check prototypical mro
        if (res.length && this.prototype.sk$prototypical) {
            let prevs_prototype = Object.getPrototypeOf(res[res.length - 1].prototype)
            if (prevs_prototype === next.prototype) {
                // pass
            } else if (prevs_prototype.constructor.sk$abstract) {
                // account for abstract classes
                while (prevs_prototype.constructor.sk$abstract) {
                    prevs_prototype = Object.getPrototypeOf(prevs_prototype);
                }
                if (prevs_prototype !== next.prototype) {
                    this.prototype.sk$prototypical = false;
                }
            } else {
                this.prototype.sk$prototypical = false;
            }
        }

        // append next to result and remove from sequences
        res.push(next);


        for (i = 0; i < seqs.length; ++i) {
            seq = seqs[i];
            if (seq.length > 0 && seq[0] === next) {
                seq.splice(0, 1);
            }
        }
    }
};


Sk.builtin.type.prototype.$buildMRO_ = function () {
    // MERGE(klass + mro(bases) + bases)
    var i;
    var bases;
    var all = [
        [this]
    ];

    //Sk.debugout("buildMRO for", klass.tp$name);

    const kbases = this.prototype.tp$bases;

    for (i = 0; i < kbases.v.length; ++i) {
        all.push([...kbases.v[i].prototype.tp$mro.v]);
    }

    bases = [];
    for (i = 0; i < kbases.v.length; ++i) {
        bases.push(kbases.v[i]);
    }
    all.push(bases);

    return this.$mroMerge_(all);
};

/*
 * C3 MRO (aka CPL) linearization. Figures out which order to search through
 * base classes to determine what should override what. C3 does the "right
 * thing", and it's what Python has used since 2.3.
 *
 * Kind of complicated to explain, but not really that complicated in
 * implementation. Explanations:
 *
 * http://people.csail.mit.edu/jrb/goo/manual.43/goomanual_55.html
 * http://www.python.org/download/releases/2.3/mro/
 * http://192.220.96.201/dylan/linearization-oopsla96.html
 *
 * This implementation is based on a post by Samuele Pedroni on python-dev
 * (http://mail.python.org/pipermail/python-dev/2002-October/029176.html) when
 * discussing its addition to Python.
 */
Sk.builtin.type.prototype.$buildMRO = function () {
    return new Sk.builtin.tuple(this.$buildMRO_());
};

Sk.builtin.type.prototype.tp$richcompare = function (other, op) {
    var r2;
    var r1;
    if (other.ob$type != Sk.builtin.type) {
        return undefined;
    }
    if (!this["$r"] || !other["$r"]) {
        return undefined;
    }

    r1 = this["$r"]();
    r2 = other["$r"]();

    return r1.tp$richcompare(r2, op);
};

Sk.builtin.type.prototype["__format__"] = function (self, format_spec) {
    Sk.builtin.pyCheckArgsLen("__format__", arguments.length, 1, 2);
    return new Sk.builtin.str(self);
};

Sk.builtin.type.pythonFunctions = ["__format__"];

Sk.builtin.type.prototype.$allocateSlots = function () {
    Sk.asserts.assert(this.sk$klass);
    if (this.prototype.sk$prototypical) {
        // only allocate certain slots
        for (let dunder in Sk.dunderToSkulpt) {
            if (this.prototype.hasOwnProperty(dunder)) {
                this.$allocateSlot(dunder);
            }
        }
    } else {
        // then just allocate all the slots 
        for (let slot in Sk.Slots) {
            this.prototype[slot] = Sk.Slots[slot].slot_func;
        }
    }

};

Sk.builtin.type.prototype.$allocateSlot = function (dunder) {
    const slot = Sk.dunderToSkulpt[dunder];
    this.prototype[slot] = Sk.Slots[slot].slot_func;
};


Sk.builtin.type.prototype.tp$getsets = [
    new Sk.GetSetDef("__bases__",
        function () {
            return this.prototype.tp$bases;
        }
    ),
    new Sk.GetSetDef("__base__",
        function () {
            return this.prototype.tp$base ? this.prototype.tp$base : Sk.builtin.none.none$;
        }
    ),
    new Sk.GetSetDef("__mro__",
        function () {
            return this.prototype.tp$mro;
        }
    ),
    new Sk.GetSetDef("__dict__",
        function () {
            return new Sk.builtin.mappingproxy(this.prototype);
        }
    ),
    new Sk.GetSetDef("__doc__",
        function () {
            return this.prototype.tp$doc ? this.prototype.tp$doc : Sk.builtin.none.none$;
        }
    ),
    new Sk.GetSetDef("__name__",
        function () {
            return new Sk.builtin.str(this.prototype.tp$name);
        },
        function (value) {
            if (!Sk.builtin.checkString(value)) {
                throw new Sk.builtin.TypeError("can only assign string to " + this.prototype.tp$name + ".__name__, not '" + Sk.abstr.typeName(value) + "'");
            }
            this.prototype.tp$name = value.$jsstr();
            return;
        }
    ),
    new Sk.GetSetDef("__module__",
        function () {
            if (this.sk$klass) {
                return this.prototype.__module__;
            }
            let mod = this.prototype.tp$name.split(".");
            mod = mod.slice(0, mod.length - 1).join(".");
            if (mod) {
                return new Sk.builtin.str(mod);
            } else {
                return new Sk.builtin.str("builtins");
            }
        },
        function (value) {
            // they can set the module to whatever they like
            this.prototype.__module__ = value;
        }
    ),
];


Sk.builtin.type.$bestBase = function (bases) {
    // deal with bases
    if (bases.v.length === 0) {
        // new style class, inherits from object by default
        if (Sk.__future__.inherit_from_object) {
            bases.v.push(Sk.builtin.object);
        }
    }

    let parent, it, firstAncestor, builtin_bases = [];
    // Set up inheritance from any builtins
    for (it = bases.tp$iter(), parent = it.tp$iternext(); parent !== undefined; parent = it.tp$iternext()) {
        if (!parent.prototype || !parent.sk$type) {
            throw new Sk.builtin.TypeError("bases must be 'type' objects");
        }
        if (firstAncestor === undefined) {
            firstAncestor = parent;
        }

        while (parent.sk$klass && parent.prototype.tp$base) {
            parent = parent.prototype.tp$base;
        }

        if (!parent.sk$klass && builtin_bases.indexOf(parent) < 0 && parent !== Sk.builtin.object) {
            builtin_bases.push(parent);
            inheritsBuiltin = true;
        }
    }
    if (builtin_bases.length > 1) {
        throw new Sk.builtin.TypeError("Multiple inheritance with more than one builtin type is unsupported");
    }

    return firstAncestor;

}


Sk.builtin.type.prototype.$isSubType = function (other) {
    if (this === other) {
        return true;
    } else if (other.prototype && this.prototype.sk$prototypical) {
        return this.prototype instanceof other;
    } 
    return this.prototype.tp$mro.v.includes(other) || false;
};