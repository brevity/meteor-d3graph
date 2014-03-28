//[of]:Renderer
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
};

LinkLine = function (id, data, source, target, thickness, color, opacity, markerStart, markerEnd, dashPattern, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.source = source;   // These should be NodeCircle instances
    this.target = target;       // - " -
    this.thickness = thickness;
    this.color = color;
    this.opacity = opacity;
    this.markerStart = markerStart;
    this.markerEnd = markerEnd;
    this.dashPattern = dashPattern;
    this.hoverText = hoverText;
    this.eventHandlers = eventHandlers;
};

LabelText = function (id, data, text, x, y, fontSize, color, borderColor, opacity, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.text = text;
    this.x = x;
    this.y = y;
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
    
    var width = containerElement.width();
    var height = containerElement.height();

    //[of]:    function makeHull(d, xScale, yScale) {
    function makeHull(d, xScale, yScale, radiusFactor) {
        var nodes = d.nodeCircles;
        var nodePoints = [];
    
        _(nodes).each(function (n) {
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

    this.containerElement = function () { return containerElement; };
    this.width = function () { return width; };
    this.height = function () { return height; };

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
    
    function allEventNames(elementArray) {
        // We want to know all the different types of events that exist in any of the elements. This cryptic oneliner does that:
        return _.uniq(_.flatten(_.map(_.pluck(elementArray, "eventHandlers"), function (eh) { return _.keys(eh); })));
    }
    
    // transitionDuration should only be used by tests/debugging
    this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration) {
        transitionDuration = transitionDuration === undefined ? 250 : transitionDuration;
        
        //[of]:        Clusters
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
        
        var allClusterEvents = allEventNames(clusterHulls);
        
        _.each(allClusterEvents, function (ce) {
            clusterEnter.on(ce, function (d) { 
                if (d.eventHandlers.hasOwnProperty(ce)) {
                    d.eventHandlers[ce](d); 
                    d3.event.stopPropagation();
                }
            });
        });
        
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
        //[of]:        Links
        //[c]Links
        
        var link = layers.links.selectAll("path.link")
            .data(linkLines, function (d) { return d.id; });
        
        var linkEnter = link.enter().append("svg:path");
        linkEnter.attr("class", "link")
            .attr("data-id", function (d) { return d.id; })
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .append("svg:title");
        
        var allLinkEvents = allEventNames(linkLines);
        
        _.each(allLinkEvents, function (le) {
            linkEnter.on(le, function (d) { 
                if (d.eventHandlers.hasOwnProperty(le)) {
                    d.eventHandlers[le](d); 
                    d3.event.stopPropagation();
                }
            });
        });
        
        link.exit().transition().duration(transitionDuration)
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .remove();
        
        link.transition().duration(transitionDuration)
            .style("stroke-opacity", function (d) { return d.opacity; })
            .style("stroke-width", function (d) { return d.thickness * radiusFactor; })
            .style("stroke", function (d) { return d.color; });
        
        link
            .attr("d", function (d) { return makeLinkPath(d, xScale, yScale); });
            
        link.select("title")
            .text(function (d) { return d.hoverText; });    
        
        //[cf]
        //[of]:        Nodes
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
        
        var allNodeEvents = allEventNames(nodeCircles);
        
        _.each(allNodeEvents, function (ne) {
            nodeEnter.on(ne, function (d) { 
                if (d.eventHandlers.hasOwnProperty(ne)) {
                    d.eventHandlers[ne](d);
                    d3.event.stopPropagation();
                }
            });
        });
        
        node.exit().transition().duration(transitionDuration)
            .attr("r", 1e-6)
            .style("opacity", 1e-6)
            .remove();
        
        node.transition().duration(transitionDuration)
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
            .attr("r", function (d) { return d.radius * radiusFactor; })
            .style("stroke-width", function (d) { return 2 * radiusFactor; })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        node.select("title")
            .text(function (d) { return d.hoverText; });    
        //[cf]
        //[of]:        Labels
        //[c]Labels
        
        var label = layers.labels.selectAll("g.label")
            .data(labelTexts, function (d) { return d.id; });
        
        var labelEnter = label.enter().append("svg:g");
        labelEnter
            .attr("class", "label")
            .attr("data-id", function (d) { return d.id; })
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; })
            .style("opacity", 1e-6)
            .append("svg:text");
        
        var allLabelEvents = allEventNames(labelTexts);
        
        _.each(allLabelEvents, function (le) {
            labelEnter.on(le, function (d) { 
                if (d.eventHandlers.hasOwnProperty(le)) {
                    d.eventHandlers[le](d); 
                    d3.event.stopPropagation();
                }
            });
        });
        
        label.exit().transition().duration(transitionDuration)
            .style("opacity", 1e-6)
            .remove();
        
        label.transition().duration(transitionDuration)
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; });
        
        label.select("text")
            .text(function (d) { return d.text; })
            .transition().duration(transitionDuration)
            .style("stroke-width", function (d) { return 2 * radiusFactor; })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        //[cf]
    };

    this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor) {
        //[of]:        Clusters
        //[c]Clusters
        
        var cluster = layers.clusters.selectAll("path.cluster")
            .data(clusterHulls, function (d) { return d.id; });
        
        cluster
            .attr("d", function (d) { return makeHull(d, xScale, yScale, radiusFactor); });
        
        //[cf]
        //[of]:        Links
        //[c]Links
        
        var link = layers.links.selectAll("path.link")
            .data(linkLines, function (d) { return d.id; });
        
        link
            .attr("d", function (d) { return makeLinkPath(d, xScale, yScale); })
            .style("stroke-width", function (d) { return d.thickness * radiusFactor; });
        
        //[cf]
        //[of]:        Nodes
        //[c]Nodes
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        node
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
            .attr("r", function (d) { return d.radius * radiusFactor; })
            .style("stroke-width", function (d) { return 2 * radiusFactor; });
        
        //[cf]
    };
    
    initialize();
};
//[cf]
//[of]:GraphVis
//[c]GraphVis

