
// CharacterMap builds a map of font-specific glyph codes from unicode characaters.
// It is also able to suggest a substitution for a given glyph, based on the
// substitutionFrequencies table.

function CharacterMap(page, substitutionFrequencies) {

    var substitutionGroups = {};
    for (var group in substitutionFrequencies) {
        substitutionGroups[group] = "";
        for (var chr in substitutionFrequencies[group]) {
            for (var i = 0; i < substitutionFrequencies[group][chr]; ++i) {
                substitutionGroups[group] += chr;
            }
        }
    }

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
        var score = -1;
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

exports.CharacterMap = CharacterMap;
