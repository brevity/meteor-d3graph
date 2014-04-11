﻿//[of]:Renderer
//[c]Renderer

//[of]:Classes fed to renderer
//[c]Classes fed to renderer

NodeCircle = function (id, data, x, y, radius, color, borderColor, opacity, hoverText, fixed, eventHandlers) {
    this.id = id;
    this.data = data;
    this.x = x; // Note: x and y are NOT scaled to screen space because they are manipulated by d3.force
    this.y = y; // Scaling takes place in SvgRenderer.update, which is why it takes the scales as parameters.
    this.radius = radius;
    this.color = color;
    this.borderColor = borderColor;
    this.opacity = opacity;
    this.hoverText = hoverText;
    this.fixed = fixed;
    this.eventHandlers = eventHandlers;

    // These are reserved for d3.force. Initialized here so the compiler constructor will know about them.
    this.index = null;
    this.px = null;
    this.py = null;
    this.weight = null;
};

LinkLine = function (id, data, source, target, width, color, opacity, marker, dashPattern, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.source = source;   // These should be NodeCircle instances
    this.target = target;       // - " -
    this.width = width;
    this.color = color;
    this.opacity = opacity;
    this.markerEnd = marker;
    this.dashPattern = dashPattern;
    this.hoverText = hoverText;
    this.eventHandlers = eventHandlers;
};

LabelText = function (id, data, text, x, y, offsetX, offsetY, fontSize, color, borderColor, opacity, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.text = text;
    this.x = x;
    this.y = y;
    this.offsetX = offsetX;
    this.offsetY = offsetY;
    this.fontSize = fontSize;
    this.color = color;
    this.borderColor = borderColor;
    this.opacity = opacity;
    this.hoverText = hoverText;
    this.eventHandlers = eventHandlers;
};

// This guy needs to know about visNodes and visLinks so we can reconstruct NodeCircle's and LinkLine's when it's expanded
ClusterHull = function (id, data, visCluster, visNodes, visLinks, nodeCircles, color, borderColor, opacity, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.visCluster = visCluster;
    this.visNodes = visNodes;
    this.visLinks = visLinks;
    this.nodeCircles = nodeCircles;
    this.color = color;
    this.borderColor = borderColor;
    this.opacity = opacity;
    this.hoverText = hoverText;
    this.eventHandlers = eventHandlers;
};

//[cf]

