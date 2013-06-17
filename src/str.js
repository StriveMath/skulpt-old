var interned = {};

/**
 * @constructor
 * @param {*} x
 * @extends Sk.builtin.object
 */
Sk.builtin.str = function(x)
{
    if (x === undefined) x = "";
    if (x instanceof Sk.builtin.str && x !== Sk.builtin.str.prototype.ob$type) return x;
    if (!(this instanceof Sk.builtin.str)) return new Sk.builtin.str(x);

    // convert to js string
    var ret;
    if (x === true) ret = "True";
    else if (x === false) ret = "False";
    else if (x === null) ret = "None";
    else if (typeof x === "number")
    {
        ret = x.toString();
        if (ret === "Infinity") ret = "inf";
        else if (ret === "-Infinity") ret = "-inf";
    }
    else if (typeof x === "string")
        ret = x;
    else if (x.tp$str !== undefined)
    {
        ret = x.tp$str();
        if (!(ret instanceof Sk.builtin.str)) throw new Sk.builtin.ValueError("__str__ didn't return a str");
        return ret;
    }
    else 
        return Sk.misceval.objectRepr(x);

    // interning required for strings in py
    if (Object.prototype.hasOwnProperty.call(interned, "1"+ret)) // note, have to use Object to avoid __proto__, etc. failing
    {
        return interned["1"+ret];
    }

    this.__class__ = Sk.builtin.str;
    this.v = ret;
    this["v"] = this.v;
    interned["1"+ret] = this;
    return this;

};
goog.exportSymbol("Sk.builtin.str", Sk.builtin.str);

Sk.builtin.str.$emptystr = new Sk.builtin.str('');

Sk.builtin.str.prototype.mp$subscript = function(index)
{
    if (typeof index === "number" && Math.floor(index) === index /* not a float*/ )
    {
        if (index < 0) index = this.v.length + index;
        if (index < 0 || index >= this.v.length) throw new Sk.builtin.IndexError("string index out of range");
        return new Sk.builtin.str(this.v.charAt(index));
    }
    else if (index instanceof Sk.builtin.slice)
    {
        var ret = '';
        index.sssiter$(this, function(i, wrt) {
                if (i >= 0 && i < wrt.v.length)
                    ret += wrt.v.charAt(i);
                });
        return new Sk.builtin.str(ret);
    }
    else
        throw new TypeError("string indices must be numbers, not " + typeof index);
};

Sk.builtin.str.prototype.sq$length = function()
{
    return this.v.length;
};
Sk.builtin.str.prototype.sq$concat = function(other) 
{ 
    if (!other || !Sk.builtin.checkString(other))
    {
        var otypename = Sk.abstr.typeName(other);
        throw new TypeError("cannot concatenate 'str' and '" 
                            + otypename + "' objects");
    }
    return new Sk.builtin.str(this.v + other.v); 
};
Sk.builtin.str.prototype.sq$repeat = function(n)
{
    var ret = "";
    for (var i = 0; i < n; ++i)
        ret += this.v;
    return new Sk.builtin.str(ret);
};
Sk.builtin.str.prototype.sq$item = function() { goog.asserts.fail(); };
Sk.builtin.str.prototype.sq$slice = function(i1, i2)
{
    if (i1 < 0) i1 = 0;
    return new Sk.builtin.str(this.v.substr(i1, i2 - i1));
};

Sk.builtin.str.prototype.sq$contains = function(ob) {
    if ( ob.v === undefined || ob.v.constructor != String) {
        throw new TypeError("TypeError: 'In <string> requires string as left operand");
    }
    if (this.v.indexOf(ob.v) != -1) {
        return true;
    } else {
        return false;
    }

}

Sk.builtin.str.prototype.tp$name = "str";
Sk.builtin.str.prototype.tp$getattr = Sk.builtin.object.prototype.GenericGetAttr;
Sk.builtin.str.prototype.tp$iter = function()
{
    var ret =
    {
        tp$iter: function() { return ret; },
        $obj: this,
        $index: 0,
        tp$iternext: function()
        {
            // todo; StopIteration
            if (ret.$index >= ret.$obj.v.length) return undefined;
           return new Sk.builtin.str(ret.$obj.v.substr(ret.$index++, 1));
        }
    };
    return ret;
};

