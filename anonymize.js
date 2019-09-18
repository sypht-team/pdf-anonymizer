var pdf = require("pdf");

var Resolution = 300;

var CharacterWhitelist = " !\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~";

var SubstitutionFrequencies = {
    lower: {a:135, b:22, c:68, d:56, e:197, f:25, g:25, h:39, i:113, j:1, k:11, l:74, m:46, n:115, o:132, p:34, q:3, r:113, s:87, t:136, u:62, v:19, w:19, x:9, y:35, z:1},
    upper: {A:33,  B:13, C:22, D:18, E:29,  F:7,  G:10, H:7,  I:24,  J:3, K:3,  L:17, M:13, N:24,  O:21,  P:20, Q:2, R:21,  S:27, T:32,  U:10, V:6,  W:7,  X:3, Y:6,  Z:1},
    digit: {0:4,   1:2,  2:2,  3:1,  4:1,   5:1,  6:1,  7:1,  8:1,   9:1}
}

if (scriptArgs.length != 3) {
    print("usage: mutool run anonymize.js document.pdf pageNumber output.png");
    quit(1);
}

var anonymizer = new pdf.Anonymizer(scriptArgs[0], parseInt(scriptArgs[1])-1, SubstitutionFrequencies, CharacterWhitelist, scriptArgs[0].replace(".pdf", ".json"));
anonymizer.run(Resolution, scriptArgs[2], scriptArgs[2].replace(".png", ".info.png"));
