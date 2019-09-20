
// Determines when a sequence of glyphs should be split into multiple parts. If
// the distance between the previous glyph's advanced matrix and the current
// glyph's matrix is greater than MaxGlyphDistance*fontSize, then a split occurs.
// This parameter should rarely require tuning.
var MaxGlyphDistance = 0.1;

var MinHorizontalOverlap = 0.1;
var MinVerticalOverlap = 0.5;

var Direction = {
    Horizontal: 0,
    Vertical: 1
}

function Glyph(font, matrix, glyph, unicode, wmode, ctm, kern, highlightColor) {

    this.font = font;
    this.matrix = matrix;
    this.glyph = glyph;
    this.unicode = unicode;
    this.wmode = wmode;
    this.ctm = ctm;
    this.kern = kern;
    this.highlightColor = highlightColor;

    this.string = String.fromCharCode(unicode);

    this.vertices = [];
    var adv = this.font.advanceGlyph(this.glyph, this.wmode) + this.kern;
    if (this.wmode == 0) {
        this.nextMatrix = this.matrix.advance(adv, 0);
        this.size = this.matrix.distance(this.matrix.advance(0, 1));
        this.vertices.push(this.matrix.advance(0, 0).transform(this.ctm).coords);
        this.vertices.push(this.matrix.advance(0, 1).transform(this.ctm).coords);
        this.vertices.push(this.matrix.advance(adv, 1).transform(this.ctm).coords);
        this.vertices.push(this.matrix.advance(adv, 0).transform(this.ctm).coords);
    } else {
        this.nextMatrix = this.matrix.advance(0, -adv);
        this.size = this.matrix.distance(this.matrix.advance(1, 0));
        this.vertices.push(this.matrix.advance(0, 0).transform(this.ctm).coords);
        this.vertices.push(this.matrix.advance(1, 0).transform(this.ctm).coords);
        this.vertices.push(this.matrix.advance(1, -adv).transform(this.ctm).coords);
        this.vertices.push(this.matrix.advance(0, -adv).transform(this.ctm).coords);
    }

    var xs = this.vertices.map(function(v) {return v[0]});
    var ys = this.vertices.map(function(v) {return v[1]});
    this.x1 = Math.min.apply(null, xs);
    this.y1 = Math.min.apply(null, ys);
    this.x2 = Math.max.apply(null, xs);
    this.y2 = Math.max.apply(null, ys);
    this.width = this.x2-this.x1;
    this.height = this.y2-this.y1;

    if (this.nextMatrix.transform(this.ctm).coords[0] == this.matrix.transform(this.ctm).coords[0]) {
        this.direction = Direction.Vertical;
    } else {
        this.direction = Direction.Horizontal;
    }
}

Glyph.prototype.toString = function() {
    return "Glyph(" + [this.font.getName(), this.matrix.transform(this.ctm).toString(), this.unicode, this.glyph, this.wmode].join(", ") + ")";
};

Glyph.prototype.placeAfter = function(glyph) {
    return new Glyph(this.font, glyph.nextMatrix, this.glyph, this.unicode, this.wmode, this.ctm, this.kern, this.highlightColor);
};

Glyph.prototype.withKerning = function(kern) {
    return new Glyph(this.font, this.matrix, this.glyph, this.unicode, this.wmode, this.ctm, kern, this.highlightColor);
};

Glyph.prototype.isWithin = function(zones) {
    for (var i = 0; i < zones.length; ++i) {
        var zone = zones[i];
        var dx = Math.min(this.x2, zone.x2) - Math.max(this.x1, zone.x1);
        var dy = Math.min(this.y2, zone.y2) - Math.max(this.y1, zone.y1);
        var horizontalOverlap, verticalOverlap;
        if (this.direction == Direction.Horizontal) {
            horizontalOverlap = dx/this.width;
            verticalOverlap = dy/this.height;
        } else {
            horizontalOverlap = dy/this.height;
            verticalOverlap = dx/this.width;
        }
        if (horizontalOverlap >= MinHorizontalOverlap && verticalOverlap >= MinVerticalOverlap) {
            return true;
        }
    }
    return false;
};

Glyph.prototype.randomize = function(characterMap, characterWhitelist, zoneWhitelist) {
    var unicode, glyph, highlightColor;
    if (this.isWithin(zoneWhitelist)) {
        unicode = this.unicode;
        glyph = this.glyph;
        highlightColor = [0, 0, 1];
    } else if (characterWhitelist.indexOf(this.string) >= 0) {
        unicode = this.unicode;
        glyph = this.glyph;
        highlightColor = [0, 1, 0];
    } else {
        var result = characterMap.anonymize(this.font.getName(), this.unicode);
        unicode = result.unicode;
        glyph = result.glyph;
        if (result.score < 0) {
            highlightColor = [1, 0.5, 0];
        } else if (result.score < 0.25) {
            highlightColor = [1, 0, 0];
        } else if (unicode == this.unicode) {
            highlightColor = [0, 1, 1];
        } else {
            highlightColor = [0, 1, 0];
        }
    }
    return new Glyph(this.font, this.matrix, glyph, unicode, this.wmode, this.ctm, this.kern, highlightColor);
};

Glyph.prototype.succeeds = function(other, separatorCharactors) {
    if (separatorCharactors.indexOf(other.string) >= 0) {
        return false;
    }
    if (this.font != other.font) {
        return false;
    }
    if (this.wmode != other.wmode) {
        return false;
    }
    return this.matrix.equals(other.nextMatrix, this.size*MaxGlyphDistance);
};

function GlyphMatrix(m) {
    this.m = m;
    this.coords = m.slice(4, 6);
}

GlyphMatrix.prototype.toString = function() {
    return "GlyphMatrix(" + this.m.join(",") + ")";
};

GlyphMatrix.prototype.advance = function(tx, ty) {
    var m = this.m.slice();
    m[4] += tx * m[0] + ty * m[2];
    m[5] += tx * m[1] + ty * m[3];
    return new GlyphMatrix(m);
};

GlyphMatrix.prototype.distance = function(other) {
    var dx = other.m[4] - this.m[4];
    var dy = other.m[5] - this.m[5];
    return Math.sqrt(dx*dx + dy*dy);
};

GlyphMatrix.prototype.equals = function(other, maxDistance) {
    for (var i = 0; i < 4; ++i) {
        if (this.m[i] != other.m[i]) {
            return false;
        }
    }
    return this.distance(other) <= maxDistance;
};

GlyphMatrix.prototype.transform = function(ctm) {
    return new GlyphMatrix(Concat(this.m, ctm));
};

exports.Glyph = Glyph;
exports.GlyphMatrix = GlyphMatrix;