Sk.builtin.str.prototype.tp$richcompare = function(other, op)
{
    if (!(other instanceof Sk.builtin.str)) return undefined;

    if (this === other)
    {
        switch (op)
        {
            case 'Eq': case 'LtE': case 'GtE':
                return true;
            case 'NotEq': case 'Lt': case 'Gt':
                return false;
        }
    }
    var lenA = this.v.length;
    var lenB = other.v.length;
    var minLength = Math.min(lenA, lenB);
    var c = 0;
    if (minLength > 0)
    {
        for (var i = 0; i < minLength; ++i)
        {
            if (this.v[i] != other.v[i])
            {
                c = this.v[i].charCodeAt(0) - other.v[i].charCodeAt(0);
                break;
            }
        }
    }
    else
    {
        c = 0;
    }

    if (c == 0)
    {
        c = (lenA < lenB) ? -1 : (lenA > lenB) ? 1 : 0;
    }

    switch (op)
    {
        case 'Lt': return c < 0;
        case 'LtE': return c <= 0;
        case 'Eq': return c == 0;
        case 'NotEq': return c != 0;
        case 'Gt': return c > 0;
        case 'GtE': return c >= 0;
        default:
            goog.asserts.fail();
    }
};

Sk.builtin.str.prototype['$r'] = function()
{
    // single is preferred
    var quote = "'";
    if (this.v.indexOf("'") !== -1 && this.v.indexOf('"') === -1)
    {
        quote = '"';
    }
    var len = this.v.length;
    var ret = quote;
    for (var i = 0; i < len; ++i)
    {
        var c = this.v.charAt(i);
        if (c === quote || c === '\\')
            ret += '\\' + c;
        else if (c === '\t')
            ret += '\\t';
        else if (c === '\n')
            ret += '\\n';
        else if (c === '\r')
            ret += '\\r';
        else if (c < ' ' || c >= 0x7f)
        {
            var ashex = c.charCodeAt(0).toString(16);
            if (ashex.length < 2) ashex = "0" + ashex;
            ret += "\\x" + ashex;
        }
        else
            ret += c;
    }
    ret += quote;
    return new Sk.builtin.str(ret);
};


Sk.builtin.str.re_escape_ = function(s)
{
    var ret = [];
	var re = /^[A-Za-z0-9]+$/;
    for (var i = 0; i < s.length; ++i)
    {
        var c = s.charAt(i);

        if (re.test(c))
        {
            ret.push(c);
        }
        else
        {
            if (c === "\\000")
                ret.push("\\000");
            else
                ret.push("\\" + c);
        }
    }
    return ret.join('');
};

Sk.builtin.str.prototype['lower'] = new Sk.builtin.func(function(self)
{
    return new Sk.builtin.str(self.v.toLowerCase());
});

Sk.builtin.str.prototype['upper'] = new Sk.builtin.func(function(self)
{
    return new Sk.builtin.str(self.v.toUpperCase());
});

Sk.builtin.str.prototype['capitalize'] = new Sk.builtin.func(function(self)
{
    var orig = self.v;
    var cap;
    var i;

    if (orig.length === 0) {
        return new Sk.builtin.str("");
    };

    cap = orig.charAt(0).toUpperCase();

    for (i = 1; i < orig.length; i++) {
        cap += orig.charAt(i).toLowerCase();
    };
        
    return new Sk.builtin.str(cap);
});

Sk.builtin.str.prototype['join'] = new Sk.builtin.func(function(self, seq)
{
    var arrOfStrs = [];
    for (var it = seq.tp$iter(), i = it.tp$iternext(); i !== undefined; i = it.tp$iternext())
    {
        if (i.constructor !== Sk.builtin.str) throw "TypeError: sequence item " + arrOfStrs.length + ": expected string, " + typeof i + " found";
        arrOfStrs.push(i.v);
    }
    return new Sk.builtin.str(arrOfStrs.join(self.v));
});

