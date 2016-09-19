/**
* Copyright 2012-2016, Plotly, Inc.
* All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.
*/


'use strict';

var d3 = require('d3');
var Lib = require('../../lib');
var Plots = require('../plots');

var Axes = require('./axes');
var constants = require('./constants');

exports.name = 'cartesian';

exports.attr = ['xaxis', 'yaxis'];

exports.idRoot = ['x', 'y'];

exports.idRegex = constants.idRegex;

exports.attrRegex = constants.attrRegex;

exports.attributes = require('./attributes');

exports.transitionAxes = require('./transition_axes');

exports.plot = function(gd, traces, transitionOpts, makeOnCompleteCallback) {
    var cdSubplot, cd, trace, i, j, k, l;

    var fullLayout = gd._fullLayout,
        subplots = Plots.getSubplotIds(fullLayout, 'cartesian'),
        calcdata = gd.calcdata,
        modules = fullLayout._modules;

    if(!Array.isArray(traces)) {
      // If traces is not provided, then it's a complete replot and missing
      // traces are removed
        traces = [];
        for(i = 0; i < calcdata.length; i++) {
            traces.push(i);
        }
    }

    for(i = 0; i < subplots.length; i++) {
        var subplot = subplots[i],
            subplotInfo = fullLayout._plots[subplot];

        // Get all calcdata for this subplot:
        cdSubplot = [];

        // Find which trace layer are needed for this subplot
        var traceLayerData = [];

        var pcd;

        for(j = 0; j < calcdata.length; j++) {
            cd = calcdata[j];
            trace = cd[0].trace;

            // Skip trace if whitelist provided and it's not whitelisted:
            // if (Array.isArray(traces) && traces.indexOf(i) === -1) continue;
            if(trace.xaxis + trace.yaxis === subplot) {
                // If this trace is specifically requested, add it to the list:
                if(traces.indexOf(trace.index) !== -1) {
                    // Okay, so example: traces 0, 1, and 2 have fill = tonext. You animate
                    // traces 0 and 2. Trace 1 also needs to be updated, otherwise its fill
                    // is outdated. So this retroactively adds the previous trace if the
                    // traces are interdependent.
                    if(pcd &&
                            ['tonextx', 'tonexty', 'tonext'].indexOf(trace.fill) !== -1 &&
                            cdSubplot.indexOf(pcd) === -1) {
                        cdSubplot.push(pcd);
                    }

                    cdSubplot.push(cd);
                }

                // Track the previous trace on this subplot for the retroactive-add step
                // above:
                pcd = cd;

                if(trace.visible === true) {
                    for(l = 0; l < trace._module.layers.length; l++) {
                        Lib.pushUnique(traceLayerData, trace._module.layers[l]);
                    }
                }
            }
        }

        traceLayerData.sort(function(a, b) {
            return constants.LAYER_ORDER.indexOf(a) > constants.LAYER_ORDER.indexOf(b);
        });

        var traceLayers = subplotInfo.plot.selectAll('.tracelayer')
            .data(traceLayerData, Lib.identity);

        traceLayers.enter().append('g')
            .classed('tracelayer', true);

        traceLayers.order();

        traceLayers.exit().remove();

        traceLayers.each(function(layerName) {
            d3.select(this).classed(layerName, true);
        });

        // Plot all traces for each module at once:
        for(j = 0; j < modules.length; j++) {
            var _module = modules[j];

            // skip over non-cartesian trace modules
            if(_module.basePlotModule.name !== 'cartesian') continue;

            // plot all traces of this type on this subplot at once
            var cdModule = [];
            for(k = 0; k < cdSubplot.length; k++) {
                cd = cdSubplot[k];
                trace = cd[0].trace;

                if((trace._module === _module) && (trace.visible === true)) {
                    cdModule.push(cd);
                }
            }

            _module.plot(gd, subplotInfo, cdModule, transitionOpts, makeOnCompleteCallback);
        }
    }
};

exports.clean = function(newFullData, newFullLayout, oldFullData, oldFullLayout) {
    var hadCartesian = (oldFullLayout._has && oldFullLayout._has('cartesian')),
        hasCartesian = (newFullLayout._has && newFullLayout._has('cartesian'));

    if(hadCartesian && !hasCartesian) {
        var subplotLayers = oldFullLayout._cartesianlayer.selectAll('.subplot');

        subplotLayers.call(purgeSubplotLayers, oldFullLayout);
        oldFullLayout._defs.selectAll('.axesclip').remove();
    }
};

exports.drawFramework = function(gd) {
    var fullLayout = gd._fullLayout,
        subplotData = makeSubplotData(gd);

    var subplotLayers = fullLayout._cartesianlayer.selectAll('.subplot')
        .data(subplotData, Lib.identity);

    subplotLayers.enter().append('g')
        .classed('subplot', true);

    subplotLayers.order();

    subplotLayers.exit()
        .call(purgeSubplotLayers, fullLayout);

    subplotLayers.each(function(subplot) {
        var plotgroup = d3.select(this),
            plotinfo = fullLayout._plots[subplot];

        // references to any subplots overlaid on this one,
        // filled in makeSubplotLayer
        plotinfo.overlays = [];

        plotgroup.call(makeSubplotLayer, fullLayout, subplot);

        // make separate drag layers for each subplot,
        // but append them to paper rather than the plot groups,
        // so they end up on top of the rest
        plotinfo.draglayer = joinLayer(fullLayout._draggers, 'g', subplot);
    });
};

