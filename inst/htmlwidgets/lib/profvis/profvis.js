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

    var vis = {
      el: el,
      sourceProf: prof,    // Original profiling data (after a little massaging)
      curProf: prof,       // Current profiling data used in flame graph
      files: message.files,
      collapseItems: message.collapseItems,
      fileLineTimes: getFileLineTimes(prof, message.files, false),

      // DOM elements
      controlPanel: null,
      codeTable: null,
      flameGraph: null,

      // Cache D3 selections for faster interactions
      codeTableRows: null,
      flameGraphCells: null,

      // Indicates whether any filename/linenum/label is selected and locked
      lockedSelection: null
    };


    // Render the objects ---------------------------------------------
    vis.controlPanel = document.createElement("div");
    vis.controlPanel.className = "profvis-control-panel";
    vis.el.appendChild(vis.controlPanel);
    generateControlPanel();

    vis.codeTable = document.createElement("div");
    vis.codeTable.className = "profvis-code";
    vis.el.appendChild(vis.codeTable);
    generateCodeTable();

    vis.flameGraph = document.createElement("div");
    vis.flameGraph.className = "profvis-flamegraph";
    vis.el.appendChild(vis.flameGraph);
    generateFlameGraph();


    function generateControlPanel() {
      var el = vis.controlPanel;
      el.innerHTML =
        '<div><label><input class="collapse" type="checkbox" checked>Collapse</label></div>' +
        '<div><label><input class="hide-zero-row" type="checkbox">Hide lines of code with zero time</label></div>';

      var collapseCheckbox = d3.select(el).select("input.collapse");
      var hideZeroCheckbox = d3.select(el).select("input.hide-zero-row");

      // We start checked, so start the data in the collapsed state
      vis.curProf = collapseStacks(vis.sourceProf, vis.collapseItems);
      collapseCheckbox
        .on("change", function() {
          if (this.checked) {
            vis.curProf = collapseStacks(vis.sourceProf, vis.collapseItems);
          } else {
            vis.curProf = vis.sourceProf;
          }
          generateFlameGraph();
        });

      hideZeroCheckbox
        .on("change", function() {
          if (this.checked) {
            d3.select(vis.codeTable).selectAll('tr.code-row')
              .filter(function(d) { return d.sumTime === 0; })
              .style("display", "none");
          } else {
            d3.select(vis.codeTable).selectAll('tr.code-row')
              .filter(function(d) { return d.sumTime === 0; })
              .style("display", "");
          }
        });

    }

    // Generate the code table ----------------------------------------
    function generateCodeTable() {
      var el = vis.codeTable;

      el.innerHTML = '<div class="profvis-table-inner"></div>';

      var content = d3.select(el).select("div.profvis-table-inner");

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
        .attr("class", "timebar-cell")
        .append("div")
          .attr("class", "timebar")
          .style("width", function(d) {
            return Math.round(d.propTime * 100) + "%";
          })
          .html("&nbsp;");

      rows
        .on("click", clickItem)
        .on("mouseover", mouseOverItem)
        .on("mouseout", mouseOutItem);

      // Cache rows
      vis.codeTableRows = rows;

      return content;
    }


    // Generate the flame graph ---------------------------------------
    function generateFlameGraph() {
      var el = vis.flameGraph;
      el.innerHTML = "";

      var stackHeight = 15;   // Height of each layer on the stack, in pixels

      // Process data ---------------------------------------------------
      var prof = consolidateRuns(vis.curProf);

      // Size of virtual graphing area ----------------------------------
      // (Can differ from visible area)

      // Margin inside the svg where the plotting occurs
      var margin = { top: 0, right: 0, left: 0, bottom: 20 };
      var width = el.clientWidth - margin.left - margin.right;
      var height = el.clientHeight - margin.top - margin.bottom;

      var xDomain = [
        d3.min(prof, function(d) { return d.startTime; }),
        d3.max(prof, function(d) { return d.endTime; })
      ];
      var yDomain = [
        d3.min(prof, function(d) { return d.depth; }) - 1,
        d3.max(prof, function(d) { return d.depth; })
      ];

      // Scales
      var x = d3.scale.linear()
        .domain(xDomain)
        .range([0, width]);

      var y = d3.scale.linear()
        .domain(yDomain)
        .range([height, height - (yDomain[1] - yDomain[0]) * stackHeight]);

      // Creat SVG objects ----------------------------------------------
      var wrapper = d3.select(el).append('div')
        .attr('class', 'profvis-flamegraph-inner');

      var svg = wrapper.append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom);

      var container = svg.append('g')
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Add a background rect so we have something to grab for zooming/panning
      var backgroundRect = container.append("rect")
        .attr("class", "background")
        .attr("width", width)
        .attr("height", height);

      var cells = container.selectAll(".cell")
        .data(prof)
        .enter()
        .append("g")
          .attr("class", "cell")
          .classed("highlighted", function(d) { return d.filename !== null; });

      var rects = cells.append("rect")
        .attr("class", "rect");

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

      var labels = cells.append("text")
        .attr("class", "label")
        .text(function(d) { return d.label; });


      // Axes ------------------------------------------------------------
      var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

      svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(" + margin.left + "," + height + ")")
        .call(xAxis);


      // Redrawing ------------------------------------------------------------

      // Updating the attributes of lots of SVG elements is expensive. The
      // basic strategy here is to first filter out all the elements that
      // don't fit in the plotting area, and then only operate on what's left.
      //
      // d3.select() and setAttribute are expensive. To minimize calls to them,
      // this is what we'll do:
      // * Do one pass finding which cells will be in the visible area. Set
      //   display to "none" if it's not in the visible area. (Note that
      //   display:none results in much better performance than
      //   visibility:hidden)
      // * Set the external vars activeRects and activeLabels from these cells.
      // * Then during redraws, set x, y, etc. attributes on those active
      //   elements only.
      //
      // Rendering text elements is slow, so setting hidden labels to
      // display:none improves performance a lot.

      var activeRects;
      var activeLabels;
      // This sets the activeRects and activeCells, based on whether they're in
      // the visible area.
      function filterActiveElements() {
        // Filter based on whether the rect is in the plotting area
        var activeCells = cells.filter(function(d) {
          if (x(d.endTime)   < 0     ||
              x(d.startTime) > width ||
              y(d.depth - 1) < 0     ||
              y(d.depth)     > height)
          {
            // Set 'display' attribute instead of 'visible', because it's faster.
            if (this.getAttribute("display") !== "none")
              this.setAttribute("display", "none");
            return false;
          }

          if (this.getAttribute("display") !== "inherit")
            this.setAttribute("display", "inherit");
          return true;
        });

        activeRects = activeCells.select("rect");
        activeLabels = activeCells.select("text");
      }


      function redraw(duration) {
        if (duration === undefined) duration = 0;

        filterActiveElements();

        // Create local copies because we might add a transition and we don't
        // want to modify the original.
        var activeRects2 = activeRects;
        var activeLabels2 = activeLabels;
        var x_axis = svg.select(".x.axis");

        // Only add the transition if needed (duration!=0) because there's a
        // performance penalty
        if (duration !== 0) {
          activeRects2 = activeRects2.transition().duration(duration);
          activeLabels2 = activeLabels2.transition().duration(duration);
          x_axis = x_axis.transition().duration(duration);
        }

        activeRects2
          .attr("width", function(d) { return x(d.endTime) - x(d.startTime); })
          .attr("height", y(0) - y(1))
          .attr("x", function(d) { return x(d.startTime); })
          .attr("y", function(d) { return y(d.depth ); });

        activeLabels2
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
            var rectWidth = x(d.endTime) - x(d.startTime);

            if (textWidth + pad*2 > rectWidth) {
              return x(d.startTime) + (rectWidth - textWidth) / 2;
            } else {
              return Math.min(
                Math.max(0, x(d.startTime)) + pad,
                x(d.endTime) - textWidth - pad
              );
            }
          })
          .attr("y", function(d) { return y(d.depth - 0.5); });

        x_axis.call(xAxis);

        if (duration === 0) {
          updateLabelVisibilityDebounced();

        } else {
          // If there's a transition, select a single rect element, and add the
          // function to be called at the end of the transition.
          activeRects2.filter(function(d, i) { return i === 0; })
            .each("end", updateLabelVisibilityDebounced);
        }
      }

      // Calculate whether to display label in each cell -----------------

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
      function updateLabelVisibility() {
        // Cache the width of rects. This is a lookup table which, given the
        // timespan (width in data), gives the number of pixels. The width of
        // rects changes with the x scale, so we have to rebuild the table each
        // time we have an update.
        var rectWidthTable = {};
        var x0 = x(0);
        function getRectWidth(time) {
          // Add entry if it doesn't already exist
          if (rectWidthTable[time] === undefined) {
            rectWidthTable[time] = x(time) - x0;
          }
          return rectWidthTable[time];
        }

        // Now calculate text and rect width for each cell.
        activeLabels.attr("display", function(d) {
          var labelWidth = getLabelWidth(this, d.label.length);
          var boxWidth = getRectWidth(d.endTime - d.startTime);

          return (labelWidth <= boxWidth) ? "inherit" : "none";
        });
      }
      var updateLabelVisibilityDebounced = debounce(updateLabelVisibility, 150);


      // Make all labels start invisible, so that if they start offscreen, they
      // won't be visible when we drag them onscreen.
      labels.attr("display", "none");
      redraw();
      updateLabelVisibility(); // Call immediately the first time

      // Recalculate dimensions on resize
      function onResize() {
        width = el.clientWidth - margin.left - margin.right;
        height = el.clientHeight - margin.top - margin.bottom;

        svg
          .attr('width', width + margin.left + margin.right)
          .attr('height', height + margin.top + margin.bottom);

        backgroundRect
          .attr("width", width)
          .attr("height", height);

        svg.select(".x.axis")
          .attr("transform", "translate(" + margin.left + "," + height + ")");

        // Update the x range so that we're able to double-click on a block to
        // zoom, and have it fill the whole x width.
        x.range([0, width]);
        zoom.x(x);
        redraw();
      }
      d3.select(window).on("resize", onResize);

      // Attach mouse event handlers ------------------------------------
      cells
        .on("click", clickItem)
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

          mouseOverItem(d);
        })
        .on("mouseout", function(d) {
          hideTooltip();
          mouseOutItem(d);
        });

      // Tooltip --------------------------------------------------------
      var tooltip = container.append("g").attr("class", "tooltip");
      var tooltipRect = tooltip.append("rect");
      var tooltipLabel = tooltip.append("text");

      function showTooltip(label, x, y) {
        tooltip.attr("visibility", "visible");

        // Add label
        tooltipLabel.text(label)
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
        tooltip.attr("visibility", "hidden");
      }


      // Panning and zooming --------------------------------------------
      // For panning and zooming x, d3.behavior.zoom does most of what we want
      // automatically. For panning y, we can't use d3.behavior.zoom becuase it
      // will also automatically add zooming, which we don't want. Instead, we
      // need to use d3.behavior.drag and set the y domain appropriately.
      var drag = d3.behavior.drag()
        .on("drag", function() {
          var ydom = y.domain();
          var ydiff = y.invert(d3.event.dy) - y.invert(0);
          y.domain([ydom[0] - ydiff, ydom[1] - ydiff]);
        });

      var zoom = d3.behavior.zoom()
        .x(x)
        .scaleExtent([0.01, 1000])
        .on("zoom", redraw);

      // Register drag before zooming, because we need the drag to set the y
      // scale before the zoom triggers a redraw.
      svg
        .call(drag)
        .call(zoom)
        .on("dblclick.zoom", null); // Disable zoom's built-in double-click behavior

      // Zoom out when background is double-clicked
      backgroundRect.on("dblclick.zoombackground", function() {
        x.domain(xDomain);
        zoom.x(x);
        redraw(250);
      });

      // When a cell is double-clicked, zoom x to that cell's width.
      cells.on("dblclick.zoomcell", function(d) {
        x.domain([d.startTime, d.endTime]);
        zoom.x(x);
        redraw(250);
      });

      // Cache cells for faster access
      vis.flameGraphCells = cells;
    }


    // Highlights line of code and flamegraph blocks corresponding to a
    // filenum. linenum and, if provided, label combination. (When this is called
    // from hovering over code, no label is provided.)
    // If only a label is provided, search for cells (only in the flamegraph) that
    // have the same label.
    function highlightSelectedCode(filename, linenum, label, locked) {
      // Un-highlight lines of code and flamegraph blocks
      vis.codeTableRows.classed({ selected: false, locked: false });
      vis.flameGraphCells.classed({ selected: false, locked: false });

      if (filename && linenum) {
        // If we have filename and linenum, search for cells that match, and
        // set them as "selected".
        var tr = vis.codeTableRows.filter(function(d) {
            return d.linenum === linenum && d.filename === filename;
          })
          .classed({ selected: true, locked: locked });

        // Highlight corresponding flamegraph blocks
        vis.flameGraphCells
          .filter(function(d) {
            // Check for filename and linenum match, and if provided, a label match.
            var match = d.filename === filename && d.linenum === linenum;
            if (!!label) {
              match = match && (d.label === label);
            }
            return match;
          })
          .classed({ selected: true, locked: locked });

        tr.node().scrollIntoViewIfNeeded();

      } else if (label) {
        // Don't highlight blocks for these labels
        var exclusions = ["<Anonymous>", "FUN"];
        if (exclusions.some(function(x) { return label === x; })) {
          return;
        }

        // If we only have the label, search for cells that match, but make sure
        // to not select ones that have a filename and linenum.
        vis.flameGraphCells
          .filter(function(d) {
            return d.label === label && d.filename === null && d.linenum === null;
          })
          .classed({ selected: true, locked: locked });
      }
    }


    // This is called when a flamegraph cell or a line of code is clicked on.
    function clickItem(d) {
      // If locked, and this click is on the currently locked selection,
      // unlock.
      if (vis.lockedSelection &&
          vis.lockedSelection.filename === d.filename &&
          vis.lockedSelection.linenum === d.linenum)
      {
        vis.lockedSelection = null;
        highlightSelectedCode(d.filename, d.linenum, d.label, false);
        return;
      }

      // If nothing currently locked, or if locked and this click is on
      // something other than the currently locked selection, then lock the
      // current selection.
      vis.lockedSelection = {
        filename: d.filename,
        linenum: d.linenum
      };
      highlightSelectedCode(d.filename, d.linenum, d.label, true);
    }

    // This is called when a flamegraph cell or a line of code is moused over.
    function mouseOverItem(d) {
      if (vis.lockedSelection === null)
        highlightSelectedCode(d.filename, d.linenum, d.label, false);
    }

    // This is called when a flamegraph cell or a line of code is moused out.
    function mouseOutItem(d) {
      if (vis.lockedSelection === null)
        highlightSelectedCode(null, null, null, false);
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


  // Given profiling data and an array of function labels, remove samples
  // that contain those labels.
  function collapseStacks(prof, collapseItems) {
    var data = d3.nest()
      .key(function(d) { return d.startTime; })
      .rollup(function(leaves) {
        // Remove any leaves that have a label that's found in collapseItems.
        leaves = leaves.filter(function(leaf) {
          // If the leaf's label matches any of the collapse items, remove it.
          var matchFound = collapseItems.some(function(collapseItem) {
            return collapseItem === leaf.label;
          });

          return !matchFound;
        });

        // Recalculate depths so that collapsed stacks are contiguous.
        leaves = leaves.sort(function(a, b) { return a.depth - b.depth; });
        var startDepth = leaves[0].depth;

        // Make a clone of each leaf (so we don't change original data) and
        // update the depth.
        var newLeaves = leaves.map(function(leaf, i) {
          var newLeaf = shallowClone(leaf);
          newLeaf.depth = startDepth + i;
          return newLeaf;
        });

        return newLeaves;
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
            newLeaves.push({
              depth:     startLeaf.depth,
              filename:  startLeaf.filename,
              filenum:   startLeaf.filenum,
              label:     startLeaf.label,
              linenum:   startLeaf.linenum,
              startTime: startLeaf.startTime,
              endTime:   lastLeaf.endTime
            });

            startLeaf = leaf;
          }

          lastLeaf = leaf;
        }

        // Add the last one
        newLeaves.push({
          depth:     startLeaf.depth,
          filename:  startLeaf.filename,
          filenum:   startLeaf.filenum,
          label:     startLeaf.label,
          linenum:   startLeaf.linenum,
          startTime: startLeaf.startTime,
          endTime:   lastLeaf.endTime
        });

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

      breaks.sort();
      var newBlocks = [];
      var tmp;
      for (var i=-1; i<breaks.length; i++) {
        tmp = shallowClone(block);
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

  // Clone an object
  function shallowClone(obj) {
    var clone = {};
    clone.prototype = obj.prototype;
    for (var property in obj) {
      clone[property] = obj[property];
    }
    return clone;
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
