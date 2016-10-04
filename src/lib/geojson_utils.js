/**
* Copyright 2012-2016, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

/**
 * Convert calcTrace to GeoJSON 'MultiLineString' coordinate arrays
 *
 * @param {calcTrace}
 *
 */
exports.calcTraceToLineCoords = function(calcTrace) {
    var trace = calcTrace[0].trace,
        connectgaps = trace.connectgaps;

    var coords = [],
        lineString = [];

    // TODO handle case where all calcPt have undefined lonlat

    for(var i = 0; i < calcTrace.length; i++) {
        var calcPt = calcTrace[i];

        lineString.push(calcPt.lonlat);

        if(!connectgaps && calcPt.gapAfter && lineString.length > 0) {
            coords.push(lineString);
            lineString = [];
        }
    }

    coords.push(lineString);

    return coords;
};


/**
 * Make line ('LineString' or 'MultiLineString') GeoJSON
 *
 * @param {coords}
 * @param {trace}
 *
 */
exports.makeLine = function(coords, trace) {
    var out = {};

    if(coords.length === 1) {
        out = {
            type: 'LineString',
            coordinates: coords[0]
        };
    }
    else {
        out = {
            type: 'MultiLineString',
            coordinates: coords
        };
    }

    if(trace) out.trace = trace;

    return out;
};

/**
 * Make polygon ('Polygon' or 'MultiPolygon') GeoJSON
 *
 * @param {coords}
 * @param {trace}
 *
 * @return {object}
 *
 */
exports.makePolygon = function(coords, trace) {
    var out = {};

    if(coords.length === 1) {
        out = {
            type: 'Polygon',
            coordinates: coords
        };
    }
    else {
        var _coords = new Array(coords.length);

        for(var i = 0; i < coords.length; i++) {
            _coords[i] = [coords[i]];
        }

        out = {
            type: 'MultiPolygon',
            coordinates: _coords
        };
    }

    if(trace) out.trace = trace;

    return out;
};

/**
 * Make blank GeoJSON
 *
 * @return {object}
 *
 */
exports.makeBlank = function() {
    return {
        type: 'Point',
        coordinates: []
    };
};
