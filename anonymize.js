// Output image resolution in pixels per inch.
var Resolution = 300;

// Determines how lenient the algorithm will be when finding anonymized text of
// similar dimensions to the original text. If the distance between the end of
// the anonymized token and the end of the original token exceeds
// GlyphReplacementTolerance*fontSize, the proposed replacement will be rejected.
var GlyphReplacementTolerance = 0.1;

// The following two parameters determine how frequently and by how much the
// GlyphReplacementTolerance is backed off. If the number of attempts to find a
// sequence of glyphs of correct dimensions exceeds BackOffFrequency*sequenceLength,
// the current value of GlyphReplacementTolerance is multiplied by BackOffAmount.
// Back off is only applied per token.
var BackOffFrequency = 10;
var BackOffAmount = 1.5;

// Determines when a sequence of glyphs should be split into multiple parts. If
// the distance between the previous glyph's advanced matrix and the current
// glyph's matrix is greater than MaxGlyphDistance*fontSize, then a split occurs.
// This parameter should rarely require tuning.
var MaxGlyphDistance = 0.1;

var CharacterWhitelist = " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

var SubstitutionGroups = {
    lower: "abcdefghijklmnopqrstuvwxyzabcdefghiklmnopqrstuvwxyabcdefghiklmnopqrstuvwxyabcdefghiklmnoprstuvwxyabcdefghiklmnoprstuvwxyabcdefghiklmnoprstuvwxyabcdefghiklmnoprstuvwxyabcdefghiklmnoprstuvwxyabcdefghiklmnoprstuvwxyabcdefghiklmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuvwyabcdefghilmnoprstuyacdefghilmnoprstuyacdefghilmnoprstuyacdefghilmnoprstuyacdeghilmnoprstuyacdehilmnoprstuyacdehilmnoprstuyacdehilmnoprstuyacdehilmnoprstuyacdehilmnoprstuyacdehilmnoprstuyacdehilmnoprstuyacdehilmnoprstuyacdehilmnorstuyacdehilmnorstuacdehilmnorstuacdeilmnorstuacdeilmnorstuacdeilmnorstuacdeilmnorstuacdeilmnorstuacdeilmnorstuacdeilmnorstuacdeilmnorstuacdeilmnorstuacdeilnorstuacdeilnorstuacdeilnorstuacdeilnorstuacdeilnorstuacdeilnorstuacdeilnorstuacdeilnorstuacdeilnorstuacdeilnorstuaceilnorstuaceilnorstuaceilnorstuaceilnorstuaceilnorstuaceilnorstuaceilnorstuaceilnorstaceilnorstaceilnorstaceilnorstaceilnorstaeilnorstaeilnorstaeilnorstaeilnorstaeilnorstaeinorstaeinorstaeinorstaeinorstaeinorstaeinorstaeinorstaeinorstaeinorstaeinorstaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaeinortaenotaenotaenotaenotaenotaeotaeotaeotaeotaeotaeotaeotaeotaeotaeotaeotaeotaeotaeotaeotaeteteeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZABCDEFGHIJKLMNOPQRSTUVWXYABCDEFGHIJKLMNOPRSTUVWXYABCDEFGHILMNOPRSTUVWYABCDEFGHILMNOPRSTUVWYABCDEFGHILMNOPRSTUVWYABCDEFGHILMNOPRSTUWABCDEFGHILMNOPRSTUABCDEGILMNOPRSTUABCDEGILMNOPRSTUABCDEGILMNOPRSTUABCDEILMNOPRSTABCDEILMNOPRSTABCDEILNOPRSTACDEILNOPRSTACDEILNOPRSTACDEILNOPRSTACDEILNOPRSTACDEINOPRSTACDEINOPRSTACEINOPRSTACEINORSTACEINOSTAEINSTAEINSTAEINSTAESTAESTAESTAETAETATATATAT",
    digit: "012345678901200",
};

