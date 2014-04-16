//[of]:Util
//[c]Util

TypeChecker = {
    enabled: false,
    logToConsole: false,
    
    // if strongCheck is true, no properties are allowed but the ones specified.
    checkProperties: function (object, requiredProperties, optionalProperties, strongCheck) {
        if (!this.enabled) return;

        var log = this.logToConsole ? function (m) { console.log(m); } : function () {};
        
        var keys = _.keys(object);

        var requiredNames = _.pluck(requiredProperties, "propertyName");
        _.each(requiredNames, function (n) { 
            if (keys.indexOf(n) === -1) {
                var errorMessage = "Required property '" + n + "' was not found";
                log(errorMessage);
                throw new Meteor.Error(errorMessage); 
            }
        });

        if (strongCheck) {
            var legalNames = requiredNames.concat(_.pluck(optionalProperties, "propertyName"));

            _.each(keys, function (k) { 
                if (legalNames.indexOf(k) === -1) {
                    var errorMessage = "Property '" + k + "' is not among allowed properties";
                    log(errorMessage);
                    throw new Meteor.Error(errorMessage); 
                }
            });
        }            
        
        var validators = {};
        _.each(requiredProperties.concat(optionalProperties), function (p) { validators[p.propertyName] = p; });
        
        _.each(object, function (val, key) { 
            if (!validators[key].validate(val)) {
                var errorMessage = "Property '" + key + "' should be a " + validators[key].typeName + ". Value was: " + val;
                log(errorMessage);
                throw new Meteor.Error(errorMessage); 
            }
        });
    },
    
    object: function(propertyName) {
        return {
            typeName: "object",
            propertyName: propertyName,
            validate: function (value) { return typeof value === "object";  }
        }
    },
    
    string: function(propertyName) {
        return {
            typeName: "string",
            propertyName: propertyName,
            validate: function (value) { return _.isNull(value) || typeof value === "string";  }
        }
    },
    
    number: function(propertyName) {
        return {
            typeName: "number",
            propertyName: propertyName,
            validate: function (value) { return typeof value === "number";  }
        }
    },
    
    boolean: function(propertyName) {
        return {
            typeName: "boolean",
            propertyName: propertyName,
            validate: function (value) { return typeof value === "boolean";  }
        }
    },

    color: function(propertyName) {
        return {
            typeName: "color",
            propertyName: propertyName,
            validate: function (value) { return !_.isUndefined(value);  }   // TODO: Validate that this is indeed a color.. 
        }
    }
};

//[cf]
//[of]:Renderer
//[c]Renderer

//[of]:Classes fed to renderer
//[c]Classes fed to renderer

NodeCircle = function (id, data) {
    this.id = id;
    this.data = data;
};

// These properties must be present for rendering
NodeCircle.prototype.propertyTypes = [
    TypeChecker.string("id"),
    TypeChecker.object("data"),
    TypeChecker.number("x"), // Note: x and y are NOT scaled to screen space because they are manipulated by d3.force
    TypeChecker.number("y"), // Scaling takes place in SvgRenderer.update, which is why it takes the scales as parameters.
    TypeChecker.number("radius"),
    TypeChecker.color("color"),
    TypeChecker.color("borderColor"),
    TypeChecker.number("borderWidth"),
    TypeChecker.number("opacity"),
    TypeChecker.string("hoverText"),
    TypeChecker.boolean("fixed"),
    TypeChecker.object("eventHandlers")
];

// These are added to nodes by d3.force, so we should allow them
NodeCircle.prototype.optionalPropertyTypes = [
    TypeChecker.number("index"), 
    TypeChecker.number("px"), 
    TypeChecker.number("py"), 
    TypeChecker.number("weight")
];

// Update certain properties on the NodeCircle. Type checking makes sure no unknown properties are added (if it's enabled)
NodeCircle.prototype.updateProperties = function (properties) {
    TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
    _.extend(this, properties);
}

LinkLine = function (id, data, source, target, width, color, opacity, marker, curvature, dashPattern, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.source = source;   // These should be NodeCircle instances
    this.target = target;       // - " -
    this.width = width;
    this.color = color;
    this.opacity = opacity;
    this.marker = marker;
    this.curvature = curvature;     // Radians to curve at the center. Negative for counter-clockwise curvature. 0 for a straight line.
    this.dashPattern = dashPattern;
    this.hoverText = hoverText;
    this.eventHandlers = eventHandlers;
};

LabelText = function (id, data, text, x, y, offsetX, offsetY, anchor, fontSize, color, borderColor, opacity, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.text = text;
    this.x = x;
    this.y = y;
    this.offsetX = offsetX;    // When text-anchor is "end" or "auto" that computes to end, this will be negated.
    this.offsetY = offsetY;
    this.anchor = anchor;   // text-anchor attribute (start | middle | end), but can also be set to "auto".
    this.fontSize = fontSize;
    this.color = color;
    this.borderColor = borderColor;
    this.opacity = opacity;
    this.hoverText = hoverText;
    this.eventHandlers = eventHandlers;
};

ClusterHull = function (id, data, nodeCircles, color, borderColor, opacity, hoverText, eventHandlers) {
    this.id = id;
    this.data = data;
    this.nodeCircles = nodeCircles;
    this.color = color;
    this.borderColor = borderColor;
    this.opacity = opacity;
    this.hoverText = hoverText;
    this.eventHandlers = eventHandlers;
};

//[cf]