SvgRenderer = function (containerElement, options) {
    var layerIds = ["clusters", "links", "nodes", "labels", "ui"];  // First one becomes the bottom layer
    
    var svg, defs;
    var layers = {};
    var previousRadiusFactor;   // Used to check if we need to update sizes
    
    var width = containerElement.width();
    var height = containerElement.height();

    this.containerElement = function () { return containerElement; };
    this.width = function () { return width; };
    this.height = function () { return height; };

    //[of]:    function makeHull(d, xScale, yScale) {
    function makeHull(d, xScale, yScale, radiusFactor) {
        var nodes = d.nodeCircles;
        var nodePoints = [];
    
        _.each(nodes, function (n) {
            var offset = (n.radius || 5) * radiusFactor;
            var x = n.x || 0;
            var y = n.y || 0;
            nodePoints.push([xScale(x) - offset, yScale(y) - offset]);
            nodePoints.push([xScale(x) - offset, yScale(y) + offset]);
            nodePoints.push([xScale(x) + offset, yScale(y) - offset]);
            nodePoints.push([xScale(x) + offset, yScale(y) + offset]);
        });
    
        var clusterCurve = d3.svg.line()
            .interpolate("cardinal-closed")
            .tension(0.85);
    
        return clusterCurve(d3.geom.hull(nodePoints));
    }
    //[cf]
    //[of]:    function makeLinkPath(d, xScale, yScale) {
    function makeLinkPath(d, xScale, yScale) {
        var sx = xScale(d.source.x);
        var sy = yScale(d.source.y);
        var tx = xScale(d.target.x);
        var ty = yScale(d.target.y);
        
        return "M " + sx + " " + sy + " L " + tx + " " + ty;
    }
    
    
    //[cf]
    //[of]:    function makeMarkerDefs(linkLines) {
    function makeMarkerDefs(linkLines) {
        var sizeColorCombos = {};
        
        _.each(linkLines, function (ll) {
            if (ll.markerStart || ll.markerEnd) {
                var size = ll.width.toFixed(0);
                var color = d3.rgb(ll.color).toString(); // This is necessary to convert "red" into "ff0000" etc.
                var sizeColorCombo = size + "-" + color.substr(1);
                sizeColorCombos[sizeColorCombo] = { id: sizeColorCombo, size: size, color: color };
            }
        });
        
        return _.map(sizeColorCombos, function (sizeColorCombo, id) { return sizeColorCombo; });
    }
    //[cf]

    //[of]:    function attachEvents(selection, renderItems) {
    function attachEvents(selection, renderItems) {
        var dragBehavior;
    
        // We want to know all the different types of events that exist in any of the elements. This cryptic oneliner does that:
        var allEvents = _.uniq(_.flatten(_.map(_.pluck(renderItems, "eventHandlers"), function (eh) { return _.keys(eh); })));
    
        _.each(allEvents, function (ce) {
            if (ce === "click" || ce === "dblclick")
                return;
                
            if (ce === "dragstart" || ce === "drag" || ce === "dragend") {
                if (!dragBehavior) {
                    dragBehavior = d3.behavior.drag()
                        .origin(function() { 
                            var t = d3.select(this);
                            return {x: t.attr("x"), y: t.attr("y")};
                        })
                }
                
                dragBehavior.on(ce, function (d, i) {
                    d.eventHandlers[ce](d, i, d3.event);
                    //d3.event.stopPropagation();
                });    
            } else {
                selection.on(ce, function (d, i) { 
                    if (d.eventHandlers.hasOwnProperty(ce)) {
                        d.eventHandlers[ce](d, i, d3.event); 
                        d3.event.stopPropagation();
                    }
                });
            }
        });
    
        if (dragBehavior)
            selection.call(dragBehavior);
        
        var doubleClickDelay = 300;
        var singleClickTimer;
        var storedEvent;
        
        // Handle click and dblclick..
        selection.on("click", function (d, i) {
            if (d.eventHandlers.hasOwnProperty("click") && d.eventHandlers.hasOwnProperty("dblclick")) {
                console.log("Both events");
                if (singleClickTimer) {
                    d.eventHandlers.dblclick(d, i, d3.event);
                    clearTimeout(singleClickTimer);
                    singleClickTimer = null;
                } else {
                    storedEvent = d3.event;
                    singleClickTimer = setTimeout(function () {
                        d.eventHandlers.click(d, i, storedEvent);
                        singleClickTimer = null;
                    }, doubleClickDelay);
                }
                d3.event.stopPropagation();
            } else if (d.eventHandlers.hasOwnProperty("click")) {
                console.log("only the click event");
                d.eventHandlers.click(d, i, d3.event);
                d3.event.stopPropagation();
            }
        });
        
        selection.on("dblclick", function (d, i) {
            if (d.eventHandlers.hasOwnProperty("dblclick") && !d.eventHandlers.hasOwnProperty("click")) {
                d.eventHandlers.dblclick(d, i, d3.event);
                d3.event.stopPropagation();
            }
        });
    }
    //[cf]
    
    //[of]:    this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration) {
    this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration) {
        transitionDuration = transitionDuration === undefined ? 250 : transitionDuration;
        
        //[of]:    Clusters
        //[c]Clusters
        
        var cluster = layers.clusters.selectAll("path.cluster")
            .data(clusterHulls, function (d) { return d.id; });
        
        var clusterEnter = cluster.enter().append("svg:path");
        clusterEnter
            .attr("class", "cluster")
            .attr("data-id", function (d) { return d.id; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; })
            .style("opacity", 1e-6)
            .append("svg:title");
        
        attachEvents(clusterEnter, clusterHulls);
        
        cluster.exit().transition().duration(transitionDuration)
            .style("opacity", 1e-6)
            .remove();
        
        cluster.transition().duration(transitionDuration)
            .attr("d", function (d) { return makeHull(d, xScale, yScale, radiusFactor); })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        cluster.select("title")
            .text(function (d) { return d.hoverText; });    
        
        
        
        //[cf]
        //[of]:    Link markers
        //[c]Link markers
        
        var markerDefs = makeMarkerDefs(linkLines);
        
        var marker = defs.selectAll("marker.generated")
            .data(markerDefs, function (d) { return d.id })
        
        marker.enter()
            .append('svg:marker')
                .attr("id", function (d) { return "marker-" + d.id; })
                .attr("class", "generated")
                .attr('preserveAspectRatio', 'xMinYMin')
                .attr('markerUnits', 'userSpaceOnUse')
                .attr("orient", "auto")
            .append("svg:path");
        
        marker
                .attr("markerWidth", function (d) { return 5 * d.size * radiusFactor; })
                .attr("markerHeight", function (d) { return 3 * d.size * radiusFactor; })
                .attr("viewBox", function (d) { return  "0 0 " + (10 * d.size * radiusFactor) + " " + (10 * d.size * radiusFactor); })
                .attr("refX", function (d) { return 10 * d.size * radiusFactor; })
                .attr("refY", function (d) { return 10 * d.size * radiusFactor; })
                .attr("fill", function (d) { return d.color; })
            .select("path")
                .attr("d", function (d) { return "M0,0L" + (10 * d.size * radiusFactor) + "," + (10 * d.size * radiusFactor) + "L0," + (10 * d.size * radiusFactor) + "z"});
        
        marker.exit()
            .remove();
        
        //[cf]
        //[of]:    Links
        //[c]Links
        
        var link = layers.links.selectAll("path.link")
            .data(linkLines, function (d) { return d.id; });
        
        var linkEnter = link.enter().append("svg:path");
        linkEnter.attr("class", "link")
            .attr("data-id", function (d) { return d.id; })
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .append("svg:title");
        
        attachEvents(linkEnter, linkLines);
        
        link.exit().transition().duration(transitionDuration)
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .remove();
        
        link.transition().duration(transitionDuration)
            .attr("d", function (d) { return makeLinkPath(d, xScale, yScale); })
            .attr("marker-start", function (d) { return d.markerStart ? ("url(#marker-" + d.width.toFixed(0) + "-" + d3.rgb(d.color).toString().substr(1) + ")") : null; })
            .attr("marker-end", function (d) { return d.markerEnd ? ("url(#marker-" + d.width.toFixed(0) + "-" + d3.rgb(d.color).toString().substr(1) + ")") : null; })
            .style("stroke-opacity", function (d) { return d.opacity; })
            .style("stroke-width", function (d) { return d.width * radiusFactor; })
            .style("stroke", function (d) { return d.color; });
            
        link.select("title")
            .text(function (d) { return d.hoverText; });    
        
        //[cf]
        //[of]:    Nodes
        //[c]Nodes
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        var nodeEnter = node.enter().append("svg:circle");
        nodeEnter
            .attr("class", "node")
            .attr("data-id", function (d) { return d.id; })
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
            .attr("r", 1e-6)
            .style("opacity", 1e-6)
            .append("svg:title");
        
        attachEvents(nodeEnter, nodeCircles);
        
        node.exit().transition().duration(transitionDuration)
            .attr("r", 1e-6)
            .style("opacity", 1e-6)
            .remove();
        
        node.transition().duration(transitionDuration)
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
            .attr("r", function (d) { return d.radius * radiusFactor; })
            .style("stroke-width", function (d) { return 3 * radiusFactor; })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        node.select("title")
            .text(function (d) { return d.hoverText; });    
        //[cf]
        //[of]:    Labels
        //[c]Labels
        
        var label = layers.labels.selectAll("g.label")
            .data(labelTexts, function (d) { return d.id; });
        
        var labelEnter = label.enter().append("svg:g");
        labelEnter
            .attr("class", "label")
            .attr("data-id", function (d) { return d.id; })
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; })
            .style("opacity", 1e-6)
            .append("svg:text")
            .attr("x", function (d) { return d.offsetX * radiusFactor; })
            .attr("y", function (d) { return d.offsetY * radiusFactor; });
        
        attachEvents(labelEnter, labelTexts);
        
        label.exit().transition().duration(transitionDuration)
            .style("opacity", 1e-6)
            .remove();
        
        label.transition().duration(transitionDuration)
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; })
            .style("opacity", function (d) { return d.opacity; })
        
        label.select("text")
            .text(function (d) { return d.text; })
            .transition().duration(transitionDuration)
            .attr("x", function (d) { return d.offsetX * radiusFactor; })
            .attr("y", function (d) { return d.offsetY * radiusFactor; })
            .style("font-size", function (d) { return d.fontSize * radiusFactor; })
        //    .style("stroke-width", function (d) { return 0.5 * radiusFactor; })
            .style("fill", function (d) { return d.color; })
        //    .style("stroke", function (d) { return d.borderColor; });
        
        //[cf]
        
        previousRadiusFactor = radiusFactor;
    };
    //[cf]
    //[of]:    this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor) {
    this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor) {
        //[of]:    Clusters
        //[c]Clusters
        
        var cluster = layers.clusters.selectAll("path.cluster")
            .data(clusterHulls, function (d) { return d.id; });
        
        cluster
            .attr("d", function (d) { return makeHull(d, xScale, yScale, radiusFactor); });
        
        //[cf]
        //[of]:    Link markers
        //[c]Link markers
        
        var markerDefs = makeMarkerDefs(linkLines);
        
        var marker = defs.selectAll("marker.generated")
            .data(markerDefs, function (d) { return d.id })
        
        marker.enter()
            .append('svg:marker')
                .attr("id", function (d) { return d.id; })
                .attr("class", "generated")
                .attr('preserveAspectRatio', 'xMinYMin')
                .attr('markerUnits', 'userSpaceOnUse')
                .attr("orient", "auto")
            .append("svg:path");
        
        marker
                .attr("markerWidth", function (d) { return 5 * d.size * radiusFactor; })
                .attr("markerHeight", function (d) { return 3 * d.size * radiusFactor; })
                .attr("viewBox", function (d) { return  "0 0 " + (10 * d.size * radiusFactor) + " " + (10 * d.size * radiusFactor); })
                .attr("refX", function (d) { return 10 * d.size * radiusFactor; })
                .attr("refY", function (d) { return 10 * d.size * radiusFactor; })
                .attr("fill", function (d) { return d.color; })
            .select("path")
                .attr("d", function (d) { return "M0,0L" + (10 * d.size * radiusFactor) + "," + (10 * d.size * radiusFactor) + "L0," + (10 * d.size * radiusFactor) + "z"});
        
        marker.exit()
            .remove();
        
        //[cf]
        //[of]:    Links
        //[c]Links
        
        var link = layers.links.selectAll("path.link")
            .data(linkLines, function (d) { return d.id; });
        
        link
            .attr("d", function (d) { return makeLinkPath(d, xScale, yScale); })
        
        if (radiusFactor !== previousRadiusFactor) {
            link
                .style("stroke-width", function (d) { return d.width * radiusFactor; });
        }
        //[cf]
        //[of]:    Nodes
        //[c]Nodes
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        node
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
        
        if (radiusFactor !== previousRadiusFactor) {
            node
                .attr("r", function (d) { return d.radius * radiusFactor; })
                .style("stroke-width", function (d) { return 3 * radiusFactor; });
        }
        //[cf]
        //[of]:    Labels
        //[c]Labels
        
        var label = layers.labels.selectAll("g.label")
            .data(labelTexts, function (d) { return d.id; });
        
        label
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; });
        
        label.select("text")
            .attr("x", function (d) { return d.offsetX * radiusFactor; })
            .attr("y", function (d) { return d.offsetY * radiusFactor; })
            .style("font-size", function (d) { return d.fontSize * radiusFactor; });
        
        //[cf]
        
        previousRadiusFactor = radiusFactor;
    };
    //[cf]
    
    //[of]:    function initialize() {
    function initialize() {
        svg = d3.select(containerElement[0]).append("svg")
            .attr("width", width)
            .attr("height", height);
        
        defs = svg.append("svg:defs");
                    
        layers = {};
        _.each(layerIds, function (layerId) {
            layers[layerId] = svg.append("svg:g")
                .attr("id", layerId)
                .attr("class", "layer");
        });
    }
    //[cf]
    initialize();
};
//[cf]
//[of]:GraphVis
//[c]GraphVis

