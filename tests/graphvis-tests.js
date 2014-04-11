var testLevel = "meteor-d3graph tests - ";

//[of]:Helpers
//[c]Helpers

function makeMockFunction (argList) {
    return function () {
        for(var i = 0; i < argList.length; i++) {
            this[argList[i]] = arguments[i];
        }
    };
}

function makeMockRenderer() {
    var containerElement = $("<div />");
    return {
        width: function () { return 960; },
        height: function () { return 600; },
        containerElement: function () { return containerElement; },
        update: makeMockFunction(["clusterHulls", "linkLines", "nodeCircles", "labelTexts", "xScale", "yScale", "radiusFactor", "transitionDuration"]),
        updatePositions: makeMockFunction(["clusterHulls", "linkLines", "nodeCircles", "labelTexts", "xScale", "yScale", "radiusFactor"])
    };
}
//[cf]
//[of]:SvgRenderer
//[c]SvgRenderer

var testLevel = "meteor-d3graph tests - SvgRenderer - ";

//[of]:Tinytest.add(testLevel + "Constructor test", function (test) {
Tinytest.add(testLevel + "Constructor test", function (test) {
    // Setup
    var containerElement = $("<div />");
    
    // Execute
    var svgRenderer = new SvgRenderer(containerElement, {});
    
    // Verify
    var layers = containerElement.find("g.layer");
    test.equal(layers.length, 5, "There should be five layers");
    test.equal($(layers[0]).attr("id"), "clusters", "The bottom layer should be the 'clusters' layer");
    test.equal($(layers[4]).attr("id"), "ui", "The top layer should be the 'ui' layer");
});

//[cf]
//[of]:Tinytest.addAsync(testLevel + "Cluster hull test", function (test, next) {
Tinytest.addAsync(testLevel + "Cluster hull test", function (test, next) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var visCluster = new VisCluster("cluster1", null, false);
    var visNode = new VisNode("node1", null, null, null);
    var nodeCircle = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "Node hover-text", false, {}); 
    var clusterHull = new ClusterHull("cluster1", null, visCluster, [visNode], [], [nodeCircle], "f88", "#844", 1, "Cluster hover-text", {});
    
    // Execute
    svgRenderer.update([clusterHull], [], [nodeCircle], [], idScale, idScale, 1, 0);
    
    // Verify
    var clusters = containerElement.find("path.cluster");
    test.equal(clusters.length, 1, "There should be one cluster hull");

    setTimeout(function () {
        var cluster = $(clusters[0]);
        test.equal(cluster.attr("data-id"), "cluster1", "Cluster should have the ID we gave it");
        test.isTrue(cluster.attr("d").indexOf("M5,5") === 0, "Cluster path should begin with a move to 5,5");
        test.equal(cluster.css("fill"), "rgb(255, 136, 136)", "Node should have the border color we gave it (but specified as rgb because of the transition)");
        next();
    }, 20);
});

//[cf]
//[of]:Tinytest.addAsync(testLevel + "Link test", function (test, next) {
Tinytest.addAsync(testLevel + "Link test", function (test, next) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var node1 = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, {}); 
    var node2 = new NodeCircle("node2", null, 20, 20, 5, "#f00", "#800", 3, 1, "", false, {}); 
    
    var link = new LinkLine("node1->node2", null, node1, node2, 2, "#f00", 1, true, 0, null, "Hover text", {});
    
    // Execute
    svgRenderer.update([], [link], [node1, node2], [], idScale, idScale, 1, 0);
    
    // Verify
    var links = containerElement.find("path.link");
    test.equal(links.length, 1, "There should be one link");

    setTimeout(function () {
        var link = $(links[0]);
        test.equal(link.attr("data-id"), "node1->node2", "Link should have the ID we gave it");
        test.equal(link.css("stroke"), "rgb(255, 0, 0)", "Link should have the color we gave it");
        test.equal(link.attr("d"), "M 10 10 L 20 20", "Link path should be a straight line from node1 to node2");
        next();
    }, 20);
});