SvgRenderer = function (containerElement, options) {
    var layerIds = ["clusters", "links", "nodes", "labels", "ui"];  // First one becomes the bottom layer
    
    var svg, defs;
    var layers = {};
    var previousRadiusFactor;   // Used to check if we need to update sizes
    
    var width = containerElement.width();
    var height = containerElement.height();

    this.containerElement = function () { return containerElement; };
    this.width = function () { return width; };
    this.height = function () { return height; };

    //[of]:    function makeHull(d, xScale, yScale) {
    function makeHull(d, xScale, yScale, radiusFactor) {
        var nodes = d.nodeCircles;
        var nodePoints = [];
    
        _.each(nodes, function (n) {
            var offset = (n.radius || 5) * radiusFactor;
            var x = n.x || 0;
            var y = n.y || 0;
            nodePoints.push([xScale(x) - offset, yScale(y) - offset]);
            nodePoints.push([xScale(x) - offset, yScale(y) + offset]);
            nodePoints.push([xScale(x) + offset, yScale(y) - offset]);
            nodePoints.push([xScale(x) + offset, yScale(y) + offset]);
        });
    
        var clusterCurve = d3.svg.line()
            .interpolate("cardinal-closed")
            .tension(0.85);
    
        return clusterCurve(d3.geom.hull(nodePoints));
    }
    //[cf]
    //[of]:    function makeLinkPath(d, xScale, yScale, radiusFactor) {
    function makeLinkPath(d, xScale, yScale, radiusFactor) {
        var sx = xScale(d.source.x);
        var sy = yScale(d.source.y);
        var tx = xScale(d.target.x);
        var ty = yScale(d.target.y);
    
        if (d.curvature === 0) {
            if (sx === tx && sy === ty)
                return null;
    
            var sr = (d.source.radius + d.source.borderWidth) * radiusFactor;
            var tr = (d.target.radius + d.target.borderWidth) * radiusFactor;
    
            var a = tx - sx, b = ty - sy;
            var centerDist = Math.sqrt(a*a + b*b);
            
            var normalizedVectorX = (tx - sx) / centerDist;
            var normalizedVectorY = (ty - sy) / centerDist;
            
            var rsx = sx + sr * normalizedVectorX;
            var rsy = sy + sr * normalizedVectorY;
            var rtx = tx - tr * normalizedVectorX;
            var rty = ty - tr * normalizedVectorY;
            
            var result = "M " + rsx + " " + rsy + " L " + rtx + " " + rty;
            
            if(result.indexOf("NaN") !== -1)
                console.log("STOP");
            
            return result;
        } else {
            //[of]:        Original curve
            //[c]Original curve
            
            var dir = true;
            
            var sr = (d.source.radius + d.source.borderWidth) * radiusFactor,
                tr = (d.target.radius + d.target.borderWidth) * radiusFactor,
                dx = tx - sx,
                dy = ty - sy,
                dr = Math.sqrt(dx * dx + dy * dy) || 0.001,
                xs = dir ? sx + dx * (sr / dr) : sx,
                ys = dir ? sy + dy * (sr / dr) : sy,
                xt = dir ? tx - dx * (tr / dr) : tx,
                yt = dir ? ty - dy * (tr / dr) : ty;
            
            if(xs == xt && ys == yt)  // loop it
                return "M " + xs + " " + ys + " A 10 10 0 1 " + (xt > xs ? "1" : "0") + " " + (xt + 1) + " " + (yt + 1);
            
            // All of this logic comes from:
            // - http://www.kevlindev.com/gui/math/intersection/index.htm#Anchor-Introductio-4219 - for intersection of ellipse and circle
            // - http://www.w3.org/TR/SVG/implnote.html#ArcImplementationNotes - for calculating the center of the ellipse
            
            // calculate center of ellipse
            var x1p = (sx - tx) / 2;
            var y1p = (sy - ty) / 2;
            
            var sq = Math.sqrt(
                ((dr * dr * dr * dr) - (dr * dr * y1p * y1p) - (dr * dr * x1p * x1p)) /
                ((dr * dr * y1p * y1p) + (dr * dr * x1p * x1p)));
            
            if(xt < xs)
                sq *= -1;
            
            var cxp = sq * y1p;
            var cyp = sq * (-1 * x1p);
            var cx = cxp + (sx + tx) / 2;
            var cy = cyp + (sy + ty) / 2;
            
            var result = Intersection.intersectCircleEllipse({ x: tx, y: ty}, tr, { x: cx, y: cy }, dr, dr);
            if(result.points.length) {
                // find the correct point (closest to source) and use that as our target
                var min = 1000000;
                var pt;
                $.each(result.points, function(i, point) {
                    var dist = Math.sqrt(Math.pow(point.x - sx, 2) + Math.pow(point.y - sy, 2));
                    if(dist < min) {
                        min = dist;
                        pt = point;
                    }
                });
            
                if(pt) {
                    xt = pt.x;
                    yt = pt.y;
                }
            }
            
            result = Intersection.intersectCircleEllipse({ x: sx, y: sy}, sr, { x: cx, y: cy }, dr, dr);
            
            if(result.points.length) {
                // find the correct point (closest to source) and use that as our target
                var min = 1000000;
                var pt;
                $.each(result.points, function(i, point) {
                    var dist = Math.sqrt(Math.pow(point.x - tx, 2) + Math.pow(point.y - ty, 2));
                    if(dist < min) {
                        min = dist;
                        pt = point;
                    }
                });
                
                if(pt) {
                    sx = pt.x;
                    sy = pt.y;
                }
            }
            
            return "M " + sx + " " + sy + " A " + dr + " " + dr + " 0 0 " + (xt > xs ? "1" : "0") + " " + xt + " " + yt;
            //[cf]
            //[of]:        Simple curve
            //[c]Simple curve
            
            /*
            var sr = (d.source.radius + d.source.borderWidth) * radiusFactor;
            var tr = (d.target.radius + d.target.borderWidth) * radiusFactor;
            
            var a = tx - sx, b = ty - sy;
            var centerDist = Math.sqrt(a*a + b*b);
            
            var normalizedVectorX = (tx - sx) / centerDist;
            var normalizedVectorY = (ty - sy) / centerDist;
            
            var rsx = sx + sr * normalizedVectorX;
            var rsy = sy + sr * normalizedVectorY;
            var rtx = tx - tr * normalizedVectorX;
            var rty = ty - tr * normalizedVectorY;
            
            var dx = rtx - rsx,
                dy = rty - rsy,
                dr = Math.sqrt(dx * dx + dy * dy) * 2;
            
            return "M" + rsx + "," + rsy + "A" + dr + "," + dr + " 0 0,1 " + rtx + "," + rty;        
            */
            //[cf]
        }
    }
    
    
    //[cf]
    //[of]:    function linkTween(xScale, yScale, radiusFactor, d, i, a) {
    function linkTween(xScale, yScale, radiusFactor, d, i, a) {
        return function (b) {
            if(!d || !b)
                return a;
    
            // calculate the standard string-based interpolation value
            var path = makeLinkPath(d, xScale, yScale, radiusFactor);
            if(!path)
                return "";
    
            var x = d3.interpolateString(a, path);
    
            // fix the sweep-path value
            var result = x(b);
            var vals = result.split(' ');
            if (vals[3] == "A") {   // If this is a curved link
                vals[7] = Math.floor(parseFloat(vals[7]));
                vals[8] = Math.floor(parseFloat(vals[8]));
            }
            
            // and join it back together
            return vals.join(' ');
        }
    };
    //[cf]

    //[of]:    function makeMarkerDefs(linkLines) {
    function makeMarkerDefs(linkLines) {
        var sizeColorCombos = {};
        
        _.each(linkLines, function (ll) {
            if (ll.marker) {
                var size = ll.width.toFixed(0);
                var color = d3.rgb(ll.color).toString(); // This is necessary to convert "red" into "ff0000" etc.
                var opacity = ll.opacity;
                var sizeColorCombo = size + "-" + color.substr(1) + Math.floor(opacity * 255).toString(16);
                
                sizeColorCombos[sizeColorCombo] = { id: sizeColorCombo, size: size, color: color, opacity: opacity };
            }
        });
        
        return _.map(sizeColorCombos, function (sizeColorCombo, id) { return sizeColorCombo; });
    }
    //[cf]
    //[of]:    function getTextAnchor(labelText, xScale) {
    function getTextAnchor(labelText, xScale) {
        if (labelText.anchor === "auto") {
            return xScale(labelText.x) < width / 2 ? "end" : "start";
        } else {
            return labelText.anchor;
        }
    }
    //[cf]

    //[of]:    function attachEvents(selection, renderItems) {
    function attachEvents(selection, renderItems) {
        var dragBehavior;
    
        // We want to know all the different types of events that exist in any of the elements. This cryptic oneliner does that:
        var allEvents = _.uniq(_.flatten(_.map(_.pluck(renderItems, "eventHandlers"), function (eh) { return _.keys(eh); })));
    
        _.each(allEvents, function (ce) {
            if (ce === "click" || ce === "dblclick")
                return;
                
            if (ce === "dragstart" || ce === "drag" || ce === "dragend") {
                if (!dragBehavior) {
                    dragBehavior = d3.behavior.drag()
                        .origin(function() { 
                            var t = d3.select(this);
                            return {x: t.attr("x"), y: t.attr("y")};
                        })
                }
                
                dragBehavior.on(ce, function (d, i) {
                    d.eventHandlers[ce](d, i, d3.event);
                    //d3.event.stopPropagation();
                });    
            } else {
                selection.on(ce, function (d, i) { 
                    if (d.eventHandlers.hasOwnProperty(ce)) {
                        d.eventHandlers[ce](d, i, d3.event); 
                        d3.event.stopPropagation();
                    }
                });
            }
        });
    
        if (dragBehavior)
            selection.call(dragBehavior);
        
        var doubleClickDelay = 300;
        var singleClickTimer;
        var storedEvent;
        
        // Handle click and dblclick..
        selection.on("click", function (d, i) {
            if (d.eventHandlers.hasOwnProperty("click") && d.eventHandlers.hasOwnProperty("dblclick")) {
                if (singleClickTimer) {
                    d.eventHandlers.dblclick(d, i, d3.event);
                    clearTimeout(singleClickTimer);
                    singleClickTimer = null;
                } else {
                    storedEvent = d3.event;
                    singleClickTimer = setTimeout(function () {
                        d.eventHandlers.click(d, i, storedEvent);
                        singleClickTimer = null;
                    }, doubleClickDelay);
                }
                d3.event.stopPropagation();
            } else if (d.eventHandlers.hasOwnProperty("click")) {
                d.eventHandlers.click(d, i, d3.event);
                d3.event.stopPropagation();
            }
        });
        
        selection.on("dblclick", function (d, i) {
            if (d.eventHandlers.hasOwnProperty("dblclick") && !d.eventHandlers.hasOwnProperty("click")) {
                d.eventHandlers.dblclick(d, i, d3.event);
                d3.event.stopPropagation();
            }
        });
    }
    //[cf]
    
    //[of]:    this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration) {
    this.update = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration) {
        transitionDuration = transitionDuration === undefined ? 250 : transitionDuration;
        
        //[of]:    Clusters
        //[c]Clusters
        
        var cluster = layers.clusters.selectAll("path.cluster")
            .data(clusterHulls, function (d) { return d.id; });
        
        var clusterEnter = cluster.enter().append("svg:path");
        clusterEnter
            .attr("class", "cluster")
            .attr("data-id", function (d) { return d.id; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; })
            .style("opacity", 1e-6)
            .append("svg:title");
        
        attachEvents(clusterEnter, clusterHulls);
        
        cluster.exit().transition().duration(transitionDuration)
            .style("opacity", 1e-6)
            .remove();
        
        cluster.transition().duration(transitionDuration)
            .attr("d", function (d) { return makeHull(d, xScale, yScale, radiusFactor); })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        cluster.select("title")
            .text(function (d) { return d.hoverText; });    
        
        
        
        //[cf]
        //[of]:    Link markers
        //[c]Link markers
        
        var markerDefs = makeMarkerDefs(linkLines);
        
        var marker = defs.selectAll("marker.generated")
            .data(markerDefs, function (d) { return d.id })
        
        marker.enter()
            .append('svg:marker')
                .attr("id", function (d) { return "marker-" + d.id; })
                .attr("class", "generated")
                .attr('preserveAspectRatio', 'xMinYMin')
                .attr('markerUnits', 'userSpaceOnUse')
                .attr("orient", "auto")
            .append("svg:path");
        
        marker
                .attr("markerWidth", function (d) { return 5 * d.size * radiusFactor; })
                .attr("markerHeight", function (d) { return 3 * d.size * radiusFactor; })
                .attr("viewBox", function (d) { return  "0 0 " + (10 * d.size * radiusFactor) + " " + (10 * d.size * radiusFactor); })
                .attr("refX", function (d) { return 10 * d.size * radiusFactor; })
                .attr("refY", function (d) { return 10 * d.size * radiusFactor; })
                .attr("fill", function (d) { return d.color; })
                .attr("opacity", function (d) { return d.opacity; })
            .select("path")
                .attr("d", function (d) { return "M0,0L" + (10 * d.size * radiusFactor) + "," + (10 * d.size * radiusFactor) + "L0," + (10 * d.size * radiusFactor) + "z"});
        
        marker.exit()
            .remove();
        
        //[cf]
        //[of]:    Links
        //[c]Links
        
        var link = layers.links.selectAll("path.link")
            .data(linkLines, function (d) { return d.id; });
        
        var linkEnter = link.enter().append("svg:path");
        linkEnter.attr("class", "link")
            .attr("data-id", function (d) { return d.id; })
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .style("fill", "none")
            .append("svg:title");
        
        attachEvents(linkEnter, linkLines);
        
        link.exit().transition().duration(transitionDuration)
            .style("stroke-opacity", 1e-6)
            .style("stroke-width", 1e-6)
            .remove();
        
        link
            .attr("marker-end", function (d) { 
                if (!d.marker) return null;
                var sizeColorCombo =  + d.width.toFixed(0) + "-" + d3.rgb(d.color).toString().substr(1) + Math.floor(d.opacity * 255).toString(16);
                return "url(#marker-" + sizeColorCombo + ")";
            })
        
        link.transition().duration(transitionDuration)
            .attrTween("d", linkTween.bind(null, xScale, yScale, radiusFactor))
            .style("stroke-opacity", function (d) { return d.opacity; })
            .style("stroke-width", function (d) { return d.width * radiusFactor; })
            .style("stroke", function (d) { return d.color; });
            
        link.select("title")
            .text(function (d) { return d.hoverText; });    
        
        //[cf]
        //[of]:    Nodes
        //[c]Nodes
        
        if (TypeChecker.enabled) {
            _.each(nodeCircles, function (nc) { TypeChecker.checkProperties(nc, nc.propertyTypes, nc.optionalPropertyTypes, true); });
        }
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        var nodeEnter = node.enter().append("svg:circle");
        nodeEnter
            .attr("class", "node")
            .attr("data-id", function (d) { return d.id; })
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
            .attr("r", 1e-6)
            .style("opacity", 1e-6)
            .append("svg:title");
        
        attachEvents(nodeEnter, nodeCircles);
        
        node.exit().transition().duration(transitionDuration)
            .attr("r", 1e-6)
            .style("opacity", 1e-6)
            .remove();
        
        node.transition().duration(transitionDuration)
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
            .attr("r", function (d) { return d.radius * radiusFactor; })
            .style("stroke-width", function (d) { return d.borderWidth * radiusFactor; })
            .style("opacity", function (d) { return d.opacity; })
            .style("fill", function (d) { return d.color; })
            .style("stroke", function (d) { return d.borderColor; });
        
        node.select("title")
            .text(function (d) { return d.hoverText; });    
        
        //[cf]
        //[of]:    Labels
        //[c]Labels
        
        var label = layers.labels.selectAll("g.label")
            .data(labelTexts, function (d) { return d.id; });
        
        var labelEnter = label.enter().append("svg:g");
        labelEnter
            .attr("class", "label")
            .attr("data-id", function (d) { return d.id; })
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; })
            .style("opacity", 1e-6)
            .append("svg:text")
            .attr("x", function (d) { return d.offsetX * radiusFactor; })
            .attr("y", function (d) { return d.offsetY * radiusFactor; })
            .style("font-size", function (d) { return d.fontSize * radiusFactor; })
        
        attachEvents(labelEnter, labelTexts);
        
        label.exit().transition().duration(transitionDuration)
            .style("opacity", 1e-6)
            .remove();
        
        label.transition().duration(transitionDuration)
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; })
            .style("opacity", function (d) { return d.opacity; })
            .style("font-size", function (d) { return d.fontSize * radiusFactor; })
        
        label.select("text")
            .text(function (d) { return d.text; })
            .transition().duration(transitionDuration)
            .attr("text-anchor", function (d) { return getTextAnchor(d, xScale); })
            .attr("x", function (d) { return (getTextAnchor(d, xScale) === "end" ? -d.offsetX : d.offsetX) * radiusFactor; })
            .attr("y", function (d) { return d.offsetY * radiusFactor; })
            .style("fill", function (d) { return d.color; });
        //    .style("stroke-width", function (d) { return 0.5 * radiusFactor; })
        //    .style("stroke", function (d) { return d.borderColor; });
        
        //[cf]
        
        previousRadiusFactor = radiusFactor;
    };
    //[cf]
    //[of]:    this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor) {
    this.updatePositions = function (clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor) {
        //[of]:    Clusters
        //[c]Clusters
        
        var cluster = layers.clusters.selectAll("path.cluster")
            .data(clusterHulls, function (d) { return d.id; });
        
        cluster
            .attr("d", function (d) { return makeHull(d, xScale, yScale, radiusFactor); });
        
        //[cf]
        //[of]:    Link markers
        //[c]Link markers
        
        var markerDefs = makeMarkerDefs(linkLines);
        
        var marker = defs.selectAll("marker.generated")
            .data(markerDefs, function (d) { return d.id })
        
        marker.enter()
            .append('svg:marker')
                .attr("id", function (d) { return d.id; })
                .attr("class", "generated")
                .attr('preserveAspectRatio', 'xMinYMin')
                .attr('markerUnits', 'userSpaceOnUse')
                .attr("orient", "auto")
            .append("svg:path");
        
        marker
                .attr("markerWidth", function (d) { return 5 * d.size * radiusFactor; })
                .attr("markerHeight", function (d) { return 3 * d.size * radiusFactor; })
                .attr("viewBox", function (d) { return  "0 0 " + (10 * d.size * radiusFactor) + " " + (10 * d.size * radiusFactor); })
                .attr("refX", function (d) { return 10 * d.size * radiusFactor; })
                .attr("refY", function (d) { return 10 * d.size * radiusFactor; })
                .attr("fill", function (d) { return d.color; })
            .select("path")
                .attr("d", function (d) { return "M0,0L" + (10 * d.size * radiusFactor) + "," + (10 * d.size * radiusFactor) + "L0," + (10 * d.size * radiusFactor) + "z"});
        
        marker.exit()
            .remove();
        
        //[cf]
        //[of]:    Links
        //[c]Links
        
        var link = layers.links.selectAll("path.link")
            .data(linkLines, function (d) { return d.id; });
        
        link
            .attr("d", function (d) { return makeLinkPath(d, xScale, yScale, radiusFactor); })
        
        if (radiusFactor !== previousRadiusFactor) {
            link
                .style("stroke-width", function (d) { return d.width * radiusFactor; });
        }
        //[cf]
        //[of]:    Nodes
        //[c]Nodes
        
        if (TypeChecker.enabled) {
            _.each(nodeCircles, function (nc) { TypeChecker.checkProperties(nc, nc.propertyTypes, nc.optionalPropertyTypes, true); });
        }
        
        var node = layers.nodes.selectAll("circle.node")
            .data(nodeCircles, function (d) { return d.id; });
        
        node
            .attr("cx", function (d) { return xScale(d.x); })
            .attr("cy", function (d) { return yScale(d.y); })
        
        if (radiusFactor !== previousRadiusFactor) {
            node
                .attr("r", function (d) { return d.radius * radiusFactor; })
                .style("stroke-width", function (d) { return d.borderWidth * radiusFactor; });
        }
        //[cf]
        //[of]:    Labels
        //[c]Labels
        
        var label = layers.labels.selectAll("g.label")
            .data(labelTexts, function (d) { return d.id; });
        
        label
            .attr("transform", function (d) { return "translate(" + [xScale(d.x), yScale(d.y)] + ")"; });
        
        label.select("text")
            .attr("text-anchor", function (d) { return getTextAnchor(d, xScale); })
            .attr("x", function (d) { return (getTextAnchor(d, xScale) === "end" ? -d.offsetX : d.offsetX) * radiusFactor; })
            .attr("y", function (d) { return d.offsetY * radiusFactor; })
            .style("font-size", function (d) { return d.fontSize * radiusFactor; });
        
        //[cf]
        
        previousRadiusFactor = radiusFactor;
    };
    //[cf]
    
    //[of]:    function initialize() {
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
    //[cf]
    initialize();
};
//[cf]
//[of]:GraphVis
//[c]GraphVis

