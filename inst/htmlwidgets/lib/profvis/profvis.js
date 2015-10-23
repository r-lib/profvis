/*jshint
  undef:true,
  browser:true,
  devel: true,
  jquery:true,
  strict:false,
  curly:false,
  indent:2
*/
/*global profvis:true, d3 */

profvis = (function() {
  var profvis = {};

  profvis.render = function(el, message) {
    // Convert object-with-arrays format prof data to array-of-objects format
    var prof = colToRows(message.prof);
    applyInterval(prof, message.interval);
    prof = addCollapsedDepth(prof, message.collapseItems);
    prof = consolidateRuns(prof);

    var vis = {
      el: el,
      sourceProf: prof,    // Original profiling data (after a little massaging)
      curProf: prof,       // Current profiling data used in flame graph
      files: message.files,
      collapseItems: message.collapseItems,
      aggLabelTimes: getAggregatedLabelTimes(prof),
      fileLineTimes: getFileLineTimes(prof, message.files, false),

      // Objects representing each component
      controlPanel: null,
      codeTable: null,
      flameGraph: null,
      infoBox: null
    };


    // Render the objects ---------------------------------------------
    var controlPanelEl = document.createElement("div");
    controlPanelEl.className = "profvis-control-panel";
    vis.el.appendChild(controlPanelEl);

    var codeTableEl = document.createElement("div");
    codeTableEl.className = "profvis-code";
    vis.el.appendChild(codeTableEl);

    var flameGraphEl = document.createElement("div");
    flameGraphEl.className = "profvis-flamegraph";
    vis.el.appendChild(flameGraphEl);

    var infoBoxEl = document.createElement("div");
    infoBoxEl.className = "profvis-infobox";
    vis.el.appendChild(infoBoxEl);

    var splitBarEl = document.createElement("div");
    splitBarEl.className = "profvis-splitbar";
    vis.el.appendChild(splitBarEl);

    // Resize left and right sides to 50% of available space
    (function() {
      var $controlPanel = $(controlPanelEl);
      var $codeTable = $(codeTableEl);
      var $flameGraph = $(flameGraphEl);
      var $infoBox = $(infoBoxEl);
      var $splitBar = $(splitBarEl);

      // Preserve the gap between the split bar and the objects to left and right
      var splitBarGap = {
        left: $splitBar.offset().left - offsetRight($controlPanel),
        right: $flameGraph.offset().left - offsetRight($splitBar)
      };

      var sumPanelWidth = $controlPanel.outerWidth() + $flameGraph.outerWidth();

      // Size and position the elements
      $controlPanel.outerWidth(sumPanelWidth/2);
      $codeTable.outerWidth(sumPanelWidth/2);
      $splitBar.offset({
        left: offsetRight($controlPanel) + splitBarGap.left
      });
      $infoBox.offset({
        left: offsetRight($splitBar) + splitBarGap.right
      });
      $flameGraph.offset({
        left: offsetRight($splitBar) + splitBarGap.right
      });
      $flameGraph.outerWidth(sumPanelWidth/2);


      // Make sure the flame graph resizes after the window is resized
      // Capture the initial distance from the right
      var flameGraphRightMargin = window.innerWidth - offsetRight($flameGraph);
      $(window).resize(
        debounce(function() {
          $flameGraph.outerWidth(window.innerWidth - flameGraphRightMargin - $flameGraph.offset().left);
          vis.flameGraph.onResize();
        }, 250)
      );

      function offsetRight($el) {
        return $el.offset().left + $el.outerWidth();
      }
    })();


    // Create the UI components
    vis.controlPanel = generateControlPanel(controlPanelEl);
    vis.codeTable = generateCodeTable(codeTableEl);
    vis.flameGraph = generateFlameGraph(flameGraphEl);
    vis.infoBox = initInfoBox(infoBoxEl);

    enableSplitBarDrag(splitBarEl);


    function generateControlPanel(el) {
      el.innerHTML =
        '<div><label><input class="hide-internal" type="checkbox" checked>Hide internal functions</label></div>' +
        '<div><label><input class="hide-zero-row" type="checkbox">Hide lines of code with zero time</label></div>';

      var hideInternalCheckbox = d3.select(el).select("input.hide-internal");
      var hideZeroCheckbox = d3.select(el).select("input.hide-zero-row");

      hideInternalCheckbox
        .on("change", function() {
          vis.flameGraph.savePrevScales();

          if (this.checked) {
            vis.flameGraph.useCollapsedDepth();
            vis.flameGraph.redrawCollapse(400, 400);
          } else {
            vis.flameGraph.useUncollapsedDepth();
            vis.flameGraph.redrawUncollapse(400, 250);
          }
        });

      hideZeroCheckbox
        .on("change", function() {
          if (this.checked) {
            vis.codeTable.rows
              .filter(function(d) { return d.sumTime === 0; })
              .style("display", "none");
          } else {
            vis.codeTable.rows
              .filter(function(d) { return d.sumTime === 0; })
              .style("display", "");
          }
        });

      return { el: el };
    }

    // Generate the code table ----------------------------------------
    function generateCodeTable(el) {
      el.innerHTML = '<div class="profvis-table-inner"></div>';

      var content = d3.select(el).select("div.profvis-table-inner");

      var totalTime = d3.max(prof, function(d) { return d.endTime; }) -
                      d3.min(prof, function(d) { return d.startTime; });

      // One table for each file
      var tables = content.selectAll("table")
          .data(vis.fileLineTimes)
        .enter()
          .append("table")
          .attr("class", "profvis-table");

      // Table headers
      var headerRows = tables.append("tr");
      headerRows.append("th")
        .attr("colspan", "2")
        .attr("class", "filename")
        .text(function(d) { return d.filename; });

      headerRows.append("th")
        .attr("class", "time")
        .text("Total (ms)");

      headerRows.append("th")
        .attr("class", "percent")
        .text("%");

      headerRows.append("th")
        .text("Proportion");

      // Insert each line of code
      var rows = tables.selectAll("tr.code-row")
          .data(function(d) { return d.lineData; })
        .enter()
          .append("tr")
          .attr("class", "code-row");

      rows.append("td")
        .attr("class", "linenum")
        .append("code")
        .text(function(d) { return d.linenum; });

      rows.append("td")
        .attr("class", "code")
        .append("code")
        .text(function(d) { return d.content; });

      rows.append("td")
        .attr("class", "time")
        .text(function(d) { return (Math.round(d.sumTime * 100) / 100); });

      rows.append("td")
        .attr("class", "percent")
        .text(function(d) { return Math.round(d.sumTime/totalTime * 100); });

      rows.append("td")
        .attr("class", "timebar-cell")
        .append("div")
          .attr("class", "timebar")
          .style("width", function(d) {
            return Math.round(d.propTime * 100) + "%";
          })
          .html("&nbsp;");

      rows
        .on("click", function(d) {
          // Info box is only relevant when mousing over flamegraph
          hideInfoBox();
          clickItem(d, this);
        })
        .on("mouseover", function(d) {
          if (lockedSelection !== null) return;
          // Info box is only relevant when mousing over flamegraph
          hideInfoBox();
          highlightSelectedCode(d);
        })
        .on("mouseout", function(d) {
          if (lockedSelection !== null) return;
          highlightSelectedCode(null);
        });

      return {
        el: el,
        rows: rows  // Cache rows for faster access
      };
    }


    // Generate the flame graph -----------------------------------------------
    function generateFlameGraph(el) {
      el.innerHTML = "";

      var stackHeight = 15;   // Height of each layer on the stack, in pixels

      // Dimensions -----------------------------------------------------------

      // Margin inside the svg where the plotting occurs
      var dims = {
        margin: { top: 0, right: 0, left: 0, bottom: 20 }
      };
      dims.width = el.clientWidth - dims.margin.left - dims.margin.right;
      dims.height = el.clientHeight - dims.margin.top - dims.margin.bottom;

      var xDomain = [
        d3.min(prof, function(d) { return d.startTime; }),
        d3.max(prof, function(d) { return d.endTime; })
      ];
      var yDomain = [
        d3.min(prof, function(d) { return d.depth; }) - 1,
        d3.max(prof, function(d) { return d.depth; })
      ];

      // Scales ---------------------------------------------------------------
      var scales = {
        x: d3.scale.linear()
            .domain(xDomain)
            .range([0, dims.width]),

        y: d3.scale.linear()
            .domain(yDomain)
            .range([dims.height, dims.height - (yDomain[1] - yDomain[0]) * stackHeight]),

        // This will be a function that, given a data point, returns the depth.
        // This function can change; sometimes it returns the original depth,
        // and sometimes it returns the collapsed depth. This isn't exactly a
        // scale function, but it's close enough for our purposes.
        getDepth: null
      };

      function useCollapsedDepth() {
        scales.getDepth = function(d) { return d.depthCollapsed; };
      }
      function useUncollapsedDepth() {
        scales.getDepth = function(d) { return d.depth; };
      }

      useCollapsedDepth();


      // SVG container objects ------------------------------------------------
      var wrapper = d3.select(el).append('div')
        .attr('class', 'profvis-flamegraph-inner');

      var svg = wrapper.append('svg');

      var clipRect = svg.append("clipPath")
          .attr("id", "clip")
        .append("rect");

      var container = svg.append('g')
        .attr("transform", "translate(" + dims.margin.left + "," + dims.margin.top + ")")
        .attr("clip-path", "url(" + urlNoHash() + "#clip)");

      // Add a background rect so we have something to grab for zooming/panning
      var backgroundRect = container.append("rect")
        .attr("class", "background");

      // Axes ------------------------------------------------------------
      var xAxis = d3.svg.axis()
        .scale(scales.x)
        .orient("bottom");

      svg.append("g")
        .attr("class", "x axis")
        .call(xAxis);

      // Container sizing -----------------------------------------------------
      // Update dimensions of various container elements, based on the overall
      // dimensions of the containing div.
      function updateContainerSize() {
        dims.width = el.clientWidth - dims.margin.left - dims.margin.right;
        dims.height = el.clientHeight - dims.margin.top - dims.margin.bottom;

        svg
          .attr('width', dims.width + dims.margin.left + dims.margin.right)
          .attr('height', dims.height + dims.margin.top + dims.margin.bottom);

        clipRect
          .attr("x", dims.margin.left)
          .attr("y", dims.margin.top)
          .attr("width", dims.width)
          .attr("height", dims.height);

        backgroundRect
          .attr("width", dims.width)
          .attr("height", dims.height);

        svg.select(".x.axis")
          .attr("transform", "translate(" + dims.margin.left + "," + dims.height + ")");
      }


      // Redrawing ------------------------------------------------------------

      // Redrawing is a little complicated. For performance reasons, the
      // flamegraph cells that are offscreen aren't rendered; they're removed
      // from the D3 selection of cells. However, when transitions are
      // involved, it may be necssary to add objects in their correct
      // off-screen starting locations before the transition, and then do the
      // transition. Similarly, it may be necssary to transition objects to
      // their correct off-screen ending positions.
      //
      // In order to handle this, whenever there's a transition, we need to
      // have the scales for before the transition, and after. When a function
      // invokes a transition, it will generally do the following: (1) save the
      // previous scales, (2) modify the current scales, (3) call a redraw
      // function. The redraw functions are customized for different types of
      // transitions, and they will use the saved previous scales to position
      // objects correctly for the transition. When there's no transition, the
      // previous scales aren't needed, and the redrawImmediate() function
      // should be used.

      // Cache cells for faster access (avoid a d3.select())
      var cells;
      // Externally-visible function
      function getCells() {
        return cells;
      }

      // For a data element, return identifying key
      function dataKey(d) {
        return d.depth + "-" + d.startTime + "-" + d.endTime;
      }

      // For transitions with animation, we need to have a copy of the previous
      // scales in addition to the current ones.
      var prevScales = {};
      function savePrevScales() {
        prevScales = {
          x:        scales.x.copy(),
          y:        scales.y.copy(),
          getDepth: scales.getDepth
        };
      }
      savePrevScales();


      // Returns a D3 selection of the cells that are within the plotting
      // region, using a set of scales.
      function selectActiveCells(scales) {
        var xScale = scales.x;
        var yScale = scales.y;
        var depth = scales.getDepth;
        var width = dims.width;
        var height = dims.height;

        var data = prof.filter(function(d) {
          var depthVal = depth(d);
          return !(xScale(d.endTime)    < 0      ||
                   xScale(d.startTime)  > width  ||
                   depthVal           === null   ||
                   yScale(depthVal - 1) < 0      ||
                   yScale(depthVal)     > height);
        });

        cells = container.selectAll("g.cell").data(data, dataKey);

        return cells;
      }

      // Given an enter selection, add the rect and text objects, but don't
      // position them. Returns a selection of the new <g> elements.
      // This should usually be called with addItems(sel.enter()) instead
      // of sel.enter().call(addItems), because the latter returns the original
      // enter selection, not the selection of <g> elements, and can't be
      // used for chaining more function calls on the <g> selection.
      function addItems(enterSelection) {
        var cells = enterSelection.append("g")
          .attr("class", "cell")
          .classed("highlighted", function(d) { return d.filename !== null; })
          .call(addMouseEventHandlers);

        // Add CSS classes for highlighting cells with labels that match particular
        // regex patterns.
        var highlightPatterns = d3.entries(message.highlight);
        highlightPatterns.map(function(item) {
          var cssClass = item.key;
          var regexp = new RegExp(item.value);

          cells.classed(cssClass, function(d) {
            return d.label.search(regexp) !== -1;
          });
        });

        cells.append("rect")
          .attr("class", "rect");

        cells.append("text")
          .attr("class", "label")
          .text(function(d) { return d.label; });

        return cells;
      }

      // Given a selection, position the rects and labels, using a set of
      // scales.
      function positionItems(cells, scales) {
        var xScale = scales.x;
        var yScale = scales.y;
        var depth = scales.getDepth;

        cells.select("rect")
          .attr("width", function(d) {
            return xScale(d.endTime) - xScale(d.startTime);
          })
          .attr("height", yScale(0) - yScale(1))
          .attr("x", function(d) { return xScale(d.startTime); })
          .attr("y", function(d) { return yScale(depth(d)); });

        cells.select("text")
          .attr("x", function(d) {
            // To place the labels, check if there's enough space to fit the
            // label plus padding in the rect. (We already know the label fits
            // without padding if we got here.)
            // * If there's not enough space, simply center the label in the
            //   rect.
            // * If there is enough space, keep the label within the rect, with
            //   padding. Try to left-align, keeping the label within the
            //   viewing area if possible.

            // Padding on left and right
            var pad = 2;

            var textWidth = getLabelWidth(this, d.label.length);
            var rectWidth = xScale(d.endTime) - xScale(d.startTime);

            if (textWidth + pad*2 > rectWidth) {
              return xScale(d.startTime) + (rectWidth - textWidth) / 2;
            } else {
              return Math.min(
                Math.max(0, xScale(d.startTime)) + pad,
                xScale(d.endTime) - textWidth - pad
              );
            }
          })
          .attr("y", function(d) { return yScale(depth(d) - 0.5); })
          .call(updateLabelVisibility);

        return cells;
      }


      // Redraw without a transition (regular panning and zooming)
      function redrawImmediate() {
        cells = selectActiveCells(scales);

        cells.exit().remove();
        addItems(cells.enter());
        cells.call(positionItems, scales);
        svg.select(".x.axis").call(xAxis);
      }

      // Redraw for double-click zooming, where there's a transition
      function redrawZoom(duration) {
        cells = selectActiveCells(scales);

        // Phase 1
        // Add the enter items and position them using the previous scales
        addItems(cells.enter())
          .call(positionItems, prevScales);

        // Phase 2
        // Position the update (and enter) items using the new scales
        cells
          .transition().duration(duration)
            .call(positionItems, scales);

        // Position the exit items using the new scales
        cells.exit()
          .transition().duration(duration)
            .call(positionItems, scales);

        // Update x axis
        svg.select(".x.axis")
          .transition().duration(duration)
            .call(xAxis);

        // Phase 3
        // Remove the exit items
        cells.exit()
          .transition().delay(duration)
            .remove();
      }

      // Redraw when internal functions are hidden
      function redrawCollapse(exitDuration, updateDuration) {
        cells = selectActiveCells(scales);

        // There are two subsets of the exit items:
        //   1. Those that exit because depth is null. These should fade out.
        //   2. Those that exit because they move off screen. These should wait
        //      for subset 1 to fade out, then move with a transition.
        var fadeOutCells = cells.exit()
          .filter(function(d) { return scales.getDepth(d) === null; });
        var moveOutCells = cells.exit()
          .filter(function(d) { return scales.getDepth(d) !== null; });

        // Phase 1
        // Add the enter items and position them using the previous scales
        addItems(cells.enter())
          .call(positionItems, prevScales);

        // Phase 2
        // Fade out the items that have a null depth
        fadeOutCells
          .transition().duration(exitDuration)
            .style("opacity", 0);

        // Phase 3
        // Position the update (and enter) items using the new scales
        cells
          .transition().delay(exitDuration).duration(updateDuration)
            .call(positionItems, scales);

        // Position the exit items that move out, using the new scales
        moveOutCells
          .transition().delay(exitDuration).duration(updateDuration)
            .call(positionItems, scales);

        // Phase 4
        // Remove all the exit items
        cells.exit()
          .transition().delay(exitDuration + updateDuration)
          .remove();
      }

      // Redraw when internal functions are un-hidden
      function redrawUncollapse(updateDuration, enterDuration) {
        cells = selectActiveCells(scales);

        var enterCells = addItems(cells.enter());
        // There are two subsets of the enter items:
        //   1. Those that enter because they move on screen (but the previous
        //      depth was not null). These should move with a transition.
        //   2. Those that enter because the previous depth was null. These
        //      should wait for subset 1 to move, then fade in.
        var moveInCells = enterCells
          .filter(function(d) { return prevScales.getDepth(d) !== null; });
        var fadeInCells = enterCells
          .filter(function(d) { return prevScales.getDepth(d) === null; });

        // Phase 1
        // Position the move-in items with the old scales
        moveInCells
            .call(positionItems, prevScales);

        // Phase 2
        // Position the move-in, update, and exit items with a transition
        moveInCells
          .transition().duration(updateDuration)
            .call(positionItems, scales);
        cells
          .transition().duration(updateDuration)
            .call(positionItems, scales);
        cells.exit()
          .transition().duration(updateDuration)
            .call(positionItems, scales);

        // Phase 3
        // Position the fade-in items, then fade in
        fadeInCells
            .call(positionItems, scales)
            .style("opacity", 0)
          .transition().delay(updateDuration).duration(enterDuration)
            .style("opacity", 1);

        // Phase 4
        // Remove the exit items
        cells.exit()
          .transition().delay(updateDuration + enterDuration)
            .remove();
      }


      // Calculate whether to display label in each cell ----------------------

      // Finding the dimensions of SVG elements is expensive. We'll reduce the
      // calls getBoundingClientRect() by caching the dimensions.

      // Cache the width of labels. This is a lookup table which, given the
      // number of characters, gives the number of pixels. The label width
      // never changes, so we can keep it outside of updateLabelVisibility().
      var labelWidthTable = {};
      function getLabelWidth(el, nchar) {
        // Add entry if it doesn't already exist
        if (labelWidthTable[nchar] === undefined) {
          // If the text isn't displayed, then we can't get its width. Make
          // sure it's visible, get the width, and then restore original
          // display state.
          var oldDisplay = el.getAttribute("display");
          el.setAttribute("display", "inline");
          labelWidthTable[nchar] = el.getBoundingClientRect().width;
          el.setAttribute("display", oldDisplay);
        }
        return labelWidthTable[nchar];
      }

      // Show labels that fit in the corresponding rectangle, and hide others.
      function updateLabelVisibility(labels) {
        // Cache the width of rects. This is a lookup table which, given the
        // timespan (width in data), gives the number of pixels. The width of
        // rects changes with the x scale, so we have to rebuild the table each
        // time the scale changes.
        var rectWidthTable = {};
        var x0 = scales.x(0);
        function getRectWidth(time) {
          // Add entry if it doesn't already exist
          if (rectWidthTable[time] === undefined) {
            rectWidthTable[time] = scales.x(time) - x0;
          }
          return rectWidthTable[time];
        }

        // Now calculate text and rect width for each cell.
        labels.attr("display", function(d) {
          var labelWidth = getLabelWidth(this, d.label.length);
          var boxWidth = getRectWidth(d.endTime - d.startTime);

          return (labelWidth <= boxWidth) ? "inherit" : "none";
        });

        return labels;
      }


      function onResize() {
        updateContainerSize();

        scales.x.range([0, dims.width]);
        zoom.x(scales.x);
        redrawImmediate();
      }

      // Attach mouse event handlers ------------------------------------
      function addMouseEventHandlers(cells) {
        cells
          .on("click", function(d) {
            showInfoBox(d);
            clickItem(d, this);
          })
          .on("mouseover", function(d) {
            // If no label currently shown, display a tooltip
            var label = this.querySelector(".label");
            if (label.getAttribute("display") === "none") {
              var box = this.getBBox();
              showTooltip(
                d.label,
                box.x + box.width / 2,
                box.y - box.height - 5
              );
            }

            if (lockedSelection === null) {
              showInfoBox(d);
              highlightSelectedCode(d);
            }
          })
          .on("mouseout", function(d) {
            hideTooltip();

            if (lockedSelection === null) {
              hideInfoBox(d);
              highlightSelectedCode(null);
            }
          })
          .on("dblclick.zoomcell", function(d) {
            // When a cell is double-clicked, zoom x to that cell's width.
            savePrevScales();

            scales.x.domain([d.startTime, d.endTime]);
            zoom.x(scales.x);

            redrawZoom(250);
          });

        return cells;
      }

      // Tooltip --------------------------------------------------------
      function showTooltip(label, x, y) {
        var tooltip = container.append("g").attr("class", "tooltip");
        var tooltipRect = tooltip.append("rect");
        var tooltipLabel = tooltip.append("text")
          .text(label)
          .attr("x", x)
          .attr("y", y);

        // Add box around label
        var labelBox = tooltipLabel.node().getBBox();
        var rectWidth = labelBox.width + 10;
        var rectHeight = labelBox.height + 4;
        tooltipRect
          .attr("width", rectWidth)
          .attr("height", rectHeight)
          .attr("x", x - rectWidth / 2)
          .attr("y", y - rectHeight / 2);
      }

      function hideTooltip() {
        container.select("g.tooltip").remove();
      }


      // Panning and zooming --------------------------------------------
      // For panning and zooming x, d3.behavior.zoom does most of what we want
      // automatically. For panning y, we can't use d3.behavior.zoom becuase it
      // will also automatically add zooming, which we don't want. Instead, we
      // need to use d3.behavior.drag and set the y domain appropriately.
      var drag = d3.behavior.drag()
        .on("drag", function() {
          var y = scales.y;
          var ydom = y.domain();
          var ydiff = y.invert(d3.event.dy) - y.invert(0);
          y.domain([ydom[0] - ydiff, ydom[1] - ydiff]);
        });

      var zoom = d3.behavior.zoom()
        .x(scales.x)
        .scaleExtent([0.01, 1000])
        .on("zoom", redrawImmediate);

      // Register drag before zooming, because we need the drag to set the y
      // scale before the zoom triggers a redraw.
      svg
        .call(drag)
        .call(zoom)
        .on("dblclick.zoom", null); // Disable zoom's built-in double-click behavior

      // Zoom out when background is double-clicked
      backgroundRect.on("dblclick.zoombackground", function() {
        savePrevScales();

        scales.x.domain(xDomain);
        zoom.x(scales.x);

        redrawZoom(250);
      });


      onResize();

      return {
        el: el,
        getCells: getCells,
        onResize: onResize,
        redrawImmediate: redrawImmediate,
        redrawZoom: redrawZoom,
        redrawCollapse: redrawCollapse,
        redrawUncollapse: redrawUncollapse,
        savePrevScales: savePrevScales,
        useCollapsedDepth: useCollapsedDepth,
        useUncollapsedDepth: useUncollapsedDepth
      };
    } // generateFlameGraph


    // Enable dragging of the split bar ---------------------------------------
    function enableSplitBarDrag(el) {
      var $el = $(el);

      var dragging = false;
      var startDragX;
      var startOffsetLeft;

      var stopDrag = function(e) {
        if (!dragging) return;
        dragging = false;

        document.removeEventListener("mousemove", drag);
        document.removeEventListener("mouseup", stopDrag);

        el.style.opacity = "";

        var dx = e.pageX - startDragX;
        if (dx === 0) return;

        // Resize components
        var $controlPanel = $(vis.controlPanel.el);
        $controlPanel.width($controlPanel.width() + dx);

        var $codeTable = $(vis.codeTable.el);
        $codeTable.width($codeTable.width() + dx);

        var $flameGraph = $(vis.flameGraph.el);
        $flameGraph.width($flameGraph.width() - dx);
        $flameGraph.offset({ left: $flameGraph.offset().left + dx });
        vis.flameGraph.onResize();

        var $infoBox = $(vis.infoBox.el);
        $infoBox.offset({ left: $infoBox.offset().left + dx });
      };

      var startDrag = function(e) {
        // Don't start another drag if we're already in one.
        if (dragging) return;
        dragging = true;
        pauseEvent(e);

        el.style.opacity = "0.5";

        startDragX = e.pageX;
        startOffsetLeft = $el.offset().left;

        document.addEventListener("mousemove", drag);
        document.addEventListener("mouseup", stopDrag);
      };

      var drag = function(e) {
        if (!dragging) return;
        pauseEvent(e);

        var dx = e.pageX - startDragX;
        if (dx === 0) return;

        // Move the split bar
        $el.offset({ left: startOffsetLeft + dx });
      };

      // Stop propogation so that we don't select text while dragging
      function pauseEvent(e){
        if(e.stopPropagation) e.stopPropagation();
        if(e.preventDefault) e.preventDefault();
        e.cancelBubble = true;
        e.returnValue = false;
        return false;
      }

      el.addEventListener("mousedown", startDrag);
    }


    function initInfoBox(el) {
      el.style.display = "none";
      return { el: el };
    }

    // Highlights line of code and flamegraph blocks corresponding to a
    // filenum. linenum and, if provided, label combination. (When this is called
    // from hovering over code, no label is provided.)
    // If only a label is provided, search for cells (only in the flamegraph) that
    // have the same label.
    function highlightSelectedCode(d) {
      // Un-highlight lines of code and flamegraph blocks
      vis.codeTable.rows
        .filter(".selected")
        .classed({ selected: false });
      vis.flameGraph.getCells()
        .filter(".selected")
        .classed({ selected: false });

      if (d === null) return;

      var target = d;

      if (target.filename && target.linenum) {
        // If we have filename and linenum, search for cells that match, and
        // set them as "selected".
        var tr = vis.codeTable.rows.filter(function(d) {
            return d.linenum === target.linenum &&
                   d.filename === target.filename;
          })
          .classed({ selected: true });

        // Highlight corresponding flamegraph blocks
        vis.flameGraph.getCells()
          .filter(function(d) {
            // Check for filename and linenum match, and if provided, a label match.
            var match = d.filename === target.filename &&
                        d.linenum === target.linenum;
            if (!!target.label) {
              match = match && (d.label === target.label);
            }
            return match;
          })
          .classed({ selected: true });

        tr.node().scrollIntoViewIfNeeded();

      } else if (target.label) {
        // Don't highlight blocks for these labels
        var exclusions = ["<Anonymous>", "FUN"];
        if (exclusions.some(function(x) { return target.label === x; })) {
          return;
        }

        // If we only have the label, search for cells that match, but make sure
        // to not select ones that have a filename and linenum.
        vis.flameGraph.getCells()
          .filter(function(d) {
            return d.label === target.label &&
                   d.filename === null &&
                   d.linenum === null;
          })
          .classed({ selected: true });
      }
    }


    var lockedSelection = null;

    function lockSelection(d, el) {
      lockedSelection = {
        data: d,
        el: el
      };

      d3.select(el).classed({ locked: true });
    }

    function unlockSelection() {
      if (lockedSelection) {
        d3.select(lockedSelection.el).classed({ locked: false });
        lockedSelection = null;
      }
    }

    // This is called when a flamegraph cell or a line of code is clicked on.
    function clickItem(d, el) {
      // If locked, and this click is on the currently locked selection,
      // just unlock and return.
      if (lockedSelection && el === lockedSelection.el) {
        unlockSelection();
        return;
      }

      // If nothing currently locked, or if locked and this click is on
      // something other than the currently locked selection, then lock the
      // current selection.
      unlockSelection();
      lockSelection(d, el);
      highlightSelectedCode(d);
    }


    function showInfoBox(d) {
      var label = d.label ? d.label : "";
      var ref = (d.filename && d.linenum) ?
        (d.filename + "#" + d.linenum) :
        "(source unavailable)";

      vis.infoBox.el.style.display = "";

      vis.infoBox.el.innerHTML =
        "<table>" +
        "<tr><td class='infobox-title'>Label</td><td>" + escapeHTML(label) + "</td></tr>" +
        "<tr><td class='infobox-title'>Called from</td><td>" + escapeHTML(ref) + "</td></tr>" +
        "<tr><td class='infobox-title'>Total time</td><td>" + (d.endTime - d.startTime) + "ms</td></tr>" +
        "<tr><td class='infobox-title'>Agg. total time</td><td>" + vis.aggLabelTimes[label] + "ms</td></tr>" +
        "<tr><td class='infobox-title'>Call stack depth</td><td>" + d.depth + "</td></tr>" +
        "</table>";
    }

    function hideInfoBox() {
      vis.infoBox.el.style.display = "none";
    }

    return vis;
  };  // profvis.render()

  // Calculate amount of time spent on each line of code. Returns nested objects
  // grouped by file, and then by line number.
  // If dropZero is true, drop the lines that have zero time.
  function getFileLineTimes(prof, files, dropZero) {
    dropZero = (dropZero === undefined ? false : dropZero);

    // Drop entries with null or "" filename
    prof = prof.filter(function(row) {
      return row.filename !== null && row.filename !== "";
    });

    // Gather line-by-line file contents
    var fileLineTimes = files.map(function(file) {
      // Create array of objects with info for each line of code.
      var lines = file.content.split("\n");
      var lineData = [];
      var filename = file.filename;
      for (var i=0; i<lines.length; i++) {
        lineData[i] = {
          filename: filename,
          linenum: i + 1,
          content: lines[i],
          sumTime: 0
        };
      }

      return {
        filename: filename,
        lineData: lineData
      };
    });

    // Get timing data for each line
    var timeData = d3.nest()
      .key(function(d) { return d.filename; })
      .key(function(d) { return d.linenum; })
      .rollup(function(leaves) {
        var sumTime = leaves.reduce(function(sum, d) {
            return sum + d.endTime - d.startTime;
          }, 0);

        return {
          filename: leaves[0].filename,
          linenum: leaves[0].linenum,
          sumTime: sumTime
        };
      })
      .entries(prof);

    // Insert the sumTimes into line content data
    timeData.forEach(function(fileInfo) {
      // Find item in fileTimes that matches the file of this fileInfo object
      var fileLineData = fileLineTimes.filter(function(d) {
        return d.filename === fileInfo.key;
      })[0].lineData;

      fileInfo.values.forEach(function(lineInfo) {
        lineInfo = lineInfo.values;
        fileLineData[lineInfo.linenum - 1].sumTime = lineInfo.sumTime;
      });
    });


    if (dropZero) {
      fileLineTimes = fileLineTimes.map(function(lines) {
        lines.lineData = lines.lineData.filter(function(line) {
          return line.sumTime > 0;
        });

        return lines;
      });
    }

    // Calculate proportional times, relative to the longest time in the data
    // set. Modifies data in place.
    var fileMaxTimes = fileLineTimes.map(function(lines) {
      var lineTimes = lines.lineData.map(function(x) { return x.sumTime; });
      return d3.max(lineTimes);
    });

    var maxTime = d3.max(fileMaxTimes);

    fileLineTimes.map(function(lines) {
      lines.lineData.map(function(line) {
        line.propTime = line.sumTime / maxTime;
      });
    });

    return fileLineTimes;
  }

  // Given the raw profiling data, convert `time` field to `startTime` and
  // `endTime`, and use the supplied interval.
  // Modifies data in place.
  function applyInterval(prof, interval) {
    prof.map(function(d) {
      d.startTime = interval * (d.time - 1);
      d.endTime = interval * (d.time);
      delete d.time;
    });

    return prof;
  }


  // Calculate the total amount of time spent in each function label
  function getAggregatedLabelTimes(prof) {
    var labelTimes = {};
    prof.map(function(d) {
      var label = d.label;
      if (labelTimes[label] === undefined)
        labelTimes[label] = 0;

      labelTimes[label] += d.endTime - d.startTime;
    });

    return labelTimes;
  }

  // Given profiling data and an array of function labels, remove samples
  // that contain those labels.
  function addCollapsedDepth(prof, collapseItems) {
    var data = d3.nest()
      .key(function(d) { return d.startTime; })
      .rollup(function(leaves) {
        leaves = leaves.sort(function(a, b) { return a.depth - b.depth; });

        // Remove any leaves that have a label that's found in collapseItems.
        var curDepth = leaves[0].depth;
        leaves = leaves.map(function(leaf) {
          // If the leaf's label matches any of the collapse items, remove it.
          var inCollapseList = collapseItems.some(function(collapseItem) {
            return collapseItem === leaf.label;
          });

          // Add what the depth of the call is when in collapsed view. (null
          // means this call is hidden.)
          if (inCollapseList) {
            leaf.depthCollapsed = null;
          } else {
            leaf.depthCollapsed = curDepth;
            curDepth++;
          }

          return leaf;
        });

        return leaves;
      })
      .map(prof);

    // Un-nest (flatten) the data
    // Convert from object of arrays to array of arrays
    data = d3.map(data).values();
    data = d3.merge(data);
    return data;
  }


  // Given profiling data, consolidate consecutive blocks for a flamegraph.
  function consolidateRuns(prof) {
    var data = d3.nest()
      .key(function(d) { return d.depth; })
      .rollup(function(leaves) {
        leaves = leaves.sort(function(a, b) { return a.startTime - b.startTime; });

        // Collapse consecutive leaves with the same fun
        var startLeaf = null;  // leaf starting this run
        var lastLeaf = null;   // The last leaf we've looked at
        var newLeaves = [];
        for (var i=0; i<leaves.length; i++) {
          var leaf = leaves[i];

          if (i === 0) {
            startLeaf = leaf;

          } else if (leaf.startTime !== lastLeaf.endTime ||
                     leaf.label !== startLeaf.label ||
                     leaf.filename !== startLeaf.filename ||
                     leaf.linenum !== startLeaf.linenum)
          {
            var newLeaf = $.extend({}, startLeaf);
            newLeaf.endTime = lastLeaf.endTime;
            newLeaves.push(newLeaf);

            startLeaf = leaf;
          }

          lastLeaf = leaf;
        }

        // Add the last one
        newLeaf = $.extend({}, startLeaf);
        newLeaf.endTime = lastLeaf.endTime;
        newLeaves.push(newLeaf);

        return newLeaves;
      })
      .map(prof);

    // Convert from object of arrays to array of arrays
    data = d3.map(data).values();
    // Make sure that blocks are always the same or smaller than the one below.
    // In other words, no block can rest on more than one other block.
    // We'll do this by loop over rows, going from bottom to top. Along the way:
    // * Store the start and end times of each block in a set `breaks`.
    // * If a block contains any breaks between its start and end times, split
    //   it up along those breaks.
    var breaks = d3.set();
    for (var i=0; i<data.length; i++) {
      var row = data[i];
      var newRow = [];

      // Convert breaks from d3.set to array of numbers
      var breaksNum = breaks.values()
        .map(function(val) { return parseInt(val); });

      row.map(function(block) {
        var internalBreaks = containsBreaks(block.startTime, block.endTime, breaksNum);
        var newBlocks = splitBlock(block, internalBreaks);
        newRow = newRow.concat(newBlocks);

        // Make sure the start and end times are added to the set of breaks.
        breaks.add(block.startTime);
        breaks.add(block.endTime);
      });

      // Replace old row with new one
      data[i] = newRow;
    }

    // Given a start and end value, and an array of break values, return an
    // array of breaks that are between the start and end (not inclusive).
    function containsBreaks(start, end, breaks) {
      return breaks.filter(function(b) {
        return b > start && b < end;
      });
    }

    // Given a block and an array of breaks, split up that block along the
    // breaks. Returns an array of blocks with new startTime and endTime
    // values.
    function splitBlock(block, breaks) {
      if (breaks.length === 0) return [block];

      breaks.sort(function(a, b) { return a-b; });
      var newBlocks = [];
      var tmp;
      for (var i=-1; i<breaks.length; i++) {
        tmp = $.extend({}, block);
        if (i >= 0)
          tmp.startTime = breaks[i];
        if (i < breaks.length-1)
          tmp.endTime = breaks[i+1];

        newBlocks.push(tmp);
      }

      return newBlocks;
    }

    // Un-nest (flatten) the data
    data = d3.merge(data);

    return data;
  }


  // Given a selector string, a start node, and (optionally) an end node which
  // is an ancestor of `start`, search for an ancestor node between the start
  // and end which matches the selector.
  function selectAncestor(selector, start, end) {
    if (start.matches(selector))
      return start;
    if (start === end || start === document)
      return null;

    return selectAncestor(selector, start.parentNode, end);
  }

  // Transform column-oriented data (an object with arrays) to row-oriented data
  // (an array of objects).
  function colToRows(x) {
    var colnames = d3.keys(x);
    if (colnames.length === 0)
      return [];

    var newdata = [];
    for (var i=0; i < x[colnames[0]].length; i++) {
      var row = {};
      for (var j=0; j < colnames.length; j++) {
        var colname = colnames[j];
        row[colname] = x[colname][i];
      }
      newdata[i] = row;
    }

    return newdata;
  }


  // Escape an HTML string.
  function escapeHTML(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // This returns the current page URL without any trailing hash. Should be
  // used in url() references in SVGs to avoid problems when there's a <base>
  // tag in the document.
  function urlNoHash() {
    return window.location.href.split("#")[0];
  }

  function debounce(f, delay) {
    var timer = null;
    return function() {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () {
        f.apply(context, args);
      }, delay);
    };
  }


  if (!Element.prototype.scrollIntoViewIfNeeded) {
    Element.prototype.scrollIntoViewIfNeeded = function (centerIfNeeded) {
      centerIfNeeded = arguments.length === 0 ? true : !!centerIfNeeded;

      var parent = this.parentNode,
          parentComputedStyle = window.getComputedStyle(parent, null),
          parentBorderTopWidth = parseInt(parentComputedStyle.getPropertyValue('border-top-width')),
          parentBorderLeftWidth = parseInt(parentComputedStyle.getPropertyValue('border-left-width')),
          overTop = this.offsetTop - parent.offsetTop < parent.scrollTop,
          overBottom = (this.offsetTop - parent.offsetTop + this.clientHeight - parentBorderTopWidth) > (parent.scrollTop + parent.clientHeight),
          overLeft = this.offsetLeft - parent.offsetLeft < parent.scrollLeft,
          overRight = (this.offsetLeft - parent.offsetLeft + this.clientWidth - parentBorderLeftWidth) > (parent.scrollLeft + parent.clientWidth),
          alignWithTop = overTop && !overBottom;

      if ((overTop || overBottom) && centerIfNeeded) {
        parent.scrollTop = this.offsetTop - parent.offsetTop - parent.clientHeight / 2 - parentBorderTopWidth + this.clientHeight / 2;
      }

      if ((overLeft || overRight) && centerIfNeeded) {
        parent.scrollLeft = this.offsetLeft - parent.offsetLeft - parent.clientWidth / 2 - parentBorderLeftWidth + this.clientWidth / 2;
      }

      if ((overTop || overBottom || overLeft || overRight) && !centerIfNeeded) {
        this.scrollIntoView(alignWithTop);
      }
    };
  }

  return profvis;
})();
