/*jshint
  undef:true,
  browser:true,
  devel: true,
  jquery:true,
  strict:false,
  curly:false,
  indent:2
*/
/*global profvis:true, d3, hljs */

profvis = (function() {
  var profvis = {};

  profvis.render = function(el, message) {

    function generateStatusBar(el) {
      var $el = $(el);

      el.innerHTML =
        '<div class="info-block"><span class="info-label">Total time:</span> ' +
          vis.totalTime + 'ms</div>' +
        '<div class="info-block"><span class="info-label">Sample interval:</span> ' +
          vis.interval + 'ms</div>' +
        '<span role="button" class="settings-button">Settings &#x25BE;</span>';

      $el.find("span.settings-button").on("click", function(e) {
        e.preventDefault();
        e.stopPropagation();

        vis.settingsPanel.setOffset({
          top: $el.offset().top + $el.outerHeight() - 1,
          right: $el.offset().left + $el.outerWidth(),
        });
        vis.settingsPanel.toggleVisibility();
      });

      return {
        el: el
      };
    }

    function generateSettingsPanel(el) {
      var $el = $(el);

      el.innerHTML =
        '<div role="button" class="hide-internal">' +
          '<span class="settings-checkbox" data-checked="1">&#x2612;</span> Hide internal functions for Shiny' +
        '</div>' +
        '<div role="button" class="hide-zero-row">' +
          '<span class="settings-checkbox" data-checked="0">&#x2610;</span> Hide lines of code with zero time' +
        '</div>';

      // Toggle the appearance of a checkbox and return the new checked state.
      function toggleCheckbox($checkbox) {
        var checked = $checkbox.data("checked");

        if (checked === "0") {
          $checkbox.data("checked", "1");
          $checkbox.html("&#x2612;");
          return true;

        } else {
          $checkbox.data("checked", "0");
          $checkbox.html("&#x2610;");
          return false;
        }
      }

      $el.find(".hide-internal")
        .on("click", function() {
          vis.flameGraph.savePrevScales();

          var checked = toggleCheckbox($(this).find(".settings-checkbox"));

          if (checked) {
            vis.flameGraph.useCollapsedDepth();
            vis.flameGraph.redrawCollapse(400, 400);
          } else {
            vis.flameGraph.useUncollapsedDepth();
            vis.flameGraph.redrawUncollapse(400, 250);
          }
        });

      // Make the "hide internal" option available or unavailable to users
      function enableHideInternal() {
        $el.find(".hide-internal").css("display", "");
      }
      function disableHideInternal() {
        $el.find(".hide-internal").css("display", "none");
      }
      // By default, start with it unavailable; it's only relevant for Shiny
      // apps.
      disableHideInternal();


      $el.find(".hide-zero-row")
        .on("click", function() {
          var checked = toggleCheckbox($(this).find(".settings-checkbox"));

          if (checked) {
            vis.codeTable.hideZeroTimeRows();
          } else {
            vis.codeTable.showZeroTimeRows();
          }
        });


      // Position the div, given the top-right offset
      function setOffset(offset) {
        var $el = $(el);
        $el.offset({
          top: offset.top,
          left: offset.right - $el.outerWidth()
        });
      }

      el.style.visibility = "hidden";
      function toggleVisibility(offset) {
        if (el.style.visibility === "visible") {
          el.style.visibility = "hidden";
        } else {
          el.style.visibility = "visible";
          $(document).on("click", hideOnClickOutside);
        }
      }

      // Hide the panel when a click happens outside. This handler also removes
      // itself after it fires.
      function hideOnClickOutside(e) {
        var $el = $(el);
        if (!$el.is(e.target) && $el.has(e.target).length === 0) {
          el.style.visibility = "hidden";
          // Unregister this event listener
          $(document).off("click", hideOnClickOutside);
        }
      }

      return {
        el: el,
        setOffset: setOffset,
        toggleVisibility: toggleVisibility,
        enableHideInternal: enableHideInternal,
        disableHideInternal: disableHideInternal
      };
    }

    // Generate the code table ----------------------------------------
    function generateCodeTable(el) {
      var content = d3.select(el);

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

      // Use pseudo-content and CSS content rule to make text unselectable and
      // uncopyable. See https://danoc.me/blog/css-prevent-copy/
      rows.append("td")
        .attr("class", "linenum")
        .attr("data-pseudo-content", function(d) { return d.linenum; });

      rows.append("td")
        .attr("class", "code r")
        .text(function(d) { return d.content; })
        .each(function() { hljs.highlightBlock(this); });

      rows.append("td")
        .attr("class", "time")
        .attr("data-pseudo-content",
              function(d) { return (Math.round(d.sumTime * 100) / 100); });

      rows.append("td")
        .attr("class", "percent")
        .attr("data-pseudo-content",
              function(d) { return Math.round(d.sumTime/vis.totalTime * 100); });

      rows.append("td")
        .attr("class", "timebar-cell")
        .append("div")
          .attr("class", "timebar")
          .style("width", function(d) {
            return Math.round(d.propTime * 100) + "%";
          })
          // Add the equivalent of &nbsp; to be added with CSS content
          .attr("data-pseudo-content", "\u00a0");

      rows
        .on("click", function(d) {
          // Info box is only relevant when mousing over flamegraph
          vis.infoBox.hide();
          highlighter.click(d);
        })
        .on("mouseover", function(d) {
          if (highlighter.isLocked()) return;

          // Info box is only relevant when mousing over flamegraph
          vis.infoBox.hide();
          highlighter.hover(d);
        })
        .on("mouseout", function(d) {
          if (highlighter.isLocked()) return;

          highlighter.hover(null);
        });

      function hideZeroTimeRows() {
        rows
          .filter(function(d) { return d.sumTime === 0; })
          .style("display", "none");
      }

      function showZeroTimeRows() {
        rows
          .filter(function(d) { return d.sumTime === 0; })
          .style("display", "");
      }

      function addLockHighlight(d) {
        var target = d;
        rows
          .filter(function(d) { return d === target; } )
          .classed({ locked: true });
      }

      function clearLockHighlight() {
        rows
          .filter(".locked")
          .classed({ locked: false });
      }

      function addActiveHighlight(d) {
        // If we have filename and linenum, search for cells that match, and
        // set them as "active".
        var target = d;
        if (target.filename && target.linenum) {
          var tr = rows
            .filter(function(d) {
              return d.linenum === target.linenum &&
                     d.filename === target.filename;
            })
            .classed({ active: true });

          tr.node().scrollIntoViewIfNeeded();
        }
      }

      function clearActiveHighlight() {
        rows
          .filter(".active")
          .classed({ active: false });
      }

      function enableScroll() {
        // TODO: implement this
      }

      function disableScroll() {
      }

      return {
        el: el,
        hideZeroTimeRows: hideZeroTimeRows,
        showZeroTimeRows: showZeroTimeRows,
        addLockHighlight: addLockHighlight,
        clearLockHighlight: clearLockHighlight,
        addActiveHighlight: addActiveHighlight,
        clearActiveHighlight: clearActiveHighlight,
        enableScroll: enableScroll,
        disableScroll: disableScroll
      };
    }


    var highlighter = (function() {
      // D3 data objects for the currently locked and active items
      var lockItem = null;
      var activeItem = null;

      function isLocked() {
        return lockItem !== null;
      }

      function currentLock() {
        return lockItem;
      }

      function currentActive() {
        return activeItem;
      }


      // This is called when a flamegraph cell or a line of code is clicked on.
      // Clicks also should trigger hover events.
      function click(d) {
        // If d is null (background is clicked), or if locked and this click
        // is on the currently locked selection, just unlock and return.
        if (d === null || (lockItem && d === lockItem)) {
          lockItem = null;
          vis.flameGraph.clearLockHighlight();
          vis.codeTable.clearLockHighlight();
          return;
        }

        // If nothing currently locked, or if locked and this click is on
        // something other than the currently locked selection, then lock the
        // current selection.
        lockItem = d;

        vis.flameGraph.clearLockHighlight();
        vis.codeTable.clearLockHighlight();
        hover(null);

        vis.flameGraph.addLockHighlight(d);
        vis.codeTable.addLockHighlight(d);
        hover(d);
      }


      function hover(d) {
        activeItem = d;

        if (activeItem) {
          vis.flameGraph.addActiveHighlight(activeItem);
          vis.codeTable.addActiveHighlight(activeItem);
          return;
        }

        vis.flameGraph.clearActiveHighlight();
        vis.codeTable.clearActiveHighlight();
      }

      return {
        isLocked: isLocked,
        currentLock: currentLock,
        currentActive: currentActive,

        click: click,
        hover: hover
      };
    })();


    // Generate the flame graph -----------------------------------------------
    function generateFlameGraph(el) {
      el.innerHTML = "";

      var stackHeight = 15;   // Height of each layer on the stack, in pixels
      var zoomMargin = 0.02;  // Extra margin on sides when zooming to fit

      // Dimensions -----------------------------------------------------------

      // Margin inside the svg where the plotting occurs
      var dims = {
        margin: { top: 0, right: 0, left: 0, bottom: 20 }
      };
      dims.width = el.clientWidth - dims.margin.left - dims.margin.right;
      dims.height = el.clientHeight - dims.margin.top - dims.margin.bottom;

      var domains = {
        x: [
          d3.min(vis.prof, function(d) { return d.startTime; }),
          d3.max(vis.prof, function(d) { return d.endTime; })
        ],
        y: [
          d3.min(vis.prof, function(d) { return d.depth; }) - 1,
          d3.max(vis.prof, function(d) { return d.depth; })
        ]
      };
      // Slightly expand x domain
      domains.x = expandRange(domains.x, zoomMargin);

      // Scales ---------------------------------------------------------------
      var scales = {
        x: d3.scale.linear()
            .domain(domains.x)
            .range([0, dims.width]),

        y: d3.scale.linear()
            .domain(domains.y)
            .range([dims.height, dims.height - (domains.y[1] - domains.y[0]) * stackHeight]),

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
      var svg = d3.select(el).append('svg');

      var clipRect = svg.append("clipPath")
          .attr("id", "clip-" + vis.el.id)
        .append("rect");

      var container = svg.append('g')
        .attr("transform", "translate(" + dims.margin.left + "," + dims.margin.top + ")")
        .attr("clip-path", "url(" + urlNoHash() + "#clip-" + vis.el.id + ")");

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

        var data = vis.prof.filter(function(d) {
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
          .attr("class", "profvis-label")
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
          .attr("y", function(d) { return yScale(depth(d) - 0.8); });

        return cells;
      }


      // Redraw without a transition (regular panning and zooming)
      function redrawImmediate() {
        cells = selectActiveCells(scales);

        cells.exit().remove();
        addItems(cells.enter())
          .call(addLockHighlightSelection, highlighter.currentLock())
          .call(addActiveHighlightSelection, highlighter.currentActive());
        cells.call(positionItems, scales);
        cells.select('text')
          .call(updateLabelVisibility);
        svg.select(".x.axis").call(xAxis);
      }

      // Redraw for double-click zooming, where there's a transition
      function redrawZoom(duration) {
        // Figure out if we're zooming in or out. This will determine when we
        // recalculate the label visibility: before or after the transition.
        var prevExtent = prevScales.x.domain()[1] - prevScales.x.domain()[0];
        var curExtent = scales.x.domain()[1] - scales.x.domain()[0];
        var zoomIn = curExtent < prevExtent;

        cells = selectActiveCells(scales);

        // Phase 1
        // Add the enter items, highlight them, and position them using the
        // previous scales
        addItems(cells.enter())
          .call(addLockHighlightSelection, highlighter.currentLock())
          .call(addActiveHighlightSelection, highlighter.currentActive())
          .call(positionItems, prevScales);

        // If zooming out, update label visibility. This will hide some labels
        // now, before the transition, ensuring that they will never be larger
        // than the box.
        if (!zoomIn) {
          cells.select('text')
            .call(updateLabelVisibility);
        }

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
        // If zooming in, update label visibility. This will hide some labels
        // now, after the transition, ensuring that they will never be larger
        // than the box.
        if (zoomIn) {
          cells.select('text')
            .transition().delay(duration)
            .call(updateLabelVisibility);
        }

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
        // Add the enter items, highlight them, and position them using the
        // previous scales
        addItems(cells.enter())
          .call(addLockHighlightSelection, highlighter.currentLock())
          .call(addActiveHighlightSelection, highlighter.currentActive())
          .call(positionItems, prevScales);

        cells.select('text')
          .call(updateLabelVisibility);

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
        // Highlight and position the move-in items with the old scales
        moveInCells
          .call(addLockHighlightSelection, highlighter.currentLock())
          .call(addActiveHighlightSelection, highlighter.currentActive())
          .call(positionItems, prevScales);

        cells.select('text')
          .call(updateLabelVisibility);

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
        // Highlight and position the fade-in items, then fade in
        fadeInCells
            .call(addLockHighlightSelection, highlighter.currentLock())
            .call(addActiveHighlightSelection, highlighter.currentActive())
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
          var oldDisplay = el.style.display;
          el.style.display = "inline";
          labelWidthTable[nchar] = el.getBoundingClientRect().width;
          el.style.display = oldDisplay;
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
        labels.style("display", function(d) {
          var labelWidth = getLabelWidth(this, d.label.length);
          var boxWidth = getRectWidth(d.endTime - d.startTime);

          return (labelWidth <= boxWidth) ? "" : "none";
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
      var dragging = false;

      function addMouseEventHandlers(cells) {
        cells
          .on("mouseup", function(d) {
            if (dragging) return;

            // If it wasn't a drag, treat it as a click
            vis.infoBox.show(d);
            highlighter.click(d);
          })
          .on("mouseover", function(d) {
            if (dragging) return;

            // If no label currently shown, display a tooltip
            var label = this.querySelector(".profvis-label");
            if (label.style.display === "none") {
              var box = this.getBBox();
              showTooltip(
                d.label,
                box.x + box.width / 2,
                box.y - box.height
              );
            }

            if (!highlighter.isLocked()) {
              vis.infoBox.show(d);
              highlighter.hover(d);
            }
          })
          .on("mouseout", function(d) {
            if (dragging) return;

            hideTooltip();

            if (!highlighter.isLocked()) {
              vis.infoBox.hide();
              highlighter.hover(null);
            }
          })
          .on("dblclick.zoomcell", function(d) {
            // When a cell is double-clicked, zoom x to that cell's width.
            savePrevScales();

            scales.x.domain(expandRange([d.startTime, d.endTime], zoomMargin));
            zoom.x(scales.x);

            redrawZoom(250);
          });

        return cells;
      }

      // Tooltip --------------------------------------------------------
      function showTooltip(label, x, y) {
        var tooltip = container.append("g").attr("class", "profvis-tooltip");
        var tooltipRect = tooltip.append("rect");
        var tooltipLabel = tooltip.append("text")
          .text(label)
          .attr("x", x)
          .attr("y", y + stackHeight * 0.2); // Shift down slightly for baseline

        // Add box around label
        var labelBox = tooltipLabel.node().getBBox();
        var rectWidth = labelBox.width + 10;
        var rectHeight = labelBox.height + 4;
        tooltipRect
          .attr("width", rectWidth)
          .attr("height", rectHeight)
          .attr("x", x - rectWidth / 2)
          .attr("y", y - rectHeight / 2)
          .attr("rx", 4)    // Rounded corners -- can't set this in CSS
          .attr("ry", 4);
      }

      function hideTooltip() {
        container.select("g.profvis-tooltip").remove();
      }


      // Highlighting ---------------------------------------------------------

      function addLockHighlight(d) {
        var target = d;
        addLockHighlightSelection(cells, d);
      }

      function clearLockHighlight() {
        cells
          .filter(".locked")
          .classed({ locked: false });
      }


      function addActiveHighlight(d) {
        if (!d) return;
        addActiveHighlightSelection(cells, d);
      }

      function clearActiveHighlight() {
        cells
          .filter(".active")
          .classed({ active: false });
      }

      // These are versions of addLockHighlight and addActiveHighlight which
      // are only internally visible. It must be passed a selection of cells to
      // perform the highlighting on. This can be more efficient because it can
      // operate on just an enter selection instead of all cells.
      function addLockHighlightSelection(selection, d) {
        if (!d) return;

        var target = d;
        selection
          .filter(function(d) { return d === target; } )
          .classed({ locked: true })
          .call(moveToFront);
      }

      function addActiveHighlightSelection(selection, d) {
        if (!d) return;

        var target = d;
        if (target.filename && target.linenum) {
          selection
            .filter(function(d) {
              // Check for filename and linenum match, and if provided, a label match.
              var match = d.filename === target.filename &&
                          d.linenum === target.linenum;
              if (!!target.label) {
                match = match && (d.label === target.label);
              }
              return match;
            })
            .classed({ active: true });

        } else if (target.label) {
          // Don't highlight blocks for these labels
          var exclusions = ["<Anonymous>", "FUN"];
          if (exclusions.some(function(x) { return target.label === x; })) {
            return;
          }

          // If we only have the label, search for cells that match, but make sure
          // to not select ones that have a filename and linenum.
          selection
            .filter(function(d) {
              return d.label === target.label &&
                     d.filename === null &&
                     d.linenum === null;
            })
            .classed({ active: true });
        }
      }

      // Move a D3 selection to front. If this is called on a selection, that
      // selection should have been created with a data indexing function (e.g.
      // data(data, function(d) { return ... })). Otherwise, the wrong object
      // may be moved to the front.
      function moveToFront(selection) {
        return selection.each(function() {
          this.parentNode.appendChild(this);
        });
      }


      // Panning and zooming --------------------------------------------
      // For panning and zooming x, d3.behavior.zoom does most of what we want
      // automatically. For panning y, we can't use d3.behavior.zoom becuase it
      // will also automatically add zooming, which we don't want. Instead, we
      // need to use d3.behavior.drag and set the y domain appropriately.
      var drag = d3.behavior.drag()
        .on("drag", function() {
          dragging = true;
          var y = scales.y;
          var ydom = y.domain();
          var ydiff = y.invert(d3.event.dy) - y.invert(0);
          y.domain([ydom[0] - ydiff, ydom[1] - ydiff]);
        });


      // For mousewheel zooming, we need to limit zoom amount. This is needed
      // because in Firefox, zoom increments are too big. To do this, we limit
      // scaleExtent before the first zoom event, and after each subsequent
      // one.
      //
      // When zooming out, there's an additional limit: never zoom out past
      // the original zoom span. The reason it's necessary to calculate this
      // each time, instead of simply setting the scaleExtent() so that the
      // lower bound is 1, is because other zoom events (like
      // dblclick.zoomcell) are able to change the domain of scales.x, without
      // changing the value of zoom.scale(). This means that the relationship
      // between the zoom.scale() does not have a fixed linear relationship to
      // the span of scales.x, and we have to recalculate it.
      var maxZoomPerStep = 1.1;

      function zoomOutLimit() {
        var span = scales.x.domain()[1] - scales.x.domain()[0];
        var startSpan = domains.x[1] - domains.x[0];
        return Math.min(maxZoomPerStep, startSpan/span);
      }

      var zoom = d3.behavior.zoom()
        .x(scales.x)
        .on("zoomstart", function() {
          zoom.scaleExtent([zoom.scale() / zoomOutLimit(), zoom.scale() * maxZoomPerStep]);
        })
        .on("zoom", function(e) {
          redrawImmediate();
          zoom.scaleExtent([zoom.scale() / zoomOutLimit(), zoom.scale() * maxZoomPerStep]);
        });

      // Register drag before zooming, because we need the drag to set the y
      // scale before the zoom triggers a redraw.
      svg
        .on("mouseup", function(d) {
          dragging = false;
        })
        .call(drag);

      // Unlock selection when background is clicked, and zoom out when
      // background is double-clicked.
      backgroundRect
        .on("mouseup", function(d) {
          if (dragging) return;

          // If it wasn't a drag, hide info box and unlock.
          vis.infoBox.hide();
          highlighter.click(null);
        })
        .on("dblclick.zoombackground", function() {
          savePrevScales();

          scales.x.domain(domains.x);
          zoom.x(scales.x);

          redrawZoom(250);
        });


      var zoomEnabled = false;
      function disableZoom() {
        if (zoomEnabled) {
          svg.on(".zoom", null);
          zoomEnabled = false;
        }
      }
      function enableZoom() {
        if (!zoomEnabled) {
          svg
            .call(zoom)
            .on("dblclick.zoom", null); // Disable zoom's built-in double-click behavior
          zoomEnabled = true;
        }
      }
      enableZoom();

      onResize();

      return {
        el: el,
        onResize: onResize,
        redrawImmediate: redrawImmediate,
        redrawZoom: redrawZoom,
        redrawCollapse: redrawCollapse,
        redrawUncollapse: redrawUncollapse,
        savePrevScales: savePrevScales,
        useCollapsedDepth: useCollapsedDepth,
        useUncollapsedDepth: useUncollapsedDepth,
        addLockHighlight: addLockHighlight,
        clearLockHighlight: clearLockHighlight,
        addActiveHighlight: addActiveHighlight,
        clearActiveHighlight: clearActiveHighlight,
        disableZoom: disableZoom,
        enableZoom: enableZoom
      };
    } // generateFlameGraph


    function initInfoBox(el) {

      function show(d) {
        var label = d.label ? d.label : "";
        var ref = (d.filename && d.linenum) ?
          (d.filename + "#" + d.linenum) :
          "(source unavailable)";

        el.style.visibility = "";

        el.innerHTML =
          "<table>" +
          "<tr><td class='infobox-title'>Label</td><td>" + escapeHTML(label) + "</td></tr>" +
          "<tr><td class='infobox-title'>Called from</td><td>" + escapeHTML(ref) + "</td></tr>" +
          "<tr><td class='infobox-title'>Total time</td><td>" + (d.endTime - d.startTime) + "ms</td></tr>" +
          "<tr><td class='infobox-title'>Agg. total time</td><td>" + vis.aggLabelTimes[label] + "ms</td></tr>" +
          "<tr><td class='infobox-title'>Call stack depth</td><td>" + d.depth + "</td></tr>" +
          "</table>";
      }

      function hide() {
        el.style.visibility = "hidden";
      }

      hide();

      return {
        el: el,
        show: show,
        hide: hide
      };
    }

    function enableScroll() {
      vis.codeTable.enableScroll();
      vis.flameGraph.enableZoom();
    }

    function disableScroll() {
      vis.codeTable.disableScroll();
      vis.flameGraph.disableZoom();
    }


    // Set up resizing --------------------------------------------------------
    // Resize left and right sides to 50% of available space and add callback
    // for window resizing.
    function initResizing() {
      var $el = $(vis.el);
      var $statusBar = $el.children(".profvis-status-bar");
      var $settingsPanel = $el.children(".profvis-settings-panel");
      var $codeTable = $el.children(".profvis-code");
      var $flameGraph = $el.children(".profvis-flamegraph");
      var $infoBox = $el.children(".profvis-infobox");
      var $splitBar = $el.children(".profvis-splitbar");

      // Record the gap between the split bar and the objects to left and right
      var splitBarGap = {
        left: $splitBar.offset().left - offsetRight($codeTable),
        right: $flameGraph.offset().left - offsetRight($splitBar)
      };

      // Capture the initial distance from the left and right of container element
      var margin = {
        left: $codeTable.position().left,
        right: $el.innerWidth() - positionRight($flameGraph)
      };

      // Capture infoBox inset from left of flameGraph
      var infoboxInset = $infoBox.offset().left - $flameGraph.offset().left;

      // Record the proportions from the previous call to resizePanels. This is
      // needed when we resize the window to preserve the same proportions.
      var lastSplitProportion;

      // Resize the panels. splitProportion is a number from 0-1 representing the
      // horizontal position of the split bar.
      function resizePanels(splitProportion) {
        var elOffsetLeft = $el.offset().left;
        var innerWidth = offsetRight($flameGraph) - $codeTable.offset().left;

        $splitBar.offset({
          left: $codeTable.offset().left + innerWidth * splitProportion -
                $splitBar.outerWidth()/2
        });

        // Size and position left and right-side elements
        var leftPanelWidth = $splitBar.position().left - splitBarGap.left - margin.left;
        $codeTable.outerWidth(leftPanelWidth);
        $statusBar.outerWidth(leftPanelWidth);

        var rightPanelOffsetLeft = offsetRight($splitBar) + splitBarGap.right;
        $infoBox.offset({ left: rightPanelOffsetLeft + infoboxInset });
        $flameGraph.offset({ left: rightPanelOffsetLeft });

        lastSplitProportion = splitProportion;
      }

      // Initially, set widths to 50/50
      // For the first sizing, we don't need to call vis.flameGraph.onResize()
      // because this happens before the flame graph is generated.
      resizePanels(0.5);

      $(window).resize(
        debounce(function() {
          resizePanels(lastSplitProportion);
          vis.flameGraph.onResize();
        }, 250)
      );

      // Get current proportional position of split bar
      function splitProportion() {
        var splitCenter = $splitBar.offset().left - $codeTable.offset().left +
                          $splitBar.outerWidth()/2;
        var innerWidth = offsetRight($flameGraph) - $codeTable.offset().left;
        return splitCenter / innerWidth;
      }

      function positionRight($el) {
        return $el.position().left + $el.outerWidth();
      }
      function offsetRight($el) {
        return $el.offset().left + $el.outerWidth();
      }

      // Enable dragging of the split bar ---------------------------------------
      (function() {
        var dragging = false;
        var startDragX;
        var startOffsetLeft;

        var stopDrag = function(e) {
          if (!dragging) return;
          dragging = false;

          document.removeEventListener("mousemove", drag);
          document.removeEventListener("mouseup", stopDrag);

          $splitBar.css("opacity", "");

          var dx = e.pageX - startDragX;
          if (dx === 0) return;

          resizePanels(splitProportion());
          vis.flameGraph.onResize();
        };

        var startDrag = function(e) {
          // Don't start another drag if we're already in one.
          if (dragging) return;
          dragging = true;
          pauseEvent(e);

          $splitBar.css("opacity", 0.75);

          startDragX = e.pageX;
          startOffsetLeft = $splitBar.offset().left;

          document.addEventListener("mousemove", drag);
          document.addEventListener("mouseup", stopDrag);
        };

        var drag = function(e) {
          if (!dragging) return;
          pauseEvent(e);

          var dx = e.pageX - startDragX;
          if (dx === 0) return;

          // Move the split bar
          $splitBar.offset({ left: startOffsetLeft + dx });
        };

        // Stop propogation so that we don't select text while dragging
        function pauseEvent(e){
          if(e.stopPropagation) e.stopPropagation();
          if(e.preventDefault) e.preventDefault();
          e.cancelBubble = true;
          e.returnValue = false;
          return false;
        }

        $splitBar[0].addEventListener("mousedown", startDrag);
      })();

    }


    var prof = prepareProfData(message.prof, message.interval);

    var vis = {
      el: el,
      prof: prof,
      profTree: getProfTree(prof),
      interval: message.interval,
      totalTime: getTotalTime(prof),
      files: message.files,
      aggLabelTimes: getAggregatedLabelTimes(prof),
      fileLineTimes: getFileLineTimes(prof, message.files),

      // Objects representing each component
      statusBar: null,
      settingsPanel: null,
      codeTable: null,
      flameGraph: null,
      infoBox: null,

      // Functions to enable/disable responding to scrollwheel events
      enableScroll: enableScroll,
      disableScroll: disableScroll
    };

    // Render the objects ---------------------------------------------
    var statusBarEl = document.createElement("div");
    statusBarEl.className = "profvis-status-bar";
    vis.el.appendChild(statusBarEl);

    var codeTableEl = document.createElement("div");
    codeTableEl.className = "profvis-code";
    vis.el.appendChild(codeTableEl);

    var settingsPanelEl = document.createElement("div");
    settingsPanelEl.className = "profvis-settings-panel";
    vis.el.appendChild(settingsPanelEl);

    var flameGraphEl = document.createElement("div");
    flameGraphEl.className = "profvis-flamegraph";
    vis.el.appendChild(flameGraphEl);

    var infoBoxEl = document.createElement("div");
    infoBoxEl.className = "profvis-infobox";
    vis.el.appendChild(infoBoxEl);

    var splitBarEl = document.createElement("div");
    splitBarEl.className = "profvis-splitbar";
    vis.el.appendChild(splitBarEl);

    // Efficient to properly size panels before the code + flamegraph are
    // rendered, so that we don't have to re-render.
    initResizing();

    // Create the UI components
    vis.statusBar = generateStatusBar(statusBarEl);
    vis.settingsPanel = generateSettingsPanel(settingsPanelEl);
    vis.codeTable = generateCodeTable(codeTableEl);
    vis.flameGraph = generateFlameGraph(flameGraphEl);
    vis.infoBox = initInfoBox(infoBoxEl);

    // If any depth collapsing occured, enable the "hide internal" checkbox.
    if (prof.some(function(d) { return d.depth !== d.depthCollapsed; })) {
      vis.settingsPanel.enableHideInternal();
    }

    // Start with scrolling disabled because of mousewheel scrolling issue
    disableScroll();

    // Make the vis object accessible via the DOM element
    $(el).data("profvis", vis);

    return vis;
  };  // profvis.render()

  // Calculate amount of time spent on each line of code. Returns nested objects
  // grouped by file, and then by line number.
  function getFileLineTimes(prof, files) {
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
          // Add this node's time only if no ancestor node has the same
          // filename and linenum. This is to avoid double-counting times for
          // a line.
          var incTime = 0;
          if (!ancestorHasFilenameLinenum(d.filename, d.linenum, d.parent)) {
            incTime = d.endTime - d.startTime;
          }
          return sum + incTime;
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

    // Returns true if the given node or one of its ancestors has the given
    // filename and linenum; false otherwise.
    function ancestorHasFilenameLinenum(filename, linenum, node) {
      if (!node) {
        return false;
      }
      if (node.filename === filename && node.linenum === linenum) {
        return true;
      }
      return ancestorHasFilenameLinenum(filename, linenum, node.parent);
    }
  }

  function prepareProfData(prof, interval) {
    // Convert object-with-arrays format prof data to array-of-objects format
    var data = colToRows(prof);
    data = addParentChildLinks(data);
    data = consolidateRuns(data);
    data = applyInterval(data, interval);
    data = findCollapsedDepths(data);

    return data;
  }

  // Given the raw profiling data, convert `time` and `lastTime` fields to
  // `startTime` and `endTime`, and use the supplied interval. Modifies data
  // in place.
  function applyInterval(prof, interval) {
    prof.forEach(function(d) {
      d.startTime = interval * (d.time - 1);
      d.endTime = interval * (d.lastTime);
      delete d.time;
      delete d.lastTime;
    });

    return prof;
  }

  // Find the total time spanned in the data
  function getTotalTime(prof) {
    return d3.max(prof, function(d) { return d.endTime; }) -
           d3.min(prof, function(d) { return d.startTime; });
  }

  // Calculate the total amount of time spent in each function label
  function getAggregatedLabelTimes(prof) {
    var labelTimes = {};
    var tree = getProfTree(prof);
    calcLabelTimes(tree);

    return labelTimes;

    // Traverse the tree with the following strategy:
    // * Check if current label is used in an ancestor.
    //   * If yes, don't add to times for that label.
    //   * If no, do add to times for that label.
    // * Recurse into children.
    function calcLabelTimes(node) {
      var label = node.label;
      if (!ancestorHasLabel(label, node.parent)) {
        if (labelTimes[label] === undefined)
          labelTimes[label] = 0;

        labelTimes[label] += node.endTime - node.startTime;
      }

      node.children.forEach(calcLabelTimes);
    }

    // Returns true if the given node or one of its ancestors has the given
    // label; false otherwise.
    function ancestorHasLabel(label, node) {
      if (node) {
        if (node.label === label) {
          return true;
        }
        return ancestorHasLabel(label, node.parent);
      } else {
        return false;
      }
    }
  }


  // Given profiling data, add parent and child links to indicate stack
  // relationships.
  function addParentChildLinks(prof) {
    var data = d3.nest()
      .key(function(d) { return d.time; })
      .rollup(function(leaves) {
        leaves = leaves.sort(function(a, b) { return a.depth - b.depth; });

        leaves[0].parent = null;
        leaves[0].children = [];

        for (var i=1; i<leaves.length; i++) {
          leaves[i-1].children.push(leaves[i]);
          leaves[i].parent = leaves[i-1];
          leaves[i].children = [];
        }

        return leaves;
      })
      .map(prof);

    // Convert data from object of arrays to array of arrays
    data = d3.map(data).values();
    // Flatten data
    return d3.merge(data);
  }


  // Given profiling data, consolidate consecutive blocks for a flamegraph.
  // This function also assigns correct parent-child relationships to form a
  // tree of data objects, with a hidden root node at depth 0.
  function consolidateRuns(prof) {
    // Create a special top-level leaf whose only purpose is to point to its
    // children, the items at depth 1.
    var topLeaf = {
      depth: 0,
      parent: null,
      children: prof.filter(function(d) { return d.depth === 1; })
    };

    var tree = consolidateTree(topLeaf);
    var data = treeToArray(tree);
    // Remove the root node from the flattened data
    data = data.filter(function(d) { return d.depth !== 0; });
    return data;

    function consolidateTree(tree) {
      var leaves = tree.children;
      leaves = leaves.sort(function(a, b) { return a.time - b.time; });

      // Collapse consecutive leaves, with some conditions
      var startLeaf = null;  // leaf starting this run
      var lastLeaf = null;   // The last leaf we've looked at
      var newLeaves = [];
      var collectedChildren = [];

      // This takes the start leaf, end leaf, and the set of children for the
      // new leaf, and creates a new leaf which copies all its properties from
      // the startLeaf, except lastTime and children.
      function addNewLeaf(startLeaf, endLeaf, newLeafChildren) {
        var newLeaf = $.extend({}, startLeaf);
        newLeaf.lastTime = endLeaf.time;
        newLeaf.parent = tree;
        newLeaf.children = newLeafChildren;

        // Recurse into children
        newLeaf = consolidateTree(newLeaf);
        newLeaves.push(newLeaf);
      }

      for (var i=0; i<leaves.length; i++) {
        var leaf = leaves[i];

        if (i === 0) {
          startLeaf = leaf;

        } else if (leaf.label !== startLeaf.label ||
                   leaf.filename !== startLeaf.filename ||
                   leaf.linenum !== startLeaf.linenum ||
                   leaf.depth !== startLeaf.depth)
        {
          addNewLeaf(startLeaf, lastLeaf, collectedChildren);

          collectedChildren = [];
          startLeaf = leaf;
        }

        collectedChildren = collectedChildren.concat(leaf.children);
        lastLeaf = leaf;
      }

      // Add the last one, if there were any at all
      if (i !== 0) {
        addNewLeaf(startLeaf, lastLeaf, collectedChildren);
      }

      tree.children = newLeaves;
      return tree;
    }

    // Given a tree, pull out all the leaves and put them in a flat array
    function treeToArray(tree) {
      var allLeaves = [];

      function pushLeaves(leaf) {
        allLeaves.push(leaf);
        leaf.children.forEach(pushLeaves);
      }

      pushLeaves(tree);
      return allLeaves;
    }
  }


  // Given profiling data with parent-child information, get the root node.
  function getProfTree(prof) {
    if (prof.length === 0)
      return null;

    // Climb up to the top of the tree
    var node = prof[0];
    while (node.parent) {
      node = node.parent;
    }
    return node;
  }


  // Given profiling data, find depth of items after hiding items between
  // items with labels "..stacktraceoff.." and "..stacktraceon..". Modifies
  // data in place.
  function findCollapsedDepths(data) {
    var tree = getProfTree(data);
    calculateDepths(tree, tree.depth, 0);
    return data;

    function calculateDepths(node, curCollapsedDepth, stacktraceOffCount) {
      if (node.label === "..stacktraceoff..") {
        stacktraceOffCount++;
      }

      if (stacktraceOffCount > 0) {
        node.depthCollapsed = null;
      } else {
        node.depthCollapsed = curCollapsedDepth;
        curCollapsedDepth++;
      }

      if (node.label === "..stacktraceon..") {
        stacktraceOffCount--;
      }

      // Recurse
      node.children.forEach(function(x) {
        calculateDepths(x, curCollapsedDepth, stacktraceOffCount);
      });
    }
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

  // Given an array with two values (a min and max), return an array with the
  // range expanded by `amount`.
  function expandRange(range, amount) {
    var adjust = amount * (range[1] - range[0]);
    return [
      range[0] - adjust,
      range[1] + adjust
    ];
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


  (function() {
    // Prevent unwanted scroll capturing. Based on the corresponding code in
    // https://github.com/rstudio/leaflet

    // The rough idea is that we disable scroll wheel zooming inside each
    // profvis object, until the user moves the mouse cursor or clicks on the
    // visualization. This is trickier than just listening for mousemove,
    // because mousemove is fired when the page is scrolled, even if the user
    // did not physically move the mouse. We handle this by examining the
    // mousemove event's screenX and screenY properties; if they change, we know
    // it's a "true" move.
    //
    // There's a complication to this: when the mouse wheel is scrolled quickly,
    // on the step where the profvis DOM object overlaps the cursor, sometimes
    // the mousemove event happens before the mousewheel event, and sometimes
    // it's the reverse (at least on Chrome 46 on Linux). This means that we
    // can't rely on the mousemove handler disabling the profvis object's zoom
    // before a scroll event is triggered on the profvis object (cauzing
    // zooming). In order to deal with this, we start each profvis object with
    // zooming disabled, and also disable zooming when the cursor leaves the
    // profvis div. That way, even if a mousewheel event gets triggered on the
    // object before the mousemove, it won't cause zooming.

    // lastScreen can never be null, but its x and y can.
    var lastScreen = { x: null, y: null };

    $(document)
      .on("mousewheel DOMMouseScroll", function(e) {
        // Any mousemove events at this screen position will be ignored.
        lastScreen = { x: e.originalEvent.screenX, y: e.originalEvent.screenY };
      })
      .on("mousemove", ".profvis", function(e) {
        // Did the mouse really move?
        if (lastScreen.x !== null && e.screenX !== lastScreen.x || e.screenY !== lastScreen.y) {
          $(this).data("profvis").flameGraph.enableZoom();
          lastScreen = { x: null, y: null };
        }
      })
      .on("mousedown", ".profvis", function(e) {
        // Clicking always enables zooming.
        $(this).data("profvis").flameGraph.enableZoom();
        lastScreen = { x: null, y: null };
      })
      .on("mouseleave", ".profvis", function(e) {
        $(this).data("profvis").flameGraph.disableZoom();
      });
  })();


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
