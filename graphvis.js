//[of]:Renderer
//[c]Renderer

//[of]:Classes fed to renderer
//[c]Classes fed to renderer

NodeCircle = function (id, data, x, y, radius, color, borderColor, opacity, hoverText, fixed) {
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
};

LinkLine = function (id, data, source, target, thickness, color, opacity, markerStart, markerEnd, dashPattern, hoverText) {
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
};

LabelText = function (id, data, text, x, y, fontSize, color, borderColor, opacity, hoverText) {
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
};

ClusterHull = function (id, data, visNodes, nodeCircles, color, borderColor, opacity, hoverText) {
    this.id = id;
    this.data = data;
    this.visNodes = visNodes;
    this.nodeCircles = nodeCircles;
    this.color = color;
    this.borderColor = borderColor;
    this.opacity = opacity;
    this.hoverText = hoverText;
};

//[cf]

SvgRenderer = function (containerElement, options) {
    var layerIds = ["clusters", "links", "nodes", "labels", "ui"];  // First one becomes the bottom layer
    
    var svg, defs;
    var layers = {};
    
    var width = containerElement.width();
    var height = containerElement.height();

    var clusterCurve = d3.svg.line()
        .interpolate("cardinal-closed")
        .tension(.85);

    function makeHull(d, xScale, yScale) {
        var nodes = d.nodeCircles;
        var nodePoints = [];

        _(nodes).each(function (n) {
            var offset = n.radius || 5;
            var x = n.x || 0;
            var y = n.y || 0;
            nodePoints.push([xScale(x - offset), yScale(y - offset)]);
            nodePoints.push([xScale(x - offset), yScale(y + offset)]);
            nodePoints.push([xScale(x + offset), yScale(y - offset)]);
            nodePoints.push([xScale(x + offset), yScale(y + offset)]);
        });

        return clusterCurve(d3.geom.hull(nodePoints));
    }

    this.containerElement = function () { return containerElement; };
    this.width = function () { return width; };
    this.height = function () { return height; };

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
    
    // transitionDuration should only be used by tests/debugging
    this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, transitionDuration) {
        transitionDuration = transitionDuration === undefined ? 250 : transitionDuration;
        
        //[of]:        Clusters
        //[c]Clusters
        
        var cluster = layers.clusters.selectAll("path.cluster")
            .data(clusterHulls, function (d) { return d.id; });
        
        cluster.enter()
            .append("svg:path")
                .attr("class", "cluster")
                .attr("data-id", function (d) { return d.id; })
                .attr("d", function (d) { return makeHull(d, xScale, yScale); })
                .style("fill", function (d) { return d.color; })
                .style("stroke", function (d) { return d.borderColor; })
                .style("opacity", 1e-6)
            .append("svg:title");
        
        cluster.exit().transition().duration(transitionDuration)
            .style("opacity", 1e-6)
            .remove();
        
        cluster.transition().duration(transitionDuration)
            .attr("d", function (d) { return makeHull(d, xScale, yScale); })
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
        
        link.enter()
            .append("svg:path")
                .attr("class", "link")
                .attr("data-id", function (d) { return d.id; })
                .style("stroke-opacity", 1e-6)
                .style("stroke-width", 1e-6)
            .append("svg:title");
        
        link.exit().transition().duration(transitionDuration)
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .remove();
        
        link.transition().duration(transitionDuration)
            .style("stroke-opacity", function (d) { return d.opacity; })
            .style("stroke-width", function (d) { return d.thickness; })
            .style("stroke", function (d) { return d.color; });
            
        link.select("title")
            .text(function (d) { return d.hoverText; });    
        
        //[cf]
        //[of]:        Nodes
        //[c]Nodes
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        node.enter()
            .append("svg:circle")
                .attr("class", "node")
                .attr("data-id", function (d) { return d.id; })
                .attr("cx", function (d) { return xScale(d.x); })
                .attr("cy", function (d) { return yScale(d.y); })
                .attr("r", 1e-6)
                .style("opacity", 1e-6)
                .style("stroke-width", 2)
            .append("svg:title");
        
        node.exit().transition().duration(transitionDuration)
            .attr("r", 1e-6)
            .style("opacity", 1e-6)
            .remove();
        
        node.transition().duration(transitionDuration)
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
            .attr("r", function (d) { return d.radius; })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        node.select("title")
            .text(function (d) { return d.hoverText; });    
        //[cf]
    };

    this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, rescale) {
        //[of]:        Nodes
        //[c]Nodes
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        node
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); });
        
        if (rescale)
            node.attr("r", function (d) { return d.radius; });
        //[cf]
        //[of]:        Clusters
        //[c]Clusters
        
        var cluster = layers.clusters.selectAll("path.cluster")
            .data(clusterHulls, function (d) { return d.id; });
        
        cluster
            .attr("d", function (d) { return makeHull(d, xScale, yScale); })
        
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

