/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

var d3 = require('d3');
var Lib = require('../../lib');
var xmlnsNamespaces = require('../../constants/xmlns_namespaces');
var constants = require('./constants');

module.exports = function plot(gd, plotinfo, cdimage, imageLayer) {
    var xa = plotinfo.xaxis;
    var ya = plotinfo.yaxis;

    var supportsPixelatedImage = !Lib.isSafari() && !gd._context._exportedPlot;

    Lib.makeTraceGroups(imageLayer, cdimage, 'im').each(function(cd) {
        var plotGroup = d3.select(this);
        var cd0 = cd[0];
        var trace = cd0.trace;
        var fastImage = supportsPixelatedImage && !trace._isSourceEmpty;
        trace._fastImage = fastImage;

        var z = cd0.z;
        var x0 = cd0.x0;
        var y0 = cd0.y0;
        var w = cd0.w;
        var h = cd0.h;
        var dx = trace.dx;
        var dy = trace.dy;

        var left, right, temp, top, bottom, i;
        // in case of log of a negative
        i = 0;
        while(left === undefined && i < w) {
            left = xa.c2p(x0 + i * dx);
            i++;
        }
        i = w;
        while(right === undefined && i > 0) {
            right = xa.c2p(x0 + i * dx);
            i--;
        }
        i = 0;
        while(top === undefined && i < h) {
            top = ya.c2p(y0 + i * dy);
            i++;
        }
        i = h;
        while(bottom === undefined && i > 0) {
            bottom = ya.c2p(y0 + i * dy);
            i--;
        }

        if(right < left) {
            temp = right;
            right = left;
            left = temp;
        }

        if(bottom < top) {
            temp = top;
            top = bottom;
            bottom = temp;
        }

        // Reduce image size when zoomed in to save memory
        if(!fastImage) {
            var extra = 0.5; // half the axis size
            left = Math.max(-extra * xa._length, left);
            right = Math.min((1 + extra) * xa._length, right);
            top = Math.max(-extra * ya._length, top);
            bottom = Math.min((1 + extra) * ya._length, bottom);
        }

        var imageWidth = Math.round(right - left);
        var imageHeight = Math.round(bottom - top);

        // if image is entirely off-screen, don't even draw it
        var isOffScreen = (imageWidth <= 0 || imageHeight <= 0);
        if(isOffScreen) {
            var noImage = plotGroup.selectAll('image').data([]);
            noImage.exit().remove();
            return;
        }

        // Create a new canvas and draw magnified pixel on it
        function drawMagnifiedPixelOnCanvas(readPixel, colormodel) {
            var canvas = document.createElement('canvas');
            canvas.width = imageWidth;
            canvas.height = imageHeight;
            var context = canvas.getContext('2d');

            var ipx = function(i) {return Lib.constrain(Math.round(xa.c2p(x0 + i * dx) - left), 0, imageWidth);};
            var jpx = function(j) {return Lib.constrain(Math.round(ya.c2p(y0 + j * dy) - top), 0, imageHeight);};

            var fmt = constants.colormodel[colormodel].fmt;
            var c;
            for(i = 0; i < cd0.w; i++) {
                var ipx0 = ipx(i); var ipx1 = ipx(i + 1);
                if(ipx1 === ipx0 || isNaN(ipx1) || isNaN(ipx0)) continue;
                for(var j = 0; j < cd0.h; j++) {
                    var jpx0 = jpx(j); var jpx1 = jpx(j + 1);
                    if(jpx1 === jpx0 || isNaN(jpx1) || isNaN(jpx0) || !readPixel(i, j)) continue;
                    c = trace._scaler(readPixel(i, j));
                    if(c) {
                        context.fillStyle = colormodel + '(' + fmt(c).join(',') + ')';
                    } else {
                        // Return a transparent pixel
                        context.fillStyle = 'rgba(0,0,0,0)';
                    }
                    context.fillRect(ipx0, jpx0, ipx1 - ipx0, jpx1 - jpx0);
                }
            }

            return canvas;
        }

        var image3 = plotGroup.selectAll('image')
            .data(cd);

        image3.enter().append('svg:image').attr({
            xmlns: xmlnsNamespaces.svg,
            preserveAspectRatio: 'none',
        });

        image3.attr({
            height: imageHeight,
            width: imageWidth,
            x: left,
            y: top
        });

        // TODO: support additional smoothing options
        // https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering
        // http://phrogz.net/tmp/canvas_image_zoom.html
        image3
          .attr('style', 'image-rendering: optimizeSpeed; image-rendering: -moz-crisp-edges; image-rendering: -o-crisp-edges; image-rendering: -webkit-optimize-contrast; image-rendering: optimize-contrast; image-rendering: crisp-edges; image-rendering: pixelated;');

        new Promise(function(resolve) {
            if(!trace._isSourceEmpty) {
                var tmpCanvas;
                // Transfer image to a canvas for reading pixel colors in hover routine
                trace._canvas = trace._canvas || document.createElement('canvas');
                tmpCanvas = trace._canvas;
                tmpCanvas.width = w;
                tmpCanvas.height = h;
                var context = tmpCanvas.getContext('2d');

                var image;
                if(fastImage) {
                    image = image3.node();
                    image.onload = function() {
                        context.drawImage(image, 0, 0);
                    };
                    resolve();
                } else {
                    trace._image = trace._image || new Image();
                    image = trace._image;
                    image.onload = function() {
                        context.drawImage(image, 0, 0);
                        resolve();
                    };
                    image.src = trace.source;
                }
            } else {
                resolve();
            }
        })
        .then(function() {
            var canvas, href;
            if(!fastImage) {
                if(!trace._isZEmpty) {
                    canvas = drawMagnifiedPixelOnCanvas(function(i, j) {return z[j][i];}, trace.colormodel);
                } else if(!trace._isSourceEmpty) {
                    var context = trace._canvas.getContext('2d');
                    var data = context.getImageData(0, 0, w, h).data;
                    canvas = drawMagnifiedPixelOnCanvas(function(i, j) {
                        var index = 4 * (j * w + i);
                        return [
                            data[index + 0],
                            data[index + 1],
                            data[index + 2],
                            data[index + 3]
                        ];
                    }, 'rgba');
                }
                href = canvas.toDataURL('image/png');
            } else {
                href = trace.source;
            }
            image3.attr({'xlink:href': href});
        });
    });
};
