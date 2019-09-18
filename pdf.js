var map = require("map");
var device = require("device");

function Anonymizer(fileName, pageIndex, substitutionFrequencies, characterWhitelist, annotationsFile) {

    var doc = new Document(fileName);
    this.page = doc.loadPage(pageIndex);

    this.characterMap = new map.CharacterMap(this.page, substitutionFrequencies);
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

        var anonymizingDevice = new device.AnonymizingDevice(pixmap, this.characterMap, this.characterWhitelist, zoneWhitelist);
        this.page.run(anonymizingDevice, scaleMatrix);
        pixmap.saveAsPNG(outputFile);

        if (highlightedOutputFile === undefined) {
            return;
        }

        for (var k in anonymizingDevice.replacements) {
            var r = anonymizingDevice.replacements[k];
            var v = r.vertices;
            var p = new Path();
            p.moveTo(v[v.length-1][0], v[v.length-1][1]);
            for (var j = 0; j < v.length; ++j) {
                var x = v[j][0];
                var y = v[j][1];
                p.lineTo(x, y);
            }
            anonymizingDevice.fillPath(p, true, Identity, DeviceRGB, r.highlightColor, 0.3);
        }

        for (var i = 0; i < zoneWhitelist.length; i++) {
            var z = zoneWhitelist[i];
            var p = new Path();
            p.moveTo(z.x1, z.y1);
            p.lineTo(z.x1, z.y2);
            p.lineTo(z.x2, z.y2);
            p.lineTo(z.x2, z.y1);
            p.lineTo(z.x1, z.y1);
            anonymizingDevice.strokePath(p, 5, Identity, DeviceRGB, [1, 0, 0], 1.0);
        }

        pixmap.saveAsPNG(highlightedOutputFile);

        anonymizingDevice.close();
    };
}

exports.Anonymizer = Anonymizer;
