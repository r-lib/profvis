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

    var content = '<table class="profvis-table">';

    for (var i=0; i < allFileTimes.length; i++) {
      var fileData = allFileTimes[i];

      content += '<tr><th>' + fileData.filename + '</th><th></th></tr>';

      for (var j=0; j<fileData.lineData.length; j++) {
        var line = fileData.lineData[j];
        content += "<tr>" +
          '<td class="code"><pre><code>' + escapeHTML(line.content) + '</code></pre></td>' +
          '<td class="time">' + (Math.round(line.sumTime * 100) / 100) + '</td>' +
          '<td class="timebar">' +
            '<div style="width: ' + Math.round(line.propTime * 100) + '%; background-color: black;">&nbsp;</div>' +
          '</td>' +
          '<td class="timehist" data-filename="' + line.filename +
              '" data-linenum="' + line.lineNum + '">' +
            '<div></div>' +
          '</td>' +
          '</tr>';
      }
    }
    content += "</table>";

    el.innerHTML = content;


    // Calculate longest time sample
    var maxTime = d3.max(allFileTimes, function(fileData) {
      return d3.max(fileData.lineData, function(line) {
        return d3.max(line.times);
      });
    });

    var width = 100;
    var height = 15;
    var x = d3.scale.linear()
      .domain([0, maxTime])
      .range([0, width]);

    // Add histograms for each line
    allFileTimes.map(function(fileData) {
      fileData.lineData.map(function(line) {
        if (line.times.length === 0) return;

        // Generate a histogram using twenty uniformly-spaced bins.
        var data = d3.layout.histogram()
          .bins(x.ticks(10))
          (line.times);

        var y = d3.scale.linear()
          .domain([0, d3.max(data, function(d) { return d.y; })])
          .range([height, 0]);

        var svg = d3
          .select('[data-filename="' + line.filename + '"][data-linenum="' + line.lineNum + '"] div').append('svg')
            .attr("width", width)
            .attr("height", height)
          .append("g");

        svg.append("rect")
          .attr("width", "100%")
          .attr("height", "100%")
          .attr("opacity", 0.05);


        var bar = svg.selectAll(".bar")
            .data(data)
          .enter().append("g")
            .attr("class", "bar")
            .attr("transform", function(d) { return "translate(" + x(d.x) + "," + y(d.y) + ")"; });

        bar.append("rect")
            .attr("x", 1)
            .attr("width", x(data[0].dx) - 1)
            .attr("height", function(d) { return height - y(d.y); });
      });

    });

    return content;
  };


  profvis.generateFlameGraph = function(el, message) {
    // TODO:
    // draw a box at each time and each depth
    // draw text at each one
    // Then figure out how to merge
    //  - set a min and max, draw a box for each min and max.
    var prof = colToRows(message.prof);

    var width = 500;
    var height = 500;

    var x = d3.scale.linear()
      .domain([0, d3.max(prof, function(d) { return d.time; })])
      .range([0, width]);

    var y = d3.scale.linear()
      .domain([0, d3.max(prof, function(d) { return d.depth; })])
      .range([height, 0]);

    var w = x(1);
    var h = y(0) - y(1);

    var svg = d3.select(el).append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g');

    var rect = svg.selectAll(".cell")
        .data(prof)
      .enter().append("svg:rect")
        .attr("class", "cell")
        .attr("x", function(d) { return x(d.time); })
        .attr("y", function(d) { return y(d.depth); })
        .attr("width", w)
        .attr("height", h);
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
          lineNum: i + 1,
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
