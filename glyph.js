
// Determines when a sequence of glyphs should be split into multiple parts. If
// the distance between the previous glyph's advanced matrix and the current
// glyph's matrix is greater than MaxGlyphDistance*fontSize, then a split occurs.
// This parameter should rarely require tuning.
var MaxGlyphDistance = 0.1;

function Glyph(font, matrix, glyph, unicode, wmode, ctm, highlightColor) {

    this.font = font;
    this.matrix = matrix;
    this.glyph = glyph;
    this.unicode = unicode;
    this.wmode = wmode;
    this.ctm = ctm;
    this.highlightColor = highlightColor;

    this.string = String.fromCharCode(unicode);

    this.vertices = [];
    var adv = this.font.advanceGlyph(this.glyph, this.wmode);
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
}

Glyph.prototype.toString = function() {
    return "Glyph(" + [this.font.getName(), this.matrix.transform(this.ctm).toString(), this.unicode, this.glyph, this.wmode].join(", ") + ")";
};

Glyph.prototype.placeAfter = function(glyph) {
    return new Glyph(this.font, glyph.nextMatrix, this.glyph, this.unicode, this.wmode, this.ctm, this.highlightColor);
};

Glyph.prototype.isWithin = function(zones) {
    var avgX = 0, avgY = 0;
    for (var i = 0; i < this.vertices.length; ++i) {
        avgX += this.vertices[i][0] / this.vertices.length;
        avgY += this.vertices[i][1] / this.vertices.length;
    }
    var points = [];
    points.push(this.vertices[0]);
    points.push([avgX, avgY]);
    points.push(this.vertices[3]);
    for (var i = 0; i < zones.length; ++i) {
        var zone = zones[i];
        for (var j = 0; j < points.length; ++j) {
            var x0 = points[j][0];
            var y0 = points[j][1];
            if (x0 >= zone.x1 && x0 <= zone.x2 && y0 >= zone.y1 && y0 <= zone.y2) {
                return true;
            }
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
    return new Glyph(this.font, this.matrix, glyph, unicode, this.wmode, this.ctm, highlightColor);
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