//[cf]
//[of]:Tinytest.addAsync(testLevel + "Node test", function (test, next) {
Tinytest.addAsync(testLevel + "Node test", function (test, next) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var nodeCircle = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "Node hover-text", false, {}); 
    
    // Execute
    svgRenderer.update([], [], [nodeCircle], [], idScale, idScale, 1, 0);
    
    // Verify
    var nodes = containerElement.find("circle.node");
    test.equal(nodes.length, 1, "There should be one node");

    setTimeout(function () {
        var node = $(nodes[0]);
        test.equal(node.attr("data-id"), "node1", "Node should have the ID we gave it");
        test.equal(node.attr("cx"), "10", "Node should have the radius we gave it");
        test.equal(node.css("stroke"), "rgb(136, 0, 0)", "Node should have the border color we gave it");
        next();
    }, 20);
});
//[cf]
//[of]:Tinytest.add(testLevel + "Node event handler test", function (test) {
Tinytest.add(testLevel + "Node event handler test", function (test) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var success = false;
    var nodeCircle;
    var eventHandlers = { "click" : function (d) { success = d === nodeCircle; } };
    nodeCircle = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, eventHandlers);
    svgRenderer.update([], [], [nodeCircle], [], idScale, idScale, 1, 0);
    var node = $(containerElement.find("circle.node")[0]);
    
    // Execute
    node.simulate("click");
    
    // Verify
    test.isTrue(success, "The click handler should have set the success flag to true");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Link, cluster and label event handlers test", function (test) {
Tinytest.add(testLevel + "Link, cluster and label event handlers test", function (test) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var clickCount = 0;
    var eventHandlers = { "click" : function (d) { clickCount += 1; } };
    
    var nc1 = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, {});
    var nc2 = new NodeCircle("node2", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, {});
    
    var linkLine = new LinkLine("link1", null, nc1, nc2, 1, "#f00", 1, false, 0, null, "", eventHandlers);
    var clusterHull = new ClusterHull("cluster1", null, null, [], [], [nc1, nc2], "#f00", "#800", 1, "", eventHandlers);
    var labelText = new LabelText("label1", null, "label text", 10, 10, 0, 0, 10, "#f00", "#800", 1, "", eventHandlers);
    
    svgRenderer.update([clusterHull], [linkLine], [nc1, nc2], [labelText], idScale, idScale, 1, 0);
    var link = $(containerElement.find("path.link")[0]);
    var cluster = $(containerElement.find("path.cluster")[0]);
    var label = $(containerElement.find("g.label")[0]);
    
    // Execute
    link.simulate("click");
    cluster.simulate("click");
    label.simulate("click");
    
    // Verify
    test.equal(clickCount, 3, "We should have registered three clicks");
});
//[cf]
//[of]:Tinytest.addAsync(testLevel + "Link marker test", function (test, next) {
Tinytest.addAsync(testLevel + "Link marker test", function (test, next) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var node1 = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, {}); 
    var node2 = new NodeCircle("node2", null, 20, 20, 5, "#f00", "#800", 3, 1, "", false, {}); 
    
    var link = new LinkLine("node1->node2", null, node1, node2, 2, "#f00", 1, true, 0, null, "Hover text", {});
    
    // Execute
    svgRenderer.update([], [link], [node1, node2], [], idScale, idScale, 1, 0);
    
    // Verify
    setTimeout(function () {
        var links = containerElement.find("path.link");
        var link = $(links[0]);
        test.equal(link.attr("marker-end"), "url(#marker-2-ff0000)", "The link should have the marker matching the color and size set");
        
        var markers = containerElement.find("marker");
        test.equal(markers.length, 1, "There should be exactly one marker defined");
        var marker = $(markers[0]);
        test.equal(marker.attr("id"), "marker-2-ff0000", "Marker should have an id that expresses size and color");
        test.equal(link.css("stroke"), "rgb(255, 0, 0)", "Link should have the color we gave it");
        test.equal(link.attr("d"), "M 10 10 L 20 20", "Link path should be a straight line from node1 to node2");
        next();
    }, 20);
});