function CharacterMap(page, substitutionGroups) {

    var map = {};
    var characterAnalyzer = {
        showGlyph: function(f, m, g, u) {
            var fn = f.getName();
            if (!(fn in map)) {
                map[fn] = {};
            }
            map[fn][u] = g;
        },
        fillText: function(text) { text.walk(this); },
        clipText: function(text) { text.walk(this); },
        strokeText: function(text) { text.walk(this); },
        clipStrokeText: function(text) { text.walk(this); },
        ignoreText: function(text) { text.walk(this); }
    }
    page.run(characterAnalyzer, Identity);

    var countUnique = function(characters) {
        var unique = {};
        for (var i = 0; i < characters.length; ++i) {
            unique[characters[i]] = true;
        }
        return Object.keys(unique).length;
    };

    var fontSubstitutionGroups = {};
    var fontSubstitutionGroupScores = {};
    for (var fontName in map) {
        fontSubstitutionGroups[fontName] = {};
        fontSubstitutionGroupScores[fontName] = {};
        for (var group in substitutionGroups) {
            fontSubstitutionGroups[fontName][group] = "";
            var characters = substitutionGroups[group];
            for (var i = 0; i < characters.length; ++i) {
                var chr = characters[i];
                var uni = chr.charCodeAt(0);
                if (uni in map[fontName]) {
                    fontSubstitutionGroups[fontName][group] += chr;
                }
            }
            fontSubstitutionGroupScores[fontName][group] = countUnique(fontSubstitutionGroups[fontName][group]) / countUnique(substitutionGroups[group]);
        }
    }

    this.anonymize = function(fontName, unicode) {
        var score = 0;
        for (var group in fontSubstitutionGroups[fontName]) {
            var characters = fontSubstitutionGroups[fontName][group];
            if (characters.indexOf(String.fromCharCode(unicode)) >= 0) {
                unicode = characters[parseInt(Math.random()*characters.length)].charCodeAt(0);
                score = fontSubstitutionGroupScores[fontName][group];
                break;
            }
        }
        var glyph = map[fontName][unicode];
        return {unicode: unicode, glyph: glyph, score: score};
    };
}

function GlyphMatrix(m) {

    // Transform with 6 elements.
    this.m = m;

    this.maxGlyphDistance = MaxGlyphDistance * Math.abs(m[0]);

    this.toString = function() {
        return "GlyphMatrix(" + this.m.join(",") + ")";
    }

    this.advance = function(font, glyph, wmode) {
        var adv = font.advanceGlyph(glyph, wmode);
        var tx = 0, ty = 0;
        if (wmode == 0) {
            tx = adv;
        } else {
            ty = -adv;
        }
        var m = this.m.slice();
        m[4] += tx * m[0] + ty * m[2];
        m[5] += tx * m[1] + ty * m[3];
        return new GlyphMatrix(m);
    }

    this.distance = function(other) {
        var dx = other.m[4] - this.m[4];
        var dy = other.m[5] - this.m[5];
        return Math.sqrt(dx*dx + dy*dy);
    }

    this.equals = function(other) {
        for (var i = 0; i < 4; ++i) {
            if (this.m[i] != other.m[i]) {
                return false;
            }
        }
        return this.distance(other) <= this.maxGlyphDistance;
    }

    this.transform = function(ctm) {
        return new GlyphMatrix(Concat(this.m, ctm));
    }

}