function makeSubplotData(gd) {
    var fullLayout = gd._fullLayout,
        subplots = Axes.getSubplots(gd);

    var subplotData = [],
        overlays = [];

    for(var i = 0; i < subplots.length; i++) {
        var subplot = subplots[i],
            plotinfo = fullLayout._plots[subplot];

        var xa = plotinfo.xaxis,
            ya = plotinfo.yaxis;

        // is this subplot overlaid on another?
        // ax.overlaying is the id of another axis of the same
        // dimension that this one overlays to be an overlaid subplot,
        // the main plot must exist make sure we're not trying to
        // overlay on an axis that's already overlaying another
        var xa2 = Axes.getFromId(gd, xa.overlaying) || xa;
        if(xa2 !== xa && xa2.overlaying) {
            xa2 = xa;
            xa.overlaying = false;
        }

        var ya2 = Axes.getFromId(gd, ya.overlaying) || ya;
        if(ya2 !== ya && ya2.overlaying) {
            ya2 = ya;
            ya.overlaying = false;
        }

        var mainplot = xa2._id + ya2._id;
        if(mainplot !== subplot && subplots.indexOf(mainplot) !== -1) {
            plotinfo.mainplot = mainplot;
            overlays.push(subplot);

            // for now force overlays to overlay completely... so they
            // can drag together correctly and share backgrounds.
            // Later perhaps we make separate axis domain and
            // tick/line domain or something, so they can still share
            // the (possibly larger) dragger and background but don't
            // have to both be drawn over that whole domain
            xa.domain = xa2.domain.slice();
            ya.domain = ya2.domain.slice();
        }
        else {
            subplotData.push(subplot);
        }
    }

    // main subplots before overlays
    subplotData = subplotData.concat(overlays);

    return subplotData;
}

function makeSubplotLayer(plotgroup, fullLayout, subplot) {
    var plotinfo = fullLayout._plots[subplot];

    // keep reference to plotgroup in _plots object
    plotinfo.plotgroup = plotgroup;

    // add class corresponding to the subplot id
    plotgroup.classed(subplot, true);

    if(!plotinfo.mainplot) {
        plotinfo.bg = joinLayer(plotgroup, 'rect', 'bg');
        plotinfo.bg.style('stroke-width', 0);

        var backLayer = joinLayer(plotgroup, 'g', 'layer-subplot');
        plotinfo.shapelayer = joinLayer(backLayer, 'g', 'shapelayer');
        plotinfo.imagelayer = joinLayer(backLayer, 'g', 'imagelayer');

        plotinfo.gridlayer = joinLayer(plotgroup, 'g', 'gridlayer');
        plotinfo.overgrid = joinLayer(plotgroup, 'g', 'overgrid');

        plotinfo.zerolinelayer = joinLayer(plotgroup, 'g', 'zerolinelayer');
        plotinfo.overzero = joinLayer(plotgroup, 'g', 'overzero');

        plotinfo.plot = joinLayer(plotgroup, 'g', 'plot');
        plotinfo.overplot = joinLayer(plotgroup, 'g', 'overplot');

        plotinfo.xlines = joinLayer(plotgroup, 'path', 'xlines');
        plotinfo.ylines = joinLayer(plotgroup, 'path', 'ylines');
        plotinfo.overlines = joinLayer(plotgroup, 'g', 'overlines');

        plotinfo.xaxislayer = joinLayer(plotgroup, 'g', 'xaxislayer');
        plotinfo.yaxislayer = joinLayer(plotgroup, 'g', 'yaxislayer');
        plotinfo.overaxes = joinLayer(plotgroup, 'g', 'overaxes');
    }
    else {

        // now make the components of overlaid subplots
        // overlays don't have backgrounds, and append all
        // their other components to the corresponding
        // extra groups of their main plots.

        var mainplot = fullLayout._plots[plotinfo.mainplot];
        mainplot.overlays.push(plotinfo);

        plotinfo.gridlayer = joinLayer(mainplot.overgrid, 'g', subplot);
        plotinfo.zerolinelayer = joinLayer(mainplot.overzero, 'g', subplot);

        plotinfo.plot = joinLayer(mainplot.overplot, 'g', subplot);

        plotinfo.xlines = joinLayer(mainplot.overlines, 'path', subplot);
        plotinfo.ylines = joinLayer(mainplot.overlines, 'path', subplot);

        plotinfo.xaxislayer = joinLayer(mainplot.overaxes, 'g', subplot);
        plotinfo.yaxislayer = joinLayer(mainplot.overaxes, 'g', subplot);
    }

    // common attributes for all subplots, overlays or not

    plotinfo.xlines
        .style('fill', 'none')
        .classed('crisp', true);

    plotinfo.ylines
        .style('fill', 'none')
        .classed('crisp', true);
}

function purgeSubplotLayers(layers, fullLayout) {
    if(!layers) return;

    layers.each(function(subplot) {
        var plotgroup = d3.select(this),
            clipId = 'clip' + fullLayout._uid + subplot + 'plot';

        plotgroup.remove();
        fullLayout._draggers.selectAll('g.' + subplot).remove();
        fullLayout._defs.select('#' + clipId).remove();

        // do not remove individual axis <clipPath>s here
        // as other subplots may need them
    });
}

function joinLayer(parent, nodeType, className) {
    var layer = parent.selectAll('.' + className)
        .data([0], Lib.identity);

    layer.enter().append(nodeType)
        .classed(className, true);

    return layer;
}