//[of]:Classes fed to GraphVis
//[c]Classes fed to GraphVis

VisNode = function (id, data, clusterId) {
    this.id = id;
    this.data = data;
    this.clusterId = clusterId;
};

VisLink = function (sourceNodeId, targetNodeId, data) {
    this.sourceNodeId = sourceNodeId;
    this.targetNodeId = targetNodeId;
    this.data = data;
};

VisCluster = function (id, data, isCollapsed) {
    this.id = id;
    this.data = data;
    this.isCollapsed = isCollapsed;
};


//[cf]

//[of]:defaultGraphVisOptions = {
defaultNodeDescription = {
    radius: 10,
    color: "#888",
    borderColor: "#333",
    opacity: 1,
    hoverText: null,
    label: null
};

defaultLinkDescription = {
    width: 1,
    color: "#333",
    opacity: 1,
    marker: false,
    dashPattern: null,
    hoverText: null
};

// Collapsed clusters become node circles
defaultCollapsedClusterDescription = {
    radius: 20,
    color: "#a88",
    borderColor: "#633",
    opacity: 1,
    hoverText: null,
    label: null
};

// Expanded clusters become cluster hulls
defaultExpandedClusterDescription = {
    color: "#a88",
    borderColor: null,
    opacity: 0.2,
    hoverText: null
};