//[of]:Classes fed to GraphVis
//[c]Classes fed to GraphVis

VisNode = function (id, data, clusterId) {
    this.id = id;
    this.data = data;
    this.clusterId = clusterId;
};

VisLink = function (sourceNodeId, targetNodeId, data) {
    this.sourceNodeId = sourceNodeId;
    this.targetNodeId = targetNodeId;
    this.data = data;
};

VisCluster = function (id, data, isCollapsed) {
    this.id = id;
    this.data = data;
    this.isCollapsed = isCollapsed;
};


//[cf]

//[of]:defaultGraphVisOptions = {

// This one simply returns interpolated values between the two nodes.
// If a node is hovered, links that point to it will have markers.
defaultLinkDescriber = function (visLink, sourceNodeCircle, targetNodeCircle, radiusFactor) {
    return {
        width: (sourceNodeCircle.radius + targetNodeCircle.radius) / 10,
        color: d3.interpolateRgb(sourceNodeCircle.color, targetNodeCircle.color)(0.5),
        opacity: (sourceNodeCircle.opacity + targetNodeCircle.opacity) / 2,
    };
};

defaultCollapsedClusterDescriber = function () {
    return {
        
    }
};

defaultExpandedClusterDescriber = function () {
};

defaultGraphVisOptions = {
    // General settings
    enableZoom: true,
    enablePan: true,
    enableForce: true,
    forceParameters: {
        linkDistance: 20,
        linkStrength: 1,
        friction: 0.9,
        charge: -30,
        chargeDistance: Infinity,
        theta: 0.8,
        gravity: 0.1
    },
    enableCollisionDetection: true,
    enableClusterForce: false,
    zoomExtent: [0.25, 4],
    zoomDensityScale: d3.scale.linear().domain([0.25, 4]).range([0.5, 2]),
    updateOnlyPositionsOnZoom: true,        // If false, a complete update() will take place during zoom. More flexible but slower.
    updateOnlyPositionsOnTick: true,        // Likewise, for force ticks.

    // Event handling
    onUpdatePreProcess: null,
    onUpdatePreRender: null,
    onClick: null,
    onNodeClick: null,
    onNodeDoubleClick: null,
    onNodeMouseOver: null,
    onNodeMouseOut: null,
    onNodeDragStart: null,
    onNodeDrag: null,
    onNodeDragEnd: null,
    onClusterNodeClick: null,
    onClusterNodeDoubleClick: null,     // If unset, will default to "expand cluster".
    onClusterNodeMouseOver: null,
    onClusterNodeMouseOut: null,
    onClusterNodeDragStart: null,
    onClusterNodeDrag: null,
    onClusterNodeDragEnd: null,
    onLinkClick: null,
    onLinkDoubleClick: null,
    onLinkMouseOver: null,
    onLinkMouseOut: null,
    onClusterClick: null,
    onClusterDoubleClick: null, // If unset, will default to "collapse cluster".
    onClusterMouseOver: null,
    onClusterMouseOut: null,
    
    // Visual element describing
    
    defaultNodeDescription: {
        radius: 10,
        color: "#888",
        borderColor: "#333",
        borderWidth: 2,
        opacity: 1,
        hoverText: null,
        label: null,
        fixed: false
    },
    describeVisNode: null,

    defaultLinkDescription: {
        width: 1,
        color: "#333",
        opacity: 1,
        marker: false,
        curvature: 0,
        dashPattern: null,
        hoverText: null
    },
    describeVisLink: defaultLinkDescriber,

    // Collapsed clusters become node circles
    defaultCollapsedClusterDescription: {
        radius: 20,
        color: "#aaa",
        borderColor: "#fff",
        borderWidth: 2,
        opacity: 1,
        hoverText: null,
        label: null,
        fixed: false
    },
    describeCollapsedCluster: defaultCollapsedClusterDescriber,

    // Expanded clusters become cluster hulls
    defaultExpandedClusterDescription: {
        color: "#a88",
        borderColor: null,
        opacity: 0.2,
        hoverText: null
    },
    describeExpandedCluster: defaultExpandedClusterDescriber,
};
//[cf]

