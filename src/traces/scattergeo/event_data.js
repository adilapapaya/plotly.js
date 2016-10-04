/**
* Copyright 2012-2016, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var Lib = require('../../lib');


module.exports = function eventData(out, pt) {
    Lib.extendFlat(out, {
        lon: pt.lon,
        lat: pt.lat,
        location: pt.lon ? pt.lon : null
    });

    return out;
};
