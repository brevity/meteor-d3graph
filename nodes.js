﻿if(Meteor.isClient)
d3nodes = function (graph) {
    this.getNodeColor = function (node, minColor, maxColor) {
        if(node.selected && !window.inCauseEffectView)
            return d3colors.rgba(d3colors.getRgbaFromHex('ff0000'));

        if(node._color)
            return d3colors.rgba(colors.getRgbaFromHex(node._color));

        var color = d3colors.colorBlend(d3colors.getRgbaFromHex(minColor || graph.d3styles().colors.nodeMin), d3colors.getRgbaFromHex(maxColor || graph.d3styles().colors.nodeMax), node.ratio);
        var fill = d3colors.rgba(color);
        if (node.color != fill)
            node.color = fill;

        return fill;
    };

    this.getNodeRadius = function (node) {
        var r = node._radius || node.radius;
        if(isNaN(r))
            return graph.settings.minRadius;

        return parseInt(r);
    };

    this.getNodeBorderWidth = function (node) {
        return graph.d3styles().settings.nodeBorderSize;
    };

    this.getNode = function (name) {
        if (!graph.nodeDictionary)
            return;
        return graph.nodeDictionary.get(name);
    };

    this.addNode = function (nodeDefinition) {
        if (!nodeDefinition)
            return null;

        var id = nodeDefinition.id;
        var title = nodeDefinition.title;
        var weight = nodeDefinition.weight || 1;
        var data = nodeDefinition.data;
        var update = nodeDefinition.update == false ? false : true;
        var quality = nodeDefinition.quality;

        var node = this.getNode(id);
        if (node) {
            node.value += (weight || 1);
            node.count++;
            if (data)
                node.data.push(data);

            if (typeof this.nodeChanged === 'function')
                this.nodeChanged(node);

            // re-calculate
            if (update)
                graph.update();

            return node;
        }

        node = {
            id: id,
            title: title,
            x: nodeDefinition.x,
            y: nodeDefinition.y,
            index: graph.nodes.length,
            _color: nodeDefinition.color,
            _labelOpacity: nodeDefinition.labelOpacity,
            _fontSize: nodeDefinition.fontSize,
            to: [],
            from: [],
            tags: [],
            data: [],
            quality: quality,
            value: weight || 1,
            filterValues: {},
            clusterTitles: {},
            rank: graph.nodes.length,
            normalized: 0,
            ratio: 0,
            radius: nodeDefinition.radius || (graph.settings.minRadius + graph.settings.maxRadius / 2),
            centrality: nodeDefinition.centrality,
            showFullLabel: nodeDefinition.showFullLabel,
            dom: {},
            count: 1,
            frequency: 1,
            visible: true,
            visibility: {},
            getValue: function (id) {
                return id ? this.filterValues[id] : this.value;
            },
            getData: function(i) {
                return this.data[i||0];
            },
            hasLinkFrom: function(n, steps) {
                if(steps == 1) {
                    for(var i = 0; i < this.from.length; i++)
                        if(this.from[i].source.id == n.id)
                            return true;
                    return false;
                }
                else {
                    for(var i = 0; i < this.from.length; i++)
                        if(this.from[i].source.hasLinkFrom(n, steps - 1))
                            return true;
                    return false;
                }
            },
            hasLinkTo: function(n, steps) {
                if(steps == 1) {
                    for(var i = 0; i < this.to.length; i++)
                        if(this.to[i].target.id == n.id)
                            return true;
                    return false;
                }
                else {
                    for(var i = 0; i < this.to.length; i++)
                        if(this.to[i].target.hasLinkTo(n, steps - 1))
                            return true;
                    return false;
                }
            }
        };

        if (data)
            node.data.push(data);

        node.tooltip = this.getNodeTooltip(node);

        graph.nodes.push(node);
        graph.nodeDictionary.set(id, node);

        if (typeof this.nodeAdded === 'function')
            this.nodeAdded(node);

        if (update)
            graph.update();

        return node;
    };

    this.calculateNodes = function (filterKey) {
        if (graph.nodes.length <= 0)
            return;

        var sorted = graph.nodes.slice(0),
            min,
            max,
            ratio,
            i;

        sorted.sort(function (a, b) {
            return b.getValue(filterKey) - a.getValue(filterKey);
        });

        max = sorted[0].getValue(filterKey);
        min = sorted[sorted.length - 1].getValue(filterKey);

        for (i = 0; i < sorted.length; i++) {
            var val = sorted[i].value = sorted[i].getValue(filterKey);
            ratio = max < 0 ? 0 : (max == min) ? 0 : (val - min) / (max - min);

            if (isNaN(ratio))
                ratio = 0.5;
            if (ratio < graph.settings.minRatio)
                ratio = graph.settings.minRatio;

            sorted[i].rank = i;
            sorted[i].ratio = ratio;
            sorted[i].radius = sorted[i]._radius = graph.settings.minRadius + ((graph.settings.maxRadius - graph.settings.minRadius) * ratio);

            if (sorted[i].radius < graph.settings.minRadius)
                sorted[i].radius = graph.settings.minRadius;
            if (sorted[i].radius > graph.settings.maxRadius)
                sorted[i].radius = graph.settings.maxRadius;

            sorted[i].tooltip = this.getNodeTooltip(sorted[i]);
        }
    };

    /// Public Method: removeNode(name)
    ///
    /// <summary>
    /// Decreases the node's weight by one, and if the weight <= 0, removes the node from the graph.
    /// If a tag is specified, it also removes one instance of the tag.
    /// </summary>
    /// <param name="name">The node name</param>
    /// <param name="tag">The tag to be removed from this node.</param>
    /// <returns>If successful, undefined, otherwise an error message.
    this.removeNode = function (id, tag, fade, forceRemove) {
        var t = tag;
        node = graph.nodeDictionary.get(id);
        if (node) {
            var nodes = graph.nodes;
            var self = this;
            var found = false;
            $.each(nodes, function (i, n) {
                // try to find the node
                if (n && (n.id === node.id)) {
                    found = true;
                    // drop the node weight by 1
                    n.value -= 1;
                    if (n.value <= 0 || forceRemove) {
                        self.removeNodeByIndex(i, fade);
                        return;
                    }

                    // if we're removing a tag as well, find the tag
                    if (t) {
                        var index = $.inArray(t, graph.d3tags().getTagNames(n));
                        if (index >= 0) {
                            var _tag = n.tags[index];

                            // and drop the tag weight
                            _tag.weight -= 1;

                            // if the tag weight is zeroed, delete it
                            if (_tag.weight <= 0)
                                n.tags.splice(index, 1);
                        }
                    }
                }
            });
            if (!found)
                return "That node could not be found in graph.nodes.";
        }
        else
            return "That node could not be found in the dictionary.";
    };

    this.getShortestPath = function(nodes, from, to) {
        var path = this.calculateShortestPaths(nodes, from.index);
        var i = to.index;
        var p = path.parents[i];

        var links = [];

        _DEBUG("Node: " + to.title);
        while(p >= 0) {
            _DEBUG("Node: " + nodes[p].title);

            // add the link from nodes[p] to nodes[i]
            var l = this.getLinkToIndex(nodes[p], i);
            if(l)
                links.push(l);

            i = p;
            p = path.parents[nodes[p].index];

            if(p == from.index)
                break;
        }

        _DEBUG("Node: " + from.title);

        // add the link from 'from' to nodes[i]
        var l = this.getLinkToIndex(from, i);
        if(l)
            links.push(l);

        return links;
    };

    this.getLinkToIndex = function(node, index) {
        for(var i = 0; i < node.to.length; i++)
            if(node.to[i].target.index == index)
                return node.to[i];
        for(var i = 0; i < node.from.length; i++)
            if(node.from[i].source.index == index)
                return node.from[i];
    };

    this.calculateShortestPaths = function (nodes, index, directional) {
        // Taken from: http://vasir.net/blog/game_development/dijkstras_algorithm_shortest_path/

        // Step 0
        var costs = [];
        var temporary = [];
        var parents = [];

        $.each(nodes, function (i, node) {
            costs[i] = i == index ? 0 : Infinity;
            temporary[i] = true;
            parents[i] = -1;
        });

        var finished = false;
        do {
            finished = this.calculateShortestPaths_iterate(nodes, costs, temporary, parents, directional);
        }
        while (!finished);

        return { costs: costs, parents: parents };
    };

    this.calculateShortestPaths_iterate = function (nodes, costs, temporary, parents, directional) {
        // Find the node x with the smallest cost
        var x = this.getTemporaryMinimumIndex(costs, temporary);
        if (x < 0)
            return true;

        temporary[x] = false;

        // step 2 - find all connected nodes that are temporary
        var node = nodes[x];
        for (var i = 0; i < node.to.length; i++) {
            var y = node.to[i].target.index;
            if (!temporary[y])
                continue;

            if (costs[x] + 1 /* FIX: all weights are 1 */ < costs[y]) {
                costs[y] = costs[x] + 1;
                parents[y] = x;
            }
        }

        if(!directional) {
            for (var i = 0; i < node.from.length; i++) {
                var y = node.from[i].source.index;
                if (!temporary[y])
                    continue;

                if (costs[x] + 1 /* FIX: all weights are 1 */ < costs[y]) {
                    costs[y] = costs[x] + 1;
                    parents[y] = x;
                }
            }
        }

        return false;
    };

    this.getTemporaryMinimumIndex = function (costs, temporary) {
        var min = Infinity;
        var index = -1;
        for (var i = 0; i < costs.length; i++) {
            if (costs[i] < min && temporary[i]) {
                min = costs[i];
                index = i;
            }
        }

        return index;
    };

    /// Private Method: _removeNodeByIndex(index)
    ///
    /// <summary>
    /// Deletes a specified node and all associated links.
    /// </summary>
    /// <param name="index">The 0-based index of the node to be deleted.</param>
    this.removeNodeByIndex = function (index, fade) {
        // remove the node
        var nodes = graph.nodes.splice(index, 1);
        if (nodes.length) {
            var node = nodes[0];
            for (var i = graph.links.length; i >= 0; i--) {
                if (graph.links[i] && (graph.links[i].source == node || graph.links[i].target == node)) {
                    // remove the from/to for any nodes that reference this link
                    $.each(graph.nodes, function (j, n) {
                        for (var k = n.from.length; k >= 0; k--)
                            if (n.from[k] && (n.from[k].source.id == node.id || n.from[k].target.id == node.id))
                                n.from.splice(k, 1);
                        for (var k = n.to.length; k >= 0; k--)
                            if (n.to[k] && (n.to[k].source.id == node.id || n.to[k].target.id == node.id))
                                n.to.splice(k, 1);
                    });

                    // and remove the link itself
                    graph.links.splice(i, 1);
                }
            }

            /* FIX: When trying to use transitions here (even with duration=0), it breaks */

            // remove the label
            if (fade)
                graph.visLabels.select('g.label[id="' + node.id + '"]')
                    .transition()
                    .duration(250)
                    .style('opacity', 0)
                    .each('end', function () { graph.visLabels.select('g.label[id="' + node.id + '"]').remove(); });
            else
                graph.visLabels.select('g.label[id="' + node.id + '"]').remove();

            // remove the node
            if (fade)
                graph.visNodes.select('g.node[id="' + node.id + '"] circle')
                    .transition()
                    .duration(250)
                    .style('opacity', 0)
                    .each('end', function () { graph.visNodes.select('g.node[id="' + node.id + '"]').remove(); });
            else
                graph.visNodes.select('g.node[id="' + node.id + '"]').remove();

            // remove any links to/from it
            if (fade)
                graph.visLinks.selectAll('path.link[source="' + node.id + '"], path.link[target="' + node.id + '"]')
                    .transition()
                    .duration(250)
                    .style('opacity', 0)
                    .each('end', function () { graph.visLinks.selectAll('path.link[source="' + node.id + '"], path.link[target="' + node.id + '"]').remove(); });
            else
                graph.visLinks.selectAll('path.link[source="' + node.id + '"], path.link[target="' + node.id + '"]').remove();

            // remove from our internal dictionary
            graph.nodeDictionary.remove(node.id);

            if (graph.events.onNodeRemoved && typeof (graph.events.onNodeRemoved) === 'function')
                graph.events.onNodeRemoved(node);
        }
    };

    this.setNodeTitle = function (node, title, showFull) {
        if (node) {
            var self = this;
            node.title = title;
            node.showFullLabel = showFull;
            if (graph.settings.embedLabels)
                graph.visLabels
                    .selectAll('g.label[id="' + node.id + '"] text')
                    .each(graph.d3labels().getEmbeddedLabelFontSize)
                    .each(graph.d3labels().wordWrapLabel);
            else
                graph.visLabels
                    .selectAll('g.label[id="' + node.id + '"] text')
                    .text(title)
                    .style('font-size', function (d) { return d.fontSize + 'em'; /*return graph.labellib().getLabelSize(d);*/ });
        }
    };

    this.setNodeTitleHtml = function(node, html, ratio) {
        var r = ratio;
        if(!r)
            r = .75;

        graph.visLabels.selectAll('g.label[id="' + node.id + '"] text').remove();
        $('g.node[id="' + node.id + '"] body').parent().remove();

        var fo = graph.vis.selectAll('g.node[id="' + node.id + '"]')
            .append('svg:foreignObject')
            .attr('x', function(d) { return -1.0 * r * (d._radius || d.radius); })
            .attr('y', function(d) { return -1.0 * r * (d._radius || d.radius); })
            .attr('width', function(d) { return (d._radius || d.radius) * 2.0 * r; })
            .attr('height', function(d) { return (d._radius || d.radius) * 2.0 * r; });
        fo
            .append('xhtml:body')
            .style('text-align', 'center')
            .style('background', 'transparent')
            .style('cursor', 'pointer')
            .html(html);
    };

    this.updateNodeSizesForZoom = function(scale) {
        var s = scale;
        if(s < 1)
            s = 1;
        if(s > 8)
            s = 8;
        else if(!s)
            s = 1;

        graph.visNodes.selectAll('g.node circle')
            .attr('r', function(d) { d._radius = d.radius / s; return d._radius; })
            .style('stroke', function(d) { return graph.d3styles().getNodeBorderColor(d); })
            .style('stroke-width', (parseInt(graph.d3styles().settings.nodeBorderSize) / s)||1);
    };

    this.animateNodeClick = function(node, callback) {
        var r = graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle').attr('r');
        var c = graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle').style('fill');
        _DEBUG("r=" + r + " c=" + c);
        graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle')
            .transition()
            .delay(function (d, i) { return i * 2; })
            .duration(75)
            .style('fill', '#FFFF00')
            .attr('r', r * 1.25);
        setTimeout(function() {
            graph.visNodes.selectAll('g.node[id="' + node.id + '"] circle')
                .transition()
                .delay(function (d, i) { return i * 2; })
                .duration(75)
                .style('fill', c)
                .attr('r', r);
        }, 80);

        setTimeout(function() { if(callback) callback(); }, 220);
    };

    this.moveNodes = function (positions, time, ignoreLinks) {
        graph.force.stop();
        graph.fixedMode = true;

        var center = graph.getCenter();
        var node = null;
        $.each(positions, function (i, position) {
            $.each(graph.nodes, function (j, n) {
                if (position.id == n.id) {
                    node = n;
                    n.fixed = true;
                    if (position.radius)
                        n._radius = position.radius;
                    if (position.opacity >= 0.0)
                        n.opacity = position.opacity;
                    if (position.color)
                        n.color = n._color = position.color;
                    if (position.labelColor)
                        n.labelColor = position.labelColor;
                    if (position.labelSize)
                        n.fontSize = position.labelSize;
                    if (position.labelOpacity)
                        n.labelOpacity = position.labelOpacity;

                    var r = n._radius || n.radius;
                    if (position.x)
                        n.x = position.x; // Math.max(n.radius, Math.min(position.x, graph.width - r));
                    if (position.y)
                        n.y = position.y; // Math.max(n.radius, Math.min(position.y, graph.height - r));

                    return false;
                }
            });

            if (node) {
                graph.visNodes.selectAll('g.node[id="' + position.id + '"]')
                    .each(function (d) { d.fixed = true; })
                    .transition()
                    .delay(function (d, i) { return i * 2; })
                    .duration(time || 500)
                    .attr('cx', function(d) { return d.x; }).attr('cy', function(d) { return d.y; })
                    .attr('transform', function (d) { return 'translate(' + d.x + ',' + d.y + ')'; });

                var x = graph.visNodes.selectAll('g.node[id="' + position.id + '"] circle')
                    .transition()
                    .delay(function (d, i) { return i * 2; })
                    .duration(time || 500);

                if(position.radius)
                    x = x.attr('r', node._radius || node.radius);
                if(position.opacity >= 0.0)
                    x = x.style('opacity', position.opacity || 1.0);
                if(position.color)
                    x.style('fill', position.color);
                if(position.stroke)
                    x.style('stroke', position.stroke);
                else if(position.color) {
                    node.color = position.color;
                    x.style('stroke', graph.d3styles().getNodeBorderColor(node));
                }
                var opacity = (node.labelOpacity || node.opacity || 1.0);
                graph.visLabels.selectAll('g.label[id="' + position.id + '"]')
                    //.transition()
                    //.duration(time || 500)
                    .style('opacity', opacity);

                graph.visLabels.selectAll('g.label[id="' + position.id + '"] text')
                    //.transition()
                    //.duration(time || 500)
                    .style('opacity', opacity)
                    .text(function(d) { return opacity > 0 ? d.title : ''; })
                    //.style('font-size', function(d) { return jQuery.isNumeric(d.fontSize) ? d.fontSize + 'em' : d.fontSize })
                    .attr('text-anchor', function(d) { return position.anchor||(d.x < center.x ? 'end' : 'start') })
                    .attr('fill', function(d) { return position.labelColor||graph.d3styles().getNodeBorderColor(d); } /*LABEL FIX:node.labelColor*/);
            }
        });

        if (ignoreLinks)
            graph._links
                .transition()
                //.delay(function (d, i) { return i * 2; })
                .duration(time || 500)
                .style('opacity', 1.0)
                .attrTween('d', graph.d3links().calculatePathTween); //function (d) { return graph.linklib().calculatePath(d); });
        else
            graph._links
                .transition()
                .duration(time || 500)
                .style('opacity', function (d) {
                    // figure out what the opacity is for this link
                    var id = d.source.id;
                    var opacity = 0.0;
                    $.each(positions, function (i, p) {
                        if (p.id == id) {
                            if (p.links) {
                                $.each(p.links, function (j, link) {
                                    if (link.id == d.target.id) {
                                        if (link.opacity)
                                            opacity = link.opacity;
                                        return false;
                                    }
                                });
                            }
                        }
                    });
                    d._opacity = opacity;
                    return opacity;
                })
                .attr('stroke', function (d) {
                    // figure out what the color is for this link
                    var id = d.source.id;
                    var color = d.color;
                    $.each(positions, function (i, p) {
                        if (p.id == id) {
                            if (p.links) {
                                $.each(p.links, function (j, link) {
                                    if (link.id == d.target.id) {
                                        if (link.color)
                                            color = link.color;
                                        return false;
                                    }
                                });
                            }
                        }
                    });
                    return color;
                })
                .attr('stroke-width', function (d) {
                    // figure out what the color is for this link
                    var id = d.source.id;
                    var width = 2;
                    $.each(positions, function (i, p) {
                        if (p.id == id) {
                            if (p.links) {
                                $.each(p.links, function (j, link) {
                                    if (link.id == d.target.id) {
                                        if (link.width) {
                                            width = link.width;
                                        }
                                        return false;
                                    }
                                });
                            }
                        }
                    });
                    return parseInt(width||1);
                })
                .attrTween('d', graph.d3links().calculatePathTween);

        // Update labels
        graph.visLabels
            .selectAll('g.label')
            .transition()
            .delay(function (d, i) { return i * 2; })
            .duration(time || 500)
            .attr('transform', function (node) { return graph.d3labels().transformLabel(node, center); });
    };

    this.getNodeTooltip = function (node) {
        if (graph.events.onNodeTooltip && typeof (graph.events.onNodeTooltip === "function"))
            return graph.events.onNodeTooltip(node, d3.event);
    };

    this.onNodeClick = function (node) {
        if (graph.events.onNodeClick && typeof (graph.events.onNodeClick === "function")) {
            graph.events.onNodeClick(node, d3.event);
            d3.event.preventDefault();
        }
    };

    this.onNodeDblClick = function (node) {
        if (graph.events.onNodeDblClick && typeof (graph.events.onNodeDblClick === "function")) {
            graph.events.onNodeDblClick(node, d3.event||window.event);
            if(d3.event)
                d3.event.preventDefault();
            if(window.event) {
                window.event.preventDefault();
                window.event.stopPropagation();
            }

            return true;
        }
    };

    this.onNodeMouseover = function (node) {
        graph.currentNode = node;
        if (graph.events.onNodeMouseover && typeof (graph.events.onNodeMouseover === "function"))
            graph.events.onNodeMouseover(node, d3.event);
    };

    this.onNodeMouseout = function (node) {
        graph.currentNode = null;
        if (graph.events.onNodeMouseout && typeof (graph.events.onNodeMouseout === "function"))
            graph.events.onNodeMouseout(node, d3.event);
    };

    this.onNodeRightClick = function(node) {
        if(graph.events.onNodeRightClick && typeof (graph.events.onNodeRightClick === "function")) {
            graph.events.onNodeRightClick(node, d3.event||window.event);
            if(d3.event)
                d3.event.preventDefault();
            if(window.event)
                window.event.preventDefault();

            return false;
        }
    };
}