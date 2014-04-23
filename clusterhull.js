ClusterHull = function (id, data) {
    this.id = id.toString();
    this.data = data;
};

// These properties must be present for rendering
ClusterHull.prototype.propertyTypes = [
    TypeChecker.string("id"),
    TypeChecker.object("data"),
    TypeChecker.array("nodeCircles"),
    TypeChecker.color("color"),
    TypeChecker.color("borderColor"),
    TypeChecker.number("opacity"),
    TypeChecker.string("hoverText"),
    TypeChecker.object("eventHandlers")
];

ClusterHull.prototype.optionalPropertyTypes = [];

ClusterHull.prototype.updateProperties = function (properties) {
    TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
    _.extend(this, properties);
}