Sk.builtin.str.prototype['split'] = new Sk.builtin.func(function(self, on, howmany)
{
    Sk.builtin.pyCheckArgs("split", arguments, 1, 3);
    if (on === undefined) {
        on = null;
    }
    if ((on !== null) && !Sk.builtin.checkString(on)) { 
        throw new Sk.builtin.TypeError("expected a string");
    }
    if ((on !== null) && on.v === "") {
        throw new Sk.builtin.ValueError("empty separator");
    }
    if ((howmany !== undefined) && !Sk.builtin.checkInt(howmany)) {
        throw new Sk.builtin.TypeError("an integer is required");
    }

    var regex = /[\s]+/g;
    var str = self.v;
    if (on === null) {
        str = str.trimLeft();
    } else {
	// Escape special characters in "on" so we can use a regexp
	var s = on.v.replace(/([.*+?=|\\\/()\[\]\{\}^$])/g, "\\$1");
        regex = new RegExp(s, "g");
    }

    // This is almost identical to re.split, 
    // except how the regexp is constructed

    var result = [];
    var match;
    var index = 0;
    var splits = 0;
    while ((match = regex.exec(str)) != null) {
        if (match.index === regex.lastIndex) {
            // empty match
            break;
        }
        result.push(new Sk.builtin.str(str.substring(index, match.index)));
        index = regex.lastIndex;
        splits += 1;
        if (howmany && (splits >= howmany)) {
            break;
        }
    }
    str = str.substring(index);
    if (on !== null || (str.length > 0)) {
        result.push(new Sk.builtin.str(str));
    }

    return new Sk.builtin.list(result);
});

Sk.builtin.str.prototype['strip'] = new Sk.builtin.func(function(self, chars)
{
    goog.asserts.assert(!chars, "todo;");
    return new Sk.builtin.str(self.v.replace(/^\s+|\s+$/g, ''));
});

Sk.builtin.str.prototype['lstrip'] = new Sk.builtin.func(function(self, chars)
{
    goog.asserts.assert(!chars, "todo;");
    return new Sk.builtin.str(self.v.replace(/^\s+/g, ''));
});

Sk.builtin.str.prototype['rstrip'] = new Sk.builtin.func(function(self, chars)
{
    goog.asserts.assert(!chars, "todo;");
    return new Sk.builtin.str(self.v.replace(/\s+$/g, ''));
});

Sk.builtin.str.prototype['partition'] = new Sk.builtin.func(function(self, sep)
{
    var sepStr = new Sk.builtin.str(sep);
    var pos = self.v.indexOf(sepStr.v);
    if (pos < 0)
    {
        return new Sk.builtin.tuple([self, Sk.builtin.str.$emptystr, Sk.builtin.str.$emptystr]);
    }

    return new Sk.builtin.tuple([
        new Sk.builtin.str(self.v.substring(0, pos)),
        sepStr,
        new Sk.builtin.str(self.v.substring(pos + sepStr.v.length))]);
});

Sk.builtin.str.prototype['rpartition'] = new Sk.builtin.func(function(self, sep)
{
    var sepStr = new Sk.builtin.str(sep);
    var pos = self.v.lastIndexOf(sepStr.v);
    if (pos < 0)
    {
        return new Sk.builtin.tuple([Sk.builtin.str.$emptystr, Sk.builtin.str.$emptystr, self]);
    }

    return new Sk.builtin.tuple([
        new Sk.builtin.str(self.v.substring(0, pos)),
        sepStr,
        new Sk.builtin.str(self.v.substring(pos + sepStr.v.length))]);
});

Sk.builtin.str.prototype['count'] = new Sk.builtin.func(function(self, pat) {
    var m = new RegExp(pat.v,'g');
    var ctl = self.v.match(m)
    if (! ctl) {
        return 0;
    } else {
        return ctl.length;
    }
    
});

Sk.builtin.str.prototype['ljust'] = new Sk.builtin.func(function(self, len) {
    if (self.v.length >= len) {
        return self;
    } else {
        var newstr = Array.prototype.join.call({length:Math.floor(len-self.v.length)+1}," ");
        return new Sk.builtin.str(self.v+newstr);
    }
});

Sk.builtin.str.prototype['rjust'] = new Sk.builtin.func(function(self, len) {
    if (self.v.length >= len) {
        return self;
    } else {
        var newstr = Array.prototype.join.call({length:Math.floor(len-self.v.length)+1}," ");
        return new Sk.builtin.str(newstr+self.v);
    }

});

Sk.builtin.str.prototype['center'] = new Sk.builtin.func(function(self, len) {
    if (self.v.length >= len) {
        return self;
    } else {
        var newstr1 = Array.prototype.join.call({length:Math.floor((len-self.v.length)/2)+1}," ");
        var newstr = newstr1+self.v+newstr1;
        if (newstr.length < len ) {
            newstr = newstr + " "
        }
        return new Sk.builtin.str(newstr);
    }

});

Sk.builtin.str.prototype['find'] = new Sk.builtin.func(function(self, tgt, start) {
   return self.v.indexOf(tgt.v,start);
});