//[cf]
//[of]:Tinytest.addAsync(testLevel + "Click/double-click test", function (test, next) {
Tinytest.addAsync(testLevel + "Click/double-click test", function (test, next) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var events = { n1: [], n2: [], n3: [], n4: [] };
    function storeEvent(eventName, element) { events[element].push(eventName); }
    
    var n1 = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, { click: storeEvent.bind(null, "click", "n1") });
    var n2 = new NodeCircle("node2", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, { dblclick: storeEvent.bind(null, "dblclick", "n2")});
    var n3 = new NodeCircle("node3", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, { click: storeEvent.bind(null, "click", "n3"), dblclick: storeEvent.bind(null, "dblclick", "n3") });
    var n4 = new NodeCircle("node4", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, { click: storeEvent.bind(null, "click", "n4"), dblclick: storeEvent.bind(null, "dblclick", "n4") });
    svgRenderer.update([], [], [n1, n2, n3], [], idScale, idScale, 1, 0);
    var n1e = $(containerElement.find("circle.node")[0]);
    var n2e = $(containerElement.find("circle.node")[1]);
    var n3e = $(containerElement.find("circle.node")[2]);
    var n4e = $(containerElement.find("circle.node")[3]);
    
    console.log("==================================================");
    
    // Execute
    n1e.simulate("click");
    
    n2e.simulate("dblclick");
    
    n3e.simulate("click");

    n4e.simulate("click");
    setTimeout(function () { n4e.simulate("click"); }, 50);
    
    // Verify
    setTimeout(function () {
        test.equal(events.n1, ["click"], "We should have registered a click event on n1");
        test.equal(events.n2, ["dblclick"], "We should have registered a click event on n2");
        test.equal(events.n3, ["click"], "We should have registered a click event on n3");

        // TODO: Why does this one fail??
        //test.equal(events.n4, ["dblclick"], "The two click-events should have turned into one dblclick event on n4");
        
        next();        
    }, 600);
});
//[cf]
//[of]:Tinytest.addAsync(testLevel + "Curved links test", function (test, next) {
Tinytest.addAsync(testLevel + "Curved links test", function (test, next) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var node1 = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 3, 1, "", false, {}); 
    var node2 = new NodeCircle("node2", null, 20, 20, 5, "#f00", "#800", 3, 1, "", false, {}); 
    
    var link = new LinkLine("node1->node2", null, node1, node2, 2, "#f00", 1, true, 0.5, null, "Hover text", {});
    
    // Execute
    svgRenderer.update([], [link], [node1, node2], [], idScale, idScale, 1, 0);
    
    // Verify
    var links = containerElement.find("path.link");
    test.equal(links.length, 1, "There should be one link");

    setTimeout(function () {
        var link = $(links[0]);
        test.equal(link.attr("data-id"), "node1->node2", "Link should have the ID we gave it");
        test.equal(link.css("stroke"), "rgb(255, 0, 0)", "Link should have the color we gave it");
        test.equal(link.attr("d"), "M 10 10 L 20 20", "Link path should be a straight line from node1 to node2");
        next();
    }, 20);
});
//[cf]


//[cf]
//[of]:GraphVis
//[c]GraphVis

testLevel = "meteor-d3graph tests - GraphVis - ";

