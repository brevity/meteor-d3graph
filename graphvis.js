//[of]:Renderer
//[c]Renderer

//[of]:Classes fed to renderer
//[c]Classes fed to renderer

NodeCircle = function (id, data, x, y, radius, color, borderColor, opacity, hoverText) {
    this.id = id;
    this.data = data;
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.borderColor = borderColor;
    this.opacity = opacity;
    this.hoverText = hoverText;
};

LinkLine = function (id, data, sourceNodeCircle, targetNodeCircle, thickness, color, opacity, markerStart, markerEnd, dashPattern, hoverText) {
    this.id = id;
    this.data = data;
    this.sourceNodeCircle = sourceNodeCircle;
    this.targetNodeCircle = targetNodeCircle;
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

ClusterHull = function (id, data, nodes, color, borderColor, opacity, hoverText) {
    this.id = id;
    this.data = data;
    this.nodes = nodes;
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
    
    function p_(propertyName) { return function (d) { return d[propertyName]; }; }
    
    // transitionDuration should only be used by tests/debugging
    this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, transitionDuration) {
        transitionDuration = transitionDuration === undefined ? 250 : transitionDuration;
        
        //[of]:        Links
        //[c]Links
        
        var link = layers.links.selectAll("path.link")
            .data(linkLines, function (d) { return d.id; });
        
        link.enter()
            .append("svg:path")
            .attr("class", "link")
            .attr("data-id", function (d) { return d.id; })
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6);
            
        link.exit().transition().duration(transitionDuration)
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .remove();
        
        link.transition().duration(transitionDuration)
            .style("stroke-opacity", function (d) { return d.opacity; })
            .style("stroke-width", function (d) { return d.thickness; })
            .style("stroke", function (d) { return d.color; });
            
        //[cf]
        //[of]:        Nodes
        //[c]Nodes
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        node.enter()
            .append("svg:circle")
                .attr("class", "node")
                .attr("data-id", function (d) { return d.id; })
                .attr("cx", function (d) { return d.x; })
                .attr("cy", function (d) { return d.y; })
                .attr("r", 1e-6)
                .style("opacity", 1e-6)
                .style("stroke-width", 2)
            .append("svg:title");
        
        node.exit().transition().duration(transitionDuration)
            .attr("r", 1e-6)
            .style("opacity", 1e-6)
            .remove();
        
        node.transition().duration(transitionDuration)
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; })
            .attr("r", function (d) { return d.radius; })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        node.select("title")
            .text(function (d) { return d.hoverText; });    
        //[cf]
    };

    this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, rescale) {
        //[of]:        Nodes
        //[c]Nodes
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        node
            .attr("cx", function (d) { return d.x; })
            .attr("cy", function (d) { return d.y; });
        
        if (rescale)
            node.attr("r", function (d) { return d.radius; });
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

VisCluster = function (id, data, nodeIds, isCollapsed) {
    this.id = id;
    this.data = data;
    this.nodeIds = nodeIds;
    this.isCollapsed = isCollapsed;
};


//[cf]

GraphVis = function (renderer, options) {
    var defaultOptions = {
    };
    
    var xScale = d3.scale.linear()
        .domain([0, renderer.width()])
        .range([0, renderer.width()]);

    var yScale = d3.scale.linear()
        .domain([0, renderer.height()])
        .range([0, renderer.height()]);
    
    var visNodes, visLinks, visClusters;
    var clusterHullMap = {};
    var  linkLineMap = {};
    var nodeCircleMap = {};
    var labelTextMap = {};
    
    function initialize() {
        function zoom() { renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, true); }
        d3.select(renderer.containerElement()[0]).call(d3.behavior.zoom().x(xScale).y(yScale).scaleExtent([1, 8]).on("zoom", zoom));
    }

    this.update = function (newVisNodes, newVisLinks, newVisClusters) {
        var newNodeCircleMap = {};
        var newLinkLineMap = {};
        var newLabelTextMap = {};
        var newClusterHullMap = {};
        
        _.each(newVisNodes, function (visNode) {
            var x, y;
            if (nodeCircleMap.hasOwnProperty(visNode.id)) {
                x = nodeCircleMap[visNode.id].x;
                y = nodeCircleMap[visNode.id].y;
            } else {
                x = renderer.width() / 2;
                y = renderer.height() / 2;
            }
            
            var radius = 10;
            var color = "#f00";
            var borderColor = "#800";
            var opacity = 1;
            var hoverText = "";
            
            console.log("Creating new node..");
            newNodeCircleMap[visNode.id] = new NodeCircle(visNode.id, visNode.data, x, y, radius, color, borderColor, opacity, hoverText);
        });

        visNodes = newVisNodes;
        visLinks = newVisLinks;
        visClusters = newVisClusters;
        
        nodeCircleMap = newNodeCircleMap;
        linkLineMap = newLinkLineMap;
        labelTextMap = newLabelTextMap;
        clusterHullMap = newClusterHullMap;

        renderer.update(_.values(clusterHullMap), _.values(linkLineMap), _.values(nodeCircleMap), _.values(labelTextMap));
    };

    initialize();
};


//[cf]