Sk.builtin.str.prototype['index'] = new Sk.builtin.func(function(self, tgt, start) {
    var idx = Sk.misceval.callsim(self['find'], self, tgt, start);
    if (idx === -1) {
        throw new Sk.builtin.ValueError("substring not found");
    };
    return idx;
});

Sk.builtin.str.prototype['rfind'] = new Sk.builtin.func(function(self, tgt, start) {
    var s = self.v;
    var offset = 0;
    var idx = -1;

    if (start !== undefined) {
        // Only look after start position
        s = s.substring(start);
        offset = start;
    };
    idx = s.lastIndexOf(tgt.v);

    if (idx !== -1) {
        // Adjust so that index is from start of string
        idx = idx + offset;
    };

    return idx;
});

Sk.builtin.str.prototype['rindex'] = new Sk.builtin.func(function(self, tgt, start) {
    var idx = Sk.misceval.callsim(self['rfind'], self, tgt, start);
    if (idx === -1) {
        throw new Sk.builtin.ValueError("substring not found");
    };
    return idx;
});

Sk.builtin.str.prototype['replace'] = new Sk.builtin.func(function(self, oldS, newS, count)
{
    if (oldS.constructor !== Sk.builtin.str || newS.constructor !== Sk.builtin.str)
        throw new Sk.builtin.TypeError("expecting a string");
    goog.asserts.assert(count === undefined, "todo; replace() with count not implemented");
    var patt = new RegExp(Sk.builtin.str.re_escape_(oldS.v), "g");
    return new Sk.builtin.str(self.v.replace(patt, newS.v));
});

Sk.builtin.str.prototype['isdigit'] = new Sk.builtin.func(function(self) {
    if (self.v.length === 0) { return false; }
    var i;
    for (i=0; i<self.v.length; i++) {
        var ch = self.v.charAt(i);
        if (ch < '0' || ch > '9') {
            return false;
        };
    };
    return true;
});

Sk.builtin.str.prototype.ob$type = Sk.builtin.type.makeIntoTypeObj('str', Sk.builtin.str);