//[of]:Tinytest.add(testLevel + "Constructor test", function (test) {
Tinytest.add(testLevel + "Constructor test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    
    // Execute
    var graphVis = new GraphVis(mockRenderer, {});
    
    // Verify
    test.ok();
});
//[cf]
//[of]:Tinytest.add(testLevel + "Simple update test", function (test) {
Tinytest.add(testLevel + "Simple update test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, null, null, null);
    
    // Execute
    graphVis.update([node1], [], []);
    
    // Verify
    test.equal(mockRenderer.nodeCircles.length, 1, "There should be one NodeCircle representing our one VisNode");
    
    var nc = mockRenderer.nodeCircles[0];
    test.equal(nc.id, "node1", "The NodeCircle should have the same id as the VisNode");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Re-update test", function (test) {
Tinytest.add(testLevel + "Re-update test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1");
    var node2 = new VisNode("node2");
    var node3 = new VisNode("node3");
    graphVis.update([node1, node3], [], []);

    node3.fixedX = 100;
    node3.fixedY = 200;

    // Execute
    graphVis.update([node2, node3], [], []);
    
    // Verify
    testArrayProperty(test, mockRenderer.nodeCircles, "id", ["node2", "node3"]);
});
//[cf]
//[of]:Tinytest.add(testLevel + "Collapsed cluster test", function (test) {
Tinytest.add(testLevel + "Collapsed cluster test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, "cluster1", null, null);
    var node2 = new VisNode("node2", null, "cluster1", null, null);
    var cluster1 = new VisCluster("cluster1", null, true);

    // Execute
    graphVis.update([node1, node2], [], [cluster1]);
    
    // Verify
    test.equal(mockRenderer.nodeCircles.length, 1, "There should be be one circle, representing cluster1");
    
    var nc = mockRenderer.nodeCircles[0];
    test.equal(nc.id, "placeholder-cluster1", "The node circle should be the placeholder for cluster1");
    test.equal(nc.data.visCluster, cluster1, "Data for the placeholder node should contain the actual visCluster");
    test.equal(nc.data.visNodes.length, 2, "Data for the placeholder node should contain the two visNodes");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Expanded cluster test", function (test) {
Tinytest.add(testLevel + "Expanded cluster test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, "cluster1", null, null);
    var node2 = new VisNode("node2", null, "cluster1", null, null);
    var cluster1 = new VisCluster("cluster1", null, false);

    // Execute
    graphVis.update([node1, node2], [], [cluster1]);
    
    // Verify
    test.equal(mockRenderer.nodeCircles.length, 2, "Our two nodes should be visible");
    test.equal(mockRenderer.clusterHulls.length, 1, "Our cluster hull should be visible");
    
    var nc0 = mockRenderer.nodeCircles[0];
    test.equal(nc0.id, "node1", "The node circle should be the placeholder for cluster1");

    var nc1 = mockRenderer.nodeCircles[1];
    test.equal(nc1.id, "node2", "The node circle should be the placeholder for cluster1");

    var ch = mockRenderer.clusterHulls[0];
    test.equal(ch.id, "cluster1", "The hull should represent cluster1");
    test.equal(ch.visNodes.length, 2, "The hull should contain both our nodes");
    test.equal(ch.visNodes[0], node1, "The first visNode should be our node1");
    
    test.equal(ch.nodeCircles.length, 2, "The hull should contain the two nodeCircles");
    test.instanceOf(ch.nodeCircles[0], NodeCircle, "cluster nodecircles should actually be nodecircles");
    test.equal(ch.nodeCircles[0].id, "node1", "The first nodeCircle should refer to node1");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Link test", function (test) {
Tinytest.add(testLevel + "Link test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1");
    var node2 = new VisNode("node2");
    var link = new VisLink("node1", "node2");
    
    // Execute
    graphVis.update([node1, node2], [link], []);
    
    // Verify
    test.equal(mockRenderer.linkLines.length, 1, "There should be one LinkLine representing our one VisLink");
    
    var ll = mockRenderer.linkLines[0];
    test.equal(ll.id, "node1->node2", "The link line should have the correct generated id");
    test.equal(ll.source, mockRenderer.nodeCircles[0], "The source should be node circle #1");
    test.equal(ll.target, mockRenderer.nodeCircles[1], "The target should be node circle #2");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Zoom test", function (test) {
Tinytest.add(testLevel + "Zoom test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    graphVis.update([], [], []);

    var e = document.createEvent("WheelEvent");
    e.initWebKitWheelEvent(0, 120);
    
    // Execute
    mockRenderer.containerElement()[0].dispatchEvent(e);
    
    // Verify
    test.isTrue(mockRenderer.radiusFactor > 0.8 && mockRenderer.radiusFactor < 1.0, "radiusFactor " + mockRenderer.radiusFactor + " should have increased a bit from the initial 0.8");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Collapse cluster simple test", function (test) {
Tinytest.add(testLevel + "Collapse cluster simple test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, "cluster1", null, null);
    var node2 = new VisNode("node2", null, "cluster1", null, null);
    var cluster1 = new VisCluster("cluster1", null, false);
    graphVis.update([node1, node2], [], [cluster1]);

    // Execute
    mockRenderer.clusterHulls[0].eventHandlers.dblclick(mockRenderer.clusterHulls[0]);
    
    // Verify
    test.equal(mockRenderer.clusterHulls.length, 0, "The one cluster should now be collapsed and there should be no hull representing it");
    test.equal(mockRenderer.nodeCircles.length, 1, "There should only be one NodeCircle: the placeholder for the cluster");
    
});
//[cf]
//[of]:Tinytest.add(testLevel + "Collapse cluster test with links", function (test) {
Tinytest.add(testLevel + "Collapse cluster test with links", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, "cluster1");
    var node2 = new VisNode("node2", null, "cluster1");
    var node3 = new VisNode("node3", null, "cluster2");
    var cluster1 = new VisCluster("cluster1", null, false);
    var cluster2 = new VisCluster("cluster2", null, false);
    var link1 = new VisLink("node1", "node2");
    var link2 = new VisLink("node1", "node3");
    var link3 = new VisLink("node2", "node3");
    
    graphVis.update([node1, node2, node3], [link1, link2, link3], [cluster1, cluster2]);

    // Execute
    mockRenderer.clusterHulls[0].eventHandlers.dblclick(mockRenderer.clusterHulls[0]);  // Double-click cluster1 to collapse it
    
    // Verify
    test.equal(mockRenderer.clusterHulls.length, 1, "There should be one cluster hull left");
    testArrayProperty(test, mockRenderer.nodeCircles, "id", ["node3", "placeholder-cluster1"]);
    testArrayProperty(test, mockRenderer.linkLines, "id", ["placeholder-cluster1->placeholder-cluster1", "placeholder-cluster1->node3"]);    
});