function Glyph(f, m, g, u, v, ctm, color) {

    // Font, Matrix, Glyph, Unicode, Vertical, Contextual Transform Matrix

    this.font = f;
    this.matrix = new GlyphMatrix(m);
    this.nextMatrix = this.matrix.advance(f, g, v);
    this.glyph = g;
    this.unicode = u;
    this.wmode = v;
    this.ctm = ctm;

    if (color === undefined) {
        color = [0, 0, 0];
    }
    this.color = color;

    this.string = String.fromCharCode(u);

    var t = this.matrix.transform(this.ctm);
    var a = this.nextMatrix.transform(this.ctm);
    this.vertices = [];
    this.vertices.push([t.m[4], t.m[5]]);
    this.vertices.push([t.m[4] + t.m[1], t.m[5] - t.m[0]]);
    this.vertices.push([a.m[4] + a.m[1], a.m[5] - a.m[0]]);
    this.vertices.push([a.m[4], a.m[5]]);

    this.toString = function() {
        return "Glyph(" + [this.font.getName(), this.matrix.transform(this.ctm).toString(), this.unicode, this.glyph, this.wmode].join(", ") + ")";
    }

    this.placeAfter = function(glyph) {
        return new Glyph(this.font, glyph.nextMatrix.m, this.glyph, this.unicode, this.wmode, this.ctm, this.color);
    }

    this.isWithin = function(zones) {
        var points = this.vertices;
        var avgX = 0, avgY = 0;
        for (var i = 0; i < points.length; ++i) {
            avgX += points[i][0] / points.length;
            avgY += points[i][1] / points.length;
        }
        points.push([avgX, avgY]);
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
    }

    this.randomize = function(characterMap, characterWhitelist, zoneWhitelist) {
        var u, g, color;
        if (this.isWithin(zoneWhitelist)) {
            u = this.unicode;
            g = this.glyph;
            color = [0, 0, 1];
        } else if (characterWhitelist.indexOf(this.string) >= 0) {
            u = this.unicode;
            g = this.glyph;
            color = [0, 1, 0];
        } else {
            var result = characterMap.anonymize(this.font.getName(), this.unicode);
            u = result.unicode;
            g = result.glyph;
            if (result.score < 0.25) {
                color = [1, 0, 0];
            } else if (u == this.unicode) {
                color = [0, 1, 1];
            } else {
                color = [0, 1, 0];
            }
        }
        return new Glyph(this.font, this.matrix.m, g, u, this.wmode, this.ctm, color);
    }

    this.succeeds = function(other) {
        if (other.string == " ") {
            return false;
        }
        if (this.font != other.font) {
            return false;
        }
        if (this.wmode != other.wmode) {
            return false;
        }
        return this.matrix.equals(other.nextMatrix);
    }

}

