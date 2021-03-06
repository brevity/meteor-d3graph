﻿d3graph = function(el, options) {
    this.el = el;
    this.options = options || {};
    this.id = this.options.id;
    this.fixedMode = false;
    this.visLayout = null;
    this.dragging = false;

    this.zoomWidget = null;
    this.noZoom = false;

    // set up private variables
    var fisheye = false; //(d3.fisheye && this.settings.fisheye) ? new d3.fisheye() : null;

    var _clusteringNodeProvider = new ClusteringNodeProvider(this);

    var _highlightlib = new d3highlights(this);
    var _taglib = new d3tags(this);
    var _stylelib = new d3styles(this);
    var _labellib = new d3labels(this);

    var self = this;

    this.settings = {
        maxLabels: this.options.maxLabels||7,
        labelLength: this.options.labelLength||8,
        constrainNodes: (this.options.constrainNodes == true),
        embedLabels: (this.options.embedLabels == true),
        hideLabels: (this.options.hideLabels == true),
        minFontSize: (this.options.minFontSize || 8),
        maxFontSize: (this.options.maxFontSize||16),
        markerId: this.el.attr('id') + '_arrow',
        minMarkerSize: (this.options.minMarkerSize >= 0.0 ? this.options.minMarkerSize : 1.0),
        maxMarkerSize: (this.options.maxMarkerSize >= 0.0 ? this.options.maxMarkerSize : 1.0),
        gravity: this.options.gravity || 0.03,
        friction: this.options.friction ||.9,
        theta: 0.1,
        chargeConstant: this.options.charge || -150,
        linkStrength: this.options.linkStrength === undefined ?.2 : this.options.linkStrength,
        minRadius: this.options.minRadius || 3,
        maxRadius: this.options.maxRadius || 20,
        jenks: 0,
        minNodeRatio: .01,
        nodeBorderSize: this.options.nodeBorderSize||0,
        sizeFalloffPower: 1,
        chargeRatioFalloffPower: 0,
        linkConstant: this.options.linkConstant || 1,
        linkMultiplier: 0.5,
        minLinkThickness: this.options.minLinkThickness||.5,
        maxLinkThickness: this.options.maxLinkThickness||2.5,
        highlightedLinkThickness: this.options.highlightedLinkThickness||5,
        linkRadiiFalloffPower:this.options.linkRadiiFalloffPower || 1,
        layoutUpdateSpeed: 500,
        fixed: options.fixed,
        fisheye: this.options.fisheye,
        nodeSizeType: 'linear',
        zoom: (this.options.zoom != false),
        pan: this.options.pan,
        initialZoom: this.options.initialZoom,
        linkWeightThreshold: 0,
        draggable: this.options.draggable||false,
        taperedLinks: this.options.taperedLinks,
        taperedLinkMinColor: this.options.taperedLinkMinColor||"#BAE4B3",
        taperedLinkMaxColor: this.options.taperedLinkMaxColor||"#006D2C",
        taperedLinkMinSize: this.options.taperedLinkMinSize,
        taperedLinkMaxSize: this.options.taperedLinkMaxSize,
        reverseLabelPosition: this.options.reverseLabelPosition,
        constrainNodes: this.options.constrainNodes,
        clustering: true,
        preventCollisions: this.options.preventCollisions == undefined ? true : this.options.preventCollisions,
        fitToScreen: this.options.fitToScreen === undefined ? true :  this.options.fitToScreen
    };

    this.events = {
        onGraphClick: options.onGraphClick,
        onGraphMousemove: options.onGraphMousemove,
        onGraphMouseup: options.onGraphMouseup,
        onGraphMousedown: options.onGraphMousedown,
        onGraphDoubleClick: options.onGraphDoubleClick,
        onNodeTooltip: options.onNodeTooltip,
        onLinkTooltip: options.onLinkTooltip,
        onLabelTooltip: options.onLabelTooltip,
        onNodeClick: options.onNodeClick,
        onNodeRightClick: options.onNodeRightClick,
        onNodeMouseover: options.onNodeMouseover,
        onNodeMouseout: options.onNodeMouseout,
        onNodeMousedown: options.onNodeMousedown,
        onNodeMouseup: options.onNodeMouseup,
        onNodeDblClick: options.onNodeDblClick,
        onNodeEdit: options.onNodeEdit,
        onNodeDelete: options.onNodeDelete,
        onLinkClick: options.onLinkClick,
        onLinkDblClick: options.onLinkDblClick,
        onLinkMouseover: options.onLinkMouseover,
        onLinkMouseout: options.onLinkMouseout,
        onLinkMousedown: options.onLinkMousedown,
        onLinkMouseup: options.onLinkMouseup,
        onLinkEdit: options.onLinkEdit,
        onLinkDelete: options.onLinkDelete,
        onLabelClick: options.onLabelClick,
        onLabelMouseover: options.onLabelMouseover,
        onLabelMouseout: options.onLabelMouseout
    };

    this.d3 = function() { return d3.select(el[0]); };

    this.clusteringNodeProvider = function () { return _clusteringNodeProvider; }
    this.d3tags = function () { return _taglib; };
    this.d3highlights = function () { return _highlightlib; };
    this.d3styles = function () { return _stylelib; };
    this.d3labels = function () { return _labellib; };
    this.d3zoomer = function() { return this.zoomer; };

    this.force = function () { return self.visLayout; };

    var w = this.width = this.el.innerWidth();
    var h = this.height = this.el.innerHeight();
    this.scale = this.settings.initialZoom || 1.0;
    this.trans = [(w / 2) - (w * this.scale / 2), (h / 2) - (h * this.scale / 2)];

    // This variable decides whether to to screen during tick. It's initialized to the setting, but switched off when alpha drops low enough.
    var fitToScreenCounter = this.settings.fitToScreen ? 50 : 0;
    this.resetFitToScreen = function(x) { fitToScreenCounter = x || 50; };

    var doubleclick = false;
    this.el.on('click', function (evt) {
        doubleclick = false;
        if (_.isFunction(self.events.onGraphClick)) {
            // set a timer and run the event after it expires - to allow for a possible double-click event instead
            setTimeout(function() {
                if(!doubleclick)
                    self.events.onGraphClick(evt);
            }, 150);
        }
    });

    this.el.on('dblclick', function (evt) {
        if (_.isFunction(self.events.onGraphDoubleClick)) {
            doubleclick = true;
            if(evt.preventDefault) evt.preventDefault();
            if(evt.stopPropagation) evt.stopPropagation();
            self.events.onGraphDoubleClick(evt);
        }
    });

    this.linkDistance = function (d) {
        return self.settings.linkConstant + Math.pow(d.target.radius + d.source.radius, self.settings.linkRadiiFalloffPower);
    };

    this.calculateDefaultGravity = function () {
        var k = Math.sqrt(_clusteringNodeProvider.getVisNodes().length / (self.width * self.height));
        return (self.settings.gravity = 100 * k);
    };

    this.charge = function (d) {
        return self.settings.chargeConstant * self.settings.linkConstant * Math.pow(d.ratio, self.settings.chargeRatioFalloffPower);
    };

    this.getCenter = function () {
        return _clusteringNodeProvider.getCenter();
    };

    this.clear = function () {
        _clusteringNodeProvider.clear();

        // clear labels
        self.visLabels.selectAll('g.label').remove();

        this.update();
    };

    if(this.settings.zoom) {
        this.zoomer = new d3zoomer(this, this.options.zoomWidgetId);
    }
    else {
        this.vis = d3.select(el[0]).append("svg:svg");

        if(this.options.class)
            this.vis.attr('class', this.options.class);
    }

    var hoveredNode = null;

    this.vis
        .on('mousemove', function() {
            if(self.events.onGraphMousemove)
                self.events.onGraphMousemove(d3.event);
        })
        .on('mousedown', function(e) {
            if(self.events.onGraphMousedown) 
                self.events.onGraphMousedown(e); 
        })
        .on('mouseup', function(e) { 
            if(hoveredNode) {
                _clusteringNodeProvider.onNodeMouseup(hoveredNode);
                hoveredNode = null;
            }
            else {
                if(self.events.onGraphMouseup) 
                    self.events.onGraphMouseup(e); 
            }
        });

    this.markers = this.vis
        .append("svg:defs");

    _clusteringNodeProvider.updateMarkers();

    this.visClusters = this.vis
        .append("svg:g")
        .attr("class", "clusters");

    this.visLinks = this.vis
        .append('svg:g')
        .attr('class', 'links');

    this.visNodes = this.vis
        .append('svg:g')
        .attr('class', 'nodes');

    this.visLabels = this.vis
        .append('svg:g')
        .attr('class', 'labels');

    this.visUi = this.vis
        .append('svg:g')
        .attr('class', 'ui')

    var force = this.force = d3.layout.force()
        .theta(this.settings.theta)
        .gravity(this.settings.gravity)
        .linkStrength(this.settings.linkStrength)
        .friction(this.settings.friction)
        .linkDistance(self.linkDistance)
        .charge(this.charge)
        .size([w, h]);

    force.drag = d3.behavior.drag()
        .origin(Object)
        .on("dragstart", $.proxy(function(e) {
            if(!self.settings.draggable)
                return;

            this.dragging = true;
            force.resume();
        }, this))
        .on("drag", function(d, i) {
            if(!self.settings.draggable)
                return;
            d.x = d3.event.x;
            d.y = d3.event.y;
            d3.select(this).attr('transform', 'translate(' + d.x + ',' + d.y + ')');
            force.tick();
        })
        .on("dragend", $.proxy(function() {
            if(!self.settings.draggable)
                return;
            this.dragging = false;
        }, this));

    this.getNodes = function () { return _clusteringNodeProvider.getVisNodes(); };
    this.getLinks = function () { return _clusteringNodeProvider.getVisLinks(); };

    this.getAllNodes = function () { return _clusteringNodeProvider.getAllNodes(); }
    this.getAllLinks = function () { return _clusteringNodeProvider.getAllLinks(); }

    this.calculate = function() {
        _clusteringNodeProvider.calculate();
    };

    var padding = 1.5; // separation between nodes 
    var maxRadius = 12;

    // Resolves collisions between d and all other circles.
    function collide(alpha) {
        var quadtree = d3.geom.quadtree(_clusteringNodeProvider.getVisNodes());
        return function(d) {
            var r = d.radius + maxRadius + padding,
                nx1 = d.x - r,
                nx2 = d.x + r,
                ny1 = d.y - r,
                ny2 = d.y + r;

            quadtree.visit(function(quad, x1, y1, x2, y2) {
                if (quad.point && (quad.point !== d)) {
                    var x = d.x - quad.point.x,
                        y = d.y - quad.point.y,
                        l = Math.sqrt(x * x + y * y),
                        r = d.radius + quad.point.radius + padding;
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

    this.update = function () {
        w = this.width;
        h = this.height;

        var visNodes = _clusteringNodeProvider.getVisNodes();

        force.nodes(visNodes);
        force.links(_clusteringNodeProvider.getVisLinks());

        var nodeCount = visNodes.length;
        self.settings.linkConstant = (nodeCount > 1) ?
            this.settings.linkMultiplier * Math.min(w, h) / (3 * Math.sqrt(nodeCount - 1)) :
            1;

        this.force
            .theta(this.settings.theta)
            .linkStrength(function(d) {
                return self.settings.linkStrength * (d.source.color == d.target.color ? 4 : 1);
            })
            .friction(this.settings.friction)
            .charge(this.charge)
            .gravity(this.settings.gravity)
            .size([this.width, this.height])

        _clusteringNodeProvider.updateMarkers();

        var curve = d3.svg.line()
            .interpolate("cardinal-closed")
            .tension(.85);

        var cluster = this._clusters = this.visClusters.selectAll("path.hull")
            .data(_clusteringNodeProvider.getVisClusters());

        var c = cluster.enter().append("svg:path")
            .attr("class", "hull")
            .attr("id", function (d) { return d.id; })
            .style("fill", "red")
            .on("click", function(d) {
                console.log("hull click", d);
            });

        c.attr("d", function (d) { curve(d.makeHull()); })

        var link = this._links = this.visLinks.selectAll("path.link")
            .data(_clusteringNodeProvider.getVisLinks(), function (link) { return link.id; });

        var d3color = d3.interpolateRgb(this.settings.taperedLinkMinColor, this.settings.taperedLinkMaxColor);

        var color_scale = d3.scale.linear().range([0, 1]).domain([0, d3.max(link, function(d) {
            return d.ratio;
        })]);

        var l = link.enter().append("svg:path")
            .attr('source', function (link) { return link.source.id; })
            .attr('target', function (link) { return link.target.id; })
            .on('mouseover', function (d) { 
                if (_.isFunction(self.events.onLinkMouseover))
                    self.events.onLinkMouseover(d, d3.event);
            })
            .on('mouseout', function (d) { 
                if (_.isFunction(self.events.onLinkMouseout))
                    self.events.onLinkMouseout(d, d3.event);
            })
            .on('click', function(d) { 
                doubleclick = false;
                var mouse = d3.mouse(self.vis[0][0]);
                
                if (_.isFunction(self.events.onLinkClick)) {
                    setTimeout(function() {
                        if(!doubleclick)
                            self.events.onLinkClick(d, mouse[0], mouse[1]);
                    }, 300);
                }
                d3.event.stopPropagation();
            })
            .on('dblclick', function (d) { 
                if (_.isFunction(self.events.onLinkDblClick)) {
                    doubleclick = true;
                    var mouse = d3.mouse(self.vis[0][0]);
                    self.events.onLinkDblClick(d, mouse[0], mouse[1]);
                    d3.event.stopPropagation();
                }
            })
            .attr('class', 'link');

        if(this.settings.taperedLinks)
            l.attr("fill", function(d) {
                return d3color(color_scale(d.ratio));
            });
        else {
            l.style('fill', 'none');
            l.attr('marker-end', function(link) {
                return link.directional ? 'url(#' + _clusteringNodeProvider.getMarkerUrl(link) + ')' : '';
            });
        }

        link.exit().remove();

        link
            .style("stroke-width", function (d) { return _clusteringNodeProvider.getLinkWidth(d); })
            .style("stroke", function (d) {
                if(self.settings.taperedLinks)
                    return self.settings.taperedLinkBorders ? d3colors.darken(d3color(color_scale(d.ratio))).hex() : 'rgb(255,255,255,.5)';

                return _clusteringNodeProvider.getLinkColor(d);
            });

        var node = this._nodes = this.visNodes.selectAll("g.node")
            .data(_clusteringNodeProvider.getVisNodes(), function (node) { return node.id; });

        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .attr('id', function (d) { return d.id; })
            .on('mouseover', function (d) { 
                hoveredNode = d; 
                return _clusteringNodeProvider.onNodeMouseover(d); 
            })
            .on('mouseout', function (d) { 
                hoveredNode = null; 
                return _clusteringNodeProvider.onNodeMouseout(d); 
            })
            .on('mousedown', function(d) { 
                return _clusteringNodeProvider.onNodeMousedown(d); 
            })
            .on('mouseup', function(d) { 
                hoveredNode = null; 
                return _clusteringNodeProvider.onNodeMouseup(d); 
            })
            .on('click', function (d) { 
                var mouse = d3.mouse(self.vis[0][0]);
                return _clusteringNodeProvider.onNodeClick(d, mouse[0], mouse[1]); 
            })
            .on('dblclick', function(d) { 
                var mouse = d3.mouse(self.vis[0][0]);
                return _clusteringNodeProvider.onNodeDblClick(d, mouse[0], mouse[1]); 
            })

        if(this.options.nodeSorting)
            nodeEnter.sort(function(a, b) {
                return b.radius - a.radius;
            });

        if(self.settings.draggable)
            nodeEnter.call(force.drag);

        if ($.browser.msie) {
            this.visNodes.selectAll("g.node")
                .on("mousedown", function(d) { _clusteringNodeProvider.onNodeClick(d); });
        }

        if (_stylelib.settings.nodeBorderSize > 0)
            nodeEnter.append("circle")
                .style('stroke-width', _stylelib.settings.nodeBorderSize)
                .style('cursor', 'pointer')
                .style('fill', function (d) { d.color = _clusteringNodeProvider.getNodeColor(d); return d.color; })
                .style('stroke', function(d) { return _clusteringNodeProvider.getNodeBorderColor(d); });
        else
            nodeEnter.append("circle")
                .style('fill', function (d) { d.color = _clusteringNodeProvider.getNodeColor(d); return d.color; })
                .style('cursor', 'pointer');

        // make sure we update all of the radii to their current values - we do this with a smooth animation
        var scale = this.scale || 1.0;
        this.visNodes.selectAll('g.node circle')
            //.transition()
            //.duration(200)
            .attr('r', function (d) { return _clusteringNodeProvider.getNodeRadius(d) / scale; });

        node.exit().remove();

        if(this.vis.node()) {
            this.vis.node().oncontextmenu = function() {
                //if(!self.currentNode)
                //    return settings.debug;

                return _clusteringNodeProvider.onNodeRightClick(self.currentNode);
            };
        }

        var labels = this._labels = this.visLabels
            .selectAll('g.label')
            .data(_clusteringNodeProvider.getVisNodes(), function (node) { return node.id; });

        labels.exit().remove();

        labels = labels
            .enter()
            .append('svg:g')
            .attr('class', 'label')
            .attr('style', 'cursor:pointer')
            .attr('id', function (node) { return node.id; })
            .on('mouseover', function (node) { _labellib.onLabelMouseover(node); })
            .on('mouseout', function (node) { _labellib.onLabelMouseout(node); })
            .on('click', function (node) { _labellib.onLabelClick(node); })
            .classed('active', true);

        //.call(force.drag);

        try {
            labels.sort(function(a, b) {
                return a.radius - b.radius;
            });
        }
        catch(e) { }

        if (this.settings.embedLabels) {
            labels.append('text')
                .attr('baseline', 'text-top')
                .attr('fill', function (d) { return _labellib.getLabelColor(d); })
                .attr('text-anchor', 'middle')
                //.style('text-shadow', _stylelib.colors.labelShadow ? _stylelib.colors.labelShadow + ' 0px 1px 1px' : '')
                .style('cursor', 'pointer')
                .each(_labellib.getEmbeddedLabelFontSize)
                .each(_labellib.wordWrapLabel);
        }
        else {
            labels.append('text')
                .attr('baseline', 'middle')
                .style('font-size', function (d) { return _labellib.getLabelSize(d); })
                .attr('fill', function (d) { return _clusteringNodeProvider.getNodeBorderColor(d); /*LABEL FIX:_labellib.getLabelColor(d);*/ })
                //.style('text-shadow', '-1px -1px 2px #FFF, 1px -1px 2px #FFF, -1px 1px 2px #FFF, 1px 1px 2px #FFF')
                .style('opacity', function(d) { return _labellib.getLabelOpacity(d); })
                .text(function (d) { return d.hideLabel ? '' : d.title; });
        }

        $('#' + this.el.attr('id') + ' svg g.nodes circle').tipsy({
            html: true,
            fade: false,
            hoverlock: true,
            delayIn: _stylelib.settings.tooltipDelay,
            tipsyClass: _stylelib.settings.nodeTooltipClass,
            title: function () {
                var d = this.__data__;
                return _clusteringNodeProvider.getNodeTooltip(d);
            },
            gravity: $.fn.tipsy.autoWE
        });

        $('#' + this.el.attr('id') + ' svg g.label').tipsy({
            html: true,
            fade: false,
            hoverlock: true,
            delayIn: _stylelib.settings.tooltipDelay,
            tipsyClass: _stylelib.settings.nodeTooltipClass,
            title: function () {
                var d = this.__data__;
                return _labellib.getLabelTooltip(d);
            },
            gravity: $.fn.tipsy.autoWE
        });

        $('#' + this.el.attr('id') + ' svg g.links path').tipsy({
            html: true,
            fade: false,
            hoverlock: true,
            delayIn: _stylelib.settings.tooltipDelay,
            tipsyClass: _stylelib.settings.linkTooltipClass,
            title: function () {
                var d = this.__data__;
                return (d.tooltip == undefined) ? undefined : d.tooltip;
            },
            gravity: $.fn.tipsy.autoNS
        });

        if (fisheye) {
            this.vis.on("mousemove", function () {
                fisheye.center(d3.mouse(this));

                node
                    .each(function (d) { d.display = fisheye(d); d.display.r = d.display.z * 10; })
                    .attr("transform", function (d) {
                        return "translate(" + d.display.x + "," + d.display.y + ")";
                    });

                this.vis.selectAll("g.node circle").attr('r', function (d) { return _clusteringNodeProvider.getNodeRadius(d); });

                link.attr("d", function (d) { return _clusteringNodeProvider.calculatePath(d, true); });
            });
        }

        force.on("tick", function (e) {
            if (self.fixedMode)
                return;

            if (self.settings.preventCollisions)
                node.each(collide(0.5));

            // FIX FOR IE10/11 WHERE THE MARKERS DON'T GET MOVED WITH THE LINES
            if(navigator.appVersion.indexOf("MSIE 10") != -1 || ($.browser.mozilla && parseInt($.browser.version, 10) == 11))
                link.each(function() { this.parentNode.insertBefore(this, this); });

            // calculate graph center
            var center = self.getCenter();

            c.attr("d", function (d) { return curve(d.makeHull()); })

            // Update links
            link
                .attr('d', function (d) { return _clusteringNodeProvider.calculatePath(d); });

            // These are used to detemine the bounding box if we're doing fit-to-screen
            var minX, maxX, minY, maxY;

            // Update nodes
            node
                .attr("transform", function (d) {
                    if(self.settings.constrainNodes) {
                        if(d.x < d.radius)
                            d.x = d.radius;
                        if(d.y < d.radius)
                            d.y = d.radius;
                        if(d.x > self.width - d.radius)
                            d.x = self.width - d.radius;
                        if(d.y > self.height - d.radius)
                            d.y = self.height - d.radius;
                    }
                    
                    if (!minX || minX > d.x - d.radius) minX = d.x - d.radius;
                    if (!maxX || maxX < d.x + d.radius) maxX = d.x + d.radius;
                    if (!minY || minY > d.y - d.radius) minY = d.y - d.radius;
                    if (!maxY || maxY < d.y + d.radius) maxY = d.y + d.radius;

                    return "translate(" + d.x + "," + d.y + ")";
                });

            // Update labels
            self.d3()
                .selectAll('g.label')
                .attr('transform', function (node) { return _labellib.transformLabel(node, center); });

            self.d3()
                .selectAll('g.label text')
                .attr('text-anchor', function (node) { return self.settings.embedLabels ? 'middle' : (RTL ? (node.x < center.x ? 'start' : 'end') : (node.x < center.x ? 'end' : 'start')); });

            if (fitToScreenCounter > 0 && self.zoomer) {
                fitToScreenCounter -= 1;
                
                var bbox = {
                    width: maxX - minX + 10,
                    height: maxY - minY + 10
                };
                
                var newScaleX = w / bbox.width;
                var newScaleY = h / bbox.height;
                var newScale = Math.min(newScaleX, newScaleY);
    
                // Don't zoom in too much automatically...
                newScale = Math.min(newScale, 2);
    
                var scaledWidth = bbox.width * newScale;
                var scaledHeight = bbox.height * newScale;
                
                var x = (w - scaledWidth) / 2 - minX * newScale;
                var y = (h - scaledHeight) / 2 - minY * newScale;
                
                self.zoomer.transform(newScale, [x, y]);
                
                //self.scale = newScale;
                //self.trans = [x, y];
                
                //self.vis.attr('transform', 'translate(' + self.trans + ') scale(' + self.scale + ')');

            }
        });

        // Restart the force layout.
        if(!this.fixedMode)
            force.start();

        this.updateLabels();

        this.updateSizesForZoom(this.scale);
    };

    this.updateSizesForZoom = function (scale) {
        _clusteringNodeProvider.updateSizesForZoom(scale);
        _labellib.updateLabelSizesForZoom(scale);
    }

    this.updateNodeColors = function () {
        _clusteringNodeProvider.updateNodeColors();
    }

    this.updateLinkColors = function () {
        _clusteringNodeProvider.updateLinkColors();
    }

    this.updateTooltips = function () {
        this.d3().selectAll('g.nodes circle').each(function (d) { d.tooltip = _clusteringNodeProvider.getNodeTooltip(d); });
    };

    this.updateLabels = function() {
        var self = this;
        var center = this.getCenter();
        this.d3()
            .selectAll('g.label text')
            .attr('fill', function (d) { return _clusteringNodeProvider.getNodeBorderColor(d); /*LABEL FIX:_labellib.getLabelColor(d);*/ })
            .attr('text-anchor', function (node) { return self.settings.embedLabels ? 'middle' : (node.x < center.x ? 'end' : 'start'); });
    };

    this.setTooltipDelay = function (value) {
        _stylelib.settings.tooltipDelay = value;

        $('#' + this.el.attr('id') + ' svg circle').each(function (i, a) {
            var tipsy = $.data(a, 'tipsy');
            if (tipsy)
                tipsy.options.delayIn = value;
        });
    };

    this.stop = function () {
        if (d3.event)
            d3.event.stopPropagation();

        if (!self.force)
            return;

        self.force.stop();
        self.fixedMode = true;
    };

    this.start = function () {
        // turn off fixed mode
        self.fixedMode = false;
        this._nodes.each(function(n) { n.fixed = false; });

        // and resume the forces
        if (self.force)
            self.force.resume();
    };

    /* Node methods */

    this.animateNodeClick = function(node, callback) {
        return _clusteringNodeProvider.animateNodeClick(node, 100, callback);
    };

    this.addNode = function (settings) {
        return _clusteringNodeProvider.addNode(settings);
    };

    this.removeNode = function (id, tag, forceRemove) {
        return _clusteringNodeProvider.removeNode(id, tag, forceRemove);
    };

    this.removeNodeByIndex = function (index) {
        return _clusteringNodeProvider.removeNodeByIndex(index);
    }

    this.setNodeTitle = function (node, title) {
        return _clusteringNodeProvider.setNodeTitle(node, title);
    };

    this.updateNodeColors = function () {
        return _clusteringNodeProvider.updateNodeColors();
    }

    this.moveNodes = function (positions, time, ignoreLinks) {
        return _clusteringNodeProvider.moveNodes(positions, time, ignoreLinks);
    };

    this.getNode = function (id) {
        return _clusteringNodeProvider.getNode(id);
    };

    this.getNodeByTitle = function(title) {
        return _clusteringNodeProvider.getNodeByTitle(title);
    };

    this.getNodeColor = function (d) {
        return _clusteringNodeProvider.getNodeColor(d);
    }

    this.getNodeBorderColor = function (d, opacity) {
        return _clusteringNodeProvider.getNodeBorderColor(d, opacity);
    }

    this.viewClusters = function (pct) {
        return _clusteringNodeProvider.viewClusters(pct);
    };

    /* End node methods */

    /* Link methods */

    this.updateMarkers = function () { _clusteringNodeProvider.updateMarkers(); }
    this.getMarkerUrl = function (d) { return _clusteringNodeProvider.getMarkerUrl(d); }

    this.addLink = function (options) { return _clusteringNodeProvider.addLink(options); };
    this.removeLink = function (from, to) { return _clusteringNodeProvider.removeLink(from, to); };
    this.getSharedLinks = function (nodes) { return _clusteringNodeProvider.getSharedLinks(nodes); };
    this.calculatePath = function (d, b) { return _clusteringNodeProvider.calculatePath(d, b); }
    this.getLinkColor = function (d, minColor, maxColor) { return _clusteringNodeProvider.getLinkColor(d, minColor, maxColor); }
    this.getLinkWidth = function (d) { return _clusteringNodeProvider.getLinkWidth(d); }

    /* End link methods */

    /* Cluster methods */

    this.setCluster = function (clusterId, title, color) { return _clusteringNodeProvider.setCluster(clusterId, title, color); }
    this.updateClusters = function () { return _clusteringNodeProvider.updateClusters(); }

    /* End cluster methods */

    /* Highlight methods */

    this.fadeOut = function (time, callback) {
        return _highlightlib.fadeOut(time, callback);
    };

    this.fadeIn = function (time, callback) {
        return _highlightlib.fadeIn(time, callback);
    };

    this.animateLine = function(x1, y1, x2, y2, color, time, thickness) {
        return _highlightlib.animateLine(x1, y1, x2, y2, color, time, thickness);
    };

    this.displayNodes = function(options) {
        return _highlightlib.displayNodes(options);
    };
    /* End highlight methods */

    this.showLabels = function(top) {
        return _labellib.showTop(top);
    };

    this.getImage = function() {
        var el = this.el.find('svg');

        $('#canvas').css({ width: el.width(), height: el.height() });
        var html = new XMLSerializer().serializeToString(el[0]);
        canvg('canvas', html);
        return document.getElementById('canvas').toDataURL('image/png');
    };

    // Start it
    this.update();
}
