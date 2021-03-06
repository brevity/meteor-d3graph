if(Meteor.isClient) {

    d3treelayout = (function() {
        return {
            create: function (el, treeData, domain, options) {
                var defaultOptions = {
                    hideRootNode: true,
                    nodeClass: "node",
                    nodeClassSelected: "node-selected",
                    nodeClassUnselected: "node-unselected",
                    linkClass: "link",
                    linkClassSelected: "link-selected",
                    linkClassUnselected: "link-unselected",
                    nodeColorUnexpanded: "lightsteelblue",
                    nodeColorExpanded: "#fff",
                    hideAxis: false,
                    margins: [120, 220, 120, 220],
                    dynamicHeight: false
                };
                options = $.extend({}, defaultOptions, options);
                var result = new d3treelayout(el, options);
                result.create(treeData, domain);
                return result;
            },
            load: function (el, savedState) {
                var result = new d3treelayout(el, savedState.options);
                result.load(savedState);
                return result;
            }
        };

        function d3treelayout(el, options) {
            this.el = el;

            var m = options.margins;
            w = el.width() - m[1] - m[3],
            h = el.height() - m[0] - m[2];

            this.width = w;
            this.height = h;

            var originalWidth = w;
            var originalHeight = h;

            var levelWidth = 0;

            var svg  = d3.select('#' + this.el.attr('id')).append("svg:svg")

            var container = svg.append("svg:g")
                .attr("transform", "translate(" + m[3] + "," + m[0] + ")");

            var axisLayer = container.append("svg:g");
            if(options.hideAxis)
                axisLayer.style("opacity", "0");

            var axis;

            var vis = container.append("svg:g");

            var zoomBehavior = d3.behavior.zoom().scaleExtent([0.5, 2]).on("zoom", zoom);
            function zoom() {
                var tx = zoomBehavior.translate()[0];
                var ty = zoomBehavior.translate()[1];
                var s = zoomBehavior.scale();

                // Make sure we're within the bounding box
                if (tx > levelWidth * s) tx = levelWidth * s;
                if (tx < originalWidth - (w + levelWidth) * s) tx = originalWidth - (w + levelWidth) * s;

                if (ty > 0) ty = 0;
                if (ty < originalHeight - h * s) ty = originalHeight - h * s;

                // And if we've zoomed out so all is visible, center the viz
                if (w * s < originalWidth)
                    tx = (originalWidth - w * s) / 2;

                if (h * s < originalHeight)
                    ty = (originalHeight - h * s) / 2;
                
                zoomBehavior.translate([tx, ty]);
                
                vis.attr("transform", "translate(" + zoomBehavior.translate() + ")scale(" + zoomBehavior.scale() + ")");
                axisLayer.attr("transform", "translate(" + zoomBehavior.translate() + ")scale(" + zoomBehavior.scale() + ")");
            }
            svg.call(zoomBehavior);

            function interpolateZoom (translate, scale, duration) {
                return d3.transition().duration(duration).tween("zoom", function () {
                    var iTranslate = d3.interpolate(zoomBehavior.translate(), translate);
                    var iScale = d3.interpolate(zoomBehavior.scale(), scale);
                    
                    return function (t) {
                        zoomBehavior.scale(iScale(t)).translate(iTranslate(t));
                        vis.attr("transform", "translate(" + zoomBehavior.translate() + ")scale(" + zoomBehavior.scale() + ")");
                        axisLayer.attr("transform", "translate(" + zoomBehavior.translate() + ")scale(" + zoomBehavior.scale() + ")");
                    };
                });
            }
                        
            var tree = d3.layout.tree()
                .size([h, w]);

            var diagonal = d3.svg.diagonal()
                .projection(function(d) { return [d.y, d.x]; });

            function createAxis(domain) {
                var scale = d3.scale.ordinal()
                    .domain(domain)
                    .rangePoints([0, w]);

                axis = d3.svg.axis()
                    .scale(scale)
                    .orient("bottom")
                    .tickSize(-h);

                if(domain.length > 20) {
                    var tickValues = [];
                    var tick = 0;
                    var increment = (domain.length - 1) / 10;
                    for(var i = 0; i < 11; i++) {
                        tickValues.push(domain[Math.round(tick)]);
                        tick += increment;
                    }
                    axis.tickValues(tickValues);
                }

                axisLayer.append("svg:g")
                    .attr("class", "timeline-axis")
                    .attr("transform", "translate(0, " + h + ")")
                    .call(axis);
            }

            // If we're hiding the root node, level 1 is the left-most
            var shallowestLevel = options.hideRootNode ? 1 : 0;

            var root;

            this.create = function (treeData, domain) {
                this.treeData = treeData;
                this.domain = domain;

                root = treeData;
                root.x0 = h / 2;
                root.y0 = 0;

                // Now, figure out the maximum label length. From this, we determine the necessary width of our g-element by multiplying
                // by potential number of levels. Finally, pan the screen to show the entire first level of labels.

                var level1Width = 0;
                var levelCount = 0;

                function traverse(depth, node) {
                    var nodeLabelWidth = measureLabelWidth(node.name);
                    levelWidth = Math.max(levelWidth, nodeLabelWidth);
                    
                    if(depth == 1)
                        level1Width = Math.max(level1Width, nodeLabelWidth);
                    
                    levelCount = Math.max(levelCount, depth);
                    _(node.children).each(traverse.bind(null, depth + 1));
                }
                
                traverse(0, root);
                w = levelWidth * (levelCount - 1);
                this.width = w;
                tree.size([h, w]);
                zoomBehavior.translate([level1Width, 0]);
                zoom();

                function initializeData() {
                    var idCounter = 0;
                    root.id = idCounter++;

                    function initializeBranch(node) {
                        if (node.children) {
                            node.children.forEach(initializeBranch);
                            toggle(node);
                        }
                        node.id = idCounter++;
                        node.selected = false;
                    }

                    root.children.forEach(initializeBranch);
                }
                initializeData();

                createAxis(domain);
            }
            
            function measureLabelWidth(labelText) {
                var container = vis.append("svg:g")
                    .attr("class", "timeline-node")
                var tempLabel = container.append("svg:text")
                    .style("opacity", 0)
                    .text(labelText);
                
                var result = tempLabel[0][0].getComputedTextLength();
                container.remove();
                return result;
            }

            this.load = function (savedState) {
                this.treeData = savedState.treeData;
                root = this.treeData;
                this.domain = savedState.domain;
                this.width = w = savedState.width;
                this.height = h = savedState.height;

                createAxis(savedState.domain);

                tree.size([h, w]);
                axis.tickSize(-h);
                axisLayer.select("g")
                    .transition(500)
                    .attr("transform", "translate(0, " + h + ")")
                    .call(axis);

                zoomBehavior.translate(savedState.zoomTranslate);
                zoomBehavior.scale(savedState.zoomScale);
                zoom();
            }

            this.getState = function () {
                return {
                    options: options,
                    treeData: this.treeData,
                    domain: this.domain,
                    width: w,
                    height: h,
                    zoomTranslate: zoomBehavior.translate(),
                    zoomScale: zoomBehavior.scale()
                };
            }

            this.update = function () {
                update();
            }

            this.setOption = function (key, value) {
                options[key] = value;
            }

            this.showAxis = function() {
                options.hideAxis = false;
                axisLayer.transition(500).style("opacity", "1");
            }

            this.hideAxis = function() {
                options.hideAxis = true;
                axisLayer.transition(500).style("opacity", "0");
            }
            
            this.zoomToFit = function () {
                var horizontalScale = originalWidth / w;
                var verticalScale = originalHeight / h;
            
                var scale = Math.min(horizontalScale, verticalScale);
            
                var tx = (originalWidth - w * scale) / 2;
                var ty = (originalHeight - h * scale) / 2;
                
                interpolateZoom([tx, ty], scale, 500);
            }

            function updateNodePositions(nodeToExclude) {
                var node = vis.selectAll("g.timeline-node");

                if(nodeToExclude)
                    node = node.filter(function (d) { return d !== nodeToExclude; });

                node.transition(500)
                    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

                var linkSelector = "path.timeline-link";

                if(nodeToExclude)   // Exclude links to and from our node...
                    linkSelector += ":not([data-link-source='" + nodeToExclude.id + "']):not([data-link-target='" + nodeToExclude.id + "'])";

                var link = d3.selectAll(linkSelector)
                    .transition(500)
                    .attr("d", diagonal);
            }

            function dragStart(d) {
                if(!options.enableDragging)
                    return;

                if(options.dragStartHandler) {
                    var nodeElement = d3.select(this);
                    var node = nodeElement.datum();
                    options.dragStartHandler(node, nodeElement);
                }
            }

            function dragMove(d) {
                if(!options.enableDragging)
                    return;

                var nodeElement = d3.select(this);
                var node = nodeElement.datum();

                var newX = d3.event.x;
                var newY = d3.event.y;

                var oldX = node.y;
                var oldY = node.x;

                if (options.dragMoveHandler) {
                    var result = options.dragMoveHandler(node, nodeElement, newX, newY, oldX, oldY);
                    newX = result.x;
                    newY = result.y;

                    if(result.update)
                        updateNodePositions(node);
                }

                node.y = newX;
                node.x = newY;

                nodeElement.attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; });

                var link = d3.selectAll("[data-link-source='" + node.id + "'], [data-link-target='" + node.id + "']");
                link.attr("d", diagonal);
            }

            function dragEnd(d) {
                if(!options.enableDragging)
                    return;

                var nodeElement = d3.select(this);
                var node = nodeElement.datum();

                if (options.dragEndHandler) {
                    var finalCoords = options.dragEndHandler(node, nodeElement);
                    node.y = finalCoords[0];
                    node.x = finalCoords[1];
                }

                updateNodePositions();
            }

            var drag = d3.behavior.drag()
                .origin(function() {
                    var d = d3.select(this).datum();
                    return {x: d.y, y: d.x};
                })
                .on("dragstart", dragStart)
                .on("drag", dragMove)
                .on("dragend", dragEnd);

            // Toggle children of a given node
            function toggle(node) {
                node.selected = !node.selected;

                if (node.children) {
                    node._children = node.children;
                    node.children = null;
                } else {
                    node.children = node._children;
                    node._children = null;
                }
            }

            function updateDynamicHeight() {
                var levelSizes = new Array(100);
                function traverse (depth, node) {
                    if(!levelSizes[depth]) levelSizes[depth] = 0;
                    levelSizes[depth]++;
                    
                    _(node.children).each(traverse.bind(null, depth + 1));
                }
                
                traverse(0, root);
                
                var maxLevelSize = d3.max(levelSizes);
                var calculatedHeight = maxLevelSize * 40;
                
                h = Math.max(originalHeight, calculatedHeight);
                
                tree.size([h, w]);
                axis.tickSize(-h);
                axisLayer.select("g")
                    .transition(500)
                    .attr("transform", "translate(0, " + h + ")")
                    .call(axis);                
            }
            
            function update(source) {
                source = source || root;
                var duration = 500;

                // Compute the new tree layout.
                this.nodes = tree.nodes(root).reverse();
                if(options.hideRootNode) {
                    this.nodes = _(this.nodes).filter(function (n) { return n.id !== root.id; });
                }

                // If a normalize position-function was given, apply it to every node
                if (options.normalizePositions)
                    options.normalizePositions();

                // Update the nodes
                var node = vis.selectAll("g." + options.nodeClass)
                    .data(this.nodes, function(d) { return d.id; })

                // Enter any new nodes at the parent's previous position.
                var nodeEnter = node.enter().append("svg:g")
                    .attr("class", function (d) { return options.nodeClass + " " + (d.selected ? options.nodeClassSelected : options.nodeClassUnselected); })
                    .attr("transform", function(d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
                    .on("click", function(d) {
                        if(options.clickHandler) {
                            options.clickHandler.call(this, d);
                        }
                        else {
                            toggle(d);
                            
                            if(options.dynamicHeight)
                                updateDynamicHeight();
                            
                            update(d);
                        }
                    })
                    .call(drag);

                nodeEnter.append("svg:circle")
                    .attr("r", 1e-6)
                    .style("fill", function(d) { return d._children ? options.nodeColorUnexpanded : options.nodeColorExpanded; });

                // Switch between -1 and 1
                function alternate(row) { return (row % 2) * 2 - 1; }

                nodeEnter.append("svg:text")
                    .attr("x", function(d) { return d.children || d._children || d.depth === shallowestLevel ? -10 : 10; })
                    .attr("y", function(d) {
                        return d.depth === shallowestLevel ? 0 : (d.children || d._children ?  alternate(d.depth) * 10 : 0);
                    })
                    .attr("dy", ".35em")
                    .attr("text-anchor", function(d) { return d.children || d._children || d.depth === shallowestLevel ? "end" : "start"; })
                    .text(function(d) { return d.name; })
                    .style("fill-opacity", 1e-6);

                nodeEnter.append("svg:title")
                    .text(function (d) { return d.name; });

                // Transition nodes to their new position.
                var nodeUpdate = node.transition()
                    .duration(duration)
                    .attr("class", function (d) { return options.nodeClass + " " + (d.selected ? options.nodeClassSelected : options.nodeClassUnselected); })
                    .attr("transform", function(d) { return "translate(" + d.y + "," + d.x + ")"; })

                nodeUpdate.select("circle")
                    .attr("r", 4.5)
                    .style("fill", function(d) { return d._children ? options.nodeColorUnexpanded : options.nodeColorExpanded; });

                nodeUpdate.select("text")
                    .style("fill-opacity", 1);

                // Transition exiting nodes to the parent's new position.
                var nodeExit = node.exit().transition()
                    .duration(duration)
                    .attr("transform", function(d) { return "translate(" + source.y + "," + source.x + ")"; })
                    .remove();

                nodeExit.select("circle")
                    .attr("r", 1e-6);

                nodeExit.select("text")
                    .style("fill-opacity", 1e-6);

                // Update the links
                var link = vis.selectAll("path." + options.linkClass)
                    .data(tree.links(nodes), function(d) { return d.target.id; });

                // Enter any new links at the parent's previous position.
                link.enter().insert("svg:path", "g")
                    .attr("class", function (d) { return options.linkClass + " " + (d.target.selected ? options.linkClassSelected : options.linkClassUnselected); })
                    .attr("data-link-source", function (d) { return d.source.id })
                    .attr("data-link-target", function (d) { return d.target.id })
                    .attr("d", function(d) {
                        var o = {x: source.x0, y: source.y0};
                        return diagonal({source: o, target: o});
                    })
                    .transition()
                    .duration(duration)
                    .attr("d", diagonal);

                // Transition links to their new position.
                link.transition()
                    .attr("class", function (d) { return options.linkClass + " " + (d.target.selected ? options.linkClassSelected : options.linkClassUnselected); })
                    .duration(duration)
                    .attr("d", diagonal);

                // Transition exiting nodes to the parent's new position.
                link.exit().transition()
                    .duration(duration)
                    .attr("d", function(d) {
                        var o = {x: source.x, y: source.y};
                        return diagonal({source: o, target: o});
                    })
                    .remove();

                // Stash the old positions for transition.
                nodes.forEach(function(d) {
                    d.x0 = d.x;
                    d.y0 = d.y;
                });
            }
        }
    })();
}