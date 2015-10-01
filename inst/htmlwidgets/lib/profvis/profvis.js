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

  profvis.generateTable = function(el, message) {
    // Convert object-with-arrays format prof data to array-of-objects format
    var prof = colToRows(message.prof);

    var allFileTimes = getLineTimes(prof, message.files);

    var content = '<div class="profvis-table-inner">';

    for (var i=0; i < allFileTimes.length; i++) {
      var fileData = allFileTimes[i];

      content += '<table class="profvis-table" data-filename="' + fileData.filename + '">' +
        '<tr><th colspan="4">' + fileData.filename + '</th></tr>';

      for (var j=0; j<fileData.lineData.length; j++) {
        var line = fileData.lineData[j];
        content += '<tr data-linenum="' + line.linenum + '">' +
          '<td class="linenum"><code>' + line.linenum + '</code></td>' +
          '<td class="code"><code>' + escapeHTML(line.content) + '</code></td>' +
          '<td class="time">' + (Math.round(line.sumTime * 100) / 100) + '</td>' +
          '<td class="timebar">' +
            '<div style="width: ' + Math.round(line.propTime * 100) + '%; background-color: black;">&nbsp;</div>' +
          '</td>' +
          '</tr>';
      }

      content += '</table>';
    }

    content += '</div>';

    el.innerHTML = content;

    // Handle mousing over code
    // Get the DOM element with the table
    content = el.querySelector('.profvis-table-inner');

    content.addEventListener('mousemove', function(e) {
      var tr = selectAncestor('tr', e.target, content);
      if (!tr) return;
      var table = selectAncestor('table', tr, content);
      var filename = table.dataset.filename;
      var linenum = +tr.dataset.linenum;

      highlightSelectedCode(filename, linenum);
    });

    content.addEventListener('mouseout', function(e) {
      // Un-highlight all code
      d3.select(content).selectAll('.selected')
        .classed({ selected: false });
    });

    // Calculate longest time sample
    var maxTime = d3.max(allFileTimes, function(fileData) {
      return d3.max(fileData.lineData, function(line) {
        return d3.max(line.times);
      });
    });

    return content;
  };


  profvis.generateFlameGraph = function(el, message) {
    var stackHeight = 15;   // Height of each layer on the stack, in pixels

    // Process data ---------------------------------------------------
    var prof = colToRows(message.prof);
    prof = consolidateRuns(prof);

    // Size of virtual graphing area ----------------------------------
    // (Can differ from visible area)
    var xDomain = [
      d3.min(prof, function(d) { return d.startTime; }),
      d3.max(prof, function(d) { return d.endTime; })
    ];
    var yDomain = d3.extent(prof, function(d) { return d.depth; });

    // Scales
    var x = d3.scale.linear()
      .domain(xDomain)
      .range([0, el.clientWidth]);

    var y = d3.scale.linear()
      .domain(yDomain)
      .range([(yDomain[1] - yDomain[0]) * stackHeight, 0]);

    // Creat SVG objects ----------------------------------------------
    var wrapper = d3.select(el).append('div')
      .attr('class', 'profvis-flamegraph-inner');

    var svg = wrapper.append('svg')
      .attr('width', el.clientWidth)
      .attr('height', el.clientHeight);

    var container = svg.append('g');

    // Add a background rect so we have something to grab for zooming/panning
    var backgroundRect = container.append("rect")
      .attr("class", "background")
      .attr("width", el.clientWidth)
      .attr("height", el.clientHeight);

    var cells = container.selectAll(".cell")
      .data(prof)
      .enter()
      .append("g")
        .attr("class", "cell");

    var rects = cells.append("rect")
      .attr("class", "rect")
      .classed("highlighted", function(d) { return d.filename !== null; });

    var text = cells.append("text")
      .attr("class", "label")
      .text(function(d) { return d.label; });

    // Calculate whether to display text in each cell -----------------
    // Cache the width of text. This is a lookup table which, given the number
    // of characters, gives the number of pixels.
    var textWidthTable = [];
    function getTextWidth(el, nchar) {
      // Add entry if it doesn't already exist
      if (textWidthTable[nchar] === undefined) {
        textWidthTable[nchar] = el.getBoundingClientRect().width;
      }
      return textWidthTable[nchar];
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

    // Show labels that fit in the corresponding rectangle, and hide others.
    // This is very slow because of the getBoundingClientRect() calls.
    function updateTextVisibility() {
      text.attr("visibility", function(d) {
        var scale = zoom ? zoom.scale() : 1;

        var textWidth = getTextWidth(this, d.label.length);
        var boxWidth = scale * getRectWidth(this.parentNode.querySelector(".rect"),
                                            d.endTime - d.startTime + 1);

        return (textWidth <= boxWidth) ? "visible" : "hidden";
      });
    }
    var updateTextVisibilityDebounced = debounce(updateTextVisibility, 100);

    // Update positions when scales change ----------------------------
    function redraw(duration) {
      if (duration === undefined) duration = 0;

      // Make local copies because we may be adding transitions
      var rects2 = rects;
      var text2 = text;

      // Only add the transition if needed (duration!=0) because there's a
      // performance penalty
      if (duration !== 0) {
        rects2 = rects2.transition().duration(duration);
        text2 = text2.transition().duration(duration);
      }

      rects2
        .attr("width", function(d) { return x(d.endTime + 1) - x(d.startTime); })
        .attr("height", y(0) - y(1))
        .attr("x", function(d) { return x(d.startTime); })
        .attr("y", function(d) { return y(d.depth + 1); });

      text2
        .attr("x", function(d) { return (x(d.endTime + 1) + x(d.startTime)) / 2; })
        .attr("y", function(d) { return y(d.depth + 0.5); });

      updateTextVisibilityDebounced();
    }

    redraw();
    updateTextVisibility(); // Call immediately the first time

    // Recalculate dimensions on resize
    function onResize() {
      svg
        .attr('width', el.clientWidth)
        .attr('height', el.clientHeight);

      backgroundRect
        .attr("width", el.clientWidth)
        .attr("height", el.clientHeight);

      // Update the x range so that we're able to double-click on a block to
      // zoom, and have it fill the whole x width.
      x.range([0, el.clientWidth]);
      redraw()
    }
    d3.select(window).on("resize", onResize);

    // Attach mouse event handlers ------------------------------------
    cells
      .on("mouseover", function(d) {
        highlightSelectedCode(d.filename, d.linenum, d.label);

        // If no text currently shown, display a tooltip
        var label = this.querySelector(".label");
        if (label.getAttribute("visibility") !== "visible") {
          var labelBox = label.getBBox();
          showTooltip(
            d.label,
            labelBox.x + labelBox.width / 2,
            labelBox.y - labelBox.height - 5
          );
        }
      })
      .on("mouseout", function(d) {
        highlightSelectedCode(null, null, null);

        hideTooltip();
      });


    // Tooltip --------------------------------------------------------
    var tooltip = container.append("g").attr("class", "tooltip");
    var tooltipRect = tooltip.append("rect");
    var tooltipText = tooltip.append("text");

    function showTooltip(text, x, y) {
      tooltip.attr("visibility", "visible");

      // Add text
      tooltipText.text(text)
        .attr("x", x)
        .attr("y", y);

      // Add box around text
      var textBox = tooltipText.node().getBBox();
      var rectWidth = textBox.width + 10;
      var rectHeight = textBox.height + 4;
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
    var initialXdomain = x.domain();
    cells.on("dblclick.zoomcell", function(d) {
      // Get desired scaling factor. The original x domain corresponds to
      // zoom.scale()===1, so we divide that by our desired x domain.
      var scaleFactor = (initialXdomain[1] - initialXdomain[0]) / (d.endTime - d.startTime);

      // Rescale and translate so the block fills the x range
      zoom
        .scale(scaleFactor)
        .translate([x(0) - x(d.startTime), zoom.translate()[1]]);

      redraw(250);
    });
  };


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

          } else if (leaf.time !== lastLeaf.time + 1 || leaf.label !== startLeaf.label) {
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


  // Highlights line of code and flamegraph blocks corresponding to a
  // filenum-linenum combination. If there's no filename and linenum, search
  // for cells (only in the flamegraph) that have the same label.
  function highlightSelectedCode(filename, linenum, label) {
    // Un-highlight lines of code
    var content = document.querySelector('.profvis-code');
    d3.select(content).selectAll('.selected')
      .classed({ selected: false });

    // Un-highlight flamegraph blocks
    d3.selectAll('.profvis-flamegraph-inner .cell .rect.selected')
      .classed({ selected: false });

    if (filename && linenum) {
      // If we have filename and linenum, search for cells that match.
      var tr = document.querySelector('[data-filename="' + filename +'"] ' +
                                      '[data-linenum="' + linenum + '"]');
      // Highlight line of code
      d3.select(tr).classed({ selected: true });
      tr.scrollIntoViewIfNeeded();

    // Highlight corresponding flamegraph blocks
    d3.selectAll('.profvis-flamegraph-inner .cell .rect')
      .filter(function(d) {
        return (d.filename === filename && d.linenum === linenum);
      })
      .classed({ selected: true });

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
