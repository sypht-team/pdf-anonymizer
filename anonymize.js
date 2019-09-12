var Resolution = 300; //ppi
var NWidthBins = 5;

if (scriptArgs.length != 3) {
    print("usage: mutool run anonymize.js document.pdf pageNumber output.png")
    quit(1);
}

var scaleMatrix = Scale(Resolution/72, Resolution/72);

var doc = new Document(scriptArgs[0]);
var page = doc.loadPage(parseInt(scriptArgs[1])-1);

var CharacterMap = {};
var analyzeCharacters = {
    showGlyph: function (f, m, g, u, v, b) {
        var fn = f.getName();
        if (!(fn in CharacterMap)) {
            CharacterMap[fn] = {};
        }
        CharacterMap[fn][u] = g;
    }
};
page.run({
    fillText: function(text, ctm, colorSpace, color, alpha) { text.walk(analyzeCharacters); },
    clipText: function(text, ctm) { text.walk(analyzeCharacters); },
    strokeText: function(text, stroke, ctm, colorSpace, color, alpha) { text.walk(analyzeCharacters); },
    clipStrokeText: function(text, stroke, ctm) { text.walk(analyzeCharacters); },
    ignoreText: function(text, ctm) { text.walk(analyzeCharacters); }
}, Identity);


var SubstitutionGroups = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    digit: "0123456789",
};

function anonymizeUnicode(u) {
    for (var group in SubstitutionGroups) {
        var chars = SubstitutionGroups[group];
        if (chars.indexOf(String.fromCharCode(u)) >= 0) {
            return chars[parseInt(Math.random()*chars.length)].charCodeAt(0);
        }
    }
    return u;
}

function advanceMatrix(m, font, glyph, wmode) {
    var adv = font.advanceGlyph(glyph, wmode);
    var tx = 0, ty = 0;
    if (wmode == 0) {
        tx = adv;
    } else {
        ty = -adv;
    }
    var m = m.slice();
    m[4] += tx * m[0] + ty * m[2];
    m[5] += tx * m[1] + ty * m[3];
    return m;
}

function distance(m1, m2) {
    var dx = m2[4] - m1[4];
    var dy = m2[5] - m1[5];
    return Math.sqrt(dx*dx + dy*dy);
}

function matricesDiffer(m1, m2, maxDistance) {
    if (maxDistance === undefined) {
        maxDistance = 1.0;
    }
    for (var i = 0; i < 4; ++i) {
        if (m1[i] != m2[i]) {
            return true;
        }
    }
    if (distance(m1, m2) > maxDistance) {
        return true;
    }
    return false;
}

function splitText(text) {
    var glyphs = []
    text.walk({
        showGlyph: function (f, m, g, u, v) {
            glyphs.push({
                "font": f, 
                "matrix": m,
                "nextMatrix": advanceMatrix(m, f, g, v),
                "glyph": g,
                "unicode": u,
                "wmode": v
            });
            print("char:", String.fromCharCode(u), "curr:", m, "next:", advanceMatrix(m, f, g, v));
        }
    });
    var chunks = [];
    var chunk = [];
    for (var i = 0; i < glyphs.length; ++i) {
        var curr = glyphs[i];
        if (chunk.length > 0) {
            var last = chunk[chunk.length-1];
            if (curr.font != last.font || curr.wmode != last.wmode || matricesDiffer(curr.matrix, last.nextMatrix)) {
                chunks.push(chunk);
                chunk = [];
            }
        }
        chunk.push(curr);
    }
    if (chunk.length > 0) {
        chunks.push(chunk);
    }
    for (var i = 0; i < chunks.length; ++i) {
        var characters = "";
        for (var j = 0; j < chunks[i].length; ++j) {
            characters += String.fromCharCode(chunks[i][j].unicode);
        }
        print("chunk " + i + ": " + characters);
    }
    return chunks;
}

function mergeParts(parts) {
    var text = new Text();
    for (var i = 0; i < parts.length; ++i) {
        parts[i].walk(text);
    }
    return text;
}

function anonymizeText(text) {
    var parts = splitText(text);
    for (var i = 0; i < parts.length; ++i) {
        parts[i] = anonymizePart(parts[i]);
    }
    return mergeParts(parts);
}

var Substitutions = {}

