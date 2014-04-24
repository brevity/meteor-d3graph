LabelText = function (id, data) {
    this.id = id.toString();
    this.data = data;
};

// These properties must be present for rendering
LabelText.prototype.propertyTypes = [
    TypeChecker.string("id"),
    TypeChecker.object("data"),
    TypeChecker.string("text"),
    TypeChecker.number("x"), // Note: x and y are NOT scaled to screen space because they are manipulated by d3.force
    TypeChecker.number("y"), // Scaling takes place in SvgRenderer.update, which is why it takes the scales as parameters.
    TypeChecker.number("offsetX"),
    TypeChecker.number("offsetY"),
    TypeChecker.string("anchor"),
    TypeChecker.number("fontSize"),
    TypeChecker.color("color"),
    TypeChecker.color("borderColor"),
    TypeChecker.number("opacity"),
    TypeChecker.string("hoverText"),
    TypeChecker.object("eventHandlers")
];

LabelText.prototype.optionalPropertyTypes = [];

LabelText.prototype.updateProperties = function (properties) {
    TypeChecker.checkProperties(properties, [], this.propertyTypes, true);
    _.extend(this, properties);
}



