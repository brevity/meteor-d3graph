function setupDummyNetwork(clusteringNodeProvider) {
    var nodeSettings = [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }];
    _(nodeSettings).each(function (nodeSetting) { clusteringNodeProvider.addNode(nodeSetting); });

    var linkSettings = [{ from: "1", to: "2" }, { from: "1", to: "3" }];
    _(linkSettings).each(function (linkSetting) { clusteringNodeProvider.addLink(linkSetting); });
 }

Tinytest.add('d3graph tests - ClusteringNodeProvider - test clustering (no clusters) - 1', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    
    // Execute
    setupDummyNetwork(clusteringNodeProvider);
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    testArrayProperty(test, visNodes, "id", ["1", "2", "3", "4"]);

    test.equal(visLinks.length, 2, "With no clusters, both links should be visible");

    test.equal(visLinks[0].id, "1->2", "First link should have id 1->2");
    test.equal(visLinks[0].source.id, "1", "First link should point from node 1");
    test.equal(visLinks[0].target.id, "2", "First ink should point to node 2");

    test.equal(visLinks[1].id, "1->3", "Second link should have id 1->3");
    test.equal(visLinks[1].source.id, "1", "Second link should point from node 1");
    test.equal(visLinks[1].target.id, "3", "Second link should point to node 3");
});



Tinytest.add('d3graph tests - ClusteringNodeProvider - updateClusters test - with clusters', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    setupDummyNetwork(clusteringNodeProvider);    
    
    // Execute
    clusteringNodeProvider.getNode("1").clusterId = "cluster 1";
    clusteringNodeProvider.getNode("2").clusterId = "cluster 1";
    clusteringNodeProvider.updateClusters();
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    testArrayProperty(test, visNodes, "id", ["cluster-cluster 1", "3", "4"]);
    
    test.equal(visLinks.length, 1, "With one cluster, there should be 1 link visible");
    test.equal(visLinks[0].id, "cluster-cluster 1->3", "");
    test.equal(visLinks[0].source.id, "cluster-cluster 1", "Our link should point from cluster 1");
    test.equal(visLinks[0].target.id, "3", "Our link should point to node 3");
});


Tinytest.add("d3graph tests - ClusteringNodeProvider - updateClusters test - changing clusters from one set to another", function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);

    // Create nodes with one cluster
    var nodeSettings = [{ id: "1", clusterId: "cluster 1" }, { id: "2", clusterId: "cluster 1" }, { id: "3" }, { id: "4" }];
    _(nodeSettings).each(function (nodeSetting) { clusteringNodeProvider.addNode(nodeSetting); });

    var linkSettings = [{ from: "1", to: "2" }, { from: "1", to: "3" }];
    _(linkSettings).each(function (linkSetting) { clusteringNodeProvider.addLink(linkSetting); });
    
    console.log("All links before: ", clusteringNodeProvider.getAllLinks());
    
    // Execute
    clusteringNodeProvider.getNode("1").clusterId = null;
    clusteringNodeProvider.getNode("2").clusterId = null;
    clusteringNodeProvider.getNode("3").clusterId = "cluster 2";
    clusteringNodeProvider.getNode("4").clusterId = "cluster 2";
    clusteringNodeProvider.updateClusters();

    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    testArrayProperty(test, visNodes, "id", ["1", "2", "cluster-cluster 2"], "Expected nodes 1, 2, and the placeholder for cluster 2");

    console.log("VisLinks: ", visLinks);
    test.equal(visLinks.length, 2, "With one cluster, there should be 2 links visible");
    test.equal(visLinks[0].id, "1->2", "First link should have id 1->2");
    test.equal(visLinks[0].source.id, "1", "First link should point from node 1");
    test.equal(visLinks[0].target.id, "2", "First ink should point to node 2");

    test.equal(visLinks[1].id, "1->cluster-cluster 2", "Second link should be from node 1 to cluster 2");
    test.equal(visLinks[1].source.id, "1", "Second link should point from node 1");
    test.equal(visLinks[1].target.id, "cluster-cluster 2", "Second link should point to cluster 2");
});


Tinytest.add('d3graph tests - ClusteringNodeProvider - test remove node (no clusters)', function (test) {
    // Setup
    var d3graphStub = new D3graphStub();
    var clusteringNodeProvider = new ClusteringNodeProvider(d3graphStub);
    d3graphStub._clusteringNodeProvider = clusteringNodeProvider;
    setupDummyNetwork(clusteringNodeProvider);
    
    // Execute
    clusteringNodeProvider.removeNode("2", null, true);
    
    // Verify
    var visNodes = clusteringNodeProvider.getVisNodes();
    var visLinks = clusteringNodeProvider.getVisLinks()

    testArrayProperty(test, visNodes, "id", ["1", "3", "4"]);

    test.equal(visLinks.length, 1, "Only the link from 1 - 3 should be left");

    test.equal(visLinks[0].id, "1->3", "Second link should have id 1->3");
    test.equal(visLinks[0].source.id, "1", "Second link should point from node 1");
    test.equal(visLinks[0].target.id, "3", "Second link should point to node 3");
});
