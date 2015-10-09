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
    var vis = {
      el: el,
      // Convert object-with-arrays format prof data to array-of-objects format
      prof: colToRows(message.prof),
      files: message.files,
      collapse: message.collapse,

      // DOM elements
      codeTable: null,
      flameGraph: null,

      // Cache D3 selections for faster interactions
      codeTableRows: null,
      flameGraphCells: null
    };


    // Render the objects ---------------------------------------------
    vis.codeTable = document.createElement("div");
    vis.codeTable.className = "profvis-code";
    vis.el.appendChild(vis.codeTable);
    generateCodeTable();

    vis.flameGraph = document.createElement("div");
    vis.flameGraph.className = "profvis-flamegraph";
    vis.el.appendChild(vis.flameGraph);
    generateFlameGraph();

    // Cache some components
    vis.codeTableRows = d3.select(vis.codeTable).selectAll("tr");
    vis.flameGraphCells = d3.select(vis.flameGraph).selectAll(".cell");


    // Generate the code table ----------------------------------------
    function generateCodeTable() {
      var el = vis.codeTable;

      var allFileTimes = getLineTimes(vis.prof, vis.files);

      el.innerHTML = '<div class="profvis-table-inner"></div>';

      var content = d3.select(el).select("div.profvis-table-inner");

      // One table for each file
      var tables = content.selectAll("table")
          .data(allFileTimes)
        .enter()
          .append("table")
          .attr("class", "profvis-table");

      // Table headers
      tables
        .append("tr").append("th")
        .attr("colspan", "4")
        .text(function(d) { return d.filename; });

      // Insert each line of code
      var rows = tables.selectAll("tr")
          .data(function(d) { return d.lineData; })
        .enter()
          .append("tr");

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
        .on("mouseover", function(d) {
          highlightSelectedCode(d.filename, d.linenum, d.label);
        });

      // Calculate longest time sample
      var maxTime = d3.max(allFileTimes, function(fileData) {
        return d3.max(fileData.lineData, function(line) {
          return d3.max(line.times);
        });
      });

      return content;
    }


    // Generate the flame graph ---------------------------------------
    function generateFlameGraph() {
      var el = vis.flameGraph;

      var stackHeight = 15;   // Height of each layer on the stack, in pixels

      // Process data ---------------------------------------------------
      var prof = collapseStacks(vis.prof, vis.collapse);
      prof = consolidateRuns(prof);

      // Size of virtual graphing area ----------------------------------
      // (Can differ from visible area)

      // Margin inside the svg where the plotting occurs
      var margin = { top: 0, right: 0, left: 0, bottom: 20 };
      var width = el.clientWidth - margin.left - margin.right;
      var height = el.clientHeight - margin.top - margin.bottom;

      var xDomain = [
        d3.min(prof, function(d) { return d.startTime; }) - 1,
        d3.max(prof, function(d) { return d.endTime; })
      ];
      var yDomain = [
        d3.min(prof, function(d) { return d.depth; }),
        d3.max(prof, function(d) { return d.depth; }) + 1
      ];

      // Scales
      var x = d3.scale.linear()
        .domain(xDomain)
        .range([0, width]);

      var y = d3.scale.linear()
        .domain(yDomain)
        .range([(yDomain[1] - yDomain[0]) * stackHeight, 0]);

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
          .attr("class", "cell");

      var rects = cells.append("rect")
        .attr("class", "rect")
        .classed("highlighted", function(d) { return d.filename !== null; });

      // Add CSS classes for highlighting cells with labels that match particular
      // regex patterns.
      var highlightPatterns = d3.entries(message.highlight);
      highlightPatterns.map(function(item) {
        var cssClass = item.key;
        var regexp = new RegExp(item.value);

        rects.classed(cssClass, function(d) {
          return d.label.search(regexp) !== -1;
        });
      });

      var labels = cells.append("text")
        .attr("class", "label")
        .text(function(d) { return d.label; });

      // Calculate whether to display label in each cell -----------------

      // Show labels that fit in the corresponding rectangle, and hide others.
      // This is very slow because of the getBoundingClientRect() calls.
      function updateLabelVisibility() {
        // Cache the width of label. This is a lookup table which, given the number
        // of characters, gives the number of pixels.
        var labelWidthTable = [];
        function getLabelWidth(el, nchar) {
          // Add entry if it doesn't already exist
          if (labelWidthTable[nchar] === undefined) {
            labelWidthTable[nchar] = el.getBoundingClientRect().width;
          }
          return labelWidthTable[nchar];
        }

        // Cache the width of rects. This is a lookup table which, given the number
        // of frames, gives the number of pixels.
        var rectWidthTable = [];
        function getRectWidth(el, nframe) {
          // Add entry if it doesn't already exist
          if (rectWidthTable[nframe] === undefined) {
            rectWidthTable[nframe] = el.getBoundingClientRect().width;
          }
          return rectWidthTable[nframe];
        }

        // Now calculate text and rect width for each cell.
        labels.attr("visibility", function(d) {
          var labelWidth = getLabelWidth(this, d.label.length);
          var boxWidth = getRectWidth(this.parentNode.querySelector(".rect"),
                                      d.endTime - d.startTime + 1);

          return (labelWidth <= boxWidth) ? "visible" : "hidden";
        });
      }
      var updateLabelVisibilityDebounced = debounce(updateLabelVisibility, 100);

      // Axes ------------------------------------------------------------
      var xAxis = d3.svg.axis()
        .scale(x)
        .orient("bottom");

      svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(" + margin.left + "," + height + ")")
        .call(xAxis);

      // Update positions when scales change ----------------------------
      function redraw(duration) {
        if (duration === undefined) duration = 0;

        // Make local copies because we may be adding transitions
        var rects2 = rects;
        var labels2 = labels;
        var x_axis = svg.select(".x.axis");

        // Only add the transition if needed (duration!=0) because there's a
        // performance penalty
        if (duration !== 0) {
          rects2 = rects2.transition().duration(duration);
          labels2 = labels2.transition().duration(duration);
          x_axis = x_axis.transition().duration(duration);
        }

        rects2
          .attr("width", function(d) { return x(d.endTime) - x(d.startTime - 1); })
          .attr("height", y(0) - y(1))
          .attr("x", function(d) { return x(d.startTime - 1); })
          .attr("y", function(d) { return y(d.depth + 1); });

        labels2
          .attr("x", function(d) { return (x(d.endTime) + x(d.startTime - 1)) / 2; })
          .attr("y", function(d) { return y(d.depth + 0.5); });

        x_axis.call(xAxis);

        if (duration === 0) {
          updateLabelVisibilityDebounced();

        } else {
          // If there's a transition, select a single rect element, and add the
          // function to be called at the end of the transition.
          rects2.filter(function(d, i) { return i === 0; })
            .each("end", updateLabelVisibilityDebounced);
        }
      }

      redraw();
      updateLabelVisibility(); // Call immediately the first time

      // Recalculate dimensions on resize
      function onResize() {
        var width = el.clientWidth - margin.left - margin.right;
        var height = el.clientHeight - margin.top - margin.bottom;

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
        .on("mouseover", function(d) {
          // If no label currently shown, display a tooltip
          var label = this.querySelector(".label");
          if (label.getAttribute("visibility") !== "visible") {
            var labelBox = label.getBBox();
            showTooltip(
              d.label,
              labelBox.x + labelBox.width / 2,
              labelBox.y - labelBox.height - 5
            );
          }

          highlightSelectedCode(d.filename, d.linenum, d.label);
        })
        .on("mouseout", function(d) {
          hideTooltip();
          highlightSelectedCode(null, null, null);
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


      // When a cell is double-clicked, zoom x to that cell's width.
      cells.on("dblclick.zoomcell", function(d) {
        x.domain([d.startTime, d.endTime + 1]);
        zoom.x(x);

        redraw(250);
      });
    }


    function getLineTimes(prof, files) {
      // Drop entries with null or "" filename
      prof = prof.filter(function(row) {
        return row.filename !== null &&
               row.filename !== "";
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
            times: [],
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
          var times = leaves.map(function(d) { return d.time; });

          return {
            filename: leaves[0].filename,
            linenum: leaves[0].linenum,
            times: times,
            sumTime: times.length
          };
        })
        .entries(prof);

      // Insert the times and sumTimes into line content data
      timeData.forEach(function(fileInfo) {
        // Find item in fileTimes that matches the file of this fileInfo object
        var fileLineData = fileLineTimes.filter(function(d) {
          return d.filename === fileInfo.key;
        })[0].lineData;

        fileInfo.values.forEach(function(lineInfo) {
          lineInfo = lineInfo.values;
          fileLineData[lineInfo.linenum - 1].times = lineInfo.times;
          fileLineData[lineInfo.linenum - 1].sumTime = lineInfo.sumTime;
        });
      });

      calcProportionalTimes(fileLineTimes);

      return fileLineTimes;
    }


    // Highlights line of code and flamegraph blocks corresponding to a
    // filenum. linenum and, if provided, label combination. (When this is called
    // from hovering over code, no label is provided.)
    // If only a label is provided, search for cells (only in the flamegraph) that
    // have the same label.
    function highlightSelectedCode(filename, linenum, label) {
      // Un-highlight lines of code
      vis.codeTableRows.classed({ selected: false });

      // Un-highlight flamegraph blocks
      vis.flameGraphCells
        .select('.rect.selected')
        .classed({ selected: false });

      if (filename && linenum) {
        // If we have filename and linenum, search for cells that match, and
        // set them as "selected".
        var tr = vis.codeTableRows.filter(function(d) {
            return d.linenum === linenum && d.filename === filename;
          })
          .classed({ selected: true });

        // Highlight corresponding flamegraph blocks
        vis.flameGraphCells.select('.rect')
          .filter(function(d) {
            // Check for filename and linenum match, and if provided, a label match.
            var match = d.filename === filename && d.linenum === linenum;
            if (!!label) {
              match = match && (d.label === label);
            }
            return match;
          })
          .classed({ selected: true });

        tr.node().scrollIntoViewIfNeeded();

      } else if (label) {
        // Don't highlight blocks for these labels
        var exclusions = ["<Anonymous>", "FUN"];
        if (exclusions.some(function(x) { return label === x; })) {
          return;
        }

        // If we only have the label, search for cells that match.
        // Highlight corresponding flamegraph blocks
        d3.selectAll('.profvis-flamegraph-inner .cell .rect')
          .filter(function(d) { return (d.label === label); })
          .classed({ selected: true });
      }
   }

    return vis;
  };  // profvis.render()



  // Calculate proportional times, relative to the longest time in the data
  // set. Modifies data in place.
  function calcProportionalTimes(timeData) {
    var fileTimes = timeData.map(function(fileData) {
      var lineTimes = fileData.lineData.map(function(x) { return x.sumTime; });
      return d3.max(lineTimes);
    });

    var maxTime = d3.max(fileTimes);

    timeData.map(function(fileData) {
      fileData.lineData.map(function(lineData) {
        lineData.propTime = lineData.sumTime / maxTime;
      });
    });

  }


  // Given raw profiling data and a list of vertical sequences to collapse,
  // collapse those sequences and replace them with one element named
  // "<<Collapsed>>".
  function collapseStacks(prof, collapseList) {

    function arraysEqual(a, b) {
      return (a.length === b.length) && a.every(function(element, i) {
        return element === b[i];
      });
    }

    // Match one array sequence in another array. If found, return start and
    // end indices; if not found, return null.
    function matchSequence(pattern, data) {
      var noffsets = data.length - pattern.length + 1;

      for (var offset=0; offset<noffsets; offset++) {
        var dataSlice = data.slice(offset, offset + pattern.length);
        if (arraysEqual(pattern, dataSlice)) {
          return [offset, offset + pattern.length - 1];
        }
      }
      return null;
    }

    // Convert object with arrays to array of objects with key and value.
    collapseList = d3.entries(collapseList);

    var data = d3.nest()
      .key(function(d) { return d.time; })
      .rollup(function(leaves) {
        leaves = leaves.sort(function(a, b) { return a.depth - b.depth; });
        collapseList.forEach(function(collapseSeq) {
          var name = collapseSeq.key;
          var sequence = collapseSeq.value;
          var matchIdx;

          // Search for the collapse sequence and repeat until no more matches
          // are found.
          do {
            var labels = leaves.map(function(d) { return d.label; });
            matchIdx = matchSequence(sequence, labels);
            // If we matched a sequence, remove that sequence and insert the
            // <<Collapsed>> entry.
            if (!!matchIdx) {
              var newLeaf = {
                time: leaves[matchIdx[0]].time,
                depth: leaves[matchIdx[0]].depth,
                label: "<<Collapsed " + name + ">>",
                filenum: null,
                filename: null,
                linenum: null
              };
              leaves.splice(matchIdx[0], matchIdx[1] - matchIdx[0] + 1,
                            newLeaf);
            }
          } while (!!matchIdx);
        });

        // Recalculate depths so that collapsed stacks are contiguous.
        var startDepth = leaves[0].depth;
        leaves.map(function(d, i) {
          d.depth = startDepth + i;
        });

        return leaves;
      })
      .map(prof);

    // Un-nest (flatten) the data
    data = d3.merge(d3.map(data).values());
    return data;
  }


  // Given raw profiling data, consolidate consecutive blocks for a flamegraph
  function consolidateRuns(prof) {
    var data = d3.nest()
      .key(function(d) { return d.depth; })
      .rollup(function(leaves) {
        leaves = leaves.sort(function(a, b) { return a.time - b.time; });

        // Collapse consecutive leaves with the same fun
        var startLeaf = null;  // leaf starting this run
        var lastLeaf = null;   // The last leaf we've looked at
        var newLeaves = [];
        for (var i=0; i<leaves.length; i++) {
          var leaf = leaves[i];

          if (i === 0) {
            startLeaf = leaf;

          } else if (leaf.time !== lastLeaf.time + 1 ||
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
              startTime: startLeaf.time,
              endTime:   lastLeaf.time
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
          startTime: startLeaf.time,
          endTime:   lastLeaf.time
        });

        return newLeaves;
      })
      .map(prof);

    // Un-nest (flatten) the data
    data = d3.merge(d3.map(data).values());

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