VisLink = function (id, data, sourceNodeId, targetNodeId) {
    this.id = id;
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
    var xScale = d3.scale.linear()
        .domain([0, renderer.width()])
        .range([0, renderer.width()]);

    var yScale = d3.scale.linear()
        .domain([0, renderer.height()])
        .range([0, renderer.height()]);
    
    var clusterHulls = [];
    var linkLines = [];
    var nodeCircles = [];
    var labelTexts = [];
    
    var force;
    
    //[of]:    function initialize() {
    function initialize() {
        function zoom() { 
            renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, true); 
        }
        
        d3.select(renderer.containerElement()[0]).call(d3.behavior.zoom().x(xScale).y(yScale).scaleExtent([0.25, 4]).on("zoom", zoom));
    }
    //[cf]
    //[of]:    function clusterHullFromVisCluster(visCluster) {
    function clusterHullFromVisCluster(visCluster) {
        var color = "#f00";
        var borderColor = "#800";
        var opacity = 0.2;
        var hoverText = "";
    
        return new ClusterHull(visCluster.id, visCluster, [], [], color, borderColor, opacity, hoverText);
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
        var color = "#f00";
        var borderColor = "#800";
        var opacity = 1;
        var hoverText = "";
        
        return new NodeCircle(visNode.id, visNode.data, x, y, radius, color, borderColor, opacity, hoverText, fixed);
    }
    //[cf]
    //[of]:    function nodeCircleFromCollapsedCluster(visCluster, clusterVisNodes) {
    function nodeCircleFromCollapsedCluster(visCluster, clusterVisNodes) {
        var radius = 20;
        var color = "#0f0";
        var borderColor = "#080";
        var opacity = 1;
        var hoverText = "";
    
        var w = renderer.width();
        var h = renderer.height();
        var x = (w / 2 + (Math.random() * (w / 2) - w / 4));
        var y = (h / 2 + (Math.random() * (h / 2) - h / 4));
        
        var data = {
            visCluster: visCluster,
            visNodes: clusterVisNodes
        };
        
        return new NodeCircle("placeholder-" + visCluster.id, data, x, y, radius, color, borderColor, opacity, hoverText, false);
    }
    //[cf]

    //[of]:    this.update = function (newVisNodes, newVisLinks, newVisClusters) {
    this.update = function (visNodes, visLinks, visClusters) {
        var newClusterHulls = [];   // We'll only create hulls for expanded clusters
        var collapsedClusters = {}  // Collapsed ones go in here to turn into placeholder NodeCircles
        _.each(visClusters, function (vc) {
            if (!vc.isCollapsed)
                newClusterHulls.push(clusterHullFromVisCluster(vc));
            else
                collapsedClusters[vc.id] = [];
        });
        
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
                    
                    collapsedClusters[visNode.clusterId].push(visNode);
                }
            } else {
                newNodeCircles.push(nodeCircleFromVisNode(visNode));
            }
        });
        
        _.each(collapsedClusters, function (clusterVisNodes, clusterId) {
            var visCluster = _.find(visClusters, function (vc) { return vc.id === clusterId; });
            newNodeCircles.push(nodeCircleFromCollapsedCluster(visCluster, clusterVisNodes));
        });
        
        var newLinkLines = [];
        var newLabelTexts = [];
        
        nodeCircles = newNodeCircles;
        linkLines = newLinkLines;
        labelTexts = newLabelTexts;
        clusterHulls = newClusterHulls;
    
        renderer.update(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale);
    };
    //[cf]

    //[of]:    this.startForce = function () {
    this.startForce = function () {
        force = d3.layout.force()
            .nodes(nodeCircles)
            .links(linkLines)
            .size([renderer.width(), renderer.height()])
            .on("tick", function (e) {
                renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, false);
            })
            .start();
    };
    //[cf]

    initialize();
};


//[cf]