// This one simply returns interpolated values between the two nodes.
// If a node is hovered, links that point to it will have markers.
defaultLinkDescriber = function (visLink, sourceNodeCircle, targetNodeCircle, radiusFactor) {
    return {
        width: (sourceNodeCircle.radius + targetNodeCircle.radius) / 10,
        color: d3.interpolateRgb(sourceNodeCircle.color, targetNodeCircle.color)(0.5),
        opacity: (sourceNodeCircle.opacity + targetNodeCircle.opacity) / 2,
        marker: false
    };
};

defaultCollapsedClusterDescriber = function () {
};

defaultExpandedClusterDescriber = function () {
};

defaultGraphVisOptions = {
    // General settings
    enableZoom: true,
    enablePan: true,
    enableForce: true,
    enableCollisionDetection: true,
    enableClusterForce: false,
    zoomExtent: [0.25, 4],
    zoomDensityScale: d3.scale.linear().domain([0.25, 4]).range([0.5, 2]),
    updateOnlyPositionsOnZoom: true,        // If false, a complete update() will take place during zoom. More flexible but slower.
    updateOnlyPositionsOnTick: true,        // Likewise, for force ticks.


    // Event handling
    onClick: null,
    onNodeClick: null,
    onNodeDoubleClick: null,
    onNodeMouseOver: null,
    onNodeMouseOut: null,
    onNodeDragStart: null,
    onNodeDrag: null,
    onNodeDragEnd: null,
    onClusterNodeClick: null,
    onClusterNodeDoubleClick: null,     // If unset, will default to "expand cluster".
    onClusterNodeMouseOver: null,
    onClusterNodeMouseOut: null,
    onClusterNodeDragStart: null,
    onClusterNodeDrag: null,
    onClusterNodeDragEnd: null,
    onLinkClick: null,
    onLinkDoubleClick: null,
    onLinkMouseOver: null,
    onLinkMouseOut: null,
    onClusterClick: null,
    onClusterDoubleClick: null, // If unset, will default to "collapse cluster".
    onClusterMouseOver: null,
    onClusterMouseOut: null,
    
    
    // Visual element describing
    defaultNodeDescription: defaultNodeDescription,
    describeVisNode: null,
    defaultLinkDescription: defaultLinkDescription,
    describeVisLink: defaultLinkDescriber,
    defaultCollapsedClusterDescription: defaultCollapsedClusterDescription,
    describeCollapsedCluster: defaultCollapsedClusterDescriber,
    defaultExpandedClusterDescription: defaultExpandedClusterDescription,
    describeExpandedCluster: defaultExpandedClusterDescriber,
};
//[cf]

