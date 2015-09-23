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
        '<tr><th>' + fileData.filename + '</th><th></th></tr>';

      for (var j=0; j<fileData.lineData.length; j++) {
        var line = fileData.lineData[j];
        content += '<tr data-linenum="' + line.linenum + '">' +
          '<td class="code"><pre><code>' + escapeHTML(line.content) + '</code></pre></td>' +
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

    function mouseOverCodeHandler(e) {
      var tr = selectAncestor('tr', e.target, content);
      if (!tr) return;
      var table = selectAncestor('table', tr, content);
      var filename = table.dataset.filename;
      var linenum = +tr.dataset.linenum;

      // Un-highlight all code
      d3.select(content).selectAll('.highlighted')
        .classed({ highlighted: false });

      // Highlight line of code
      d3.select(tr).classed({ highlighted: true });

      // Highlight corresponding flame blocks, and un-highlight other blocks
      d3.selectAll('.profvis-flamegraph-inner .cell .rect')
        .each(function(d) {
          if (d.filename === filename && d.linenum === linenum) {
            d3.select(this).style('stroke-width', 1);
          } else {
            d3.select(this).style('stroke-width', 0.25);
          }
        });
    }

    content.addEventListener('mousemove', mouseOverCodeHandler);
    content.addEventListener('mouseout', function(e) {
      // Un-highlight all code
      d3.select(content).selectAll('.highlighted')
        .classed({ highlighted: false });

      d3.selectAll('.profvis-flamegraph-inner .cell .rect')
        .style('stroke-width', 0.25);
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
    var stackHeight = 16;   // Height of each layer on the stack, in pixels

    var prof = colToRows(message.prof);
    prof = filterProfvisFrames(prof);
    prof = consolidateRuns(prof);

    var width = 500;

    var x = d3.scale.linear()
      .domain([
        d3.min(prof, function(d) { return d.startTime; }),
        d3.max(prof, function(d) { return d.endTime; })
      ])
      .range([0, width - 2]);

    var ymin = d3.min(prof, function(d) { return d.depth; }) - 1;
    var ymax = d3.max(prof, function(d) { return d.depth; }) + 1;
    var height = (ymax - ymin) * stackHeight;

    var y = d3.scale.linear()
      .domain([ymin, ymax])
      .range([height - 2, 0]);

    var wrapper = d3.select(el).append('div')
      .attr('class', 'profvis-flamegraph-inner');

    var svg = wrapper.append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g');

    var cells = svg.selectAll(".cell")
      .data(prof)
      .enter()
      .append("g")
        .attr("class", "cell");

    var rects = cells.append("rect")
      .attr("class", "rect")
      .attr("x", function(d) { return x(d.startTime); })
      .attr("y", function(d) { return y(d.depth + 1); })
      .attr("width", function(d) { return x(d.endTime+1) - x(d.startTime); })
      .attr("height", y(0) - y(1))
      .attr("fill", function(d) {
        return (d.filename !== null) ? "#ffd" : "#eee";
      })
      .style("stroke", "black")
      .style("stroke-width", 0.25);

    var text = cells.append("text")
      .attr("x", function(d) { return x((d.endTime + d.startTime) / 2); })
      .attr("y", function(d) { return y(d.depth) - 3; })
      .style("text-anchor", "middle")
      .style("font-family", "monospace")
      .style("font-size", "11px")
      .text(function(d) { return d.label; });

    // Remove labels that are wider than the corresponding rectangle
    text.filter(function(d) {
        var textWidth = this.getBBox().width;
        var boxWidth = this.parentNode.querySelector(".rect").getBBox().width;
        return textWidth > boxWidth;
      })
      .remove();


    // Attach mouse event handlers
    cells
      .on("mouseover", function(d) {
        var rect = this.querySelector(".rect");
        d3.select(rect).style("fill", "#ccc")
          .style("stroke-width", 1);

        highlightCodeLine(d.filename, d.linenum);
      })
      .on("mouseout", function(d) {
        var color = (d.filename !== null) ? "#ffd" : "#eee";
        var rect = this.querySelector(".rect");
        d3.select(rect).style("fill", color)
          .style("stroke-width", 0.25);

        unHighlightCodeLine(d.filename, d.linenum);
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


  // Remove frames from the call stack that are profvis-related overhead
  function filterProfvisFrames(prof) {
    var forceFrames = prof.filter(function(d) { return d.label === "force"; });
    var minDepth = d3.min(forceFrames, function(d) { return d.depth; });

    return prof.filter(function(d) { return d.depth > minDepth; });
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


  function selectCodeLine(filename, linenum) {
    return document.querySelector(
      '[data-filename="' + filename +'"] ' +
      '[data-linenum="' + linenum + '"]');
  }

  function highlightCodeLine(filename, linenum) {
    if (!filename || !linenum)
      return;
    var row = selectCodeLine(filename, linenum);
    d3.select(row).classed({ highlighted: true });

    row.scrollIntoView(true);
  }

  function unHighlightCodeLine(filename, linenum) {
    if (!filename || !linenum)
      return;
    var row = selectCodeLine(filename, linenum);
    d3.select(row).classed({ highlighted: false });
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


  return profvis;
})();
