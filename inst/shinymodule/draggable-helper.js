var profvis_container = $(".profvis-module-container");

// Constrain draggability to x-axis
profvis_container.draggable("option", "axis", "x");

// Center using JS. Doing this instead of centering with CSS
// allows draggability to work without changing the size of
// the widget.
var w = profvis_container.outerWidth();
var screen_w = $(window).width();
profvis_container.css("left", ((screen_w - w) / 2) + "px");
