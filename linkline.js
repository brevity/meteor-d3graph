﻿LinkLine = function (id, source, target, visData) {
    this.id = id.toString();
    this.source = source;
    this.target = target;
    this.visData = visData;
};

// These properties must be present for rendering
LinkLine.prototype.propertyTypes = [
    TypeChecker.string("id"),
    TypeChecker.object("source"), // These should be NodeCircle instances. (Names cannot change because of d3.force)
    TypeChecker.object("target"),  //  -   "   -
    TypeChecker.object("visData"),  // Can be a VisLink or an array of VisLinks if this links from and/or to a cluster
    TypeChecker.number("width"),
    TypeChecker.color("color"),
    TypeChecker.number("opacity"),
    TypeChecker.boolean("marker"),
    TypeChecker.number("curvature"),
    TypeChecker.string("dashPattern"),
    TypeChecker.string("hoverText"),
    TypeChecker.object("eventHandlers")
];

LinkLine.prototype.optionalPropertyTypes = [];

LinkLine.prototype.updateProperties = function (properties) {
    TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
    _.extend(this, properties);
}



