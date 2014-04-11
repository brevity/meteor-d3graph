Package.describe({
    summary: "Create and manipulate D3 force-directed graphs"
});

var libFiles = [
        'tipsy/tipsy.js',
        'intersect/intersect.js',
        'd3treelayout.js',
        'graphvis.js',
        'autoRadiusScale.js',
        'gradientScale.js'
    ];

Package.on_use(function(api, where) {
    api.use(['d3', 'jquery'], 'client');
    api.add_files(libFiles, ["client"]);

    if (api.export) {
        api.export('GraphVis');
        api.export('VisNode');
        api.export('VisLink')
        api.export('VisCluster');

        api.export('SvgRenderer');
        api.export('NodeCircle');
        api.export('LinkLine');
        api.export('ClusterHull');
        api.export('LabelText');
        
        api.export("autoRadiusScale");
        api.export("gradientScale");
    }
});

Package.on_test(function (api) {
    api.use(["d3", "tinytest", "test-helpers"]);

    api.add_files(libFiles, ["client"]);
    api.add_files([
        "tests/jquery-simulate/jquery.simulate.js",
        "tests/stubs.js", "tests/helpers.js",
        "tests/graphvis-tests.js"
    ], ["client"]);
});