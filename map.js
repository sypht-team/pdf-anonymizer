
// CharacterMap builds a map of font-specific glyph codes from unicode characaters.
// It is also able to suggest a substitution for a given glyph, based on the
// substitutionFrequencies table.

function RandomSelector(groups) {
    this.groups = groups;
    this.total = 0;
    for (var k in this.groups) {
        this.total += this.groups[k];
    }
}
RandomSelector.prototype.choice = function() {
    var index = Math.random() * this.total;
    for (var k in this.groups) {
        index -= this.groups[k];
        if (index <= 0) {
            return k;
        }
    }
};
RandomSelector.prototype.has = function(key) {
    return key in this.groups;
};

function CharacterMap(page, substitutionGroups) {

    var map = {};
    var characterAnalyzer = {
        showGlyph: function(font, matrix, glyph, unicode) {
            var fontName = font.getName();
            if (!(fontName in map)) {
                map[fontName] = {};
            }
            map[fontName][unicode] = glyph;
        },
        fillText: function(text) { text.walk(this); },
        clipText: function(text) { text.walk(this); },
        strokeText: function(text) { text.walk(this); },
        clipStrokeText: function(text) { text.walk(this); },
        ignoreText: function(text) { text.walk(this); }
    }
    page.run(characterAnalyzer, Identity);

    var fontSubstitutionGroups = {};
    var fontSubstitutionGroupScores = {};
    for (var fontName in map) {
        fontSubstitutionGroups[fontName] = {};
        fontSubstitutionGroupScores[fontName] = {};
        for (var group in substitutionGroups) {
            fontSubstitutionGroups[fontName][group] = {};
            var total = 0, included = 0;
            for (var chr in substitutionGroups[group]) {
                total++;
                if (chr.charCodeAt(0) in map[fontName]) {
                    included++;
                    fontSubstitutionGroups[fontName][group][chr] = substitutionGroups[group][chr];
                }
            }
            fontSubstitutionGroups[fontName][group] = new RandomSelector(fontSubstitutionGroups[fontName][group]);
            fontSubstitutionGroupScores[fontName][group] = included / total;
        }
    }

    this.anonymize = function(fontName, unicode) {
        var score = -1;
        for (var group in fontSubstitutionGroups[fontName]) {
            if (fontSubstitutionGroups[fontName][group].has(String.fromCharCode(unicode))) {
                unicode = fontSubstitutionGroups[fontName][group].choice().charCodeAt(0);
                score = fontSubstitutionGroupScores[fontName][group];
            }
        }
        var glyph = map[fontName][unicode];
        return {unicode: unicode, glyph: glyph, score: score};
    };
}

exports.CharacterMap = CharacterMap;