GraphVis = function (renderer, options) {
    var self = this;
    options = $.extend(true, {}, defaultGraphVisOptions, options);

    var xScale = d3.scale.linear()
        .domain([0, renderer.width()])
        .range([0, renderer.width()]);

    var yScale = d3.scale.linear()
        .domain([0, renderer.height()])
        .range([0, renderer.height()]);

    var zoomDensityScale = options.zoomDensityScale;
    var radiusFactor = zoomDensityScale(1);

    var zoomBehavior = d3.behavior.zoom()
        .x(xScale)
        .y(yScale)
        .scaleExtent(options.zoomExtent)
        .on("zoom", function () { 
            radiusFactor = zoomDensityScale(zoomBehavior.scale());
            
            if (options.updateOnlyPositionsOnZoom)
                self.updatePositions("zoom");
            else
                self.update(null, null, null, 0);

            if (options.enableForce && force)
                force.resume();
            
            d3.event.sourceEvent.stopPropagation();
        });

    var visNodes, visLinks, visClusters;
    
    var clusterHulls = [];
    var linkLines = [];
    var nodeCircles = [];
    var labelTexts = [];
    
    var force;

    //[of]:    function clusterHullFromVisCluster(visCluster) {
    function clusterHullFromVisCluster(visCluster) {
        var color = "#888";
        var borderColor = d3.rgb(color).darker(1);
        var opacity = 0.2;
        var hoverText = "";
    
        if (options.describeVisCluster) {
            var description = options.describeVisCluster(visCluster, [], radiusFactor); // TODO: Give nodecircles along
    
            if (description.color) color = description.color;
            if (description.opacity) opacity = description.opacity;
            if (description.hoverText) hoverText = description.hoverText;
        }
    
        var eventHandlers = {
            "dblclick": function (d) { 
                visCluster.isCollapsed = true;
                self.update();
            }
        };
    
        return new ClusterHull(visCluster.id, visCluster, [], color, borderColor, opacity, hoverText, eventHandlers);
    }
    
    //[cf]
    //[of]:    function labelTextFromLabelDescription(label, id, nodeCircleX, nodeCircleY, nodeCircleColor, nodeCircleBorderColor, nodeCircleOpacity) {
    function labelTextFromLabelDescription(label, id, x, y, nodeCircleColor, nodeCircleBorderColor, nodeCircleOpacity) {
        var offsetX = _.isUndefined(label.offsetX) ? 0 : label.offsetX;
        var offsetY = _.isUndefined(label.offsetY) ? 0 : label.offsetY;
        var anchor = label.anchor || "start";
        var fontSize = label.fontSize || 14;
        var color = label.color || nodeCircleColor;
        var borderColor = label.borderColor || nodeCircleBorderColor;
        var opacity = _.isUndefined(label.opacity) ? nodeCircleOpacity : description.opacity;
        var hoverText = label.hoverText;
        
        var eventHandlers = {};
    
        return new LabelText(id, null, label.text, x, y, offsetX, offsetY, anchor, fontSize, color, borderColor, opacity, hoverText, eventHandlers);
    }
    //[cf]
    //[of]:    function nodeCircleAndLabelTextFromVisNode(visNode) {
    function nodeCircleAndLabelTextFromVisNode(visNode) {
        var nodeCircle, labelText;
        var id = visNode.id;
    
        var oldNodeCircle = _.find(nodeCircles, function (nc) { return nc.id === id; });
        if (oldNodeCircle)
            nodeCircle = oldNodeCircle;
        else {
            nodeCircle = new NodeCircle(id, visNode);
    
            nodeCircle.eventHandlers = {};    
            if (options.onNodeClick) { nodeCircle.eventHandlers.click = options.onNodeClick; }
            if (options.onNodeDoubleClick) { nodeCircle.eventHandlers.dblclick = options.onNodeDoubleClick; }
            if (options.onNodeMouseOver) { nodeCircle.eventHandlers.mouseover = options.onNodeMouseOver; }
            if (options.onNodeMouseOut) { nodeCircle.eventHandlers.mouseout = options.onNodeMouseOut; }
            if (options.onNodeDragStart) { nodeCircle.eventHandlers.dragstart = options.onNodeDragStart; }
        }
    
        var dynamicDescription = options.describeVisNode ? options.describeVisNode(visNode, radiusFactor) : {};
        var description = _.extend({}, options.defaultNodeDescription, dynamicDescription);
    
        if (!_.isNumber(nodeCircle.x) || !_.isNumber(nodeCircle.y)) {
            if (description.x)
                nodeCircle.x = description.x;
            else {
                var w = renderer.width();
                nodeCircle.x = w / 2 + (Math.random() * (w / 2) - w / 4);
            }
            
            if (description.y) 
                nodeCircle.y = description.y;
            else {
                var h = renderer.height();
                nodeCircle.y = h / 2 + (Math.random() * (h / 2) - h / 4);
            }
        }
    
        if (!_.isUndefined(description.label)) {
    
            // It might be defined, but still null so check for that as well.
            if (!_.isNull(description.label))
                labelText = labelTextFromLabelDescription(description.label, id, nodeCircle.x, nodeCircle.y, description.color, description.borderColor, description.opacity);
    
            delete description.label;
        }
    
        nodeCircle.updateProperties(description);
    
        return {
            nodeCircle: nodeCircle,
            labelText: labelText
        };
    }
    //[cf]
    //[of]:    function nodeCircleAndLabelTextFromCollapsedCluster(visCluster, clusterVisNodes) {
    function nodeCircleAndLabelTextFromCollapsedCluster(visCluster, clusterVisNodes, clusterVisLinks) {
        var nodeCircle, labelText;
        var id = "placeholder-" + visCluster.id;
    
        var oldNodeCircle = _.find(nodeCircles, function (nc) { return nc.id === id; });
        if (oldNodeCircle)
            nodeCircle = oldNodeCircle;
        else {
            nodeCircle = new NodeCircle(id, { visCluster: visCluster, visNodes: clusterVisNodes, visLinks: clusterVisLinks });
    
            nodeCircle.eventHandlers = {};    
            if (options.onClusterNodeClick) { nodeCircle.eventHandlers.click = options.onClusterNodeClick; }
            
            if (options.onClusterNodeDoubleClick) { 
                nodeCircle.eventHandlers.dblclick = options.onClusterNodeDoubleClick; 
            } else {
                nodeCircle.eventHandlers.dblclick = function (d) { visCluster.isCollapsed = false; self.update(); }
            }
            
            if (options.onClusterNodeMouseOver) { nodeCircle.eventHandlers.mouseover = options.onClusterNodeMouseOver; }
            if (options.onClusterNodeMouseOut) { nodeCircle.eventHandlers.mouseout = options.onClusterNodeMouseOut; }
            if (options.onClusterNodeDragStart) { nodeCircle.eventHandlers.dragstart = options.onClusterNodeDragStart; }
        }
    
        var dynamicDescription = options.describeCollapsedCluster ? options.describeCollapsedCluster(visCluster, radiusFactor) : {};
        var description = _.extend({}, options.defaultCollapsedClusterDescription, dynamicDescription);
    
        if (!_.isNumber(nodeCircle.x) || !_.isNumber(nodeCircle.y)) {
            if (description.x)
                nodeCircle.x = description.x;
            else {
                var w = renderer.width();
                nodeCircle.x = w / 2 + (Math.random() * (w / 2) - w / 4);
            }
            
            if (description.y) 
                nodeCircle.y = description.y;
            else {
                var h = renderer.height();
                nodeCircle.y = h / 2 + (Math.random() * (h / 2) - h / 4);
            }
        }
    
        if (!_.isUndefined(description.label)) {
    
            // It might be defined, but still null so check for that as well.
            if (!_.isNull(description.label))
                labelText = labelTextFromLabelDescription(description.label, id, nodeCircle.x, nodeCircle.y, description.color, description.borderColor, description.opacity);
    
            delete description.label;
        }
    
        nodeCircle.updateProperties(description);
    
        return {
            nodeCircle: nodeCircle,
            labelText: labelText
        };
    }
    //[cf]
    //[of]:    function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
    function linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle) {
        var description = options.defaultLinkDescription;
    
        if (options.describeVisLink) {
            var d = options.describeVisLink(visLink, sourceNodeCircle, targetNodeCircle, radiusFactor);
            description = _.extend({}, description, d);
        }
    
        var linkLine = new LinkLine(sourceNodeCircle.id + "->" + targetNodeCircle.id, 
            visLink, 
            sourceNodeCircle, 
            targetNodeCircle, 
            description.width, 
            description.color, 
            description.opacity, 
            description.marker,
            description.curvature,
            description.dashPattern, 
            description.hoverText,
            {});
    
        return linkLine;
    }
    //[cf]
    //[of]:    function linkLineFromClusterLinks(nodePairs) {
    function  linkLineFromClusterLink(sourceNodeCircle, targetNodeCircle, visLinks) {
        var width = 2;
        var color = "#0f0";
        var opacity = 1;
        var marker = false;
        var dashPattern = null;
        var curvature = 0;
        var hoverText = "";
    
        var linkLine = new LinkLine(sourceNodeCircle.id + "->" + targetNodeCircle.id, 
            visLinks, 
            sourceNodeCircle,
            targetNodeCircle,
            width, 
            color, 
            opacity, 
            marker,
            curvature,
            dashPattern, 
            hoverText,
            {});
    
        return linkLine;    
    }
    //[cf]

    //[of]:    this.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration, updateType) {
    this.update = function (newVisNodes, newVisLinks, newVisClusters, transitionDuration, updateType) {
        if (newVisNodes) visNodes = newVisNodes;
        if (newVisLinks) visLinks = newVisLinks;
        if (newVisClusters) visClusters = newVisClusters;
        if (_.isUndefined(transitionDuration)) transitionDuration = 250;
        if (!updateType) updateType = "update";
    
        if (options.onUpdatePreProcess) {
            var params = {
                visNodes: visNodes,
                visLinks: visLinks,
                visClusters: visClusters,
                transitionDuration: transitionDuration
            };
            
            options.onUpdatePreProcess(params, "update");
            
            visNodes = params.visNodes;
            visLinks = params.visLinks;
            visClusters = params.visClusters;
            transitionDuration = params.transitionDuration;
        }
    
        //[of]:    Create cluster hulls
        //[c]Create cluster hulls
        
        var newClusterHulls = [];   // We'll only create hulls for expanded clusters
        var collapsedClusters = {};  // Collapsed ones go in here to turn into placeholder NodeCircles
        _.each(visClusters, function (vc) {
            if (!vc.isCollapsed)
                newClusterHulls.push(clusterHullFromVisCluster(vc));
            else
                collapsedClusters[vc.id] = { visNodes: [], visLinks: [] };
        });
        //[cf]
        //[of]:    Create node circles and label texts
        //[c]Create node circles and label texts
        
        var newNodeCircles = [];
        var newLabelTexts = [];
        _.each(visNodes, function (visNode) {
            if (visNode.clusterId) {
                var clusterHull = _.find(newClusterHulls, function (ch) { return ch.id === visNode.clusterId; });
                
                if (clusterHull) {
                    var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                    var nodeCircle = nodeCombination.nodeCircle;
                    newNodeCircles.push(nodeCircle);
                    clusterHull.nodeCircles.push(nodeCircle);
        
                    if (nodeCombination.labelText)
                        newLabelTexts.push(nodeCombination.labelText);
                } else {
                    if (!collapsedClusters.hasOwnProperty(visNode.clusterId))
                        throw "Node '" + visNode.id + "' refers to a cluster '" + visNode.clusterId + "' that wasn't defined";
                    
                    collapsedClusters[visNode.clusterId].visNodes.push(visNode);
                }
            } else {
                var nodeCombination = nodeCircleAndLabelTextFromVisNode(visNode);
                newNodeCircles.push(nodeCombination.nodeCircle);
                if (nodeCombination.labelText)
                    newLabelTexts.push(nodeCombination.labelText);
            }
        });
        
        _.each(collapsedClusters, function (collapsedCluster, clusterId) {
            var visCluster = _.find(visClusters, function (vc) { return vc.id === clusterId; });
            var nodeCombination = nodeCircleAndLabelTextFromCollapsedCluster(visCluster, collapsedCluster.visNodes, collapsedCluster.visLinks);
            newNodeCircles.push(nodeCombination.nodeCircle);
            if (nodeCombination.labelText)
                newLabelTexts.push(nodeCombination.labelText);
        });
        //[cf]
        //[of]:    Create link lines
        //[c]Create link lines
        
        var clusterLinks = {};
        
        var newLinkLines = [];
        _.each(visLinks, function (visLink) {
            var sourceVisNode = _.find(visNodes, function (vn) { return vn.id === visLink.sourceNodeId; });
            if (!sourceVisNode)
                throw "Link refers to a source node '" + visLink.sourceNodeId + "' that wasn't found";
        
            var targetVisNode = _.find(visNodes, function (vn) { return vn.id === visLink.targetNodeId; });
            if (!targetVisNode)
                throw "Link refers to a target node '" + visLink.targetNodeId + "' that wasn't found";
        
            var sourceVisCluster, targetVisCluster;
            if (sourceVisNode.clusterId)
                sourceVisCluster = _.find(visClusters, function (vc) { return vc.id === sourceVisNode.clusterId; });
        
            if (targetVisNode.clusterId)
                targetVisCluster = _.find(visClusters, function (vc) { return vc.id === targetVisNode.clusterId; });
        
            var isClusterLink = false;
            var sourceNodeCircle, targetNodeCircle;
        
            if (sourceVisCluster && sourceVisCluster.isCollapsed) {
                isClusterLink = true;
                sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + sourceVisCluster.id; });
            }
            else {
                sourceNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === sourceVisNode.id; });
            }
            
            if (targetVisCluster && targetVisCluster.isCollapsed) {
                isClusterLink = true;
                targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === "placeholder-" + targetVisCluster.id; });
            } else {
                targetNodeCircle = _.find(newNodeCircles, function (nc) { return nc.id === targetVisNode.id; });
            }
            
            if (isClusterLink) {
                var id = sourceNodeCircle.id + "->" + targetNodeCircle.id;
                if (!clusterLinks.hasOwnProperty(id))
                    clusterLinks[id] = { source: sourceNodeCircle, target: targetNodeCircle, visLinks: [] };
                
                clusterLinks[id].visLinks.push(visLink);
            } else {
                var linkLine = linkLineFromVisLinkAndNodeCircles(visLink, sourceNodeCircle, targetNodeCircle);
                newLinkLines.push(linkLine);
            }
        });
        
        _.each(clusterLinks, function (clusterLink) {
            var linkLine = linkLineFromClusterLink(clusterLink.source, clusterLink.target, clusterLink.visLinks);
            newLinkLines.push(linkLine);
        });
        
        //[cf]
    
        nodeCircles = newNodeCircles;
        linkLines = newLinkLines;
        labelTexts = newLabelTexts;
        clusterHulls = newClusterHulls;
    
        if (options.onUpdatePreRender) {
            var params = {
                clusterHulls: clusterHulls, 
                linkLines: linkLines, 
                nodeCircles: nodeCircles, 
                labelTexts: labelTexts, 
                xScale: xScale, 
                yScale: yScale, 
                radiusFactor: radiusFactor, 
                transitionDuration: transitionDuration 
            };
    
            options.onUpdatePreRender(params, updateType);
    
            clusterHulls = params.clusterHulls;
            linkLines = params.linkLines;
            nodeCircles = params.nodeCircles;
            labelTexts = params.labelTexts;
            xScale = params.xScale;
            yScale = params.yScale;
            radiusFactor = params.radiusFactor;
            transitionDuration = params.transitionDuration;
        }
    
        renderer.update(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor, transitionDuration);
    };
    //[cf]
    //[of]:    this.updatePositions = function (updateType) {
    this.updatePositions = function (updateType) {
    
        if (options.onUpdatePreRender) {
            var params = {
                clusterHulls: clusterHulls, 
                linkLines: linkLines, 
                nodeCircles: nodeCircles, 
                labelTexts: labelTexts, 
                xScale: xScale, 
                yScale: yScale, 
                radiusFactor: radiusFactor, 
                transitionDuration: transitionDuration 
            };
    
            options.onUpdatePreRender(params, updateType);
    
            clusterHulls = params.clusterHulls;
            linkLines = params.linkLines;
            nodeCircles = params.nodeCircles;
            labelTexts = params.labelTexts;
            xScale = params.xScale;
            yScale = params.yScale;
            radiusFactor = params.radiusFactor;
            transitionDuration = params.transitionDuration;
        }
    
        renderer.updatePositions(clusterHulls, linkLines, nodeCircles, labelTexts, xScale, yScale, radiusFactor);
    }
    //[cf]

    //[of]:    function cluster(alpha) {
    function cluster(alpha) {
        return function(d) {
            if (d.id.indexOf("placeholder") === 0) return;
            //if (!d.data.clusterId) return;
            
            var centralClusterNode = _.find(nodeCircles, function (nc) { return nc.data.clusterId === d.data.clusterId; }); // For now, just use the first one found
            if (centralClusterNode === d) return;
            var x = d.x - centralClusterNode.x,
                y = d.y - centralClusterNode.y,
                l = Math.sqrt(x * x + y * y),
                r = ((d.radius + centralClusterNode.radius) / zoomBehavior.scale()) * radiusFactor;
            if (l != r) {
                l = (l - r) / l * alpha;
                d.x -= x *= l;
                d.y -= y *= l;
                centralClusterNode.x += x;
                centralClusterNode.y += y;
            }
        };
    }
    //[cf]
    //[of]:    function collide(alpha) {
    function collide(alpha) {
        var padding = 10; // separation between same-color nodes
        var clusterPadding = 20; // separation between different-color nodes
        var maxRadius = 12;
     
        var quadtree = d3.geom.quadtree(nodeCircles);
        return function(d) {
            var r = ((d.radius + maxRadius + Math.max(padding, clusterPadding)) / zoomBehavior.scale()) * radiusFactor,
                nx1 = d.x - r,
                nx2 = d.x + r,
                ny1 = d.y - r,
                ny2 = d.y + r;
    
            quadtree.visit(function(quad, x1, y1, x2, y2) {
                if (quad.point && (quad.point !== d)) {
                    var x = d.x - quad.point.x,
                        y = d.y - quad.point.y,
                        l = Math.sqrt(x * x + y * y),
                        r = ((d.radius + quad.point.radius + (d.data.clusterId === quad.point.data.clusterId ? padding : clusterPadding)) / zoomBehavior.scale()) * radiusFactor;
    
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
    //[cf]
    //[of]:    function tick(e) {
    function tick(e) {
        if (options.enableClusterForce)
            _(nodeCircles).each(cluster(0.01));
        
        if (options.enableCollisionDetection)
            _(nodeCircles).each(collide(0.5));
    
        // Move labels according to nodes.
        _(labelTexts).each(function (lt) {
            var nodeCircle = _.find(nodeCircles, function (nc) { return nc.id === lt.id; });
            lt.x = nodeCircle.x;
            lt.y = nodeCircle.y;
        });
    
        self.updatePositions("tick");
    }
    //[cf]

    //[of]:    this.startForce = function () {
    this.startForce = function () {
        force = d3.layout.force()
            .nodes(nodeCircles)
            .links(linkLines)
            .size([renderer.width(), renderer.height()])
            .linkDistance(options.forceParameters.linkDistance)
            .linkStrength(options.forceParameters.linkStrength)
            .friction(options.forceParameters.friction)
            .charge(options.forceParameters.charge)
            //.chargeDistance(options.forceParameters.chargeDistance)   // This doesn't seem to be supported in this version of D3.
            .theta(options.forceParameters.theta)
            .gravity(options.forceParameters.gravity)
            .on("tick", tick)
            .start();
    };
    //[cf]
    //[of]:    this.resumeForce = function () {
    this.resumeForce = function () {
        force.resume();
    }
    //[cf]

    //[of]:    function initialize() {
    function initialize() {
        var container = d3.select(renderer.containerElement()[0]);
        
        container
            .call(zoomBehavior)
            .on("dblclick.zoom", null);
    
        if (options.onClick) {
            container.on("click", options.onClick);
        }
    }
    //[cf]
    initialize();
};

//[cf]
