var testLevel = "meteor-d3graph tests - ";

//[of]:Helpers
//[c]Helpers

function makeMockFunction (argList) {
    return function () {
        console.log("Called: ", arguments);
        for(var i = 0; i < argList.length; i++) {
            this[argList[i]] = arguments[i];
        }
    };
}

function makeMockRenderer() {
    return {
        width: function () { return 960; },
        height: function () { return 600; },
        containerElement: function () { return $("<div />"); },
        update: makeMockFunction(["clusterHulls", "linkLines", "nodeCircles", "labelTexts", "transitionDuration"]),
        updatePositions: makeMockFunction(["clusterHulls", "linkLines", "nodeCircles", "labelTexts", "rescale"])
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
    
    var nodeCircle = new NodeCircle("node1", null, 10, 10, 5, "#f00", "#800", 1, "Node hover-text"); 
    
    // Execute
    svgRenderer.update([], [], [nodeCircle], [], 0);
    
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
//[cf]