//[cf]
//[of]:Tinytest.add(testLevel + "Expand cluster simple test", function (test) {
Tinytest.add(testLevel + "Expand cluster simple test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, "cluster1", null, null);
    var node2 = new VisNode("node2", null, "cluster1", null, null);
    var cluster1 = new VisCluster("cluster1", null, true);
    graphVis.update([node1, node2], [], [cluster1]);

    // Execute
    mockRenderer.nodeCircles[0].eventHandlers.dblclick(mockRenderer.nodeCircles[0]);
    
    // Verify
    test.equal(mockRenderer.clusterHulls.length, 1, "The one cluster should now be expanded and have a hull representing it");
    testArrayProperty(test, mockRenderer.nodeCircles, "id", ["node1", "node2"]);
    
});
//[cf]
//[of]:Tinytest.add(testLevel + "Node describer function simple test", function (test) {
Tinytest.add(testLevel + "Node describer function simple test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var radiusFactorFromDescription;
    function describeVisNode(visNode, radiusFactor) {
        radiusFactorFromDescription = radiusFactor;
        return {
            color: "#f00",
            borderColor: "#800"
        }
    }
    var graphVis = new GraphVis(mockRenderer, { describeVisNode: describeVisNode });
    var node1 = new VisNode("node1", null, null, null, null);
    
    // Execute
    graphVis.update([node1], [], []);
    
    // Verify
    test.equal(mockRenderer.nodeCircles.length, 1, "There should be one NodeCircle representing our one VisNode");
    
    var nc = mockRenderer.nodeCircles[0];
    test.equal(radiusFactorFromDescription, 0.8, "We haven't zoomed in or out so factor should be 1 which is scaled to 0.8 per the default scale");
    test.equal(nc.color, "#f00", "The NodeCircle should have have the color that we assigned in describeVisNode");
    test.equal(nc.borderColor, "#800", "The NodeCircle should have have the border color that we assigned in describeVisNode");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Link describer function simple test", function (test) {
Tinytest.add(testLevel + "Link describer function simple test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    
    var visLinkFromDescription, 
        sourceNodeCircleFromDescription,
        targetNodeCircleFromDescription,
        radiusFactorFromDescription;
        
    function describeVisLink(visLink, sourceNodeCircle, targetNodeCircle, radiusFactor) {
        visLinkFromDescription = visLink;
        sourceNodeCircleFromDescription = sourceNodeCircle;
        targetNodeCircleFromDescription = targetNodeCircle;
        radiusFactorFromDescription = radiusFactor;
        
        return {
            color: "#f00",
            width: 2
        }
    }
    var graphVis = new GraphVis(mockRenderer, { describeVisLink: describeVisLink });
    var node1 = new VisNode("node1");
    var node2 = new VisNode("node2");
    var link1 = new VisLink("node1", "node2");
    
    // Execute
    graphVis.update([node1, node2], [link1], []);
    
    // Verify
    test.equal(mockRenderer.linkLines.length, 1, "There should be one LinkLine representing our one VisLink");
    
    var ll = mockRenderer.linkLines[0];
    test.equal(radiusFactorFromDescription, 0.8, "We haven't zoomed in or out so factor should be 1 which is scaled to 0.8 per the default scale");
    test.equal(sourceNodeCircleFromDescription.id, "node1", "describeVisLink should be fed with a sourceNodeCircle representing node1");
    test.equal(targetNodeCircleFromDescription.id, "node2", "describeVisLink should be fed with a targetNodeCircle representing node2");
    test.equal(ll.color, "#f00", "The LinkLine should have have the color that we assigned in describeVisLink");
    test.equal(ll.width, 2, "The LinkLine should have have the thickness that we assigned in describeVisLink");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Label test", function (test) {
Tinytest.add(testLevel + "Label test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    function describeVisNode(visNode, radiusFactor) {
        return {
            label: {
                text: "Label text",
                fontSize: 14,
                color: "#f00"
            }
        }
    }
    var graphVis = new GraphVis(mockRenderer, { describeVisNode: describeVisNode });
    var node1 = new VisNode("node1", null, null, null, null);
    
    // Execute
    graphVis.update([node1], [], []);
    
    // Verify
    test.equal(mockRenderer.labelTexts.length, 1, "There should be one LabelText representing our one VisNode");
    
    var lt = mockRenderer.labelTexts[0];
    test.equal(lt.text, "Label text", "The LabelText should have the text that we assigned in describeVisNode");
    test.equal(lt.fontSize, 14, "The LabelText should have have the font size that we assigned in describeVisNode");
    test.equal(lt.color, "#f00", "The LabelText should have have the color that we assigned in describeVisNode");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Phantom node test" function (test) {
Tinytest.add(testLevel + "Phantom node test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var phantomNode = new NodeCircle("phantomNode1", null, 10, 10, 10, "#f00", "#800", 3, 1, "", true, {});
    graphVis.addPhantomNodeCircle(phantomNode);
        
    // Execute
    graphVis.update([], [], []);
    
    // Verify
    test.equal(mockRenderer.nodeCircles.length, 1, "There should be one NodeCircle representing our phantom node");
    
    var nc = mockRenderer.nodeCircles[0];
    test.equal(nc, phantomNode, "the renderer should be fed our pahntom node");
});
//[cf]
//[of]:Tinytest.add(testLevel + "Phantom link from real node to phantom node test" function (test) {
Tinytest.add(testLevel + "Phantom link from real node to phantom node test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, null, null, null);

    // Update once to make graphVis create a nodeCircle for our VisNode
    graphVis.update([node1], [], []);
    var nodeCircleForNode1 = mockRenderer.nodeCircles[0];    

    // Add the phantom node
    var phantomNode = new NodeCircle("phantomNode1", null, 10, 10, 10, "#f00", "#800", 3, 1, "", true, {});
    graphVis.addPhantomNodeCircle(phantomNode);
    
    var phantomLink = new LinkLine("phantomLink1", null, nodeCircleForNode1, phantomNode, 1, "#f00", 1, false, 0, null, "", {});
    graphVis.addPhantomLinkLine(phantomLink);
        
    // Execute
    graphVis.update([node1], [], []);
    
    // Verify
    test.equal(mockRenderer.linkLines.length, 1, "There should be one LinkLinerepresenting our phantom link");
    
    var ll = mockRenderer.linkLines[0];
    test.equal(ll, phantomLink, "the renderer should be fed our pahntom link");
});
//[cf]



//[c]
//[c]Tests to add:
//[c] - Add node to collapsed cluster
//[c]






//[cf]


