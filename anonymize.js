var Resolution = 300; //ppi

var SubstitutionGroups = {
    lowerNarrow:    "fijlt",
    lowerNormal:    "abcdeghknopqrsuvxyz",
    lowerWide:      "mw",
    upperNarrow:    "I",
    upperNormal:    "ABCDEFGHJKLNOPQRSTUVXYZ",
    upperWide:      "MW",
    digitNarrow:    "1",
    digitWide:      "023456789",
};

// TODO: Exclude characters for which there is no glyph in the embedded font.
// TODO: Analyze document fonts to determine optimal character width groupings.

function anonymizeUnicode(u) {
    for (var group in SubstitutionGroups) {
        var chars = SubstitutionGroups[group];
        if (chars.indexOf(String.fromCharCode(u)) > 0) {
            return chars[parseInt(Math.random()*chars.length)].charCodeAt(0);
        }
    }
    return u;
}

function anonymizeText(text) {
    var anonymizedText = new Text();
    var textExtractor = {
        showGlyph: function (f, m, g, u, v, b) {
            // Font, transform_Matrix, Glyph, Unicode, Vertical, BidiLevel
            u = anonymizeUnicode(u);
            g = f.encodeCharacter(u);
            anonymizedText.showGlyph(f, m, g, u, v, b);
        }
    };
    text.walk(textExtractor);
    return anonymizedText;
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

if (scriptArgs.length != 3) {
    print("usage: mutool run anonymize.js document.pdf pageNumber output.png")
    quit(1);
}

var scaleMatrix = Scale(Resolution/72, Resolution/72);

var doc = new Document(scriptArgs[0]);
var page = doc.loadPage(parseInt(scriptArgs[1])-1);

var pixmap = page.toPixmap(scaleMatrix, DeviceRGB);
pixmap.clear(255);
var anonymizingDevice = new AnonymizingDrawDevice(Identity, pixmap);
page.run(anonymizingDevice, scaleMatrix);
anonymizingDevice.close()

pixmap.saveAsPNG(scriptArgs[2]);