function anonymizePart(glyphs) {
    var attempts = 0;
    var avgGlyphLength = distance(glyphs[0].matrix, glyphs[glyphs.length-1].nextMatrix) / glyphs.length;
    var initialTolerance = 0.15;
    var tolerance = initialTolerance * avgGlyphLength;
    print("average glyph length is", avgGlyphLength, "tolerance is", tolerance);
    while (true) {
        attempts++;
        var anonymizedText = new Text();
        var f = glyphs[0].font;
        var m = glyphs[0].matrix;
        var v = glyphs[0].wmode;
        var partSubstitutions = {};
        var original = "";
        var replaced = "";
        for (var i = 0; i < glyphs.length; ++i) {
            var u, g = 0;
            original += String.fromCharCode(glyphs[i].unicode);
            var substitutionKey = f.getName() + "-" + m + "-" + glyphs[i].unicode + "-" + glyphs[i].glyph + "-" + v;
            if (substitutionKey in Substitutions) {
                u = Substitutions[substitutionKey][0];
                g = Substitutions[substitutionKey][1];
            } else {
                while (!g) {
                    u = anonymizeUnicode(glyphs[i].unicode);
                    if (u == glyphs[i].unicode) {
                        g = glyphs[i].glyph;
                        break;
                    } else {
                        g = CharacterMap[f.getName()][u];
                    }
                }
            }
            replaced += String.fromCharCode(u);
            partSubstitutions[substitutionKey] = [u, g];
            anonymizedText.showGlyph(f, m, g, u, v);
            m = advanceMatrix(m, f, g, v);
        }
        print(original, " -> ", replaced);
        var delta;
        if (v == 0) {
            delta = m[4] - glyphs[glyphs.length-1].nextMatrix[4];
        } else {
            delta = m[5] - glyphs[glyphs.length-1].nextMatrix[5];
        }
        if (distance(m, glyphs[glyphs.length-1].nextMatrix) <= tolerance) {
            print("close enough", delta);
            for (var k in partSubstitutions) {
                Substitutions[k] = partSubstitutions[k];
            }
            print("attempts:", attempts);
            print("\n");
            return anonymizedText;
        }
        if (delta > 0) {
            print("too wide", delta);
        } else {
            print("too narrow", delta);
        }
        if (attempts % 10 == 0) {
            tolerance *= 1.5;
            print("increasing tolerance to", tolerance);
        }
    }
}

// We cannot use inheritence to extend DrawDevice, since it is a native
// class. Instead, we use composition to override the text functions.

function AnonymizingDrawDevice(transform, pixmap) {
    this.dd = DrawDevice(transform, pixmap);
    this.fillText = function(text, ctm, colorSpace, color, alpha) {
    	text = anonymizeText(text);
        return this.dd.fillText(text, ctm, colorSpace, color, alpha);
    };
    this.clipText = function(text, ctm) {
    	text = anonymizeText(text);
        return this.dd.clipText(text, ctm);
    };
    this.strokeText = function(text, stroke, ctm, colorSpace, color, alpha) {
    	text = anonymizeText(text);
        return this.dd.strokeText(text, stroke, ctm, colorSpace, color, alpha);
    };
    this.clipStrokeText = function(text, stroke, ctm) {
    	text = anonymizeText(text);
        return this.dd.clipStrokeText(text, stroke, ctm);
    };
    this.ignoreText = function(text, ctm) {
    	text = anonymizeText(text);
        return this.dd.ignoreText(text, ctm);
    };
    this.fillPath = function(path, evenOdd, ctm, colorSpace, color, alpha) {
    	return this.dd.fillPath(path, evenOdd, ctm, colorSpace, color, alpha);
    };
    this.clipPath = function(path, evenOdd, ctm) {
        return this.dd.clipPath(path, evenOdd, ctm);
    };
    this.strokePath = function(path, stroke, ctm, colorSpace, color, alpha) {
        return this.dd.strokePath(path, stroke, ctm, colorSpace, color, alpha);
    };
    this.clipStrokePath = function(path, stroke, ctm) {
        return this.dd.clipStrokePath(path, stroke, ctm);
    };
    this.fillShade = function(shade, ctm, alpha) {
        return this.dd.fillShade(shade, ctm, alpha);
    };
    this.fillImage = function(image, ctm, alpha) {
        return this.dd.fillImage(image, ctm, alpha);
    };
    this.fillImageMask = function(image, ctm, colorSpace, color, alpha) {
        return this.dd.fillImageMask(image, ctm, colorSpace, color, alpha);
    };
    this.clipImageMask = function(image, ctm) {
        return this.dd.clipImageMask(image, ctm);
    };
    this.beginMask = function(area, luminosity, colorspace, color) {
        return this.dd.beginMask(area, luminosity, colorspace, color);
    };
    this.endMask = function() {
        return this.dd.endMask();
    };
    this.popClip = function() {
        return this.dd.popClip();
    };
    this.beginGroup = function(area, isolated, knockout, blendmode, alpha) {
        return this.dd.beginGroup(area, isolated, knockout, blendmode, alpha);
    };
    this.endGroup = function() {
        return this.dd.endGroup();
    };
    this.beginTile = function(area, view, xstep, ystep, ctm, id) {
        return this.dd.beginTile(area, view, xstep, ystep, ctm, id);
    };
    this.endTile = function() {
    	return this.dd.endTile();
    };
    this.close = function() {
    	return this.dd.close();
    };
}
var pixmap = page.toPixmap(scaleMatrix, DeviceRGB);
pixmap.clear(255);
var anonymizingDevice = new AnonymizingDrawDevice(Identity, pixmap);
page.run(anonymizingDevice, scaleMatrix);
anonymizingDevice.close()

pixmap.saveAsPNG(scriptArgs[2]);
