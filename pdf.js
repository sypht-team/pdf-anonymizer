var map = require("map");
var device = require("device");

function Anonymizer(fileName, annotationsFile, substitutionFrequencies, characterWhitelist, outputResolution) {

    this.doc = new Document(fileName);
    this.annotationsFile = annotationsFile;

    this.substitutionFrequencies = substitutionFrequencies;
    this.characterWhitelist = characterWhitelist;

    this.scaleMatrix = Scale(outputResolution/72, outputResolution/72);

    this.loadAnnotations = function(pageIndex, outputWidth, outputHeight) {
        if (!this.annotationsFile) {
            return [];
        }
        var annotations = read(this.annotationsFile);
        annotations = JSON.parse(annotations);
        for (var i = 0; i < annotations.length; ++i) {
            annotations[i].x1 *= outputWidth;
            annotations[i].y1 *= outputHeight;
            annotations[i].x2 *= outputWidth;
            annotations[i].y2 *= outputHeight;
        }
        var pageAnnotations = [];
        for (var i = 0; i < annotations.length; ++i) {
            if (annotations[i]["page_idx"] == pageIndex) {
                pageAnnotations.push(annotations[i]);
            }
        }
        return pageAnnotations;
    };

    this.imagesToPDF = function(images, bounds, output) {
        var outputDoc = new PDFDocument()
        for (var i = 0; i < images.length; ++i) {
            var image = outputDoc.addImage(images[i]);
            var resources = outputDoc.addObject({XObject: { Im0: image }});
            var bound = bounds[i];
            var contents = "q " + bound[2] + " 0 0 " + bound[3] + " 0 0 cm /Im0 Do Q\n";
            var page = outputDoc.addPage(bound, 0, resources, contents);
            outputDoc.insertPage(-1, page);
        }
        outputDoc.save(output, "compress-images");
    }

    this.run = function(outputFile, highlightedOutputFile) {
        var images = [];
        var highlightedImages = [];
        var bounds = [];
        for (var i = 0; i < this.doc.countPages(); ++i) {
            var result = this.getAnonymizedImage(i, outputFile);
            images.push(result.output);
            highlightedImages.push(result.highlightedOutput);
            bounds.push(this.doc.loadPage(i).bound());
        }
        this.imagesToPDF(images, bounds, outputFile);
        if (highlightedOutputFile) {
            this.imagesToPDF(highlightedImages, bounds, highlightedOutputFile);
        }
    }

    this.getAnonymizedImage = function(pageIndex, tempFile) {

        var page = this.doc.loadPage(pageIndex);
        var characterMap = new map.CharacterMap(page, this.substitutionFrequencies);

        var pixmap = page.toPixmap(this.scaleMatrix, DeviceRGB);
        pixmap.clear(255);

        var zoneWhitelist = this.loadAnnotations(pageIndex, pixmap.getWidth(), pixmap.getHeight());

        var anonymizingDevice = new device.AnonymizingDevice(pixmap, characterMap, this.characterWhitelist, zoneWhitelist);
        page.run(anonymizingDevice, this.scaleMatrix);

        pixmap.saveAsPNG(tempFile);
        var outputImage = new Image(tempFile);

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

        pixmap.saveAsPNG(tempFile);
        var highlightImage = new Image(tempFile);

        anonymizingDevice.close();

        return {output: outputImage, highlightedOutput: highlightImage};
    };
}

exports.Anonymizer = Anonymizer;