//[of]:Classes fed to GraphVis
//[c]Classes fed to GraphVis

VisNode = function (id, data, clusterId, fixedX, fixedY) {
    this.id = id;
    this.data = data;
    this.clusterId = clusterId;
    this.fixedX = fixedX;
    this.fixedY = fixedY;
};

VisLink = function (data, sourceNodeId, targetNodeId) {
    this.data = data;
    this.sourceNodeId = sourceNodeId;
    this.targetNodeId = targetNodeId;
};

VisCluster = function (id, data, isCollapsed) {
    this.id = id;
    this.data = data;
    this.isCollapsed = isCollapsed;
};


//[cf]

GraphVis = function (renderer, options) {
    var self = this;

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
            renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor);

            if (force) force.resume();
        });

    var visNodes, visLinks, visClusters;
    var clusterHulls = [];
    var linkLines = [];
    var nodeCircles = [];
    var labelTexts = [];
    
    var force;

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

    //[of]:    function clusterHullFromVisCluster(visCluster) {
    function clusterHullFromVisCluster(visCluster) {
        var color = "#f88";
        var borderColor = d3.rgb(color).darker(1);
        var opacity = 0.2;
        var hoverText = "";
    
        var eventHandlers = {
            "dblclick": function (d) { 
                visCluster.isCollapsed = true;
                self.update();
                return;
                
    /*            // Remove the cluster hull
                clusterHulls = _.without(clusterHulls, d);
    
                // Remove nodes in the cluster
                var removedNodeCircles = _.filter(nodeCircles, function (nc) { return nc.data.clusterId === d.id; });
                nodeCircles = _.filter(nodeCircles, function (nc) { return nc.data.clusterId !== d.id; });
    
                // And insert a placeholder instead.
                var xSum = _.reduce(removedNodeCircles, function (sum, nc) { return sum + nc.x; }, 0);
                var ySum = _.reduce(removedNodeCircles, function (sum, nc) { return sum + nc.y; }, 0);
                
                var placeholderNode = nodeCircleFromCollapsedCluster(d.visCluster, d.visNodes);
                placeholderNode.x = xSum / removedNodeCircles.length;
                placeholderNode.y = ySum / removedNodeCircles.length;
                nodeCircles.push(placeholderNode);
                
                // Remove links to and from cluster
                var removedLinks = _.filter(linkLines, function (ll) { return ll.source.data.clusterId === d.id || ll.target.data.clusterId === d.id; });
                linkLines = _.filter(linkLines, function (ll) { return ll.source.data.clusterId !== d.id && ll.target.data.clusterId !== d.id; });
    
                // Reestablish links to and from this cluster
                var inboundLinks = {};  // maps using node-id as key
                var outboundLinks = {};
                
                _.each(removedLinks, function (linkLine) {
                    if (linkLine.source.data.clusterId === linkLine.target.data.clusterId)    // Link within cluster. Skip it.
                        return;
                    
                    if (linkLine.source.data.clusterId === d.id) {
                        // This link points out from this cluster
                        if (!outboundLinks.hasOwnProperty(linkLine.target.id))
                            outboundLinks[linkLine.target.id] = [];
    
                        outboundLinks[linkLine.target.id].push(linkLine);                    
                    } else {
                        // This link points into this cluster
                        if (!inboundLinks.hasOwnProperty(linkLine.source.id))
                            inboundLinks[linkLine.source.id] = [];
    
                        inboundLinks[linkLine.source.id].push(linkLine);                    
                    }
                });
                
                _.each(inboundLinks, function (linkLineCollection) {
                    var placeholderLink = linkLineForCluster(linkLineCollection, placeholderNode, true);
                    linkLines.push(placeholderLink);
                });
    
                _.each(outboundLinks, function (linkLineCollection) {
                    var placeholderLink = linkLineForCluster(linkLineCollection, placeholderNode, false);
                    linkLines.push(placeholderLink);
                });
    
                renderer.update(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor); */
            }
        };
    
        return new ClusterHull(visCluster.id, visCluster, visCluster, [], [], [], color, borderColor, opacity, hoverText, eventHandlers);
    }
    
    //[cf]
    //[of]:    function nodeCircleFromVisNode(visNode) {
    function nodeCircleFromVisNode(visNode) {
        var x, y, fixed;
    
        if (_.isNumber(visNode.fixedX)) {
            x = visNode.fixedX;
            y = visNode.fixedY;     // We assume that if there was a fixed X, there will also be a Y.
            fixed = true;
        } else {
            var oldNodeCircle = _.find(nodeCircles, function (nodeCircle) { return nodeCircle.id === visNode.id; });
            var w = renderer.width();
            var h = renderer.height();
            x = oldNodeCircle ? oldNodeCircle.x : (w / 2 + (Math.random() * (w / 2) - w / 4));
            y = oldNodeCircle ? oldNodeCircle.y : (h / 2 + (Math.random() * (h / 2) - h / 4));
            fixed = false;
        }
    
        var radius = 10;
        var color = "#888";
        var borderColor = "#333";
        var opacity = 1;
        var hoverText = "";
    
        if (options.describeVisNode) {
            var description = options.describeVisNode(visNode);
            
            if (description.color) color = description.color;
            if (description.borderColor) borderColor = description.borderColor;
        }
        
        eventHandlers = {};
        
        if (options.onNodeClick) { eventHandlers.click = options.onNodeClick; }
            
        return new NodeCircle(visNode.id, visNode, x, y, radius, color, borderColor, opacity, hoverText, fixed, eventHandlers);
    }
    //[cf]
    //[of]:    function nodeCircleFromCollapsedCluster(visCluster, clusterVisNodes) {
    function nodeCircleFromCollapsedCluster(visCluster, clusterVisNodes, clusterVisLinks) {
        var radius = 20;
        var color = "#333";
        var borderColor = "#000";
        var opacity = 1;
        var hoverText = "";
    
        var w = renderer.width();
        var h = renderer.height();
        var x = (w / 2 + (Math.random() * (w / 2) - w / 4));
        var y = (h / 2 + (Math.random() * (h / 2) - h / 4));
        
        var data = {
            visCluster: visCluster,
            visNodes: clusterVisNodes,
            visLinks: clusterVisLinks
        };
        
        var eventHandlers = {
            "dblclick": function (d) {  
                visCluster.isCollapsed = false;
                self.update();
                return;
    
    /*            // Remove the placeholder node
                nodeCircles = _.filter(nodeCircles, function (nc) { return nc.id !== d.id });
    
                console.log("d: ", d);
    
                // Remove links to and from placeholder node
                linkLines = _.filter(linkLines, function (ll) { return ll.source !== d && ll.target !== d; });
    
                renderer.update(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor); */
            }
        };
        
        return new NodeCircle("placeholder-" + visCluster.id, data, x, y, radius, color, borderColor, opacity, hoverText, false, eventHandlers);
    }
    //[cf]
    //[of]:    function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
    function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
        var thickness = 1;
        var color = "#300";
        var opacity = 1;
        var markerStart = false;
        var markerEnd = false;
        var dashPattern = null;
        var hoverText = "";
    
        var linkLine = new LinkLine(sourceNodeCircle.id + "->" + targetNodeCircle.id, 
            visLink, 
            sourceNodeCircle, 
            targetNodeCircle, 
            thickness, 
            color, 
            opacity, 
            markerStart, 
            markerEnd, 
            dashPattern, 
            hoverText,
            {});
    
        return linkLine;
    }
    //[cf]
    //[of]:    function linkLineForCluster(linkLineCollection, placeholderNode, isInbound) {
    function linkLineForCluster(linkLineCollection, placeholderNode, isInbound) {
        var thickness = 2;
        var color = "#0f0";
        var opacity = 1;
        var markerStart = false;
        var markerEnd = false;
        var dashPattern = null;
        var hoverText = "";
    
        var realNode = isInbound ? linkLineCollection[0].source : linkLineCollection[0].target;
    
        var sourceNodeCircle = isInbound ? realNode : placeholderNode;
        var targetNodeCircle = isInbound ? placeholderNode : realNode;
    
        var linkLine = new LinkLine(sourceNodeCircle.id + "->" + targetNodeCircle.id, 
            linkLineCollection, 
            sourceNodeCircle, 
            targetNodeCircle, 
            thickness, 
            color, 
            opacity, 
            markerStart, 
            markerEnd, 
            dashPattern, 
            hoverText,
            {});
    
        return linkLine;
    }
    //[cf]

    //[of]:    this.update = function (newVisNodes, newVisLinks, newVisClusters) {
    this.update = function (newVisNodes, newVisLinks, newVisClusters) {
        if (newVisNodes) visNodes = newVisNodes;
        if (newVisLinks) visLinks = newVisLinks;
        if (newVisClusters) visClusters = newVisClusters;
    
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
        _.each(visNodes, function (visNode) {
            if (visNode.clusterId) {
                var clusterHull = _.find(newClusterHulls, function (ch) { return ch.id === visNode.clusterId; });
                
                if (clusterHull) {
                    var nodeCircle = nodeCircleFromVisNode(visNode);
                    newNodeCircles.push(nodeCircle);
                    clusterHull.visNodes.push(visNode);
                    clusterHull.nodeCircles.push(nodeCircle);
                } else {
                    if (!collapsedClusters.hasOwnProperty(visNode.clusterId))
                        throw "Node '" + visNode.id + "' refers to a cluster '" + visNode.clusterId + "' that wasn't defined";
                    
                    collapsedClusters[visNode.clusterId].visNodes.push(visNode);
                }
            } else {
                newNodeCircles.push(nodeCircleFromVisNode(visNode));
            }
        });
        
        _.each(collapsedClusters, function (collapsedCluster, clusterId) {
            var visCluster = _.find(visClusters, function (vc) { return vc.id === clusterId; });
            newNodeCircles.push(nodeCircleFromCollapsedCluster(visCluster, collapsedCluster.visNodes, collapsedCluster.visLinks));
        });
        //[cf]
        //[of]:    Create link lines
        //[c]Create link lines
        
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
            
            var sourceNodeCircle, targetNodeCircle;
            if (sourceVisCluster && sourceVisCluster.isCollapsed) {
                if (targetVisCluster === sourceVisCluster)  // Link within same cluster, ignore it.
                    return; 
                
                sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + sourceVisCluster.id; });
            } else {
                sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === sourceVisNode.id; });
            }
            
            if (targetVisCluster && targetVisCluster.isCollapsed) {
                targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + targetVisCluster.id; });
            } else {
                targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === targetVisNode.id; });
            }
            
            var linkLine = linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle);
                        
            newLinkLines.push(linkLine);
        });
        
        //[cf]
    
        var newLabelTexts = [];
        
        nodeCircles = newNodeCircles;
        linkLines = newLinkLines;
        labelTexts = newLabelTexts;
        clusterHulls = newClusterHulls;
    
        renderer.update(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor);
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
        var padding = 1.5; // separation between same-color nodes
        var clusterPadding = 6; // separation between different-color nodes
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

    //[of]:    this.startForce = function () {
    this.startForce = function () {
        force = d3.layout.force()
            .nodes(nodeCircles)
            .links(linkLines)
            .size([renderer.width(), renderer.height()])
            .on("tick", function (e) {
                _(nodeCircles).each(cluster(0.6 * e.alpha));
                _(nodeCircles).each(collide(0.5));
                renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor);
            })
            .linkDistance(function(l, i) {
                var n1 = l.source, n2 = l.target;
                // larger distance for bigger groups:
                // both between single nodes and _other_ groups (where size of own node group still counts),
                // and between two group nodes.
                //
                // reduce distance for groups with very few outer links,
                // again both in expanded and grouped form, i.e. between individual nodes of a group and
                // nodes of another group or other group node or between two group nodes.
                //
                // The latter was done to keep the single-link groups ('blue', rose, ...) close.
    
    /*            return 30 + Math.min(
                    20 * Math.min(
                        (n1.size || (n1.clusterId != n2.clusterId ? n1.group_data.size : 0)),
                        (n2.size || (n1.clusterId != n2.clusterId ? n2.group_data.size : 0))),
                    -30 + 30 * Math.min(
                        (n1.link_count || (n1.clusterId != n2.clusterId ? n1.group_data.link_count : 0)),
                        (n2.link_count || (n1.clusterId != n2.clusterId ? n2.group_data.link_count : 0))),
                    100);*/
                
                return n1.clusterId === n2.clusterId ? 1 : 5;
            })
            .linkStrength(function(l, i) { return 1; })
            .gravity(0.5)   // gravity+charge tweaked to ensure good 'grouped' view (e.g. green group not smack between blue&orange, ...
            .charge(-600)    // ... charge is important to turn single-linked groups to the outside
            .friction(0.5)   // friction adjusted to get dampened display: less bouncy bouncy ball [Swedish Chef, anyone?]
            .start();
    };
    //[cf]

    initialize();
};

//[cf]