GraphVis = function (renderer, options) {
    var self = this;
    options = $.extend(true, {}, defaultGraphVisOptions, options);

    var xScale = d3.scale.linear()
        .domain([0, renderer.width()])
        .range([0, renderer.width()]);

    var yScale = d3.scale.linear()
        .domain([0, renderer.height()])
        .range([0, renderer.height()]);

    var zoomDensityScale = d3.scale.linear().domain([0.25, 4]).range([0.5, 2]);
    var radiusFactor = zoomDensityScale(1);

    var zoomBehavior = d3.behavior.zoom()
        .x(xScale)
        .y(yScale)
        .scaleExtent([0.25, 4])
        .on("zoom", function () { 
            radiusFactor = zoomDensityScale(zoomBehavior.scale());
            
            if (options.updateOnlyPositionsOnTick)
                renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor);
            else
                self.update(null, null, null, 0);

            if (options.enableForce && force)
                force.resume();
            
            d3.event.sourceEvent.stopPropagation();
        });

    var visNodes, visLinks, visClusters;
    
    var phantomClusterHulls = [];
    var phantomLinkLines = [];
    var phantomNodeCircles = [];
    var phantomLabelTexts = [];
    
    var clusterHulls = [];
    var linkLines = [];
    var nodeCircles = [];
    var labelTexts = [];
    
    var force;

    //[of]:    function clusterHullFromVisCluster(visCluster) {
    function clusterHullFromVisCluster(visCluster) {
        var color = "#888";
        var borderColor = d3.rgb(color).darker(1);
        var opacity = 0.2;
        var hoverText = "";
    
        if (options.describeVisCluster) {
            var description = options.describeVisCluster(visCluster, [], radiusFactor); // TODO: Give nodecircles along
    
            if (description.color) color = description.color;
            if (description.opacity) opacity = description.opacity;
            if (description.hoverText) hoverText = description.hoverText;
        }
    
        var eventHandlers = {
            "dblclick": function (d) { 
                visCluster.isCollapsed = true;
                self.update();
            }
        };
    
        return new ClusterHull(visCluster.id, visCluster, visCluster, [], [], [], color, borderColor, opacity, hoverText, eventHandlers);
    }
    
    //[cf]
    //[of]:    function labelTextFromLabelDescription(label, id, nodeCircleX, nodeCircleY, nodeCircleColor, nodeCircleBorderColor, nodeCircleOpacity) {
    function labelTextFromLabelDescription(label, id, x, y, nodeCircleColor, nodeCircleBorderColor, nodeCircleOpacity) {
        var offsetX = _.isUndefined(label.offsetX) ? 0 : label.offsetX;
        var offsetY = _.isUndefined(label.offsetY) ? 0 : label.offsetY;
        var fontSize = label.fontSize || 14;
        var color = label.color || nodeCircleColor;
        var borderColor = label.borderColor || nodeCircleBorderColor;
        var opacity = _.isUndefined(label.opacity) ? nodeCircleOpacity : description.opacity;
        var hoverText = label.hoverText;
        
        var eventHandlers = {};
    
        return new LabelText(id, null, label.text, x, y, offsetX, offsetY, fontSize, color, borderColor, opacity, hoverText, eventHandlers);
    }
    //[cf]
    //[of]:    function nodeCircleAndLabelTextFromVisNode(visNode) {
    function nodeCircleAndLabelTextFromVisNode(visNode) {
        var nodeCircle, labelText;
    
        var oldNodeCircle = _.find(nodeCircles, function (nodeCircle) { return nodeCircle.id === visNode.id; });
        if (oldNodeCircle)
            nodeCircle = oldNodeCircle;
        else
            nodeCircle = new NodeCircle(visNode.id, visNode, null, null, 10, "#888", "#333", 1, null, false, {});
    
        if (!_.isNumber(nodeCircle.x) || !_.isNumber(nodeCircle.y)) {
            var w = renderer.width();
            var h = renderer.height();
            nodeCircle.x = w / 2 + (Math.random() * (w / 2) - w / 4);
            nodeCircle.y = h / 2 + (Math.random() * (h / 2) - h / 4);
        }
    
        if (options.describeVisNode) {
            var description = options.describeVisNode(visNode, radiusFactor);
            
            if (_.isNumber(description.x)) nodeCircle.x = description.x;
            if (_.isNumber(description.y)) nodeCircle.y = description.y;
            if (!_.isUndefined(description.fixed)) nodeCircle.fixed = description.fixed;
            
            if (_.isNumber(description.radius)) nodeCircle.radius = description.radius;
            if (description.color) nodeCircle.color = description.color;
            if (description.borderColor) nodeCircle.borderColor = description.borderColor;
            if (_.isNumber(description.opacity)) nodeCircle.opacity = description.opacity;
            if (description.hoverText) nodeCircle.hoverText = description.hoverText;
            
            if (description.label) {
                labelText = labelTextFromLabelDescription(description.label, nodeCircle.id, nodeCircle.x, nodeCircle.y, nodeCircle.color, nodeCircle.borderColor, nodeCircle.opacity);
            }
        }
        
        if (options.onNodeClick) { nodeCircle.eventHandlers.click = options.onNodeClick; }
        if (options.onNodeMouseOver) { nodeCircle.eventHandlers.mouseover = options.onNodeMouseOver; }
        if (options.onNodeMouseOut) { nodeCircle.eventHandlers.mouseout = options.onNodeMouseOut; }
        if (options.onNodeDragStart) { nodeCircle.eventHandlers.dragstart = options.onNodeDragStart; }
    
        nodeCircle.eventHandlers.dblclick = function (d) { console.log("Doubleclick on ", d); };
            
        return {
            nodeCircle: nodeCircle,
            labelText: labelText
        };
    }
    //[cf]
    //[of]:    function nodeCircleAndLabelTextFromCollapsedCluster(visCluster, clusterVisNodes) {
    function nodeCircleAndLabelTextFromCollapsedCluster(visCluster, clusterVisNodes, clusterVisLinks) {
        var id = "placeholder-" + visCluster.id;
        var radius = 20;
        var color = "#333";
        var borderColor = "#000";
        var opacity = 1;
        var hoverText = "";
    
        var oldNodeCircle = _.find(nodeCircles, function (nodeCircle) { return nodeCircle.id === id; });
        var w = renderer.width();
        var h = renderer.height();
        x = oldNodeCircle ? oldNodeCircle.x : (w / 2 + (Math.random() * (w / 2) - w / 4));
        y = oldNodeCircle ? oldNodeCircle.y : (h / 2 + (Math.random() * (h / 2) - h / 4));
        
        var data = {
            visCluster: visCluster,
            visNodes: clusterVisNodes,
            visLinks: clusterVisLinks
        };
        
        var eventHandlers = {
            "dblclick": function (d) {  
                visCluster.isCollapsed = false;
                self.update();
            }
        };
        
        var nodeCircle = new NodeCircle(id, data, x, y, radius, color, borderColor, opacity, hoverText, false, eventHandlers);
        
        return {
            nodeCircle: nodeCircle,
            labelText: null
        };
    }
    //[cf]
    //[of]:    function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
    function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
        var width = 1;
        var color = "#300";
        var opacity = 1;
        var marker = false;
        var dashPattern = null;
        var hoverText = null;
    
        if (options.describeVisLink) {
            var description = options.describeVisLink(visLink, sourceNodeCircle, targetNodeCircle, radiusFactor);
    
            if (description.width) width = description.width;
            if (description.color) color = description.color;
            if (description.opacity) opacity = description.opacity;
            if (description.hoverText) hoverText = description.hoverText;
            if (description.marker) marker = description.marker;
        }
    
        var linkLine = new LinkLine(sourceNodeCircle.id + "->" + targetNodeCircle.id, 
            visLink, 
            sourceNodeCircle, 
            targetNodeCircle, 
            width, 
            color, 
            opacity, 
            marker,
            dashPattern, 
            hoverText,
            {});
    
        return linkLine;
    }
    //[cf]
    //[of]:    function linkLineFromClusterLinks(nodePairs) {
    function  linkLineFromClusterLink(sourceNodeCircle, targetNodeCircle, visLinks) {
        var width = 2;
        var color = "#0f0";
        var opacity = 1;
        var marker = false;
        var dashPattern = null;
        var hoverText = "";
    
        var linkLine = new LinkLine(sourceNodeCircle.id + "->" + targetNodeCircle.id, 
            visLinks, 
            sourceNodeCircle,
            targetNodeCircle,
            width, 
            color, 
            opacity, 
            marker,
            dashPattern, 
            hoverText,
            {});
    
        return linkLine;    
    }
    //[cf]

    //[of]:    this.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration) {
    this.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration) {
        if (newVisNodes) visNodes = newVisNodes;
        if (newVisLinks) visLinks = newVisLinks;
        if (newVisClusters) visClusters = newVisClusters;
        if (_.isUndefined(transitionDuration)) transitionDuration = 250;
    
        //[of]:    Create cluster hulls
        //[c]Create cluster hulls
        
        var newClusterHulls = [];   // We'll only create hulls for expanded clusters
        var collapsedClusters = {};  // Collapsed ones go in here to turn into placeholder NodeCircles
        _.each(visClusters, function (vc) {
            if (!vc.isCollapsed)
                newClusterHulls.push(clusterHullFromVisCluster(vc));
            else
                collapsedClusters[vc.id] = { visNodes: [], visLinks: [] };
        });
        //[cf]
        //[of]:    Create node circles and label texts
        //[c]Create node circles and label texts
        
        var newNodeCircles = [];
        var newLabelTexts = [];
        _.each(visNodes, function (visNode) {
            if (visNode.clusterId) {
                var clusterHull = _.find(newClusterHulls, function (ch) { return ch.id === visNode.clusterId; });
                
                if (clusterHull) {
                    var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                    var nodeCircle = nodeCombination.nodeCircle;
                    newNodeCircles.push(nodeCircle);
                    clusterHull.visNodes.push(visNode);
                    clusterHull.nodeCircles.push(nodeCircle);
        
                    if (nodeCombination.labelText)
                        newLabelTexts.push(nodeCombination.labelText);
                } else {
                    if (!collapsedClusters.hasOwnProperty(visNode.clusterId))
                        throw "Node '" + visNode.id + "' refers to a cluster '" + visNode.clusterId + "' that wasn't defined";
                    
                    collapsedClusters[visNode.clusterId].visNodes.push(visNode);
                }
            } else {
                var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                newNodeCircles.push(nodeCombination.nodeCircle);
                if (nodeCombination.labelText)
                    newLabelTexts.push(nodeCombination.labelText);
            }
        });
        
        _.each(collapsedClusters, function (collapsedCluster, clusterId) {
            var visCluster = _.find(visClusters, function (vc) { return vc.id === clusterId; });
            var nodeCombination = nodeCircleAndLabelTextFromCollapsedCluster(visCluster, collapsedCluster.visNodes, collapsedCluster.visLinks);
            newNodeCircles.push(nodeCombination.nodeCircle);
            if (nodeCombination.labelText)
                newLabelTexts.push(nodeCombination.labelText);
        });
        //[cf]
        //[of]:    Create link lines
        //[c]Create link lines
        
        var clusterLinks = {};
        
        var newLinkLines = [];
        _.each(visLinks, function (visLink) {
            var sourceVisNode = _.find(visNodes, function (vn) { return vn.id === visLink.sourceNodeId; });
            if (!sourceVisNode)
                throw "Link refers to a source node '" + visLink.sourceNodeId + "' that wasn't found";
        
            var targetVisNode = _.find(visNodes, function (vn) { return vn.id === visLink.targetNodeId; });
            if (!targetVisNode)
                throw "Link refers to a target node '" + visLink.targetNodeId + "' that wasn't found";
        
            var sourceVisCluster, targetVisCluster;
            if (sourceVisNode.clusterId)
                sourceVisCluster = _.find(visClusters, function (vc) { return vc.id === sourceVisNode.clusterId; });
        
            if (targetVisNode.clusterId)
                targetVisCluster = _.find(visClusters, function (vc) { return vc.id === targetVisNode.clusterId; });
        
            var isClusterLink = false;
            var sourceNodeCircle, targetNodeCircle;
        
            if (sourceVisCluster && sourceVisCluster.isCollapsed) {
                isClusterLink = true;
                sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + sourceVisCluster.id; });
            }
            else {
                sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === sourceVisNode.id; });
            }
            
            if (targetVisCluster && targetVisCluster.isCollapsed) {
                isClusterLink = true;
                targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + targetVisCluster.id; });
            } else {
                targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === targetVisNode.id; });
            }
            
            if (isClusterLink) {
                var id = sourceNodeCircle.id + "->" + targetNodeCircle.id;
                if (!clusterLinks.hasOwnProperty(id))
                    clusterLinks[id] = { source: sourceNodeCircle, target: targetNodeCircle, visLinks: [] };
                
                clusterLinks[id].visLinks.push(visLink);
            } else {
                var linkLine = linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle);
                newLinkLines.push(linkLine);
            }
        });
        
        _.each(clusterLinks, function (clusterLink) {
            var linkLine = linkLineFromClusterLink(clusterLink.source, clusterLink.target, clusterLink.visLinks);
            newLinkLines.push(linkLine);
        });
        
        //[cf]
    
        nodeCircles = newNodeCircles.concat(phantomNodeCircles);
        linkLines = newLinkLines.concat(phantomLinkLines);
        labelTexts = newLabelTexts.concat(phantomLabelTexts);
        clusterHulls = newClusterHulls.concat(phantomClusterHulls);
    
        renderer.update(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration);
    };
    //[cf]

    //[of]:    function cluster(alpha) {
    function cluster(alpha) {
        return function(d) {
            if (d.id.indexOf("placeholder") === 0) return;
            //if (!d.data.clusterId) return;
            
            var centralClusterNode = _.find(nodeCircles, function (nc) { return nc.data.clusterId === d.data.clusterId; }); // For now, just use the first one found
            if (centralClusterNode === d) return;
            var x = d.x - centralClusterNode.x,
                y = d.y - centralClusterNode.y,
                l = Math.sqrt(x * x + y * y),
                r = ((d.radius + centralClusterNode.radius) / zoomBehavior.scale()) * radiusFactor;
            if (l != r) {
                l = (l - r) / l * alpha;
                d.x -= x *= l;
                d.y -= y *= l;
                centralClusterNode.x += x;
                centralClusterNode.y += y;
            }
        };
    }
    //[cf]
    //[of]:    function collide(alpha) {
    function collide(alpha) {
        var padding = 10; // separation between same-color nodes
        var clusterPadding = 20; // separation between different-color nodes
        var maxRadius = 12;
     
        var quadtree = d3.geom.quadtree(nodeCircles);
        return function(d) {
            var r = ((d.radius + maxRadius + Math.max(padding, clusterPadding)) / zoomBehavior.scale()) * radiusFactor,
                nx1 = d.x - r,
                nx2 = d.x + r,
                ny1 = d.y - r,
                ny2 = d.y + r;
    
            quadtree.visit(function(quad, x1, y1, x2, y2) {
                if (quad.point && (quad.point !== d)) {
                    var x = d.x - quad.point.x,
                        y = d.y - quad.point.y,
                        l = Math.sqrt(x * x + y * y),
                        r = ((d.radius + quad.point.radius + (d.data.clusterId === quad.point.data.clusterId ? padding : clusterPadding)) / zoomBehavior.scale()) * radiusFactor;
    
                    if (l < r) {
                        l = (l - r) / l * alpha;
                        d.x -= x *= l;
                        d.y -= y *= l;
                        quad.point.x += x;
                        quad.point.y += y;
                    }
                }
                return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
            });
        };
    }
    //[cf]
    //[of]:    function tick(e) {
    function tick(e) {
        if (options.enableClusterForce)
            _(nodeCircles).each(cluster(0.01));
        
        if (options.enableCollisionDetection)
            _(nodeCircles).each(collide(0.5));
    
        // Move labels according to nodes.
        _(labelTexts).each(function (lt) {
            var nodeCircle = _.find(nodeCircles, function (nc) { return nc.id === lt.id; });
            lt.x = nodeCircle.x;
            lt.y = nodeCircle.y;
        });
        
        renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor);
    }
    //[cf]

    //[of]:    this.startForce = function () {
    this.startForce = function () {
        force = d3.layout.force()
            .nodes(nodeCircles)
            .links(linkLines)
            .size([renderer.width(), renderer.height()])
            .on("tick", tick)
            .linkDistance(function(l, i) {
                var n1 = l.source, n2 = l.target;
                return n1.clusterId === n2.clusterId ? 1 : 2;
            })
            .linkStrength(function(l, i) { return 1; })
            .gravity(0.5)   // gravity+charge tweaked to ensure good 'grouped' view (e.g. green group not smack between blue&orange, ...
            .charge(-600)    // ... charge is important to turn single-linked groups to the outside
            .friction(0.5)   // friction adjusted to get dampened display: less bouncy bouncy ball [Swedish Chef, anyone?]
            .start();
    };
    //[cf]
    //[of]:    this.resumeForce = function () {
    this.resumeForce = function () {
        force.resume();
    }
    //[cf]

    this.addPhantomClusterHull = function (clusterHull) { phantomClusterHulls.push(clusterHull); }
    this.addPhantomLinkLine = function (linkLine) { phantomLinkLines.push(linkLine); }
    this.addPhantomNodeCircle = function (nodeCircle) { phantomNodeCircles.push(nodeCircle); }
    this.addPhantomLabelTetx = function (labelText) { phantomLabelTexts.push(labelText); }
    //[of]:    this.clearPhantomElements() {
    this.clearPhantomElements = function () {
        phantomClusterHulls = [];
        phantomLinkLines = [];
        phantomNodeCircles = [];
        phantomLabelTexts = [];
    }
    //[cf]

    //[of]:    function initialize() {
    function initialize() {
        var container = d3.select(renderer.containerElement()[0]);
        
        container
            .call(zoomBehavior)
            .on("dblclick.zoom", null);
    
        if (options.onClick) {
            container.on("click", options.onClick);
        }
    }
    //[cf]
    initialize();
};

//[cf]