Sk.builtin.str.prototype.nb$remainder = function(rhs)
{
    // % format op. rhs can be a value, a tuple, or something with __getitem__ (dict)

    // From http://docs.python.org/library/stdtypes.html#string-formatting the
    // format looks like:
    // 1. The '%' character, which marks the start of the specifier.
    // 2. Mapping key (optional), consisting of a parenthesised sequence of characters (for example, (somename)).
    // 3. Conversion flags (optional), which affect the result of some conversion types.
    // 4. Minimum field width (optional). If specified as an '*' (asterisk), the actual width is read from the next element of the tuple in values, and the object to convert comes after the minimum field width and optional precision.
    // 5. Precision (optional), given as a '.' (dot) followed by the precision. If specified as '*' (an asterisk), the actual width is read from the next element of the tuple in values, and the value to convert comes after the precision.
    // 6. Length modifier (optional).
    // 7. Conversion type.
    //
    // length modifier is ignored

    if (rhs.constructor !== Sk.builtin.tuple && (rhs.mp$subscript === undefined || rhs.constructor === Sk.builtin.str)) rhs = new Sk.builtin.tuple([rhs]);
    
    var default_float_precision = 6;

    // general approach is to use a regex that matches the format above, and
    // do an re.sub with a function as replacement to make the subs.

    //           1 2222222222222222   33333333   444444444   5555555555555  66666  777777777777777777
    var regex = /%(\([a-zA-Z0-9]+\))?([#0 +\-]+)?(\*|[0-9]+)?(\.(\*|[0-9]+))?[hlL]?([diouxXeEfFgGcrs%])/g;
    var index = 0;
    var replFunc = function(substring, mappingKey, conversionFlags, fieldWidth, precision, precbody, conversionType)
    {
        var i;
        if (mappingKey === undefined || mappingKey === "" ) i = index++; // ff passes '' not undef for some reason

        var zeroPad = false;
        var leftAdjust = false;
        var blankBeforePositive = false;
        var precedeWithSign = false;
        var alternateForm = false;
        if (conversionFlags)
        {
            if (conversionFlags.indexOf("-") !== -1) leftAdjust = true;
            else if (conversionFlags.indexOf("0") !== -1) zeroPad = true;

            if (conversionFlags.indexOf("+") !== -1) precedeWithSign = true;
            else if (conversionFlags.indexOf(" ") !== -1) blankBeforePositive = true;

            alternateForm = conversionFlags.indexOf("#") !== -1;
        }

        if (precision)
        {
            precision = parseInt(precision.substr(1), 10);
        }

        var formatNumber = function(n, base)
        {
            var j;
            var r;
            var neg = false;
            var didSign = false;
            if (typeof n === "number")
            {
                if (n < 0)
                {
                    n = -n;
                    neg = true;
                }
                r = n.toString(base);
            }
            else if (n instanceof Sk.builtin.lng)
            {
                r = n.str$(base, false);
                neg = n.compare(0) < 0;
            }

            goog.asserts.assert(r !== undefined, "unhandled number format");

            var precZeroPadded = false;

            if (precision)
            {
                //print("r.length",r.length,"precision",precision);
                for (j = r.length; j < precision; ++j)
                {
                    r = '0' + r;
                    precZeroPadded = true;
                }
            }

            var prefix = '';

            if (neg) prefix = "-";
            else if (precedeWithSign) prefix = "+" + prefix;
            else if (blankBeforePositive) prefix = " " + prefix;

            if (alternateForm)
            {
                if (base === 16) prefix += '0x';
                else if (base === 8 && !precZeroPadded && r !== "0") prefix += '0';
            }

            return [prefix, r];
        };

        var handleWidth = function(args)
        {
            var prefix = args[0];
            var r = args[1];
            var j;
            if (fieldWidth)
            {
                fieldWidth = parseInt(fieldWidth, 10);
                var totLen = r.length + prefix.length;
                if (zeroPad)
                    for (j = totLen; j < fieldWidth; ++j)
                        r = '0' + r;
                else if (leftAdjust)
                    for (j = totLen; j < fieldWidth; ++j)
                        r = r + ' ';
                else
                    for (j = totLen; j < fieldWidth; ++j)
                        prefix = ' ' + prefix;
            }
            return prefix + r;
        };

        var value;
        //print("Rhs:",rhs, "ctor", rhs.constructor);
        if (rhs.constructor === Sk.builtin.tuple)
        {
            value = rhs.v[i];
        }
        else if (rhs.mp$subscript !== undefined)
        {
            var mk = mappingKey.substring(1, mappingKey.length - 1);
            //print("mk",mk);
            value = rhs.mp$subscript(new Sk.builtin.str(mk));
        }
        else throw new Sk.builtin.AttributeError(rhs.tp$name + " instance has no attribute 'mp$subscript'");
        var r;
        var base = 10;
        switch (conversionType)
        {
            case 'd':
            case 'i':
                return handleWidth(formatNumber(value, 10));
            case 'o':
                return handleWidth(formatNumber(value, 8));
            case 'x':
                return handleWidth(formatNumber(value, 16));
            case 'X':
                return handleWidth(formatNumber(value, 16)).toUpperCase();

            case 'f':
            case 'F':
                if (precision === undefined) {
                    precision = default_float_precision;
                }
            case 'e':
            case 'E':
            case 'g':
            case 'G':
                var convName = ['toExponential', 'toFixed', 'toPrecision']['efg'.indexOf(conversionType.toLowerCase())];
                var result = (value)[convName](precision);
                if ('EFG'.indexOf(conversionType) !== -1) result = result.toUpperCase();
                // todo; signs etc.
                return handleWidth(['', result]);

            case 'c':
                if (typeof value === "number")
                    return String.fromCharCode(value);
                else if (value instanceof Sk.builtin.lng)
                    return String.fromCharCode(value.str$(10,false)[0]);
                else if (value.constructor === Sk.builtin.str)
                    return value.v.substr(0, 1);
                else
                    throw new TypeError("an integer is required");
                break; // stupid lint

            case 'r':
                r = Sk.builtin.repr(value);
                if (precision) return r.v.substr(0, precision);
                return r.v;
            case 's':
                //print("value",value);
                //print("replace:");
                //print("  index", index);
                //print("  substring", substring);
                //print("  mappingKey", mappingKey);
                //print("  conversionFlags", conversionFlags);
                //print("  fieldWidth", fieldWidth);
                //print("  precision", precision);
                //print("  conversionType", conversionType);
                r = new Sk.builtin.str(value);
                if (precision) return r.v.substr(0, precision);
                return r.v;
            case '%':
                return '%';
        }
    };
    
    var ret = this.v.replace(regex, replFunc);
    return new Sk.builtin.str(ret);
};
