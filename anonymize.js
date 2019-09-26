var pdf = require("pdf");

var Resolution = 300;

var CharacterWhitelist = "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~ \t\f\r\u00A0\u2013\u2014\u2018\u2019\u201C\u201D\u2020\u2021\u2022\u2023\u2026\u20AC\u2212\u00A9\u00AE\u00AD";

var SubstitutionFrequencies = {
    lower: {a:135, b:22, c:68, d:56, e:197, f:25, g:25, h:39, i:113, j:1, k:11, l:74, m:46, n:115, o:132, p:34, q:3, r:113, s:87, t:136, u:62, v:19, w:19, x:9, y:35, z:1, "\uFB00": 1, "\uFB01": 1},
    upper: {A:33,  B:13, C:22, D:18, E:29,  F:7,  G:10, H:7,  I:24,  J:3, K:3,  L:17, M:13, N:24,  O:21,  P:20, Q:2, R:21,  S:27, T:32,  U:10, V:6,  W:7,  X:3, Y:6,  Z:1},
    digit: {0:4,   1:2,  2:2,  3:1,  4:1,   5:1,  6:1,  7:1,  8:1,   9:1}
}

if (scriptArgs.length < 2 || scriptArgs.length > 4) {
    print("usage: mutool run anonymize.js input.pdf output.pdf [highlightedOutput.pdf] [whitelistZones.json]");
    quit(1);
}

var inputFile = scriptArgs[0];
var outputFile = scriptArgs[1];

var highlightedOutputFile = null;
if (scriptArgs.length > 2) {
    highlightedOutputFile = scriptArgs[2];
}

var whitelistZonesFile = null;
if (scriptArgs.length > 3) {
    whitelistZonesFile = scriptArgs[3];
}

var anonymizer = new pdf.Anonymizer(inputFile, whitelistZonesFile, SubstitutionFrequencies, CharacterWhitelist, Resolution);
anonymizer.run(outputFile, highlightedOutputFile);
