/**
* Copyright 2012-2020, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/

'use strict';

module.exports = function handlePeriodDefaults(traceIn, traceOut, layout, coerce) {
    var xperiodalignment = coerce('xperiodalignment');
    if(xperiodalignment !== 'start') {
        var xperiod = coerce('xperiod');
        if(xperiod) coerce('xperiod0');
    }

    var yperiodalignment = coerce('yperiodalignment');
    if(yperiodalignment !== 'start') {
        var yperiod = coerce('yperiod');
        if(yperiod) coerce('yperiod0');
    }
};
