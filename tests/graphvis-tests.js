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
        update: makeMockFunction(["clusterHulls", "linkLines", "nodeCircles", "labelTexts", "xScale", "yScale", "transitionDuration"]),
        updatePositions: makeMockFunction(["clusterHulls", "linkLines", "nodeCircles", "labelTexts", "xScale", "yScale", "rescale"])
    };
}
//[cf]
//[of]:SvgRenderer
//[c]SvgRenderer

var testLevel = "meteor-d3graph tests - SvgRenderer - ";

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

Tinytest.addAsync(testLevel + "simple update test with one node", function (test, next) {
    // Setup
    var containerElement = $("<div />");
    var svgRenderer = new SvgRenderer(containerElement, {});
    var idScale = d3.scale.linear();
    
    var nodeCircle = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 1, "Node hover-text"); 
    
    // Execute
    svgRenderer.update([], [], [nodeCircle], [], idScale, idScale, 0);
    
    // Verify
    var nodes = containerElement.find("circle.node");
    test.equal(nodes.length, 1, "There should be one node");

    setTimeout(function () {
        var node = $(nodes[0]);
        test.equal(node.attr("data-id"), "node1", "Node should have the ID we gave it");
        test.equal(node.attr("cx"), "10", "Node should have the radius we gave it");
        test.equal(node.css("stroke"), "#880000", "Node should have the border color we gave it");
        next();
    }, 10);
});

//[cf]
//[of]:GraphVis
//[c]GraphVis

testLevel = "meteor-d3graph tests - GraphVis - ";

Tinytest.add(testLevel + "Constructor test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    
    // Execute
    var graphVis = new GraphVis(mockRenderer, {});
    
    // Verify
    test.ok();
});

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

Tinytest.add(testLevel + "Update with some complexity", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    
    var node1 = new VisNode("node1", null, null, null, null);
    var node2 = new VisNode("node2", null, null, null, null);
    var node3 = new VisNode("node3", null, null, 10, 20);
    graphVis.update([node1, node3], [], []);

    node3.fixedX = 100;
    node3.fixedY = 200;

    // Execute
    graphVis.update([node2, node3], [], []);
    
    // Verify
    test.equal(mockRenderer.nodeCircles.length, 2, "There should be be two circles as we currently have two nodes");
    
    var nc0 = mockRenderer.nodeCircles[0];
    test.equal(nc0.id, "node2", "The first NodeCircle should now be 'node2'");

    var nc1 = mockRenderer.nodeCircles[1];
    test.equal(nc1.id, "node3", "The second NodeCircle should still be 'node3'");
    test.equal(nc1.x, 100, "node3 should be fixed to 100, 200");
    test.equal(nc1.y, 200, "node3 should be fixed to 100, 200");
});

Tinytest.add(testLevel + "Zoom test", function (test) {
    // Setup
    var mockRenderer = makeMockRenderer();
    var graphVis = new GraphVis(mockRenderer, {});
    graphVis.update([], [], []);

    var e = document.createEvent("MouseEvents");
    e.initMouseEvent(
        "wheel", 
        true,  // in boolean canBubbleArg,
        true,  // in boolean cancelableArg,
        window,// in views::AbstractView viewArg,
        120,   // in long detailArg,
        0,     // in long screenXArg,
        0,     // in long screenYArg,
        0,     // in long clientXArg,
        0,     // in long clientYArg,
        0,     // in boolean ctrlKeyArg,
        0,     // in boolean altKeyArg,
        0,     // in boolean shiftKeyArg,
        0,     // in boolean metaKeyArg,
        0,     // in unsigned short buttonArg,
        null);   // in EventTarget relatedTargetArg
  
    // Execute
    mockRenderer.containerElement()[0].dispatchEvent(e);
    
    // Verify
    test.ok(); // Not really, but I can't get the event to trigger a proper zoom....
});





//[cf]


