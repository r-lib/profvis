// Delay this layout code for 100ms so the DOM has time to layout.
// We've initialize the profvis-module-container to left:-200px so there's no
// flash of unstyled content anyway.
setTimeout(function() {
  var profvis_container = $(".profvis-module-container");

  // Constrain draggability to x-axis
  profvis_container.draggable("option", "axis", "x");

  // Center using JS. Doing this instead of centering with CSS
  // allows draggability to work without changing the size of
  // the widget.
  var w = profvis_container.outerWidth();
  var screen_w = $(window).width();
  profvis_container.css("left", ((screen_w - w) / 2) + "px");
}, 100);
