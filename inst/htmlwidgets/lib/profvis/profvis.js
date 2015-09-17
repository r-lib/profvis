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
    prof.forEach(function(x) {
      x.ref = colToRows(x.ref);
    });

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

  function getLineTimes(prof, files) {
    // Calculate times for each file
    var times = files.map(function(file) {
      var data = simplifyRef(prof, file.filename);

      data = d3.nest()
        .key(function(d) { return d.file; })
        .key(function(d) { return d.lineNum; })
        .rollup(function(leaves) {
          var times = leaves.map(function(d) { return d.time; });

          return {
            file: leaves[0].file,
            lineNum: leaves[0].lineNum,
            times: times,
            sumTime: d3.sum(times)
          };
        })
        .map(data);


      // Create array of objects with info for each line of code.
      var lines = file.content.split("\n");
      var lineData = [];
      for (var i=0; i<lines.length; i++) {
        lineData[i] = {
          filename: file.filename,
          lineNum: i + 1,
          content: lines[i],
          times: [],
          sumTime: 0
        };
      }

      // Copy times from `data` to `lineData`.
      d3.map(data).forEach(function(temp, fileInfo) {
        d3.map(fileInfo).forEach(function(temp, lineInfo) {
          lineData[lineInfo.lineNum - 1].times = lineInfo.times;
          lineData[lineInfo.lineNum - 1].sumTime = lineInfo.sumTime;
        });
      });

      return {
        filename: file.filename,
        lineData: lineData
      };
    });

    calcProportionalTimes(times);

    return times;
  }


  // Calculate proportional times, relative to the longest time in the data
  // set. Modifies data in place.
  function calcProportionalTimes(times) {
    var fileTimes = times.map(function(fileData) {
      var lineTimes = fileData.lineData.map(function(x) { return x.sumTime; });
      return d3.max(lineTimes);
    });

    var maxTime = d3.max(fileTimes);

    times.map(function(fileData) {
      fileData.lineData.map(function(lineData) {
        lineData.propTime = lineData.sumTime / maxTime;
      });
    });

  }

  // Simplify an array of profile data objects based on the object's ref's
  // filename and line number combinations.
  function simplifyRef(prof, file) {
    // Find the file and line number in the ref, discarding all other
    // ref content. If there are multiple matches for the file in a single ref,
    // return an item for each match.
    var data = prof.map(function(item) {
      var matchRows = item.ref
        .filter(function(row) {
          return row.path === file;
        });

      var res = matchRows.map(function(row) {
        return {
          file: row.path,
          lineNum: row.line,
          time: item.time
        };
      });

      return res;
    });

    // Flatten the array of arrays
    return d3.merge(data);
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