function AnonymizingDevice(pixmap, characterMap, characterWhitelist, zoneWhitelist) {

    this.dd = DrawDevice(Identity, pixmap);
    this.characterMap = characterMap;
    this.characterWhitelist = characterWhitelist;
    this.zoneWhitelist = zoneWhitelist;
    this.replacements = {};

    this.anonymizeText = function (text, ctm) {
        var glyphs = this.textToGlyphs(text, ctm);
        var chunks = this.tokenize(glyphs);
        var anonymizedText = new Text();
        for (var i = 0; i < chunks.length; ++i) {
            this.glyphsToText(this.anonymize(chunks[i])).walk(anonymizedText);
        }
        return anonymizedText;
    };

    this.textToGlyphs = function(text, ctm) {
        var glyphs = []
        text.walk({
            showGlyph: function (f, m, g, u, v) {
                glyphs.push(new Glyph(f, m, g, u, v, ctm));
            }
        });
        return glyphs;
    };

    this.glyphsToText = function(glyphs) {
        var text = new Text();
        for (var i = 0; i < glyphs.length; ++i) {
            var g = glyphs[i];
            text.showGlyph(g.font, g.matrix.m, g.glyph, g.unicode, g.wmode);
        }
        return text;
    };

    this.tokenize = function(glyphs) {
        var chunks = [];
        var chunk = [];
        for (var i = 0; i < glyphs.length; ++i) {
            var curr = glyphs[i];
            if (chunk.length > 0) {
                var last = chunk[chunk.length-1];
                if (!curr.succeeds(last)) {
                    chunks.push(chunk);
                    chunk = [];
                }
            }
            chunk.push(curr);
        }
        if (chunk.length > 0) {
            chunks.push(chunk);
        }
        return chunks;
    };

    this.anonymize = function(glyphs) {
        var attempts = 0;
        var tolerance = GlyphReplacementTolerance * Math.abs(glyphs[0].matrix.m[0]);
        var original = "";
        for (var i = 0; i < glyphs.length; ++i) {
            original += glyphs[i].string;
        }
        print("Replacing", original, "(tolerance:", tolerance + ")");
        while (true) {
            attempts++;
            var candidate = this.randomize(glyphs);
            var candidateDistance = candidate[candidate.length-1].nextMatrix.distance(glyphs[glyphs.length-1].nextMatrix);
            var candidateString = "";
            for (var i = 0; i < candidate.length; ++i) {
                candidateString += candidate[i].string;
            }
            print(original, " -> ", candidateString, "(" + candidateDistance + ")");
            if (candidateDistance <= tolerance) {
                for (var i = 0; i < candidate.length; ++i) {
                    this.replacements[glyphs[i]] = candidate[i];
                }
                print("attempts:", attempts);
                print("\n");
                return candidate;
            }
            if (attempts % (BackOffFrequency * glyphs.length) == 0) {
                tolerance *= BackOffAmount;
                print("increasing tolerance to", tolerance);
            }
        }
    };

    this.randomize = function(glyphs) {
        var replacements = [];
        for (var i = 0; i < glyphs.length; ++i) {
            var r;
            if (glyphs[i] in this.replacements) {
                r = this.replacements[glyphs[i]];
            } else {
                r = glyphs[i];
                if (i > 0) {
                    r = r.placeAfter(replacements[i-1]);
                }
                r = r.randomize(this.characterMap, this.characterWhitelist, this.zoneWhitelist);
            }
            replacements.push(r);
        }
        return replacements;
    };

    this.fillText = function(text, ctm, colorSpace, color, alpha) {
        text = this.anonymizeText(text, ctm);
        return this.dd.fillText(text, ctm, colorSpace, color, alpha);
    };
    this.clipText = function(text, ctm) {
        text = this.anonymizeText(text, ctm);
        return this.dd.clipText(text, ctm);
    };
    this.strokeText = function(text, stroke, ctm, colorSpace, color, alpha) {
        text = this.anonymizeText(text, ctm);
        return this.dd.strokeText(text, stroke, ctm, colorSpace, color, alpha);
    };
    this.clipStrokeText = function(text, stroke, ctm) {
        text = this.anonymizeText(text, ctm);
        return this.dd.clipStrokeText(text, stroke, ctm);
    };
    this.ignoreText = function(text, ctm) {
        text = this.anonymizeText(text, ctm);
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

function PdfAnonymizer(fileName, pageIndex, substitutionGroups, characterWhitelist, annotationsFile) {

    var doc = new Document(fileName);
    this.page = doc.loadPage(pageIndex);

    this.characterMap = new CharacterMap(this.page, substitutionGroups);
    this.characterWhitelist = characterWhitelist;
    this.annotationsFile = annotationsFile;

    this.loadAnnotations = function(outputWidth, outputHeight) {
        try {
            var annotations = read(this.annotationsFile);
        } catch (err) {
            return [];
        }
        annotations = JSON.parse(annotations);
        for (var i = 0; i < annotations.length; ++i) {
            annotations[i].x1 *= outputWidth;
            annotations[i].y1 *= outputHeight;
            annotations[i].x2 *= outputWidth;
            annotations[i].y2 *= outputHeight;
        }
        return annotations;
    };

    this.run = function(outputResolution, outputFile, highlightedOutputFile) {

        var scaleMatrix = Scale(outputResolution/72, outputResolution/72);
        var pixmap = this.page.toPixmap(scaleMatrix, DeviceRGB);
        pixmap.clear(255);

        var zoneWhitelist = this.loadAnnotations(pixmap.getWidth(), pixmap.getHeight());

        var anonymizingDevice = new AnonymizingDevice(pixmap, this.characterMap, this.characterWhitelist, zoneWhitelist);
        this.page.run(anonymizingDevice, scaleMatrix);
        pixmap.saveAsPNG(outputFile);

        if (highlightedOutputFile === undefined) {
            return;
        }

        for (var k in anonymizingDevice.replacements) {
            var r = anonymizingDevice.replacements[k];
            var v = r.vertices;
            var p = new Path();
            p.moveTo(v[v.length-1][0], v[v.length-1][1])
            for (var j = 0; j < v.length; ++j) {
                var x = v[j][0];
                var y = v[j][1];
                p.lineTo(x, y);
            }
            anonymizingDevice.fillPath(p, true, Identity, DeviceRGB, r.color, 0.3);
        }
        pixmap.saveAsPNG(highlightedOutputFile);

        anonymizingDevice.close();
    };
}

if (scriptArgs.length != 3) {
    print("usage: mutool run anonymize.js document.pdf pageNumber output.png")
    quit(1);
}

var anonymizer = new PdfAnonymizer(scriptArgs[0], parseInt(scriptArgs[1])-1, SubstitutionGroups, CharacterWhitelist, scriptArgs[0].replace(".pdf", ".json"));
anonymizer.run(Resolution, scriptArgs[2], scriptArgs[2].replace(".png", ".info.png"));
